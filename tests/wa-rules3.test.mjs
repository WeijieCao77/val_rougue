import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeason,act,instance,startBattle,legalActions,battleFoes,livingFoes,foeViews,poolOf,preview,intent} from '../engine.js';
import {buildMap,availableNodes} from '../season-map.js';
import {CARDS,ENEMIES,REGIONS,WA_GROUPS,ENCOUNTER_POOLS,BOSS_POOL,BOSS_INFO,describe,compactLines} from '../content.js';
import {createMatch,applyCommand} from '../online/duel.mjs';
import {RULES_VERSION,RULES_VERSIONS} from '../wa-rules.js';

const step=(s,a)=>{const r=act(s,a);assert.equal(r.error,null,JSON.stringify(a)+' '+r.error);return r.state;};
const r3=(seed='r3',region='CN')=>createSeason(seed,false,region,{rules:3});
const bare=id=>id.replace(/^A[23]_/,'');
// A rules-3 run in the given fight (group id or single opponent) with a chosen hand.
function fightWith(enemy,hand,{region='CN',seed='r3-fight'}={}){
 let s=step(r3(seed,region),{type:'opening',choice:'trainRandom'});
 s=step(s,{type:'chooseNode',key:s.map.starts[0]});
 startBattle(s,enemy);
 const b=s.battle;b.hand=hand.map(id=>instance(s,id));b.draw=[];b.discard=[];b.energy=3;b.block=0;b.plays=0;b.tt={roles:[],dmg:0,nonDmg:0};
 return s;
}
const uidOf=(s,id)=>s.battle.hand.find(c=>c.id===id).uid;

test('rules 3 is the current ruleset; rules 1 stays accepted for replays, 2 is unknown',()=>{
 assert.equal(RULES_VERSION,3);assert.deepEqual(RULES_VERSIONS,[1,3]);
 assert.equal(r3().rules,3);
 assert.equal(createSeason('x',false,'CN',{rules:1}).rules,1);
 assert.throws(()=>createSeason('x',false,'CN',{rules:2}),/规则/);
});

test('boss pool: three candidates per act, drawn by seed, shown on the map with a factual line',()=>{
 for(const act of [1,2,3]){
  assert.equal(BOSS_POOL[act].length,3);
  const seen=new Set();
  for(let i=0;i<60;i++){
   const map=buildMap('boss-'+i,act,0,2,{r3:true}),boss=map.nodes.find(n=>n.kind==='boss');
   assert.ok(BOSS_POOL[act].includes(boss.enemy));assert.equal(map.boss.id,boss.enemy);
   assert.deepEqual(buildMap('boss-'+i,act,0,2,{r3:true}).boss,map.boss,'same seed, same boss');
   seen.add(boss.enemy);
  }
  assert.equal(seen.size,3,`act ${act} reaches every candidate`);
 }
 for(const [id,info] of Object.entries(BOSS_INFO)){
  assert.ok(info.name&&info.look&&info.text.length>8&&info.text.length<60,id);
  const members=WA_GROUPS[id]?.members||[id];assert.ok(members.every(m=>ENEMIES[m]),id);
  assert.ok(ENEMIES[members[0]].boss,id);
 }
 const looks=new Set(Object.values(BOSS_INFO).map(b=>b.look));assert.equal(looks.size,9,'every boss has its own look');
 // Older rulesets keep the fixed boss and no preview.
 const old=buildMap('boss-0',1,0,2);assert.equal(old.boss,undefined);assert.equal(old.nodes.find(n=>n.kind==='boss').enemy,'S_B01');
});

test('encounter pools: weak pool on the first floors, strong pool later, few repeats along a route',()=>{
 let repeats=0,fights=0;
 for(let i=0;i<40;i++)for(const act of [1,2,3]){
  const map=buildMap('pool-'+i,act,0,2,{r3:true}),weakUntil=act===1?3:2,prefix=act===1?'':`A${act}_`;
  const byKey=new Map(map.nodes.map(n=>[n.key,n]));
  for(const n of map.nodes.filter(n=>n.kind==='battle')){
   const pool=n.step<=weakUntil?ENCOUNTER_POOLS.weak:ENCOUNTER_POOLS.strong;
   assert.ok(pool.map(id=>prefix+id).includes(n.enemy),`${n.enemy} at floor ${n.step}`);
   assert.equal(!!n.weak,n.step<=weakUntil);
   for(const e of map.edges.filter(e=>e.to===n.key)){const p=byKey.get(e.from);if(p.enemy&&p.kind===n.kind)assert.notEqual(p.enemy,n.enemy,'no back-to-back repeat');}
  }
  for(const n of map.nodes.filter(n=>n.kind==='elite'))assert.ok(ENCOUNTER_POOLS.elite.map(id=>prefix+id).includes(n.enemy));
  // Random walk from a start to the boss: count repeated opponents on the route.
  let key=map.starts[i%map.starts.length];const met=[];
  while(key){const n=byKey.get(key);if(n.enemy&&n.kind!=='boss')met.push(n.enemy);const next=map.edges.filter(e=>e.from===key);key=next.length?next[(i+n.step)%next.length].to:null;}
  fights+=met.length;repeats+=met.length-new Set(met).size;
 }
 assert.ok(repeats/fights<0.2,`repeat share ${(repeats/fights).toFixed(2)}`);
});

