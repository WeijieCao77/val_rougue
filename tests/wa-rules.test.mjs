import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeason,act,instance,startBattle,replay,legalActions,intent,restHeal,rollGear} from '../engine.js';
import {buildMap} from '../season-map.js';
import {CARDS,ENEMIES,REGIONS} from '../content.js';
import {createWaSeason,waAct,extractCheckpoints} from '../wa-season.js';
import {createMatch,applyCommand,viewFor} from '../online/duel.mjs';
import {OPENING_FREE,OPENING_TRADE,ENEMY_TUNING,TRAIT_TUNING,GEAR,SUPPLIES,REGION_TRAITS,ASCENSION_LEVELS} from '../wa-rules.js';

const step=(s,a)=>{const r=act(s,a);assert.equal(r.error,null,JSON.stringify(a)+' '+r.error);return r.state;};
const rules=(seed='r1',region='CN',ascension=0)=>createSeason(seed,false,region,{rules:1,ascension});
// A rules-1 run past the opening, standing in its first fight with a chosen hand.
function fight(region,hand,{seed='fight',ascension=0,skins=[]}={}){
 let s=rules(seed,region,ascension);s=step(s,{type:'opening',choice:'trainRandom'});
 s.skins.push(...skins);s=step(s,{type:'chooseNode',key:s.map.starts[0]});
 const b=s.battle;b.hand=hand.map(id=>instance(s,id));b.draw=[];b.discard=[];b.energy=9;b.enemyHp=200;b.enemyBlock=0;b.enemyWeak=0;b.enemyVulnerable=0;b.enemyStrength=0;b.block=0;b.plays=0;b.tt={roles:[],dmg:0,nonDmg:0};
 return s;
}
const playId=(s,id)=>step(s,{type:'play',uid:s.battle.hand.find(c=>c.id===id).uid});

test('legacy season creation is untouched: no rules fields, no opening',()=>{
 const s=createSeason('legacy-check',false,'PAC');
 assert.equal(s.phase,'map');for(const k of ['rules','ascension','supplies','opening'])assert.ok(!(k in s),k);
 assert.throws(()=>createSeason('x',false,'CN',{ascension:3}),/难度/);
 assert.throws(()=>createSeason('x',false,'CN',{rules:2}),/规则/);
 assert.throws(()=>createSeason('x',false,'CN',{rules:1,ascension:11}),/难度/);
});

test('sponsor signing day: two free bonuses, one trade-off, one basic option, seeded and replayable',()=>{
 const seen=new Set();
 for(let i=0;i<40;i++){
  const s=rules('open-'+i,Object.keys(REGIONS)[i%4]);
  assert.equal(s.phase,'opening');const ids=s.opening.options.map(o=>o.id);
  assert.equal(ids.length,4);assert.ok(OPENING_FREE.includes(ids[0])&&OPENING_FREE.includes(ids[1])&&ids[0]!==ids[1]);
  assert.ok(OPENING_TRADE.includes(ids[2]));assert.equal(ids[3],'trainRandom');ids.forEach(id=>seen.add(id));
  assert.deepEqual(rules('open-'+i,Object.keys(REGIONS)[i%4]).opening,s.opening,'same seed, same contracts');
  assert.ok(legalActions(s).filter(a=>a.type==='opening').length>=3);
  assert.equal(legalActions(s).some(a=>a.type==='chooseNode'),false,'map is closed until a contract is signed');
 }
 assert.equal(seen.size,9);
 let s=rules('open-hp');s.opening.options[0]={id:'hp8'};s=step(s,{type:'opening',choice:'hp8'});
 assert.equal(s.maxHp,88);assert.equal(s.hp,88);assert.equal(s.phase,'map');assert.equal(s.openingChoice,'hp8');
});

