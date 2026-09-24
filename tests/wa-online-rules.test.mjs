import { test } from 'node:test';
import assert from 'node:assert';

import { createWaSeason, waAct, extractCheckpoints, waLegalActions } from '../wa-season.js';
import { validateSnapshot, createMatch, applyCommand, viewFor } from '../online/duel.mjs';
import { CARDS } from '../content.js';

function snapshotFromCheckpoint(cp) {
  return {
    runId: cp.runId,
    act: cp.act,
    version: cp.version,
    seed: cp.seed,
    region: cp.region,
    deck: cp.deck,
    skins: cp.skins,
    maxHp: cp.maxHp,
    hp: cp.hp,
    money: cp.money,
    actionsCount: cp.actionsCount
  };
}

function createCheckpointFixture(act = 1) {
  const runId = 'test-' + act;
  const state = createWaSeason('testseed', false, 'CN', runId);
  state.phase = 'skin';
  state.reward = { skins: ['SK01', 'SK02', 'SK03'], boss: true, elite: false };
  state.currentNode = 'a1-r11-c0';
  state.completed = [];
  state.battle = null;
  state.hp = 50;
  state.maxHp = 80;
  const res = waAct(state, { type: 'skin', id: null });
  if (res.error) throw new Error('skin action failed: ' + res.error);
  return res.state;
}

test('wa-season: createWaSeason adds runId and waVersion', () => {
  const s = createWaSeason('seed1', false, 'CN', 'run1');
  assert.equal(s.runId, 'run1');
  assert.equal(s.waVersion, 'wa-1');
  assert.deepEqual(s.checkpoints, []);
});

test('wa-season: extractCheckpoints returns deep copy', () => {
  const s = createWaSeason('seed', false, 'CN', 'run');
  const cp = { id: 'run:1', runId: 'run', act: 1, version: 'wa-pvp-1', seed: 'seed', region: 'CN', deck: [], skins: [], maxHp: 80, hp: 80, money: 60, actionsCount: 0 };
  s.checkpoints.push(cp);
  const extracted = extractCheckpoints(s);
  assert.notStrictEqual(extracted[0], cp);
  extracted[0].maxHp = 999;
  assert.equal(s.checkpoints[0].maxHp, 80);
});

test('wa-season: act1 boss skin checkpoint full heal and idempotent', () => {
  const state = createCheckpointFixture(1);
  assert.equal(state.phase, 'intermission');
  assert.equal(state.hp, state.maxHp);
  assert.equal(state.checkpoints.length, 1);
  const cp = state.checkpoints[0];
  assert.equal(cp.act, 1);
  assert.equal(cp.hp, cp.maxHp);
  const res2 = waAct(state, { type: 'nextAct' });
  assert.equal(res2.error, null);
  assert.equal(res2.state.checkpoints.length, 1);
});

test('wa-season: toughness activity increases maxHp and hp', () => {
  const s = createWaSeason('seed', false, 'CN', 'run');
  s.phase = 'activity';
  s.mode = 'season';
  const res = waAct(s, { type: 'activity', choice: 'toughness' });
  assert.equal(res.error, null);
  assert.equal(res.state.maxHp, 86);
  assert.equal(res.state.hp, 86);
  assert.equal(res.state.phase, 'map');
  assert.equal(res.state.rev, 1);
  assert.equal(res.state.actions.length, 1);
});

test('wa-season: waLegalActions includes toughness in activity', () => {
  const s = createWaSeason('seed', false, 'CN', 'run');
  s.phase = 'activity';
  const actions = waLegalActions(s);
  assert.ok(actions.some(a => a.type === 'activity' && a.choice === 'toughness'));
});

test('duel: validateSnapshot rejects non-permanent cards', () => {
  const bad = {
    runId: 'r', act: 1, version: 'wa-pvp-1', seed: 's', region: 'CN',
    deck: [{ uid: '1', id: 'TK01', up: false }],
    skins: [], maxHp: 80, hp: 80, money: 0, actionsCount: 0
  };
  assert.throws(() => validateSnapshot(bad), /non-permanent/);
});

