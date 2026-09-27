// Structured PvP history: who played what and what it did, public to both seats
// except for hidden information (hand contents, card instance ids, generated cards).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, applyCommand, viewFor, matchStats } from '../online/duel.mjs';
import { CARDS } from '../content.js';

const deck = (prefix, id, n = 10) => Array.from({ length: n }, (_, i) => ({ uid: `${prefix}${i}`, id, up: false }));
const snap = (runId, id, extra = {}) => ({ runId, act: 1, version: 'wa-pvp-1', seed: 's' + runId, region: 'CN', deck: deck(runId, id), skins: [], maxHp: 60, hp: 60, money: 0, actionsCount: 0, ...extra });
// CN03 is a plain 1-cost single-hit attack.
const attackId = 'CN03';
assert.deepEqual(CARDS[attackId].effects, [{ type: 'hit', n: 7, times: 1 }]);

test('pvp history: match start deals both opening hands, then the first turn', () => {
  const m = createMatch(snap('A', attackId), snap('B', attackId), 'hist1');
  assert.deepEqual(m.history.map(e => [e.kind, e.seat]), [['deal', m.active], ['deal', 1 - m.active], ['turn', m.active]]);
  assert.equal(m.history[0].results.draw, 5);
  assert.equal(m.history[1].results.draw, 5);
  const e = m.history[2];
  assert.equal(e.turn, 1);
  assert.equal(e.results.energy, 3);
  assert.equal(e.after[m.active][6], 5, 'after records the hand count');
  assert.equal(e.after[1 - m.active][6], 5);
});

test('pvp history: a play records the card, its cost and the damage dealt', () => {
  const m = createMatch(snap('A', attackId), snap('B', attackId), 'hist2');
  const s = m.active, card = m.players[s].hand[0];
  const hpBefore = m.players[1 - s].hp;
  const next = applyCommand(m, s, { type: 'play', uid: card.uid });
  const e = next.history.at(-1);
  assert.equal(e.kind, 'play');
  assert.equal(e.seat, s);
  assert.equal(e.id, card.id);
  assert.equal(e.uid, card.uid);
  assert.equal(e.cost, CARDS[card.id].cost);
  assert.equal(e.n, 4);
  const lost = hpBefore - next.players[1 - s].hp;
  assert.ok(lost > 0, 'the attack hits');
  assert.equal(e.results.damage, lost);
  assert.equal(e.after[1 - s][0], next.players[1 - s].hp);
  const stats = matchStats(next);
  assert.equal(stats[s].dealt, lost);
  assert.equal(stats[1 - s].taken, lost);
  assert.equal(stats[s].plays, 1);
  assert.deepEqual(stats[s].best, { damage: lost, id: card.id, up: false });
});

test('pvp history: block absorbs are recorded as absorbed, not damage', () => {
  const m = createMatch(snap('A', attackId), snap('B', attackId), 'hist3');
  const s = m.active;
  m.players[1 - s].block = 100;
  const next = applyCommand(m, s, { type: 'play', uid: m.players[s].hand[0].uid });
  const e = next.history.at(-1);
  assert.equal(e.results.damage || 0, 0);
  assert.ok(e.results.absorbed > 0);
  assert.equal(matchStats(next)[1 - s].blocked, e.results.absorbed);
});

test('pvp history: end turn records end + the next player\'s turn start', () => {
  const m = createMatch(snap('A', attackId), snap('B', attackId), 'hist4');
  const s = m.active;
  const next = applyCommand(m, s, { type: 'end' });
  const [end, turn] = next.history.slice(-2);
  assert.equal(end.kind, 'end');
  assert.equal(end.seat, s);
  assert.equal(end.turn, 1);
  assert.equal(end.results.draw, 5, 'the next hand is drawn at the end of the turn');
  assert.equal(turn.kind, 'turn');
  assert.equal(turn.seat, 1 - s);
  assert.equal(turn.turn, 2);
  assert.equal(turn.results.draw, undefined, 'nothing is drawn at turn start');
});

