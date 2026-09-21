// Based on DeepSeek Flash's proposed UI-boundary cases, reviewed before integration.
// Removed nonexistent Dxx IDs, missing imports and assertions that contradicted map browsing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,act,canPlay,legalActions,instance} from '../engine.js';
import {mapEntry,routeNodes,restoreScreen} from '../navigation.js';
import {CARDS} from '../content.js';
test('DeepSeek: branch screen rejects combat actions without mutating state',()=>{
 const s=createRun();s.node=5;s.phase='branch';const before=JSON.stringify(s);
 assert.equal(canPlay(s,s.battle.hand[0].uid),'当前不在比赛中');assert.ok(act(s,{type:'end',rev:s.rev}).error);
 assert.equal(routeNodes(s).filter(n=>n.status==='current').length,2);assert.equal(JSON.stringify(s),before);
});
test('DeepSeek: both opponent branches use the same seeded shuffle stream',()=>{
 const s=createRun('branch-seed');s.node=6;s.phase='opponent';
 const elite=act(s,mapEntry(s,'elite')).state,normal=act(s,mapEntry(s,'normal')).state;
 assert.equal(elite.battle.enemy,'EL01');assert.equal(normal.battle.enemy,'E04');assert.equal(elite.seed,normal.seed);assert.equal(elite.rng,normal.rng);assert.deepEqual(elite.battle.hand,normal.battle.hand);
});
test('DeepSeek: upgrade targets exclude curses and upgraded instances; cost is retained',()=>{
 const s=createRun();s.node=7;s.phase='activity';s.deck[0].up=true;s.deck.push(instance(s,'CU02'));
 const next=act(s,{type:'activity',choice:'upgrade'}).state,options=legalActions(next).filter(a=>a.type==='upgrade');
 assert.ok(!options.some(a=>a.uid===s.deck[0].uid||a.uid===s.deck.at(-1).uid));
 const target=next.deck.find(c=>c.uid===options[0].uid),cost=CARDS[target.id].cost;
 const upgraded=act(next,options[0]).state.deck.find(c=>c.uid===target.uid);assert.equal(upgraded.up,true);assert.equal(CARDS[upgraded.id].cost,cost);
});
test('DeepSeek: looking at map during a reward can restore and re-enter that reward',()=>{
 const s=createRun();s.phase='reward';s.reward={offers:['CN01'],elite:false};const before=JSON.stringify(s);
 assert.equal(restoreScreen(s,{seed:s.seed,rev:s.rev,screen:'map'}),'map');assert.deepEqual(mapEntry(s,'n1'),{type:'enter'});assert.equal(JSON.stringify(s),before);
});
test('DeepSeek: invalid trial candidate cannot partially add a recruit or curse',()=>{
 const s=createRun();s.node=3;s.phase='event';s.eventOffers=['CN01'];
 const next=act(s,{type:'event',choice:'trial'}).state,before=JSON.stringify(next);
 const result=act(next,{type:'trial',id:'CN06'});assert.ok(result.error);assert.equal(JSON.stringify(next),before);assert.equal(result.state,next);
});
