import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, scoreFormulaText, SCORE_RULES, HISTORY_CAP, addHistory, loadHistory, recordRun, mergeSeen, markSeen, loadCollection, seenCount, trackStep, newTracker, filterSortCards, formatDuration } from '../shared/run-meta.js';
import * as wa from '../engine.js';
import { ENEMIES as WA_ENEMIES, FIELDS as WA_FIELDS } from '../content.js';
import * as nd from '../new-demo/engine.js';
import { ENEMIES as ND_ENEMIES, GROUPS as ND_GROUPS, FIELDS as ND_FIELDS } from '../new-demo/content.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), map: m };
}
function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }

test('score formula: every line is count × points, then the difficulty bonus', () => {
  const r = computeScore({ floors: 20, elites: 2, bosses: 1, perfect: 3, hp: 41, gold: 257, won: false, ascension: 0 });
  const by = Object.fromEntries(r.lines.map(l => [l.key, l.points]));
  assert.deepEqual(by, { floors: 100, elites: 50, bosses: 50, perfect: 30, hp: 41, gold: 25, victory: 0 });
  assert.equal(r.subtotal, 296);
  assert.equal(r.total, 296);
  const won = computeScore({ floors: 48, elites: 3, bosses: 3, perfect: 5, hp: 30, gold: 99, won: true, ascension: 3 });
  assert.equal(won.subtotal, 48 * 5 + 75 + 150 + 50 + 30 + 9 + 250);
  assert.equal(won.percent, 130);
  assert.equal(won.total, Math.floor(won.subtotal * 1.3));
  assert.equal(computeScore({}).total, 0);
  assert.equal(computeScore({ hp: -5, gold: 'x' }).total, 0, 'garbage never goes negative');
  assert.equal(SCORE_RULES.length, won.lines.length);
  assert.match(scoreFormulaText(), /难度加成/);
  assert.equal(computeScore({ hp: 3 }, { hp: '剩余声望' }).lines.find(l => l.key === 'hp').label, '剩余声望');
});

test('history keeps the newest 30 runs per key and records a run once', () => {
  const st = fakeStorage();
  for (let i = 0; i < 40; i++) recordRun(st, 'wa-hist', { id: `run-${i}`, outcome: i % 3 ? 'loss' : 'win', score: i });
  const list = loadHistory(st, 'wa-hist');
  assert.equal(list.length, HISTORY_CAP);
  assert.equal(list[0].id, 'run-39');
  assert.equal(list.at(-1).id, 'run-10');
  recordRun(st, 'wa-hist', { id: 'run-39', outcome: 'loss', score: -1 });
  assert.equal(loadHistory(st, 'wa-hist')[0].score, 39, 'a re-rendered results screen does not duplicate or overwrite');
  assert.equal(loadHistory(st, 'new-hist').length, 0, 'demos use separate keys');
  recordRun(st, 'new-hist', { id: 'run-39', outcome: 'abandon' });
  assert.equal(loadHistory(st, 'new-hist').length, 1);
  st.setItem('bad', '{not json');
  assert.deepEqual(loadHistory(st, 'bad'), []);
  st.setItem('mixed', JSON.stringify([{ id: 'a', outcome: 'win' }, null, { id: 3, outcome: 'win' }, { id: 'b', outcome: 'weird' }]));
  assert.deepEqual(loadHistory(st, 'mixed').map(e => e.id), ['a']);
  assert.equal(addHistory(Array.from({ length: 50 }, (_, i) => ({ id: 'x' + i })), { id: 'new' }).length, HISTORY_CAP);
});

test('seen tracking only grows, ignores junk and is stored per demo', () => {
  const st = fakeStorage();
  let c = markSeen(st, 'wa-seen', { cards: ['A', 'B', 'A'], enemies: new Set(['E1']) });
  assert.deepEqual(c.cards, ['A', 'B']);
  c = markSeen(st, 'wa-seen', { cards: ['B', 'C', '', null], gear: ['G1'] });
  assert.deepEqual(loadCollection(st, 'wa-seen'), { cards: ['A', 'B', 'C'], gear: ['G1'], supplies: [], enemies: ['E1'] });
  assert.deepEqual(loadCollection(st, 'new-seen').cards, []);
  const { changed, added } = mergeSeen(c, { cards: ['A'], supplies: ['S1'] });
  assert.equal(changed, true);
  assert.deepEqual(added.supplies, ['S1']);
  assert.equal(mergeSeen(c, { cards: ['A'] }).changed, false);
  assert.deepEqual(seenCount(c, 'cards', ['A', 'C', 'Z', 'Y']), { seen: 2, total: 4 });
  st.setItem('broken', '[1,2]');
  assert.deepEqual(loadCollection(st, 'broken').cards, []);
});