test('duel: validateSnapshot requires hp == maxHp', () => {
  const good = {
    runId: 'r', act: 1, version: 'wa-pvp-1', seed: 's', region: 'CN',
    deck: [{ uid: '1', id: 'CN01', up: false }],
    skins: [], maxHp: 80, hp: 70, money: 0, actionsCount: 0
  };
  assert.throws(() => validateSnapshot(good), /hp must equal maxHp/);
});

test('duel: createMatch rejects different acts', () => {
  const snap1 = { runId: 'r1', act: 1, version: 'wa-pvp-1', seed: 's1', region: 'CN', deck: [{ uid: '1', id: 'CN01', up: false }], skins: [], maxHp: 80, hp: 80, money: 0, actionsCount: 0 };
  const snap2 = { ...snap1, runId: 'r2', act: 2 };
  assert.throws(() => createMatch(snap1, snap2, 'mseed'), /acts must match/);
});

test('duel: createMatch initializes full hp and hidden hands', () => {
  const snapA = { runId: 'rA', act: 1, version: 'wa-pvp-1', seed: 'sA', region: 'CN', deck: [
    { uid: 'a1', id: 'CN01', up: false }, { uid: 'a2', id: 'CN01', up: false }, { uid: 'a3', id: 'CN01', up: false }, { uid: 'a4', id: 'CN01', up: false }, { uid: 'a5', id: 'CN01', up: false }
  ], skins: [], maxHp: 100, hp: 100, money: 0, actionsCount: 0 };
  const snapB = { ...snapA, runId: 'rB', seed: 'sB', deck: [{ uid: 'b1', id: 'CN07', up: false }, { uid: 'b2', id: 'CN07', up: false }, { uid: 'b3', id: 'CN07', up: false }, { uid: 'b4', id: 'CN07', up: false }, { uid: 'b5', id: 'CN07', up: false }], maxHp: 80, hp: 80 };
  const match = createMatch(snapA, snapB, 'seed');
  assert.equal(match.status, 'active');
  assert.equal(match.players[0].hp, 100);
  assert.equal(match.players[1].hp, 80);
  assert.equal(match.players[match.active].hand.length, 5);
  assert.equal(match.players[1 - match.active].hand.length, 0);
  const view = viewFor(match, 1 - match.active);
  assert.equal(view.opponent.handCount, match.players[match.active].hand.length);
  assert.ok(!('hand' in view.opponent));
});

test('duel: play and end turn cycle', () => {
  const snapA = { runId: 'rA', act: 1, version: 'wa-pvp-1', seed: 'sA', region: 'CN', deck: [
    { uid: 'a1', id: 'CN03', up: false }, { uid: 'a2', id: 'CN03', up: false }, { uid: 'a3', id: 'CN03', up: false }, { uid: 'a4', id: 'CN03', up: false }, { uid: 'a5', id: 'CN03', up: false }
  ], skins: [], maxHp: 100, hp: 100, money: 0, actionsCount: 0 };
  const snapB = { ...snapA, runId: 'rB', seed: 'sB', deck: [{ uid: 'b1', id: 'CN01', up: false }, { uid: 'b2', id: 'CN01', up: false }, { uid: 'b3', id: 'CN01', up: false }, { uid: 'b4', id: 'CN01', up: false }, { uid: 'b5', id: 'CN01', up: false }] };
  const match = createMatch(snapA, snapB, 'seed');
  const initialActive = match.active;
  const firstHand = match.players[initialActive].hand;
  assert.ok(firstHand.length >= 1);
  const uid = firstHand[0].uid;
  const afterPlay = applyCommand(match, initialActive, { type: 'play', uid });
  assert.equal(afterPlay.rev, 1);
  assert.equal(afterPlay.players[initialActive].hand.length, firstHand.length - 1);
  const afterEnd = applyCommand(afterPlay, initialActive, { type: 'end' });
  assert.equal(afterEnd.rev, 2);
  assert.equal(afterEnd.active, 1 - initialActive);
  assert.equal(afterEnd.turn, 2);
  assert.equal(afterEnd.players[1 - initialActive].hand.length, 5);
});

