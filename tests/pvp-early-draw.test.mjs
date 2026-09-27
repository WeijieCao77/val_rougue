// PvP rule: the next hand is drawn at the END of your own turn, so you can study it
// during the opponent's turn; it cannot be played until your turn starts. Matches
// stored before the rule (no earlyDraw flag) keep drawing at turn start.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, applyCommand, viewFor } from '../online/duel.mjs';

const deck = (prefix, id, n = 15) => Array.from({ length: n }, (_, i) => ({ uid: `${prefix}${i}`, id, up: false }));
const snap = (runId, id = 'CN03', extra = {}) => ({ runId, act: 1, version: 'wa-pvp-1', seed: 's' + runId, region: 'CN', deck: deck(runId, id), skins: [], maxHp: 80, hp: 80, money: 0, actionsCount: 0, ...extra });

test('early draw: both players start the match holding their opening hand', () => {
  const m = createMatch(snap('A'), snap('B'), 'ed1');
  assert.equal(m.earlyDraw, true);
  assert.equal(m.players[0].hand.length, 5);
  assert.equal(m.players[1].hand.length, 5);
  assert.equal(m.players[0].drawPile.length, 10);
  assert.equal(m.players[m.active].energy, 3);
  const waiting = viewFor(m, 1 - m.active);
  assert.equal(waiting.you.hand.length, 5, 'the waiting player sees their own hand');
  assert.equal(viewFor(m, m.active).opponent.handCount, 5);
  assert.ok(!('hand' in viewFor(m, m.active).opponent), 'the opponent hand stays hidden');
});

test('early draw: ending a turn discards the hand and draws the next 5 at once', () => {
  const m = createMatch(snap('A'), snap('B'), 'ed2');
  const s = m.active;
  const before = m.players[s].hand.map(c => c.uid);
  const next = applyCommand(m, s, { type: 'end' });
  const hand = next.players[s].hand;
  assert.equal(hand.length, 5);
  assert.ok(hand.every(c => !before.includes(c.uid)), 'a fresh hand, the old one was discarded');
  assert.equal(next.players[s].discard.length, 5);
  // The next player drew nothing extra at the start of their turn.
  assert.equal(next.players[1 - s].hand.length, 5);
  assert.equal(next.players[1 - s].energy, 3);
});

test('early draw: the held hand cannot be played during the opponent turn', () => {
  const m = createMatch(snap('A'), snap('B'), 'ed3');
  const s = m.active;
  const next = applyCommand(m, s, { type: 'end' });
  const held = next.players[s].hand[0];
  assert.throws(() => applyCommand(next, s, { type: 'play', uid: held.uid }), /not your turn/);
  // Once their turn comes back it plays normally.
  const back = applyCommand(next, 1 - s, { type: 'end' });
  assert.equal(back.active, s);
  assert.equal(back.players[s].hand.length, 5, 'still the same held hand, nothing drawn at turn start');
  assert.deepEqual(back.players[s].hand.map(c => c.uid), next.players[s].hand.map(c => c.uid));
  const played = applyCommand(back, s, { type: 'play', uid: held.uid });
  assert.equal(played.players[s].hand.length, 4);
});

test('early draw: retained cards stay and 额外抽牌 powers apply to the end-of-turn draw', () => {
  const m = createMatch(snap('A'), snap('B'), 'ed4');
  const s = m.active;
  m.players[s].powers.push({ uid: 'pw', id: 'CN18', up: true });
  const next = applyCommand(m, s, { type: 'end' });
  assert.equal(next.players[s].hand.length, 6, '5 + 1 extra draw from the upgraded CN18 power');
});

test('early draw: the PAC temporary card still arrives at turn start', () => {
  const m = createMatch(snap('A', 'CN03', { region: 'PAC' }), snap('B', 'CN03', { region: 'PAC' }), 'ed5');
  const s = m.active;
  assert.equal(m.players[s].hand.length, 6, 'opening 5 + the turn-start temporary card');
  assert.equal(m.players[1 - s].hand.length, 5, 'the waiting player gets theirs when their turn starts');
  const next = applyCommand(m, s, { type: 'end' });
  assert.equal(next.players[1 - s].hand.length, 6);
  assert.equal(next.players[s].hand.length, 5, 'the temporary card exhausted, 5 drawn');
});

test('early draw: an old stored match without the flag keeps drawing at turn start', () => {
  const m = createMatch(snap('A'), snap('B'), 'ed6', { earlyDraw: false });
  assert.ok(!('earlyDraw' in m));
  const s = m.active;
  assert.equal(m.players[s].hand.length, 5);
  assert.equal(m.players[1 - s].hand.length, 0);
  const next = applyCommand(m, s, { type: 'end' });
  assert.equal(next.players[s].hand.length, 0, 'the ender holds nothing during the opponent turn');
  assert.equal(next.players[1 - s].hand.length, 5, 'the next player draws at turn start');
  // A JSON round trip (how the server stores matches) keeps the old behaviour.
  const stored = JSON.parse(JSON.stringify(next));
  const back = applyCommand(stored, 1 - s, { type: 'end' });
  assert.equal(back.players[s].hand.length, 5);
  assert.equal(back.players[1 - s].hand.length, 0);
});