test('run tracker counts perfect fights and elites and remembers the fatal fight', () => {
  const snap = (phase, hp, fight, outcome) => ({ seed: 's1', phase, hp, inCombat: phase === 'combat', fight, outcome });
  let t = newTracker('s1', 1000);
  const f1 = { enemy: 'E1', name: '甲', act: 1, floor: 1, kind: 'battle' };
  t = trackStep(t, snap('map', 80));
  t = trackStep(t, snap('combat', 80, f1));
  t = trackStep(t, snap('combat', 80, f1));
  t = trackStep(t, snap('reward', 80));
  assert.equal(t.fights, 1); assert.equal(t.perfect, 1);
  const f2 = { enemy: 'EL', name: '乙', act: 1, floor: 6, kind: 'elite' };
  t = trackStep(t, snap('combat', 80, f2));
  t = trackStep(t, snap('combat', 71, f2));
  t = trackStep(t, snap('combat', 75, f2)); // healing does not undo damage taken
  t = trackStep(t, snap('reward', 83));
  assert.equal(t.fights, 2); assert.equal(t.perfect, 1); assert.equal(t.elites, 1);
  assert.equal(t.lastFight.lost, 9);
  const f3 = { enemy: 'B', name: '丙', act: 2, floor: 9, kind: 'battle' };
  t = trackStep(t, snap('combat', 60, f3));
  t = trackStep(t, snap('result', 0, null, 'loss'));
  assert.equal(t.fights, 2);
  assert.deepEqual([t.lastFight.name, t.lastFight.floor, t.lastFight.won], ['丙', 9, false]);
  const f4 = { enemy: 'B', name: '丁', act: 2, floor: 10, kind: 'battle' };
  let u = trackStep(newTracker('s1'), snap('combat', 50, f4));
  u = trackStep(u, snap('result', 50, null, 'abandon'));
  assert.equal(u.fights, 0, 'abandoning mid-fight is not a win');
  assert.equal(trackStep(t, { seed: 'other', phase: 'map', hp: 80 }).fights, 0, 'a new seed starts a new tracker');
});

test('deck viewer filters by type and cost and sorts without touching draw order', () => {
  const cards = [{ id: 'b', cost: 2, t: 'skill' }, { id: 'a', cost: 1, t: 'attack' }, { id: 'c', cost: null, t: 'status' }, { id: 'd', cost: 3, t: 'attack' }, { id: 'a', cost: 1, t: 'attack', up: true }];
  const info = { typeOf: c => c.t, costOf: c => c.cost, nameOf: c => c.id, orderOf: c => ['attack', 'skill', 'status'].indexOf(c.t) };
  const ids = l => l.map(c => c.id + (c.up ? '+' : ''));
  assert.deepEqual(ids(filterSortCards(cards, {}, info)), ['b', 'a', 'c', 'd', 'a+']);
  assert.deepEqual(ids(filterSortCards(cards, { sort: 'cost' }, info)), ['a', 'a+', 'b', 'd', 'c']);
  assert.deepEqual(ids(filterSortCards(cards, { sort: 'name' }, info)), ['a', 'a+', 'b', 'c', 'd']);
  assert.deepEqual(ids(filterSortCards(cards, { sort: 'type' }, info)), ['a', 'a+', 'd', 'b', 'c']);
  assert.deepEqual(ids(filterSortCards(cards, { type: 'attack', cost: '3+' }, info)), ['d']);
  assert.deepEqual(ids(filterSortCards(cards, { cost: 'x' }, info)), ['c']);
  assert.equal(cards[0].id, 'b', 'input is not reordered');
  assert.equal(formatDuration(65000), '1 分 5 秒');
  assert.equal(formatDuration(3723000), '1 小时 2 分');
});

// Force a quiet turn: no block, empty hand, no deployables, so the HP lost when
// the turn ends is exactly the damage the enemy dealt.
test('Wa: intent damage preview equals the damage the enemy turn deals', () => {
  const seasonIds = Object.keys(WA_ENEMIES).filter(id => /(^|_)S_/.test(id));
  const fields = [null, ...Object.keys(WA_FIELDS)];
  const r = rng(7);
  let checked = 0, modified = 0;
  for (const [n, id] of seasonIds.entries()) {
    let s = wa.createSeason('intent-' + n, false, ['CN', 'AM', 'EMEA', 'PAC'][n % 4], { rules: 1 });
    s = wa.act(s, { type: 'opening', choice: 'trainRandom' }).state;
    s = wa.act(s, { type: 'chooseNode', key: s.map.starts[0] }).state;
    wa.startBattle(s, id);
    s.maxHp = s.hp = 999;
    for (let turn = 0; turn < 6 && s.phase === 'combat'; turn++) {
      const b = s.battle;
      b.hand = []; b.block = 0; b.deployables = []; b.enemyBurn = 0; b.enemyHp = Math.max(b.enemyHp, 500);
      b.vulnerable = r() < 0.4 ? 1 : 0;
      b.enemyWeak = r() < 0.4 ? 1 : 0;
      b.enemyStrength = Math.floor(r() * 4);
      b.field = fields[Math.floor(r() * fields.length)];
      b.turn = 1 + Math.floor(r() * 7);
      const inc = wa.incomingDamage(s);
      const plain = wa.intent(s).filter(a => a.type === 'hit' || a.type === 'snipe').reduce((t, a) => t + a.n * (a.type === 'snipe' ? 1 : a.times), 0);
      if (inc.total !== plain) modified++;
      const hp = s.hp;
      const res = wa.act(s, { type: 'end' });
      assert.equal(res.error, null);
      s = res.state;
      assert.equal(hp - s.hp, inc.total, `${id} turn ${turn}: ${wa.intentText(s)}`);
      checked++;
    }
  }
  assert.ok(checked > 60 && modified > 5, `${checked} turns, ${modified} with our vulnerable applied`);
});

