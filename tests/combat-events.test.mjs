// tests/combat-events.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, createSeason, act } from '../engine.js';
import { combatEvents } from '../combat-events.js';

function runCombatAndEvents(state, action) {
  const before = state;
  const result = act(state, action);
  if (result.error) throw new Error(result.error);
  const after = result.state;
  const events = combatEvents(before, after, action);
  return { before, after, events };
}

test('fully absorbed attack has attack event with damage 0 and absorbed > 0', () => {
  let state = createRun('test');
  // Use CN03 Kai (1 cost, 7 damage) as attack card.
  const card = { uid: 'c_attack', id: 'CN03', up: false };
  state.battle.hand.push(card);
  state.battle.energy = 10;
  state.battle.enemyBlock = 100;
  const { events } = runCombatAndEvents(state, { type: 'play', uid: card.uid });
  const attackEvents = events.filter(e => e.kind === 'attack' && e.source === 'ally');
  assert.ok(attackEvents.length === 1, 'Should have one attack event');
  assert.equal(attackEvents[0].damage, 0);
  assert.ok(attackEvents[0].absorbed > 0);
});

test('multi-hit card produces multiple attack events', () => {
  let state = createRun('test');
  // Use CN04 Life (1 cost, hit 4 times 2)
  const card = { uid: 'c_multi', id: 'CN04', up: false };
  state.battle.hand.push(card);
  state.battle.energy = 10;
  const { events } = runCombatAndEvents(state, { type: 'play', uid: card.uid });
  const attackEvents = events.filter(e => e.kind === 'attack' && e.source === 'ally');
  assert.equal(attackEvents.length, 2);
});

test('舆论压力 loss event at end turn', () => {
  let state = createRun('test');
  const curseCard = { uid: 'c_curse', id: 'CU02', up: false };
  state.battle.hand.push(curseCard);
  const { events } = runCombatAndEvents(state, { type: 'end' });
  const lossEvents = events.filter(e => e.kind === 'loss');
  assert.ok(lossEvents.length > 0);
  assert.equal(lossEvents[0].amount, 2);
});

test('lethal damage capped to remaining HP', () => {
  let state = createRun('test');
  const card = { uid: 'c_lethal', id: 'CN03', up: false };
  state.battle.hand.push(card);
  state.battle.energy = 10;
  state.battle.enemyHp = 1;
  const { events } = runCombatAndEvents(state, { type: 'play', uid: card.uid });
  const attackEvents = events.filter(e => e.kind === 'attack' && e.source === 'ally');
  assert.ok(attackEvents.length === 1);
  assert.equal(attackEvents[0].damage, 1);
});

test('skin/ability defense event from SK03', () => {
  let state = createRun('test');
  state.skins.push('SK03');
  // Play CN07 yosemite (1 cost, block 6) as sentinel, first sentinel this turn.
  const card = { uid: 'c_sentinel', id: 'CN07', up: false };
  state.battle.hand.push(card);
  state.battle.energy = 10;
  const { events } = runCombatAndEvents(state, { type: 'play', uid: card.uid });
  const powerEvents = events.filter(e => e.kind === 'power');
  assert.equal(powerEvents.length, 0);
  const defenseEvents = events.filter(e => e.kind === 'defense' && e.target === 'ally');
  assert.ok(defenseEvents.length >= 2, 'Should have block from card and skin');
});

test('power activation is represented as an event', () => {
  let state = createRun('test');
  const card = { uid: 'c_haodong', id: 'CN17', up: false };
  state.battle.hand.push(card);
  state.battle.energy = 10;
  // Need a pioneer card played first to trigger Haodong.
  // Use CN14 nobody as pioneer.
  const pioneer = { uid: 'c_pioneer', id: 'CN14', up: false };
  state.battle.hand.push(pioneer);
  // Play pioneer first.
  let result = act(state, { type: 'play', uid: pioneer.uid });
  state = result.state;
  // Now play Haodong.
  const beforePower=state;
  result = act(state, { type: 'play', uid: card.uid });
  state = result.state;
  const events=combatEvents(beforePower,state,{type:'play',uid:card.uid});
  assert.ok(events.some(e=>e.kind==='power'));
});

test('action rejected with no new logs returns empty events', () => {
  let state = createRun('test');
  const card = { uid: 'c_invalid', id: 'CN03', up: false };
  state.battle.hand.push(card);
  state.battle.energy = 0;
  const result = act(state, { type: 'play', uid: card.uid });
  assert.ok(result.error);
  const events = combatEvents(state, result.state, { type: 'play', uid: card.uid });
  assert.deepEqual(events, []);
});

test('win after damage clamps enemy HP in events', () => {
  let state = createRun('test');
  const card = { uid: 'c_win', id: 'CN06', up: false }; // 3 cost 24 damage
  state.battle.hand.push(card);
  state.battle.energy = 10;
  state.battle.enemyHp = 5; // low HP
  const { after, events } = runCombatAndEvents(state, { type: 'play', uid: card.uid });
  assert.ok(after.phase !== 'combat');
  const attackEvents = events.filter(e => e.kind === 'attack' && e.source === 'ally');
  assert.ok(attackEvents.length === 1);
  assert.equal(attackEvents[0].damage, 5); // capped
});

test('non-combat phase returns empty events', () => {
  let state = createRun('test');
  state.phase = 'reward';
  const events = combatEvents(state, state, { type: 'play', uid: 'x' });
  assert.deepEqual(events, []);
});

test('status-only card has no phantom attack',()=>{
 const s=createRun('fx');s.battle.hand=[{uid:'fx-status',id:'CN10',up:false}];
 const {events}=runCombatAndEvents(s,{type:'play',uid:'fx-status'});
 assert.deepEqual(events,[{kind:'status',target:'enemy',label:'压制 +1'}]);
});
test('enemy attack fully absorbed still reports interception after block expires',()=>{
 const s=createRun('fx');s.battle.block=20;
 const {after,events}=runCombatAndEvents(s,{type:'end'});
 assert.equal(after.battle.block,0);
 assert.deepEqual(events,[{kind:'attack',source:'enemy',target:'ally',damage:0,absorbed:6}]);
});
test('curse reduces tracked life before a lethal enemy attack',()=>{
 const s=createRun('fx');s.hp=3;s.battle.hand=[{uid:'curse',id:'CU02',up:false}];
 const {events}=runCombatAndEvents(s,{type:'end'});
 assert.deepEqual(events,[{kind:'loss',target:'ally',amount:2},{kind:'attack',source:'enemy',target:'ally',damage:1,absorbed:0}]);
 s.hp=1;
 assert.deepEqual(runCombatAndEvents(s,{type:'end'}).events,[{kind:'loss',target:'ally',amount:1}]);
});