test('opening picks: free picks can go back, trade-offs cannot, and every path replays exactly',()=>{
 let s=rules('open-pick');s.opening.options=[{id:'remove1'},{id:'train1'},{id:'moneyForTrain'},s.opening.options[3]];
 // Fixture mutation above is not an action; replay a clean run instead for the equality check below.
 s=step(s,{type:'opening',choice:'remove1'});assert.equal(s.phase,'openingPick');s=step(s,{type:'openingBack'});assert.equal(s.phase,'opening');
 const deck=s.deck.length;s=step(s,{type:'opening',choice:'remove1'});s=step(s,{type:'openingPick',uid:s.deck[1].uid});assert.equal(s.deck.length,deck-1);assert.equal(s.phase,'map');
 let t=rules('open-pick');t.opening.options[2]={id:'moneyForTrain'};t=step(t,{type:'opening',choice:'moneyForTrain'});assert.equal(t.money,0);
 assert.ok(act(t,{type:'openingBack'}).error);t=step(t,{type:'openingPick',uid:t.deck[0].uid});assert.equal(t.phase,'openingPick');t=step(t,{type:'openingPick',uid:t.deck[1].uid});
 assert.equal(t.deck.filter(c=>c.up).length,2);assert.equal(t.phase,'map');
 for(let i=0;i<12;i++){
  let r=rules('open-replay-'+i,Object.keys(REGIONS)[i%4],i%11);
  while(r.phase!=='map'){const a=legalActions(r).find(a=>a.type==='opening'||a.type==='openingPick');r=step(r,a);}
  r=step(r,{type:'chooseNode',key:r.map.starts[0]});r=step(r,{type:'end'});
  assert.deepEqual(replay(r),r);
 }
});

test('difficulty levels scale opponents, reputation, rest and map exactly as listed',()=>{
 assert.equal(ASCENSION_LEVELS.length,11);
 const base=fightAt(0),a7=fightAt(7),a2=fightAt(2);
 function fightAt(asc){let s=rules('asc',"CN",asc);s=step(s,{type:'opening',choice:'trainRandom'});return step(s,{type:'chooseNode',key:s.map.starts[0]});}
 const e=ENEMIES[base.battle.enemy],tune=ENEMY_TUNING[1].normal;
 assert.equal(base.battle.enemyHp,Math.round(e.hp*tune.hp));assert.equal(a7.battle.enemyHp,Math.round(e.hp*tune.hp*1.1));
 const hit=ENEMIES[base.battle.enemy].script[0].find(x=>x.type==='hit').n;
 assert.equal(intent(base)[0].n,Math.round(hit*tune.dmg));assert.equal(intent(a2)[0].n,Math.round(hit*tune.dmg*1.1));
 assert.equal(rules('a6','CN',6).hp,72);assert.equal(rules('a5','CN',5).maxHp,80);
 assert.equal(rules('a9','CN',9).deck.filter(c=>c.id.startsWith('CU')).length,1);assert.equal(rules('a8','CN',8).deck.filter(c=>c.id.startsWith('CU')).length,0);
 let r=rules('rest','CN',5);r.hp=20;assert.equal(restHeal(r),16);r=rules('rest','CN',4);r.hp=20;assert.equal(restHeal(r),24);
 let elites0=0,elites1=0;for(let i=0;i<30;i++)for(const act of [1,2,3]){elites0+=buildMap('m'+i,act).nodes.filter(n=>n.kind==='elite').length;elites1+=buildMap('m'+i,act,1).nodes.filter(n=>n.kind==='elite').length;}
 assert.ok(elites1>elites0*1.4,`${elites1} vs ${elites0}`);
 assert.deepEqual(buildMap('same',2),buildMap('same',2,0),'level 0 maps are the original maps');
 let boss=rules('boss10','CN',10);boss=step(boss,{type:'opening',choice:'trainRandom'});boss.currentNode=boss.map.bossId;startBattle(boss,boss.map.nodes.find(n=>n.key===boss.map.bossId).enemy);assert.equal(boss.battle.enemyStrength,3);
});

test('CN team play: third distinct role in a turn gives action points and a card, once per turn',()=>{
 let s=fight('CN',['CN03','CN07','CN11','CN14','CN03']);s.battle.draw=[instance(s,'CN04'),instance(s,'CN04')];
 s=playId(s,'CN03');s=playId(s,'CN07');assert.equal(s.battle.energy,7);
 s=playId(s,'CN11');assert.equal(s.battle.energy,9-3+TRAIT_TUNING.CN.energy);assert.equal(s.battle.hand.filter(c=>c.id==='CN04').length,1);
 s=playId(s,'CN14');assert.equal(s.battle.tt.cnDone,true);assert.equal(s.battle.energy,9-4+TRAIT_TUNING.CN.energy,'fourth role does not trigger again');
});