test('Wa: the intent text can show the actual numbers', () => {
  let s = wa.createSeason('intent-text', false, 'CN', { rules: 1 });
  s = wa.act(s, { type: 'opening', choice: 'trainRandom' }).state;
  s = wa.act(s, { type: 'chooseNode', key: s.map.starts[0] }).state;
  wa.startBattle(s, 'S_E03');
  s.battle.intent = 0; s.battle.enemyStrength = 0; s.battle.enemyWeak = 0; s.battle.field = null;
  s.battle.vulnerable = 2;
  const hit = wa.intent(s).find(a => a.type === 'hit');
  assert.equal(hit.times, 3);
  const per = Math.floor(hit.n * 1.5);
  assert.match(wa.intentText(s), new RegExp(`攻击 ${hit.n} × 3`));
  assert.match(wa.intentText(s, true), new RegExp(`攻击 ${per} × 3 = ${per * 3}`));
  assert.equal(wa.incomingDamage(s).total, per * 3);
});

function ndBattle(enemy, seed) {
  const run = nd.createRun(seed);
  run.map = { nodes: [{ key: 'n', kind: ND_GROUPS[enemy] ? 'battle' : ND_ENEMIES[enemy]?.boss ? 'boss' : 'battle', enemy, step: 5 }], edges: [], starts: ['n'], bossId: 'x' };
  const r = nd.act(run, { type: 'enter', key: 'n' });
  assert.equal(r.error, undefined, enemy + ' ' + r.error);
  return r.state;
}

test('New demo: intent damage preview equals the damage the enemy turn deals', () => {
  const ids = [...Object.keys(ND_ENEMIES), ...Object.keys(ND_GROUPS)];
  const fields = [null, ...Object.keys(ND_FIELDS)];
  const r = rng(11);
  let checked = 0, modified = 0;
  for (const [n, id] of ids.entries()) {
    let s = ndBattle(id, 'nd-intent-' + n);
    s.maxHp = s.hp = 999;
    for (let turn = 0; turn < 5 && s.phase === 'combat'; turn++) {
      const b = s.battle;
      b.hand = []; b.playerBlock = 0; b.deployables = [];
      b.stance = r() < 0.5 ? 'push' : 'cover';
      b.statuses.player.vuln = r() < 0.4 ? 1 : 0;
      b.field = fields[Math.floor(r() * fields.length)];
      b.turn = 1 + Math.floor(r() * 7);
      for (const e of nd.livingEnemies(b)) {
        e.hp = Math.max(e.hp, 300);
        e.statuses.burn = 0;
        e.statuses.weak = r() < 0.35 ? 1 : 0;
        e.statuses.smoke = r() < 0.3 ? 1 + Math.floor(r() * 3) : 0;
        e.statuses.flash = r() < 0.25 ? 1 : 0;
        e.statuses.strength = Math.floor(r() * 3);
      }
      if ('enemyHp' in b) b.enemyHp = Math.max(b.enemyHp, 300);
      const inc = nd.incomingDamage(s);
      const texts = nd.describeIntentsActual(s);
      for (const [uid, v] of Object.entries(inc.byEnemy)) {
        for (const hits of v.acts.filter(Boolean)) {
          const same = hits.every(x => x === hits[0]);
          assert.ok(texts[uid].includes(same ? `${hits[0]}` : hits.join('+')), `${texts[uid]} shows ${hits}`);
        }
      }
      if (Object.values(inc.byEnemy).some(v => v.hits.length)) modified += b.stance === 'push' || b.statuses.player.vuln ? 1 : 0;
      const hp = s.hp;
      const res = nd.act(s, { type: 'end' });
      assert.equal(res.error, undefined);
      s = res.state;
      assert.equal(hp - s.hp, inc.total, `${id} turn ${turn}: ${JSON.stringify(inc.byEnemy)}`);
      checked++;
    }
  }
  assert.ok(checked > 100 && modified > 20, `${checked} turns checked`);
});
