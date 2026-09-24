import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS as WA_CARDS,REGIONS} from '../content.js';
import {createSeason,act as waAct,drawCards,instance,offers} from '../engine.js';
import {CARDS as NEW_CARDS,CARD_IDS,REGION_CARD_IDS,STATUS_CARDS,TEAMS} from '../new-demo/content.js';
import {createRun,act as newAct} from '../new-demo/engine.js';
import {CURSES,EXTRA_STATUSES} from '../afflictions.js';

test('both climb modes keep regional rewards separate from 14 global curses and 5 statuses',()=>{
 assert.equal(CURSES.length,14);assert.equal(EXTRA_STATUSES.length,2);
 for(const [region,r] of Object.entries(REGIONS)){
  assert.equal(r.pool.length,75);assert.equal(r.pool.filter(id=>WA_CARDS[id].player).length,50);
  assert.equal(r.pool.filter(id=>!WA_CARDS[id].player).length,25);
  const s=createSeason('pool-audit',false,region);
  for(let i=0;i<60;i++)assert.ok(offers(s).every(id=>r.pool.includes(id)&&!id.startsWith('CU')&&!id.startsWith('ST')));
 }
 assert.equal(CARD_IDS.length,444,'new demo: 144 shared (incl. 33 archetype, 4 area and 20 keyword cards) + 300 regional');
 assert.equal(Object.keys(STATUS_CARDS).length,19);
 for(const ids of Object.values(REGION_CARD_IDS))assert.equal(ids.length,75);
 for(const [team,def] of Object.entries(TEAMS)){
  const allowed=new Set(REGION_CARD_IDS[def.region]);
  for(let seed=0;seed<12;seed++){
   let state=createRun(`reward-${team}-${seed}`,team);
   state=newAct(state,{type:'enter',key:state.map.starts[0]}).state;
   state.battle.enemyHp=1;
   state.battle.hand=[{uid:'fixture-hit',id:'TA01',up:false}];
   const result=newAct(state,{type:'play',uid:'fixture-hit'});assert.equal(result.error,undefined);
   assert.equal(result.state.phase,'reward');
   assert.ok(result.state.battle.rewardPool.every(id=>!NEW_CARDS[id].region||allowed.has(id)));
  }
 }
});

test('risky events add persistent curses and never put them into ordinary reward pools',()=>{
 let wa=createSeason('risk-event');wa.phase='event';wa.eventId='risk';const before=wa.money;
 wa=waAct(wa,{type:'seasonEvent',choice:'accept'}).state;
 assert.equal(wa.money,before+90);assert.ok(wa.deck.some(c=>CURSES.some(rule=>rule.id===c.id)));
 let newer=createRun('curse-event');newer.phase='event';newer.event={id:'ev7',choices:[{id:'accept'},{id:'decline'}]};
 newer=newAct(newer,{type:'event',choice:'accept'}).state;
 assert.ok(newer.deck.some(c=>CURSES.some(rule=>rule.id===c.id)));
 assert.ok(CARD_IDS.every(id=>!id.startsWith('CU')&&!id.startsWith('ST')));
});

test('draw-time affliction visibly changes resources in Wa combat',()=>{
 const s=createSeason('curse-draw');
 const entered=waAct(s,{type:'chooseNode',key:s.map.starts[0]});
 assert.equal(entered.error,null);
 const next=entered.state,b=next.battle;b.hand=[];b.draw=[instance(next,'CU03')];b.energy=3;
 drawCards(next,1);assert.equal(b.energy,2);assert.equal(b.hand[0].id,'CU03');
});