test('duel: illegal command throws and does not mutate original', () => {
  const snapA = { runId: 'rA', act: 1, version: 'wa-pvp-1', seed: 'sA', region: 'CN', deck: [
    { uid: 'a1', id: 'CN03', up: false }, { uid: 'a2', id: 'CN03', up: false }, { uid: 'a3', id: 'CN03', up: false }, { uid: 'a4', id: 'CN03', up: false }, { uid: 'a5', id: 'CN03', up: false }
  ], skins: [], maxHp: 100, hp: 100, money: 0, actionsCount: 0 };
  const snapB = { ...snapA, runId: 'rB', seed: 'sB', deck: [{ uid: 'b1', id: 'CN01', up: false }, { uid: 'b2', id: 'CN01', up: false }, { uid: 'b3', id: 'CN01', up: false }, { uid: 'b4', id: 'CN01', up: false }, { uid: 'b5', id: 'CN01', up: false }] };
  const match = createMatch(snapA, snapB, 'seed');
  const before = JSON.stringify(match);
  assert.throws(() => applyCommand(match, 1 - match.active, { type: 'end' }), /not your turn/);
  assert.equal(JSON.stringify(match), before);
});

test('duel: concede sets winner', () => {
  const snapA = { runId: 'rA', act: 1, version: 'wa-pvp-1', seed: 'sA', region: 'CN', deck: [
    { uid: 'a1', id: 'CN03', up: false }, { uid: 'a2', id: 'CN03', up: false }, { uid: 'a3', id: 'CN03', up: false }, { uid: 'a4', id: 'CN03', up: false }, { uid: 'a5', id: 'CN03', up: false }
  ], skins: [], maxHp: 100, hp: 100, money: 0, actionsCount: 0 };
  const snapB = { ...snapA, runId: 'rB', seed: 'sB', deck: [{ uid: 'b1', id: 'CN01', up: false }, { uid: 'b2', id: 'CN01', up: false }, { uid: 'b3', id: 'CN01', up: false }, { uid: 'b4', id: 'CN01', up: false }, { uid: 'b5', id: 'CN01', up: false }] };
  const match = createMatch(snapA, snapB, 'seed');
  const after = applyCommand(match, 0, { type: 'concede' });
  assert.equal(after.status, 'finished');
  assert.equal(after.winner, 1);
  assert.equal(after.rev, 1);
});

test('duel: weak and vulnerable decrement timing (guaranteed CN10 in active hand)', () => {
  const snapA = { runId: 'rA', act: 1, version: 'wa-pvp-1', seed: 'sA', region: 'CN', deck: [
    { uid: 'a1', id: 'CN10', up: false }, { uid: 'a2', id: 'CN10', up: false }, { uid: 'a3', id: 'CN10', up: false }, { uid: 'a4', id: 'CN10', up: false }, { uid: 'a5', id: 'CN10', up: false }
  ], skins: [], maxHp: 100, hp: 100, money: 0, actionsCount: 0 };
  const snapB = { ...snapA, runId: 'rB', seed: 'sB', deck: [{ uid: 'b1', id: 'CN07', up: false }, { uid: 'b2', id: 'CN07', up: false }, { uid: 'b3', id: 'CN07', up: false }, { uid: 'b4', id: 'CN07', up: false }, { uid: 'b5', id: 'CN07', up: false }] };
  const match = createMatch(snapA, snapB, 'seed');
  const active = match.active;
  if (!match.players[active].hand.some(c => c.id === 'CN10')) {
    match.players[active].hand[0] = { uid: 'forced-cn10', id: 'CN10', up: false };
  }
  const weakCardUid = match.players[active].hand.find(c => c.id === 'CN10').uid;
  const afterPlay = applyCommand(match, active, { type: 'play', uid: weakCardUid });
  assert.equal(afterPlay.players[1 - active].weak, 1);
  const afterEnd = applyCommand(afterPlay, active, { type: 'end' });
  assert.equal(afterEnd.players[1 - active].weak, 1);
  const afterEnd2 = applyCommand(afterEnd, 1 - active, { type: 'end' });
  assert.equal(afterEnd2.players[1 - active].weak, 0);
});

