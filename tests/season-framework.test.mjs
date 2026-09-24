import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMap,availableNodes} from '../season-map.js';
import {createSeason,act,instance,startBattle,preview,replay,offers,intent,intentText,drawCards} from '../engine.js';
import {CARDS,REGIONS,ENEMIES,compactLines,TACTICS,effects} from '../content.js';
import {routeNodes,mapEntry,nextScreen,restoreScreen} from '../navigation.js';
const step=(s,a)=>{const r=act(s,a);assert.equal(r.error,null);return r.state;};
function bossFixture(actNo,skins=[]){const s=createSeason('fixture');s.act=actNo;s.map=buildMap(s.seed,actNo);s.currentNode=s.map.bossId;s.node=actNo*12;s.hp=31;s.skins=skins;startBattle(s,s.map.nodes.find(n=>n.key===s.currentNode).enemy);s.battle.enemyHp=1;s.battle.hand=[instance(s,'CN03')];return s;}
test('300 maps have unique connected nodes, upward noncrossing branches and room variety',()=>{
 const signatures=new Set();
 for(let actNo=1;actNo<=3;actNo++)for(let i=0;i<100;i++){
  const m=buildMap('route-'+i,actNo),by=new Map(m.nodes.map(n=>[n.key,n]));assert.equal(by.size,m.nodes.length);assert.equal(m.starts.length,4);
  const widths=Array.from({length:11},(_,row)=>m.nodes.filter(n=>n.step===row+1).length);
  assert.ok(widths.every(width=>width>=3&&width<=6));assert.ok(Math.max(...widths)>=5);assert.ok(new Set(widths).size>=2);
  assert.ok(new Set(m.nodes.filter(n=>n.step<12).map(n=>n.lane)).size>=5);
  assert.deepEqual(m,buildMap('route-'+i,actNo));
  const kinds=new Set(m.nodes.map(n=>n.kind));for(const k of ['battle','elite','event','shop','rest','boss'])assert.ok(kinds.has(k),`${actNo}/${i}/${k}`);
  const reachable=new Set(m.starts);for(const n of m.nodes)if(reachable.has(n.key))for(const e of m.edges)if(e.from===n.key)reachable.add(e.to);assert.equal(reachable.size,m.nodes.length);
  for(const n of m.nodes){assert.ok(n.x>=8&&n.x<=92&&n.y>=5&&n.y<=95);if(n.kind!=='boss')assert.ok(m.edges.some(e=>e.from===n.key));if(n.step===6)assert.equal(n.kind,'shop');if(n.step===11)assert.equal(n.kind,'rest');if(n.step===12)assert.equal(n.kind,'boss');}
  for(const e of m.edges){const a=by.get(e.from),b=by.get(e.to);assert.equal(b.step,a.step+1);assert.ok(b.y<a.y);assert.ok(!(['elite','shop','rest'].includes(a.kind)&&a.kind===b.kind));
   for(const f of m.edges){const c=by.get(f.from),d=by.get(f.to);if(a.step===c.step)assert.ok((a.x-c.x)*(b.x-d.x)>=0,'crossing edges');}
  }
  assert.ok(m.nodes.filter(n=>n.step<11&&m.edges.filter(e=>e.from===n.key).length>1).length>=3);
  assert.ok(m.nodes.some(n=>n.step<12&&m.edges.filter(e=>e.to===n.key).length>1));
  signatures.add(JSON.stringify(m.edges));
 }
 assert.equal(signatures.size,300);
});
test('all four regions contain 50 sourced players and 25 tactical cards',async()=>{
 const names=new Map(Object.entries(JSON.parse(await readFile(new URL('./fixtures/roster-roles.json',import.meta.url),'utf8'))));
 const expanded=JSON.parse(await readFile(new URL('../assets/expanded-roster-sources.json',import.meta.url),'utf8'));
 const allNames=[];
 for(const [id,r] of Object.entries(REGIONS)){
  assert.equal(r.pool.length,75);assert.equal(r.start.length,10);assert.equal(new Set(r.pool).size,75);assert.ok(r.start.every(c=>r.pool.includes(c)));
  assert.equal(r.pool.filter(c=>CARDS[c].player).length,50);assert.equal(r.pool.filter(c=>!CARDS[c].player).length,25);
  for(const effect of ['hit','block','draw','power'])assert.ok(r.start.some(c=>effects({id:c}).some(e=>e.type===effect)));
  const players=r.pool.filter(c=>CARDS[c].player),newPlayers=players.slice(18);assert.deepEqual(newPlayers.map(cardId=>CARDS[cardId].name),expanded.regions[id].map(source=>source.alias));
  for(const cardId of r.pool){const c=CARDS[cardId];if(c.player)allNames.push(c.name);if(c.player&&r.pool.indexOf(cardId)<18&&id!=='CN')assert.equal(names.get(r.name+'/'+c.name),c.role==='自由人'?'跨位置候选':c.role==='控场'?'控场／烟位':c.role);assert.ok(TACTICS[cardId].title);
   for(const up of [false,true]){assert.ok(compactLines({id:cardId,up}).length<=3);for(const outer of effects({id:cardId,up})){const e=outer.type==='combo'?outer.effect:outer;assert.ok(e,'combo needs an inner effect');if(e.type==='hit')assert.ok(e.times>0);if(e.type==='detonate')assert.ok(e.per>0);else if(!['token','fireTurrets','bodyslam'].includes(e.type))assert.ok(e.n>0,cardId+' '+e.type);}}
  }
 }
 assert.equal(new Set(allNames.map(name=>name.toLowerCase())).size,200);
});
test('season navigation selects a start, resumes battle, rejects jumping, and restores views',()=>{
 const s=createSeason('navigation');assert.equal(s.node,0);assert.equal(availableNodes(s).length,4);
 const before=JSON.stringify(s);assert.ok(act(s,{type:'chooseNode',key:s.map.bossId}).error);assert.equal(JSON.stringify(s),before);
 const next=step(s,mapEntry(s,s.map.starts[1]));assert.equal(next.node,1);assert.equal(nextScreen(s,next),'room');assert.deepEqual(mapEntry(next,next.currentNode),{type:'enter'});assert.equal(availableNodes(next).length,0);
 assert.equal(routeNodes(next).filter(n=>n.status==='current').length,1);assert.equal(mapEntry(next,s.map.starts[0]),null);
 assert.equal(restoreScreen({...next,phase:'intermission'},null),'room');assert.deepEqual(replay(next),next);
});
test('all early boss outcomes carry deck/resources, heal once after skin and enter next act',()=>{
 for(const actNo of [1,2])for(const skins of [[],['SK01','SK02','SK03']]){
  let s=bossFixture(actNo,skins);s.deck[0].up=true;s.deck.push(instance(s,'CU01'));const deck=structuredClone(s.deck),money=s.money;
  assert.equal(preview(s,s.battle.hand[0].uid).wins,true);s=step(s,{type:'play',uid:s.battle.hand[0].uid});
  if(!skins.length){assert.equal(s.phase,'skin');assert.equal(s.hp,31);s=step(s,{type:'skin',id:s.reward.skins[0]});}
  assert.equal(s.phase,'intermission');assert.equal(s.hp,55);assert.equal(s.money,money+50+(skins.length?20:0));assert.equal(s.completed.filter(k=>k===s.currentNode).length,1);
  assert.deepEqual(s.deck,deck);s=step(s,{type:'nextAct'});assert.equal(s.act,actNo+1);assert.equal(s.hp,55);assert.equal(s.currentNode,null);assert.equal(s.phase,'map');assert.deepEqual(s.deck,deck);assert.equal(availableNodes(s).length,4);
 }
});
test('championship is the two-phase final boss and only its defeat wins the whole season',()=>{
 let s=bossFixture(3);assert.equal(s.battle.enemy,'A3_S_B01');assert.equal(s.battle.trait.id,'phase2');s.battle.cycles=2;assert.equal(intent(s)[0].n,10,'no cycle growth; phase two replaces it');s=step(s,{type:'play',uid:s.battle.hand[0].uid});assert.equal(s.outcome,'win');assert.ok(s.completed.includes(s.map.bossId));assert.equal(s.hp,31);assert.ok(act(s,{type:'nextAct'}).error);
});
test('battle draw is seeded permutation, not independent generation or replacement',()=>{
 const openings=new Set();
 for(const region of Object.keys(REGIONS))for(let i=0;i<40;i++){
  let s=createSeason('draw-'+i,false,region);s=step(s,{type:'chooseNode',key:s.map.starts[0]});const ids=s.battle.hand.map(c=>c.uid);openings.add(region+ids.join(','));
  assert.equal(new Set([...s.battle.hand,...s.battle.draw].map(c=>c.uid)).size,10);assert.deepEqual([...s.battle.hand,...s.battle.draw].map(c=>c.id).sort(),REGIONS[region].start.slice().sort());
  assert.deepEqual(replay(s),s);s.battle.hand=[];const remaining=s.battle.draw.map(c=>c.uid);drawCards(s,5);assert.deepEqual(s.battle.hand.map(c=>c.uid),remaining);
 }
 assert.ok(openings.size>140);
});
test('weighted offers stay regional, unique and below the copy limit',()=>{
 for(const region of Object.keys(REGIONS)){const s=createSeason('offers',false,region),pool=REGIONS[region].pool,zero=[0,0,0,0];
  for(let i=0;i<1000;i++){const chosen=offers(s);assert.equal(new Set(chosen).size,chosen.length);assert.ok(chosen.every(id=>pool.includes(id)&&s.deck.filter(c=>c.id===id).length<3));zero[CARDS[chosen[0]].cost]++;}
  assert.ok(zero[1]>zero[3]*3);assert.ok(zero[3]>0);assert.equal(offers(s,[0,0,0,1],1).every(id=>CARDS[id].cost===3),true);
 }
});
test('rest is a choice and event target selection is atomic',()=>{
 let s=createSeason('activities');const rest=s.map.nodes.find(n=>n.kind==='rest');s.map.starts=[rest.key];s.hp=40;s=step(s,{type:'chooseNode',key:rest.key});assert.equal(s.phase,'activity');assert.equal(s.hp,40);s=step(s,{type:'activity',choice:'fans'});assert.equal(s.hp,64);assert.equal(s.phase,'map');assert.equal(s.node,1);
 s.phase='event';s.eventId='training';const uid=s.deck[0].uid,before=JSON.stringify(s.deck),money=s.money;s=step(s,{type:'seasonEvent',choice:'paid'});s=step(s,{type:'eventBack'});assert.equal(s.money,money);assert.equal(JSON.stringify(s.deck),before);
 s=step(s,{type:'seasonEvent',choice:'risky'});const invalid=act(s,{type:'eventUpgrade',uid:'not-here'});assert.ok(invalid.error);assert.equal(invalid.state,s);s=step(s,{type:'eventUpgrade',uid});assert.equal(s.deck.find(c=>c.uid===uid).up,true);assert.ok(s.deck.some(c=>c.id==='CU01'));
});
test('all four regions complete the 36-room state machine (combat victories are fixtures, not balance evidence)',()=>{
 for(const region of Object.keys(REGIONS)){
  let s=createSeason('structure',false,region);
  for(let steps=0;steps<180&&s.phase!=='result';steps++){
   if(s.phase==='map')s=step(s,{type:'chooseNode',key:availableNodes(s)[0].key});
   else if(s.phase==='combat'){s.battle.enemyHp=1;s.battle.energy=3;s.battle.hand=[instance(s,REGIONS[region].pool[2])];s=step(s,{type:'play',uid:s.battle.hand[0].uid});}
   else if(s.phase==='reward')s=step(s,{type:'recruit',id:s.reward.offers[0]??null});
   else if(s.phase==='skin')s=step(s,{type:'skin',id:s.reward.skins[0]});
   else if(s.phase==='event')s=step(s,{type:'seasonEvent',choice:'skip'});
   else if(s.phase==='shop')s=step(s,{type:'leaveShop'});
   else if(s.phase==='crate')s=step(s,{type:'crate',choice:s.crate.opened?'leave':'open'});
   else if(s.phase==='activity')s=step(s,{type:'activity',choice:'upgrade'});
   else if(s.phase==='upgrade')s=step(s,{type:'upgrade',uid:s.deck.find(c=>CARDS[c.id].trainable&&!c.up).uid});
   else if(s.phase==='intermission')s=step(s,{type:'nextAct'});
   else assert.fail(s.phase);
   s=JSON.parse(JSON.stringify(s));
  }
  assert.equal(s.outcome,'win');assert.equal(s.act,3);assert.equal(s.node,36);assert.equal(s.completed.length,36);assert.equal(new Set(s.completed).size,36);assert.ok(s.deck.some(c=>c.up));
 }
});
test('new route actions replay deterministically without fixture mutations',()=>{
 let s=createSeason('new-route-replay');s=step(s,{type:'chooseNode',key:s.map.starts[2]});s=step(s,{type:'end'});assert.deepEqual(replay(s),s);
});
test('season opponents: sniper aim is broken by suppression, sentinel counter-fires, fields apply to both sides',()=>{
 let s=createSeason('traits');s=step(s,{type:'chooseNode',key:s.map.starts[0]});
 s.battle.enemy='S_E02';s.battle.trait={id:'sniper'};s.battle.intent=0;s.battle.hand=[];
 s=step(s,{type:'end'});assert.equal(s.battle.aim,1);assert.match(intentText(s),/重狙 22/);
 const weakCard=Object.keys(CARDS).find(id=>CARDS[id].cost===1&&CARDS[id].effects?.some(e=>e.type==='weak'));
 s.battle.hand=[instance(s,weakCard)];s.battle.energy=3;s=step(s,{type:'play',uid:s.battle.hand[0].uid});
 assert.equal(s.battle.aim,0);assert.match(intentText(s),/仓促射击 6/,'one third of 22 rounded up, then suppressed ×0.75');
 s=createSeason('thorns');s=step(s,{type:'chooseNode',key:s.map.starts[0]});
 s.battle.enemy='S_E04';s.battle.trait={id:'thorns',n:2};s.battle.traitState={};s.battle.enemyHp=40;s.battle.enemyBlock=0;s.battle.block=0;
 const hitter=Object.keys(CARDS).find(id=>CARDS[id].cost===1&&CARDS[id].effects?.length===1&&CARDS[id].effects[0].type==='hit'&&CARDS[id].effects[0].times===1);
 s.battle.hand=[instance(s,hitter)];s.battle.energy=3;const hp=s.hp;s=step(s,{type:'play',uid:s.battle.hand[0].uid});assert.equal(s.hp,hp-2);
 s.battle.field='corridor';s.battle.intent=0;s.battle.enemy='S_E03';s.battle.enemyWeak=0;s.battle.enemyStrength=0;assert.equal(intent(s)[0].n,5,'4×3 multi-hit gains +1 per hit');
});
test('legacy tutorial enemies are untouched by season traits',()=>{
 for(const id of ['E01','E02','E03','E04','E05','EL01','B01'])assert.ok(!ENEMIES[id].trait&&!ENEMIES[id].look,id);
});
test('wa archetype tactics: burn ticks, turrets fire, combo needs an earlier card, overload costs next turn, retain stays',()=>{
 const fight=hand=>{let s=createSeason('mech',false,'CN');s=step(s,{type:'chooseNode',key:s.map.starts[0]});s.battle.hand=hand.map(id=>instance(s,id));s.battle.energy=9;s.battle.enemyHp=60;s.battle.enemyBlock=0;return s;};
 let s=fight(['EUT03','CNT01','CNT17']);
 s=step(s,{type:'play',uid:s.battle.hand[0].uid});assert.equal(s.battle.enemyBurn,4);
 s=step(s,{type:'play',uid:s.battle.hand[0].uid});assert.equal(s.battle.deployables.length,1);
 s=step(s,{type:'end'});assert.equal(s.battle.enemyHp,60-5-4,'turret 5 then burn 4');assert.equal(s.battle.enemyBurn,3);
 assert.ok(s.battle.hand.some(c=>c.id==='CNT17'),'retained card is still in hand');
 s=fight(['AMT07','AMT07']);
 s=step(s,{type:'play',uid:s.battle.hand[0].uid});assert.equal(s.battle.enemyHp,55,'no combo on the first card');
 s=step(s,{type:'play',uid:s.battle.hand[0].uid});assert.equal(s.battle.enemyHp,45,'combo adds the second hit');
 s=fight(['PAT01']);s=step(s,{type:'play',uid:s.battle.hand[0].uid});assert.equal(s.battle.enemyHp,48);s=step(s,{type:'end'});
 if(s.phase==='combat')assert.equal(s.battle.energy,2,'overload 1');
});