test('AM consecutive attack: the nth damaging card each turn gets bonus damage and applies vulnerable',()=>{
 const T=TRAIT_TUNING.AM,base=CARDS.CN03.effects[0].n;
 let s=fight('AM',[...Array(T.nth).fill('CN03'),'CN07','CN04']);
 for(let k=1;k<T.nth;k++)s=playId(s,'CN03');
 s=playId(s,'CN07');assert.equal(s.battle.tt.dmg,T.nth-1,'a block-only card is not a damaging card');assert.equal(s.battle.enemyVulnerable,0);
 const before=s.battle.enemyHp;s=playId(s,'CN03');
 assert.equal(before-s.battle.enemyHp,base+T.bonus);assert.equal(s.battle.enemyVulnerable,T.vuln);
 const multi=CARDS.CN04.effects[0],mid=s.battle.enemyHp;s=playId(s,'CN04');
 assert.equal(mid-s.battle.enemyHp,Math.floor(multi.n*1.5)*multi.times,'later damaging cards get no bonus, only the vulnerable');
});
test('EMEA counter-press: extra block while the opponent is suppressed; first suppression each turn draws',()=>{
 let s=fight('EMEA',['CN07','CN10','CN10','CN07']);s.battle.draw=[instance(s,'EU03'),instance(s,'EU03')];
 const blockCard=CARDS.CN07.effects[0].n;
 s=playId(s,'CN07');assert.equal(s.battle.block,blockCard);
 s=playId(s,'CN10');assert.equal(s.battle.hand.filter(c=>c.id==='EU03').length,1,'first suppression draws');
 s=playId(s,'CN10');assert.equal(s.battle.hand.filter(c=>c.id==='EU03').length,1,'second suppression this turn does not');
 const before=s.battle.block;s=playId(s,'CN07');assert.equal(s.battle.block-before,blockCard+TRAIT_TUNING.EMEA.block);
});
test('PAC improvisation: alternating temporary card each turn; every 3rd temporary card played gives 1 action point',()=>{
 let s=rules('pac','PAC');s=step(s,{type:'opening',choice:'trainRandom'});s=step(s,{type:'chooseNode',key:s.map.starts[0]});
 assert.equal(s.battle.hand.filter(c=>c.id==='TK01').length,1);assert.equal(s.battle.hand.length,6);
 s.battle.hand=[];s=step(s,{type:'end'});assert.ok(s.battle.hand.some(c=>c.id==='TK02'));
 s=fight('PAC',['TK01','TK02','TK01']);s.battle.energy=0;s=playId(s,'TK01');s=playId(s,'TK02');assert.equal(s.battle.energy,0);s=playId(s,'TK01');assert.equal(s.battle.energy,TRAIT_TUNING.PAC.energy);
});

test('PvP matches apply the same region traits from the snapshot region',()=>{
 const snap=(id,region,deck)=>({runId:id,act:1,version:'wa-pvp-1',seed:'s'+id,region,deck:deck.map((c,i)=>({uid:id+i,id:c,up:false})),skins:[],maxHp:60,hp:60,money:0,actionsCount:0});
 let m=createMatch(snap('p','PAC',Array(10).fill('PA07')),snap('c','CN',['CN03','CN07','CN11','CN14','CN03','CN07','CN11','CN14','CN03','CN07']),'pvp-trait');
 const pacSeat=0,pac=m.players[pacSeat];
 if(m.active===pacSeat)assert.equal(pac.hand.filter(c=>c.id==='TK01').length,1);
 assert.equal(viewFor(m,0).you.trait.region,'PAC');assert.equal(viewFor(m,1).opponent.trait.region,'PAC');
 if(m.active!==1)m=applyCommand(m,m.active,{type:'end'});
 const cn=m.players[1];cn.energy=9;cn.hand=[{uid:'x1',id:'CN03',up:false},{uid:'x2',id:'CN07',up:false},{uid:'x3',id:'CN11',up:false}];cn.drawPile=[{uid:'x4',id:'CN04',up:false}];
 for(const uid of ['x1','x2','x3'])m=applyCommand(m,1,{type:'play',uid});
 assert.equal(m.players[1].energy,9-3+TRAIT_TUNING.CN.energy);assert.ok(m.players[1].hand.some(c=>c.uid==='x4'));
 const emea=createMatch(snap('e','EMEA',Array(10).fill('EU07')),snap('f','AM',Array(10).fill('AM07')),'pvp-emea');
 const seat=emea.players.findIndex(p=>p.region==='EMEA');let e=emea;if(e.active!==seat)e=applyCommand(e,e.active,{type:'end'});
 e.players[1-seat].weak=1;e.players[seat].block=0;e.players[seat].energy=3;e.players[seat].hand=[{uid:'b1',id:'EU07',up:false}];
 e=applyCommand(e,seat,{type:'play',uid:'b1'});assert.equal(e.players[seat].block,CARDS.EU07.effects[0].n+TRAIT_TUNING.EMEA.block);
});