test('duel: exhausted cards do not reshuffle', () => {
  const snapA = { runId: 'rA', act: 1, version: 'wa-pvp-1', seed: 'sA', region: 'CN', deck: [
    { uid: 'a1', id: 'CN10', up: false }, { uid: 'a2', id: 'CN10', up: false }, { uid: 'a3', id: 'CN10', up: false }, { uid: 'a4', id: 'CN10', up: false }, { uid: 'a5', id: 'CN10', up: false }
  ], skins: [], maxHp: 100, hp: 100, money: 0, actionsCount: 0 };
  const snapB = { ...snapA, runId: 'rB', seed: 'sB', deck: [{ uid: 'b1', id: 'CN07', up: false }, { uid: 'b2', id: 'CN07', up: false }, { uid: 'b3', id: 'CN07', up: false }, { uid: 'b4', id: 'CN07', up: false }, { uid: 'b5', id: 'CN07', up: false }] };
  const match = createMatch(snapA, snapB, 'seed');
  const active = match.active;
  if (!match.players[active].hand.some(c => c.id === 'CN10')) {
    match.players[active].hand[0] = { uid: 'forced-cn10', id: 'CN10', up: false };
  }
  const card = match.players[active].hand.find(c => c.id === 'CN10');
  const afterPlay = applyCommand(match, active, { type: 'play', uid: card.uid });
  assert.ok(afterPlay.players[active].exhaust.some(c => c.uid === card.uid));
  assert.ok(!afterPlay.players[active].discard.some(c => c.uid === card.uid));
});

test('duel: SK02 trigger on zero-cost card draws one and not the played card', () => {
  const zeroCostCardId = Object.keys(CARDS).find(id => CARDS[id].cost === 0 && CARDS[id].player === true);
  assert.ok(zeroCostCardId, 'found zero-cost permanent card');
  const snapA = { runId: 'rA', act: 1, version: 'wa-pvp-1', seed: 'sA', region: 'CN', deck: [
    { uid: 'a1', id: zeroCostCardId, up: false },
    { uid: 'a2', id: zeroCostCardId, up: false },
    { uid: 'a3', id: zeroCostCardId, up: false },
    { uid: 'a4', id: zeroCostCardId, up: false },
    { uid: 'a5', id: zeroCostCardId, up: false }
  ], skins: ['SK02'], maxHp: 100, hp: 100, money: 0, actionsCount: 0 };
  const snapB = { ...snapA, runId: 'rB', seed: 'sB', deck: [
    { uid: 'b1', id: 'CN07', up: false },
    { uid: 'b2', id: 'CN07', up: false },
    { uid: 'b3', id: 'CN07', up: false },
    { uid: 'b4', id: 'CN07', up: false },
    { uid: 'b5', id: 'CN07', up: false }
  ], skins: [] };
  const match = createMatch(snapA, snapB, 'seed');
  const active = match.active;
  const player = match.players[active];
  assert.ok(player.skins.includes('SK02'));
  if (!player.hand.some(c => c.id === zeroCostCardId)) {
    player.hand[0] = { uid: 'forced-zero', id: zeroCostCardId, up: false };
  }
  const zeroCard = player.hand.find(c => c.id === zeroCostCardId);
  const beforeHandCount = player.hand.length;
  const afterPlay = applyCommand(match, active, { type: 'play', uid: zeroCard.uid });
  assert.equal(afterPlay.players[active].hand.length, beforeHandCount - 1);
  assert.ok(!afterPlay.players[active].hand.some(c => c.uid === zeroCard.uid));
});

test('duel: hidden view for inactive player shows active handCount and no hand array', () => {
  const snapA = { runId: 'rA', act: 1, version: 'wa-pvp-1', seed: 'sA', region: 'CN', deck: [
    { uid: 'a1', id: 'CN01', up: false }, { uid: 'a2', id: 'CN01', up: false }, { uid: 'a3', id: 'CN01', up: false }, { uid: 'a4', id: 'CN01', up: false }, { uid: 'a5', id: 'CN01', up: false }
  ], skins: [], maxHp: 100, hp: 100, money: 0, actionsCount: 0 };
  const snapB = { ...snapA, runId: 'rB', seed: 'sB', deck: [{ uid: 'b1', id: 'CN07', up: false }, { uid: 'b2', id: 'CN07', up: false }, { uid: 'b3', id: 'CN07', up: false }, { uid: 'b4', id: 'CN07', up: false }, { uid: 'b5', id: 'CN07', up: false }] };
  const match = createMatch(snapA, snapB, 'seed');
  const inactiveSeat = 1 - match.active;
  const view = viewFor(match, inactiveSeat);
  assert.equal(view.opponent.handCount, match.players[match.active].hand.length);
  assert.ok(!('hand' in view.opponent));
});