test('group fight: each opponent keeps its own intent and statuses; the chosen target takes the hit',()=>{
 let s=fightWith('S_G03',['AM04','CN03','CN11']);
 const foes=battleFoes(s.battle);
 assert.equal(foes.length,2);assert.deepEqual(foes.map(f=>f.enemy),WA_GROUPS.S_G03.members);
 const views=foeViews(s);assert.ok(views.every(v=>v.intentText&&v.intent.length));
 const hp0=battleFoes(s.battle).map(f=>f.enemyHp);
 // Targeted plays list one action per living opponent.
 assert.equal(legalActions(s).filter(a=>a.type==='play'&&a.uid===uidOf(s,'CN03')).length,2);
 const p=preview(s,uidOf(s,'CN03'),1);assert.ok(p.damage>0);
 s=step(s,{type:'play',uid:uidOf(s,'CN03'),target:1});
 const hp1=battleFoes(s.battle).map(f=>f.enemyHp);
 assert.equal(hp1[0],hp0[0]);assert.ok(hp1[1]<hp0[1]);
 s=step(s,{type:'play',uid:uidOf(s,'CN11'),target:0});
 assert.ok(battleFoes(s.battle)[0].enemyWeak>0&&!battleFoes(s.battle)[1].enemyWeak,'weak lands on the chosen opponent only');
 assert.ok(step(s,{type:'end'}),'both opponents act');
 const bad=act(s,{type:'play',uid:uidOf(s,'AM04'),target:5});assert.match(bad.error,/目标/);
});

test('group fight: area cards hit every opponent; knocking one out continues, the last one wins',()=>{
 let s=fightWith('S_G01',['CNT14','CN03']);
 for(let i=0;i<2;i++){s.battle.foes[i]&&(s.battle.foes[i].enemyHp=12);}
 s.battle.enemyHp=12;s.battle.energy=9;
 const hp0=battleFoes(s.battle).map(f=>f.enemyHp);
 s=step(s,{type:'play',uid:uidOf(s,'CNT14')});
 const after=battleFoes(s.battle);
 assert.ok(after.every((f,i)=>f.enemyHp<hp0[i]),'area attack hits both');
 assert.equal(s.phase,'reward','both knocked out');
 // One knocked out first: the fight goes on against the other.
 let t=fightWith('S_G01',['CN03','CN03']);t.battle.energy=9;t.battle.enemyHp=3;
 t=step(t,{type:'play',uid:t.battle.hand[0].uid,target:0});
 assert.equal(t.phase,'combat');assert.deepEqual(livingFoes(t.battle),[1]);assert.equal(t.battle.cur,1);
 assert.ok(!legalActions(t).some(a=>a.target===0),'a knocked-out opponent is no longer a target');
});

test('boss groups: escorts guard and rally; the boss falling ends the fight',()=>{
 let s=fightWith('A3_S_BG1',['CN03']);
 assert.equal(battleFoes(s.battle).length,3);
 s.battle.energy=9;s.battle.enemyHp=1;s.battle.enemyBlock=0;
 s=step(s,{type:'play',uid:uidOf(s,'CN03'),target:0});
 assert.notEqual(s.phase,'combat','escorts flee when the boss is knocked out');
 let e=fightWith('A3_S_BG1',['CN03']);e.battle.energy=9;
 const hp=e.battle.enemyHp;e=step(e,{type:'play',uid:uidOf(e,'CN03'),target:0});
 const dealt=hp-battleFoes(e.battle)[0].enemyHp;assert.ok(dealt>0&&dealt<=Math.ceil(7/2),'escort halves the damage');
});

test('new boss mechanics: barricade keeps block, overdrive acts twice, foresight blunts the first hit',()=>{
 let s=fightWith('S_B02',[]);const block=s.battle.enemyBlock;assert.ok(block>0);
 s=step(s,{type:'end'});assert.ok(s.battle.enemyBlock>=block,'barricade block survives the turn');
 let o=fightWith('A2_S_B02',[]);assert.equal(o.battle.intent,0);o=step(o,{type:'end'});assert.equal(o.battle.intent,2,'two script steps per turn');
 let f=fightWith('A3_S_B02',['CN03','CN03']);f.battle.energy=9;f.battle.enemyBlock=0;const hp=f.battle.enemyHp;
 f=step(f,{type:'play',uid:f.battle.hand[0].uid});assert.equal(hp-f.battle.enemyHp,1);
 const hp2=f.battle.enemyHp;f=step(f,{type:'play',uid:f.battle.hand[0].uid});assert.ok(hp2-f.battle.enemyHp>1);
 // Saturate: every status card you hold raises each of its hits by 1.
 const t=fightWith('A2_S_B03',[]),hitOf=st=>intent(st).find(a=>a.type==='hit').n,before=hitOf(t);
 t.battle.discard.push(instance(t,'ST03'),instance(t,'ST03'));assert.equal(hitOf(t),before+2);
});