test('equipment: elite always drops one, boss offers three boss items, energy items add action points',()=>{
 let s=rules('gear');s=step(s,{type:'opening',choice:'trainRandom'});
 const elite=s.map.nodes.find(n=>n.kind==='elite');s.currentNode=elite.key;startBattle(s,elite.enemy);s.battle.enemyHp=1;s.battle.hand=[instance(s,'CN03')];s.battle.energy=3;
 s=playId(s,'CN03');assert.equal(s.phase,'reward');assert.ok(GEAR[s.reward.gear]);assert.ok(s.skins.includes(s.reward.gear));assert.ok(['common','uncommon','rare'].includes(GEAR[s.reward.gear].rarity));
 let b=rules('gear-boss');b=step(b,{type:'opening',choice:'trainRandom'});b.currentNode=b.map.bossId;startBattle(b,b.map.nodes.find(n=>n.key===b.map.bossId).enemy);b.battle.enemyHp=1;b.battle.hand=[instance(b,'CN03')];b.battle.energy=3;
 const money=b.money;b=playId(b,'CN03');assert.equal(b.phase,'bossGear');assert.equal(b.reward.bossGear.length,3);assert.ok(b.reward.bossGear.every(id=>GEAR[id].rarity==='boss'));assert.equal(b.money,money+50);
 const pickId=b.reward.bossGear.find(id=>id!=='BX10'&&id!=='BX11')||b.reward.bossGear[0];b=step(b,{type:'bossGear',id:pickId});assert.equal(b.phase,'intermission');
 b=step(b,{type:'nextAct'});b=step(b,{type:'chooseNode',key:b.map.starts[0]});if(!['BX10','BX11'].includes(pickId))assert.equal(b.battle.energy,4);
 const counts={common:0,uncommon:0,rare:0};const probe=rules('probe');for(let i=0;i<3000;i++)counts[GEAR[rollGear(probe)].rarity]++;
 assert.ok(counts.common>counts.uncommon&&counts.uncommon>counts.rare&&counts.rare>300,JSON.stringify(counts));
 assert.ok(Object.keys(GEAR).length>=40&&Object.keys(GEAR).length<=46);assert.ok(Object.values(GEAR).filter(g=>g.rarity==='boss').length>=10);
});

test('equipment effects: noise-cancelling first hit, emergency plan revive, knee pads, retain notebook',()=>{
 let s=fight('CN',[],{skins:['GR20']});s.battle.enemyHp=200;s.battle.intent=0;s.hp=50;s=step(s,{type:'end'});assert.equal(s.hp,49,'first hit capped at 1');
 s=fight('CN',[],{skins:['GR43']});s.hp=1;s=step(s,{type:'end'});assert.equal(s.phase,'combat');assert.equal(s.flags.GR43,true);assert.ok(s.hp>1);
 s=fight('CN',['CN06','CN03'],{skins:['GR22']});s.battle.draw=Array.from({length:8},()=>instance(s,'CN07'));s=step(s,{type:'end'});assert.ok(s.battle.hand.some(c=>c.id==='CN06'),'highest-cost card kept');assert.ok(!s.battle.hand.some(c=>c.id==='CN03'));
 s=fight('CN',[],{skins:['GR09']});s.battle.intent=0;const incoming=intent(s).filter(a=>a.type==='hit').reduce((n,a)=>n+a.n*a.times,0),hp=s.hp;s=step(s,{type:'end'});assert.equal(hp-s.hp,Math.max(0,incoming-4));
});