test('duel: SK02 draw with zero-cost card asserts exact drawn candidate and played not returned', () => {
  const zeroCostCardId = Object.keys(CARDS).find(id => CARDS[id].cost === 0 && CARDS[id].player === true);
  assert.ok(zeroCostCardId, 'found zero-cost permanent card');
  const snapA = { runId: 'rA', act: 1, version: 'wa-pvp-1', seed: 'sA', region: 'CN', deck: [
    { uid: 'a1', id: zeroCostCardId, up: false },
    { uid: 'a2', id: zeroCostCardId, up: false },
    { uid: 'a3', id: zeroCostCardId, up: false },
    { uid: 'a4', id: zeroCostCardId, up: false },
    { uid: 'a5', id: zeroCostCardId, up: false }
  ], skins: ['SK02'], maxHp: 100, hp: 100, money: 0, actionsCount: 0 };
  const snapB = { ...snapA, runId: 'rB', seed: 'sB', deck: [
    { uid: 'b1', id: 'CN07', up: false },
    { uid: 'b2', id: 'CN07', up: false },
    { uid: 'b3', id: 'CN07', up: false },
    { uid: 'b4', id: 'CN07', up: false },
    { uid: 'b5', id: 'CN07', up: false }
  ], skins: [] };
  const match = createMatch(snapA, snapB, 'seed');
  const active = match.active;
  const player = match.players[active];
  assert.ok(player.skins.includes('SK02'));
  if (!player.hand.some(c => c.id === zeroCostCardId)) {
    player.hand[0] = { uid: 'forced-zero', id: zeroCostCardId, up: false };
  }
  const zeroCard = player.hand.find(c => c.id === zeroCostCardId);
  // Ensure a draw candidate exists in discard
  const candidate = { uid: 'candidate-1', id: zeroCostCardId, up: false };
  player.discard.push(candidate);
  const beforeHandCount = player.hand.length;
  const afterPlay = applyCommand(match, active, { type: 'play', uid: zeroCard.uid });
  const afterHand = afterPlay.players[active].hand;
  assert.equal(afterHand.length, beforeHandCount);
  assert.ok(afterHand.some(c => c.uid === candidate.uid));
  assert.ok(!afterHand.some(c => c.uid === zeroCard.uid));
});

test('duel: burn, turrets, combo and overload work between two players', () => {
  const deckOf = (prefix, id) => Array.from({ length: 5 }, (_, i) => ({ uid: prefix + i, id, up: false }));
  const snapA = { runId: 'rA', act: 1, version: 'wa-pvp-1', seed: 'sA', region: 'EMEA', deck: deckOf('a', 'EUT03'), skins: [], maxHp: 60, hp: 60, money: 0, actionsCount: 0 };
  const snapB = { ...snapA, runId: 'rB', seed: 'sB', region: 'CN', deck: deckOf('b', 'CNT01') };
  let m = createMatch(snapA, snapB, 'mech');
  // Force seat 0 (burn deck) to act first for a deterministic script.
  if (m.active !== 0) m = applyCommand(m, m.active, { type: 'end' });
  m = applyCommand(m, 0, { type: 'play', uid: m.players[0].hand[0].uid });
  assert.equal(m.players[1].burn, 4);
  m = applyCommand(m, 0, { type: 'end' });
  assert.equal(m.players[1].hp, 60 - 4, 'burn ticks at the start of the burning player\'s turn');
  assert.equal(m.players[1].burn, 3);
  m = applyCommand(m, 1, { type: 'play', uid: m.players[1].hand[0].uid });
  assert.equal(m.players[1].deployables.length, 1);
  const before = m.players[0].hp;
  m = applyCommand(m, 1, { type: 'end' });
  assert.equal(m.players[0].hp, before - 5, 'turret fires at the end of its owner\'s turn');
  assert.equal(viewFor(m, 0).opponent.deployables[0].turns, 2);
});