test('keywords: innate opens in hand, ethereal exhausts at end of turn, X spends all energy, growth stays with the copy',()=>{
 // 固有
 let s=step(r3('kw-innate','CN'),{type:'opening',choice:'trainRandom'});
 s.deck.push(instance(s,'CNT26'));s=step(s,{type:'chooseNode',key:s.map.starts[0]});
 assert.ok(s.battle.hand.some(c=>c.id==='CNT26'),'innate card in the opening hand');
 // 虚无
 let e=fightWith('S_E01',['CNT27','CN03']);e=step(e,{type:'end'});
 assert.ok(e.battle.exhaust.some(c=>c.id==='CNT27'));assert.ok(!e.battle.discard.some(c=>c.id==='CNT27'));
 // X 费
 let x=fightWith('S_E01',['CNT28']);x.battle.energy=3;x.battle.enemyBlock=0;const hp=x.battle.enemyHp;
 x=step(x,{type:'play',uid:uidOf(x,'CNT28')});assert.equal(x.battle.energy,0);assert.equal(hp-x.battle.enemyHp,15,'5 damage × 3');
 let x0=fightWith('S_E01',['PAT30']);x0.battle.energy=2;x0=step(x0,{type:'play',uid:uidOf(x0,'PAT30')});
 assert.equal(x0.battle.hand.filter(c=>c.id==='TK01').length,2,'X tokens');
 // 成长
 let g=fightWith('S_E01',['CNT30']);g.battle.enemyHp=500;g.battle.enemyBlock=0;g.battle.energy=9;
 const card=g.battle.hand[0],hits=[];
 for(let i=0;i<3;i++){const before=g.battle.enemyHp;g=step(g,{type:'play',uid:card.uid});hits.push(before-g.battle.enemyHp);const c=g.battle.discard.find(c=>c.uid===card.uid);g.battle.discard=g.battle.discard.filter(x=>x!==c);g.battle.hand.push(c);g.battle.enemyBlock=0;}
 assert.deepEqual(hits,[6,8,10]);
 assert.ok(!g.deck.some(c=>c.g),'the season deck copy is unchanged');
 assert.match(describe({id:'CNT30',up:false}),/成长/);assert.ok(compactLines({id:'CNT28',up:false}).some(l=>/X/.test(l)));
});

test('rules-3 pools swap five plain tactics per region for keyword cards (50 players + 25 tactics)',()=>{
 for(const r of Object.values(REGIONS)){
  assert.equal(r.pool3.length,75);assert.equal(r.pool3.filter(id=>CARDS[id].player).length,50);
  assert.equal(new Set(r.pool3).size,75);
  const kw=r.pool3.filter(id=>CARDS[id].innate||CARDS[id].ethereal||CARDS[id].x||CARDS[id].growth);assert.equal(kw.length,5,r.id);
 }
 const all=Object.values(CARDS);
 for(const k of ['innate','ethereal','x','growth']){const n=all.filter(c=>c[k]).length;assert.ok(n>=4&&n<=6,`${k}: ${n}`);}
 assert.equal(poolOf(r3()),REGIONS.CN.pool3);assert.equal(poolOf(createSeason('o',false,'CN',{rules:1})),REGIONS.CN.pool);
});

test('PvP stays one-on-one and handles keyword cards (X, growth, ethereal, innate)',()=>{
 const snap=(runId,ids)=>({id:runId+':1',runId,act:1,version:'wa-pvp-1',seed:'s',region:'CN',deck:ids.map((id,i)=>({uid:runId+i,id,up:false})),skins:[],maxHp:80,hp:80,money:0});
 let m=createMatch(snap('a',['CNT26','CNT27','CNT28','CNT30','CN03','CN03','CN03','CN03','CN03','CN03']),snap('b',['CN03','CN03','CN03','CN03','CN03','CN03','CN03']),'pvp-kw');
 if(m.active===1)m=applyCommand(m,1,{type:'end'});
 const seat=0,me=m.players[seat];assert.equal(m.active,0);
 assert.ok(me.hand.some(c=>c.id==='CNT26'),'innate');
 const x=me.hand.find(c=>c.id==='CNT28');
 if(x){const hp=m.players[1-seat].hp;m=applyCommand(m,seat,{type:'play',uid:x.uid});assert.equal(m.players[seat].energy,0);assert.ok(m.players[1-seat].hp<hp);}
 m=applyCommand(m,seat,{type:'end'});
 assert.ok(!m.players[seat].hand.some(c=>c.id==='CNT27'),'ethereal left the hand');
});
