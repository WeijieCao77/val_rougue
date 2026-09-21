import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,act} from '../engine.js';
import {routeNodes,mapEntry,nextScreen,restoreScreen} from '../navigation.js';
test('only the active map step is enterable; inspection never advances RNG',()=>{
 const s=createRun(),before=JSON.stringify(s);assert.deepEqual(mapEntry(s,'n1'),{type:'enter'});assert.equal(mapEntry(s,'n9'),null);assert.equal(mapEntry(s,'shop'),null);routeNodes(s);assert.equal(JSON.stringify(s),before);
});
test('market and activity are real mutually exclusive map branches',()=>{
 const s=createRun();s.node=5;s.phase='branch';assert.deepEqual(mapEntry(s,'shop'),{type:'branch',choice:'shop'});
 const next=act(s,mapEntry(s,'shop')).state;assert.equal(next.phase,'shop');assert.equal(routeNodes(next).find(n=>n.key==='activity5').status,'bypassed');assert.equal(mapEntry(next,'activity5'),null);assert.equal(nextScreen(s,next),'room');
});
test('elite branch starts the actual elite encounter and blocks the other path',()=>{
 const s=createRun();s.node=6;s.phase='opponent';const next=act(s,mapEntry(s,'elite')).state;assert.equal(next.battle.enemy,'EL01');assert.equal(mapEntry(next,'normal'),null);assert.equal(mapEntry(next,'elite').type,'enter');
});
test('node completion returns to map; rewards and combat remain inside their room',()=>{
 const s=createRun();assert.equal(nextScreen(s,{...s,node:2}),'map');assert.equal(nextScreen(s,{...s,phase:'reward'}),'room');assert.equal(nextScreen(s,{...s,phase:'result'}),'room');
});
test('saved map/room view restores only at matching seed and revision',()=>{
 const s=createRun();assert.equal(restoreScreen(s,{seed:s.seed,rev:0,screen:'map'}),'map');assert.equal(restoreScreen(s,{seed:s.seed,rev:1,screen:'map'}),'room');assert.equal(restoreScreen({...s,phase:'branch'},null),'map');
});