test('supplies: drop chance moves by 10, three slots, use in combat, replace or discard, market stock',()=>{
 let s=rules('sup');s=step(s,{type:'opening',choice:'trainRandom'});s=step(s,{type:'chooseNode',key:s.map.starts[0]});
 const chance=s.supplyChance;s.battle.enemyHp=1;s.battle.hand=[instance(s,'CN03')];s.battle.energy=3;s=playId(s,'CN03');
 assert.equal(s.supplyChance,s.reward.supply?chance-10:chance+10);
 s.reward.supply='SP03';s=step(s,{type:'takeSupply'});assert.deepEqual(s.supplies,['SP03']);
 s.supplies=['SP01','SP05','SP06'];s.reward.supply='SP03';assert.ok(act(s,{type:'takeSupply'}).error,'slots full');
 s=step(s,{type:'takeSupply',replace:1});assert.deepEqual(s.supplies,['SP01','SP03','SP06']);
 s=step(s,{type:'discardSupply',slot:0});assert.deepEqual(s.supplies,['SP03','SP06']);
 s=step(s,{type:'recruit',id:null});
 let f=fight('CN',[]);f.supplies=['SP03','SP02'];f=step(f,{type:'useSupply',slot:0});assert.equal(f.battle.enemyHp,188);f=step(f,{type:'useSupply',slot:0});assert.equal(f.battle.energy,11);assert.deepEqual(f.supplies,[]);
 let m=rules('market');m=step(m,{type:'opening',choice:'trainRandom'});const shop=m.map.nodes.find(n=>n.kind==='shop');m.map.starts=[shop.key];m=step(m,{type:'chooseNode',key:shop.key});
 assert.equal(m.shop.supplies.length,3);assert.ok(m.shop.gear.length>=2&&m.shop.gear.length<=3);assert.equal(GEAR[m.shop.gear[m.shop.gear.length-1]].rarity,'shop');
 m.money=500;m=step(m,{type:'buyGear',slot:0});m=step(m,{type:'buySupply',slot:0});assert.equal(m.supplies.length,1);
 assert.ok(Object.keys(SUPPLIES).length>=15&&Object.keys(SUPPLIES).length<=20);
});

test('rules-1 checkpoints keep PvP snapshots to deck, original skins and max reputation',()=>{
 let s=createWaSeason('cp',false,'EMEA','run-cp',{rules:1,ascension:2});
 s=waAct(s,{type:'opening',choice:'trainRandom'}).state;s.skins.push('GR01','SK02','BX03');
 s.currentNode=s.map.bossId;startBattle(s,s.map.nodes.find(n=>n.key===s.map.bossId).enemy);s.battle.enemyHp=1;s.battle.hand=[instance(s,'EU03')];s.battle.energy=3;
 s=waAct(s,{type:'play',uid:s.battle.hand[0].uid}).state;s=waAct(s,{type:'bossGear',id:null}).state;
 const [cp]=extractCheckpoints(s);assert.deepEqual(cp.skins,['SK02']);assert.equal(cp.ascension,2);assert.equal(cp.region,'EMEA');
 for(const t of Object.values(REGION_TRAITS))assert.ok(t.text.length>10&&!/建议|推荐|应该/.test(t.text));
});

test('equipment slots: six max, full pickup asks to replace (sold at rarity value) or decline, sell any time',()=>{
 let s=rules('slots');s=step(s,{type:'opening',choice:'trainRandom'});s.skins=['SK01','GR02','GR03','GR05','GR06','BX01'];
 const elite=s.map.nodes.find(n=>n.kind==='elite');s.currentNode=elite.key;startBattle(s,elite.enemy);s.battle.enemyHp=1;s.battle.hand=[instance(s,'CN03')];s.battle.energy=3;
 s=playId(s,'CN03');assert.equal(s.skins.length,6);assert.ok(s.gearOffer);assert.equal(s.phase,'reward');
 assert.ok(legalActions(s).every(a=>['gearReplace','gearDecline'].includes(a.type)));assert.ok(act(s,{type:'recruit',id:null}).error,'must resolve the offer first');
 const money=s.money,offer=s.gearOffer;s=step(s,{type:'gearReplace',slot:5});assert.equal(s.money,money+50,'boss item sells for 50');assert.equal(s.skins[5],offer);assert.ok(!s.gearOffer);
 s=step(s,{type:'sellGear',slot:0});assert.equal(s.money,money+50+15);assert.equal(s.skins.length,5);
 let d=rules('slots2');d=step(d,{type:'opening',choice:'trainRandom'});d.skins=['SK01','GR02','GR03','GR05','GR06','GR07'];d.gearOffer='GR40';d=step(d,{type:'gearDecline'});assert.equal(d.skins.length,6);assert.ok(!d.skins.includes('GR40'));
 const m=legalActions(d);assert.ok(m.some(a=>a.type==='sellGear'));
 let r=rules('slots-replay');r=step(r,{type:'opening',choice:'trainRandom'});r=step(r,{type:'chooseNode',key:r.map.starts[0]});r=step(r,{type:'end'});assert.deepEqual(replay(r),r);
});