test('pvp history: the opponent view shows played cards but hides hand, uids and generated cards', () => {
  const m = createMatch(snap('A', attackId), snap('B', attackId), 'hist5');
  const s = m.active;
  const card = m.players[s].hand[0];
  const next = applyCommand(m, s, { type: 'play', uid: card.uid });
  next.history.at(-1).results.tokens = ['TK01'];
  const oppView = viewFor(next, 1 - s);
  const mine = viewFor(next, s);
  const e = oppView.history.at(-1);
  assert.equal(e.id, card.id, 'the played card is public');
  assert.equal(e.results.damage, next.history.at(-1).results.damage);
  assert.ok(!('uid' in e), 'instance id hidden');
  assert.ok(!('tokens' in e.results));
  assert.equal(e.results.tokenCount, 1);
  assert.ok(!('hand' in oppView.opponent));
  const leaked = JSON.stringify(oppView.history);
  for (const c of next.players[s].hand) assert.ok(!leaked.includes(c.uid), 'no hand uid leaks through history');
  assert.equal(mine.history.at(-1).uid, card.uid, 'own view keeps the uid');
  assert.deepEqual(mine.history.at(-1).results.tokens, ['TK01']);
  assert.equal(oppView.hasHistory, true);
  assert.equal(oppView.stats[s].plays, 1);
});

test('pvp history: concede, timeout and leave are recorded with their reason', () => {
  const m = createMatch(snap('A', attackId), snap('B', attackId), 'hist6');
  const c = applyCommand(m, 0, { type: 'concede' });
  assert.equal(c.endReason, 'concede');
  assert.deepEqual({ kind: c.history.at(-1).kind, winner: c.history.at(-1).winner, reason: c.history.at(-1).reason, seat: c.history.at(-1).seat }, { kind: 'result', winner: 1, reason: 'concede', seat: 0 });
  assert.equal(applyCommand(m, m.active, { type: 'concede', reason: 'timeout' }).endReason, 'timeout');
  assert.equal(applyCommand(m, 1, { type: 'concede', reason: 'leave' }).endReason, 'leave');
  assert.equal(applyCommand(m, 1, { type: 'concede', reason: 'hacked' }).endReason, 'concede');
  assert.equal(viewFor(c, 1).endReason, 'concede');
});

test('pvp history: a lethal play ends with a result entry for the winner', () => {
  const m = createMatch(snap('A', attackId), snap('B', attackId), 'hist7');
  const s = m.active;
  m.players[1 - s].hp = 1;
  const next = applyCommand(m, s, { type: 'play', uid: m.players[s].hand[0].uid });
  assert.equal(next.status, 'finished');
  const last = next.history.at(-1);
  assert.equal(last.kind, 'result');
  assert.equal(last.winner, s);
  assert.equal(last.reason, 'hp');
  assert.equal(next.history.at(-2).kind, 'play');
});

test('pvp history: matches saved before the history existed still load and keep playing', () => {
  const m = createMatch(snap('A', attackId), snap('B', attackId), 'hist8');
  delete m.history;
  const view = viewFor(m, 0);
  assert.deepEqual(view.history, []);
  assert.equal(view.hasHistory, false);
  assert.deepEqual(view.stats.map(x => x.plays), [0, 0]);
  const next = applyCommand(m, m.active, { type: 'end' });
  assert.deepEqual(next.history.map(e => e.kind), ['end', 'turn']);
  assert.equal(next.history[0].n, 1);
});

test('pvp history: burn ticks are credited to the player who applied the burn', () => {
  const m = createMatch(snap('A', attackId), snap('B', attackId), 'hist9');
  const s = m.active;
  m.players[1 - s].burn = 3;
  const next = applyCommand(m, s, { type: 'end' });
  const turn = next.history.at(-1);
  assert.equal(turn.results.burnDamage, 3);
  const stats = matchStats(next);
  assert.equal(stats[s].dealt, 3);
  assert.equal(stats[1 - s].taken, 3);
});
