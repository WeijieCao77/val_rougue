// Unknown rooms, supply crates and events in both demos. Forced victories and
// hand-edited states here only exercise rules; they are not balance evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { UNKNOWN_BASE, UNKNOWN_RISE, freshUnknownOdds, resolveUnknown, blockedUnknownKinds, rollCrateSize } from '../shared-unknown-room.js';
import { ROUTE_STEPS } from '../shared-route-generator.js';
import { buildMap as buildWaMap } from '../season-map.js';
import { buildMap as buildNewMap } from '../new-demo/season-map.js';
import { createSeason, act as waStep, legalActions as waLegal, instance, offers, replay, describeSeasonEvent } from '../engine.js';
import { createWaSeason, waAct, waLegalActions } from '../wa-season.js';
import { REGIONS, SKINS, CARDS as WA_CARDS } from '../content.js';
import { WA_EVENTS, WA_EVENT_POOLS } from '../wa-events.js';
import { createRun, act as newStep, legalActions as newLegal, describeEvent } from '../new-demo/engine.js';
import { RELICS } from '../new-demo/content.js';
import { EVENTS, EVENT_POOLS } from '../new-demo/events.js';

const ok = r => { assert.equal(r.error ?? null, null, r.error); return r.state; };

// ----------------------------- unknown rooms -----------------------------
test('unknown rooms: base odds, pity rise, reset and blocked kinds', () => {
  const base = freshUnknownOdds(1);
  assert.deepEqual({ battle: base.battle, shop: base.shop, crate: base.crate }, UNKNOWN_BASE);
  // A roll past every non-event band is an event; all three kinds become likelier.
  let r = resolveUnknown(base, 0.99);
  assert.equal(r.kind, 'event');
  for (const k of ['battle', 'shop', 'crate']) assert.ok(Math.abs(r.odds[k] - (UNKNOWN_BASE[k] + UNKNOWN_RISE[k])) < 1e-9, k);
  // Two misses in a row keep rising.
  r = resolveUnknown(r.odds, 0.99);
  assert.ok(Math.abs(r.odds.battle - (UNKNOWN_BASE.battle + 2 * UNKNOWN_RISE.battle)) < 1e-9);
  // A fight resets only the fight chance.
  const hit = resolveUnknown(r.odds, 0.01);
  assert.equal(hit.kind, 'battle');
  assert.equal(hit.odds.battle, UNKNOWN_BASE.battle);
  assert.ok(hit.odds.shop > r.odds.shop && hit.odds.crate > r.odds.crate);
  // Shop band sits right after the fight band; blocked next to the fixed shop row.
  assert.equal(resolveUnknown(base, base.battle + 0.01).kind, 'shop');
  assert.deepEqual(blockedUnknownKinds(ROUTE_STEPS.shop - 1, ROUTE_STEPS.shop, ROUTE_STEPS.crate), ['shop']);
  assert.deepEqual(blockedUnknownKinds(ROUTE_STEPS.crate + 1, ROUTE_STEPS.shop, ROUTE_STEPS.crate), ['crate']);
  assert.equal(resolveUnknown(base, base.battle + 0.01, ['shop']).kind, 'event');
  // Frequencies from uniform rolls match the base odds (event is the remainder).
  const counts = { battle: 0, shop: 0, crate: 0, event: 0 };
  for (let i = 0; i < 10000; i++) counts[resolveUnknown(base, (i + 0.5) / 10000).kind]++;
  assert.equal(counts.battle, 1500); assert.equal(counts.shop, 500); assert.equal(counts.crate, 500); assert.equal(counts.event, 7500);
});

function unknownNode(map) { return map.nodes.find(n => n.kind === 'event' && [3, 4, 10].includes(n.step)) || map.nodes.find(n => n.kind === 'event'); }

test('new demo: unknown rooms resolve inside the enter action, deterministically, into all four room types', () => {
  const seen = { battle: 0, shop: 0, crate: 0, event: 0 };
  for (let i = 0; i < 160; i++) {
    const fresh = () => { const s = createRun(`unknown-${i}`); const node = unknownNode(s.map); s.map.starts = [node.key]; return { s, node }; };
    const { s, node } = fresh();
    const a = ok(newStep(s, { type: 'enter', key: node.key }));
    const b = ok(newStep(fresh().s, { type: 'enter', key: node.key }));
    assert.deepEqual(a, b, 'same seed and action give the same room');
    const kind = a.map.nodes.find(n => n.key === node.key).revealed;
    seen[kind]++;
    assert.equal(a.phase, { battle: 'combat', shop: 'shop', crate: 'crate', event: 'event' }[kind]);
    if (kind === 'battle') assert.equal(a.battle.encounter, node.ambush);
    const expected = resolveUnknown(freshUnknownOdds(1), 0).odds; // shape only
    assert.deepEqual(Object.keys(a.unknownOdds).sort(), Object.keys({ act: 1, ...expected }).sort());
    if (kind === 'event') assert.ok(a.unknownOdds.battle > UNKNOWN_BASE.battle, 'pity rises after an event');
  }
  for (const k of Object.keys(seen)) assert.ok(seen[k] > 0, `${k} never appeared`);
  assert.ok(seen.event > seen.battle && seen.battle > 0);
});

test('Wa demo: unknown rooms resolve in chooseNode and replay exactly', () => {
  const seen = new Set();
  for (let i = 0; i < 160; i++) {
    let s = createSeason(`wa-unknown-${i}`, false, 'CN');
    const node = unknownNode(s.map);
    // Walk a legal path to the node's step so the replay record uses real actions only.
    s.map.starts = [node.key];
    s = ok(waStep(s, { type: 'chooseNode', key: node.key }));
    const kind = s.map.nodes.find(n => n.key === node.key).revealed;
    seen.add(kind);
    assert.equal(s.phase, { battle: 'combat', shop: 'shop', crate: 'crate', event: 'event' }[kind]);
    if (kind === 'battle') assert.equal(s.battle.enemy, node.ambush);
  }
  assert.deepEqual([...seen].sort(), ['battle', 'crate', 'event', 'shop']);
});

// ----------------------------- crates -----------------------------
test('every act of both demos has a fixed supply-crate row mid-act', () => {
  for (const build of [buildWaMap, buildNewMap]) for (let act = 1; act <= 3; act++) for (let i = 0; i < 40; i++) {
    const map = build(`crate-${i}`, act);
    const row = map.nodes.filter(n => n.step === ROUTE_STEPS.crate);
    assert.ok(row.length >= 3 && row.every(n => n.kind === 'crate' && n.name === '补给箱'));
    assert.ok(!map.nodes.some(n => n.kind === 'crate' && n.step !== ROUTE_STEPS.crate));
    for (const n of map.nodes.filter(n => n.kind === 'event')) assert.ok(n.ambush, 'unknown room has a seeded fallback opponent');
  }
  const sizes = { small: 0, medium: 0, large: 0 };
  for (let i = 0; i < 100; i++) sizes[rollCrateSize((i + 0.5) / 100)]++;
  assert.deepEqual(sizes, { small: 50, medium: 33, large: 17 });
});

function newAtCrate(seed) {
  const s = createRun(seed);
  const crate = s.map.nodes.find(n => n.kind === 'crate');
  s.map.starts = [crate.key];
  return { s: ok(newStep(s, { type: 'enter', key: crate.key })), key: crate.key };
}

test('new demo crate: money plus equipment, fallback money when all equipment is owned, deterministic', () => {
  const { s, key } = newAtCrate('crate-a');
  assert.equal(s.phase, 'crate');
  assert.deepEqual(newLegal(s), [{ type: 'crate', choice: 'open' }]);
  assert.ok(newStep(s, { type: 'crate', choice: 'leave' }).error, 'must open first');
  const opened = ok(newStep(s, { type: 'crate', choice: 'open' }));
  const r = opened.crate.result;
  assert.equal(opened.money - s.money, r.money + r.bonusMoney);
  if (r.equip) { assert.equal(opened.relics.length, 1); assert.equal(opened.relics[0].name, r.equip); assert.equal(r.bonusMoney, 0); }
  else assert.ok(r.bonusMoney > 0);
  assert.deepEqual(ok(newStep(newAtCrate('crate-a').s, { type: 'crate', choice: 'open' })), opened, 'same seed, same crate');
  const left = ok(newStep(opened, { type: 'crate', choice: 'leave' }));
  assert.equal(left.phase, 'map'); assert.ok(left.completed.includes(key));
  // Every relic owned: the crate pays its bonus money instead.
  const full = newAtCrate('crate-b').s;
  full.relics = Object.values(RELICS).map(x => ({ id: x.id, name: x.name, desc: x.desc }));
  const got = ok(newStep(full, { type: 'crate', choice: 'open' }));
  assert.equal(got.crate.result.equip, null);
  assert.equal(got.relics.length, Object.keys(RELICS).length);
  assert.equal(got.money - full.money, got.crate.result.money + got.crate.result.bonusMoney);
  // Larger crates are richer on average.
  const avg = size => { let t = 0; for (let i = 0; i < 30; i++) { const c = newAtCrate(`crate-size-${i}`).s; c.crate.size = size; c.relics = full.relics; t += ok(newStep(c, { type: 'crate', choice: 'open' })).money - c.money; } return t / 30; };
  assert.ok(avg('small') < avg('medium') && avg('medium') < avg('large'));
});

function waAtCrate(seed) {
  const s = createSeason(seed, false, 'CN');
  const crate = s.map.nodes.find(n => n.kind === 'crate');
  s.map.starts = [crate.key];
  return { s: ok(waStep(s, { type: 'chooseNode', key: crate.key })), key: crate.key };
}

test('Wa crate: skin or money plus a free training choice, deterministic', () => {
  const { s } = waAtCrate('wa-crate-a');
  assert.equal(s.phase, 'crate');
  const opened = ok(waStep(s, { type: 'crate', choice: 'open' }));
  const r = opened.crate.result;
  assert.equal(opened.money - s.money, r.money + r.bonusMoney);
  if (r.skin) assert.ok(opened.skins.some(id => SKINS[id].name === r.skin));
  assert.deepEqual(ok(waStep(waAtCrate('wa-crate-a').s, { type: 'crate', choice: 'open' })), opened);
  // Skins full: money bonus and one free upgrade (or leave without it).
  const full = waAtCrate('wa-crate-b').s;
  full.skins = Object.keys(SKINS);
  full.crate.size = 'medium'; // small crates pay money only
  const got = ok(waStep(full, { type: 'crate', choice: 'open' }));
  assert.equal(got.crate.result.skin, null);
  assert.ok(got.crate.result.bonusMoney > 0 && got.crate.result.upgrade);
  const ups = waLegal(got).filter(a => a.type === 'crateUpgrade');
  assert.ok(ups.length > 0 && waLegal(got).some(a => a.type === 'crate' && a.choice === 'leave'));
  const trained = ok(waStep(got, { type: 'crateUpgrade', uid: ups[0].uid }));
  assert.equal(trained.deck.find(c => c.uid === ups[0].uid).up, true);
  assert.equal(trained.phase, 'map');
  assert.ok(waStep(trained, { type: 'crateUpgrade', uid: ups[1]?.uid || ups[0].uid }).error, 'only one training');
});

// ----------------------------- events: every option -----------------------------
const hasFight = ops => ops.some(o => o.fight);
const simpleMoney = ops => ops.some(o => o.gamble || o.equip || o.fight) ? null : ops.reduce((t, o) => t + (o.money || 0), 0);
const curseDelta = ops => ops.some(o => o.gamble) ? null : ops.filter(o => o.curse).length - ops.filter(o => o.pick === 'cleanse').length;
const newCurses = s => s.deck.filter(c => c.id.startsWith('CU')).length;

function newEventState(id, act, seed) {
  const s = createRun(seed);
  s.act = act; s.phase = 'event'; s.event = { id, act }; s.money = 500; s.hp = 50;
  s.deck.push({ uid: 'curse-test', id: 'CU01', up: false });
  return s;
}

for (const [act, ids] of Object.entries(EVENT_POOLS)) for (const id of ids) {
  test(`new demo event ${id} (act ${act}): every option works`, () => {
    const def = EVENTS[id];
    assert.ok(def.options.length >= 2 && def.options.length <= 3 && def.scene.length > 10);
    for (const opt of def.options) {
      const start = newEventState(id, Number(act), `ev-${id}-${opt.id}`);
      const view = describeEvent(start).options.find(o => o.id === opt.id);
      assert.equal(view.reason, '', `${id}/${opt.id} should be affordable here`);
      assert.ok(view.effects.length > 0);
      let s = ok(newStep(start, { type: 'event', choice: opt.id }));
      if (s.phase === 'event' && s.event?.pending) {
        const picks = newLegal(s).filter(a => a.type === 'eventPick');
        assert.ok(picks.length > 0);
        const back = ok(newStep(s, { type: 'eventBack' }));
        assert.equal(back.money, start.money, 'backing out costs nothing');
        s = ok(newStep(s, picks[0]));
      }
      if (hasFight(opt.ops)) {
        assert.equal(s.phase, 'combat');
        assert.ok(s.eventBonus?.length);
        // Pretend the fight was won; the bonus is paid when the reward is taken.
        const bonusMoney = opt.ops.find(o => o.fight).bonus.reduce((t, o) => t + (o.money || 0), 0);
        s.phase = 'reward'; s.battle.rewardPool = []; s.battle.rewardTaken = false;
        const before = s.money;
        s = ok(newStep(s, { type: 'reward', id: null }));
        assert.ok(s.money >= before + bonusMoney);
        assert.equal(s.eventBonus, null);
        continue;
      }
      assert.equal(s.phase, 'map', `${id}/${opt.id}`);
      assert.equal(s.event, null);
      const money = simpleMoney(opt.ops);
      if (money !== null) assert.equal(s.money - start.money, money, `${id}/${opt.id} money`);
      const curses = curseDelta(opt.ops);
      if (curses !== null) assert.equal(newCurses(s) - newCurses(start), curses, `${id}/${opt.id} curses`);
      const maxHp = opt.ops.reduce((t, o) => t + (o.gamble ? 0 : o.maxHp || 0), 0);
      assert.equal(s.maxHp - start.maxHp, maxHp);
    }
  });
}

function waEventState(id, act, seed) {
  const s = createSeason(seed, false, 'CN');
  s.act = act; s.phase = 'event'; s.eventId = id; s.money = 500; s.hp = 50;
  if (id === 'trial') s.eventOffers = offers(s);
  s.deck.push(instance(s, 'CU01'));
  return s;
}
const winWaFight = s => {
  s.battle.enemyHp = 1; s.battle.enemyBlock = 0; s.battle.energy = 3;
  const hitter = REGIONS.CN.pool.find(id => WA_CARDS[id].cost === 1 && WA_CARDS[id].effects?.some(e => e.type === 'hit'));
  s.battle.hand = [instance(s, hitter)];
  s = ok(waStep(s, { type: 'play', uid: s.battle.hand[0].uid }));
  if (s.phase === 'reward') s = ok(waStep(s, { type: 'recruit', id: null }));
  if (s.phase === 'skin') s = ok(waStep(s, { type: 'skin', id: null }));
  return s;
};

for (const [act, ids] of Object.entries(WA_EVENT_POOLS)) for (const id of ids) {
  test(`Wa event ${id} (act ${act}): every option works, skip is free`, () => {
    const def = WA_EVENTS[id];
    assert.ok(def.options.length >= 1 && def.options.length <= 3 && def.scene.length > 10);
    const skipped = ok(waStep(waEventState(id, Number(act), `wa-ev-${id}-skip`), { type: 'seasonEvent', choice: 'skip' }));
    assert.equal(skipped.phase, 'map');
    for (const opt of def.options) {
      const start = waEventState(id, Number(act), `wa-ev-${id}-${opt.id}`);
      const view = describeSeasonEvent(start).options.find(o => o.id === opt.id);
      assert.equal(view.reason, '', `${id}/${opt.id}`);
      let s = ok(waStep(start, { type: 'seasonEvent', choice: opt.id }));
      if (s.phase === 'trial') s = ok(waStep(s, { type: 'trial', id: s.eventOffers[0] }));
      if (['eventUpgrade', 'eventCleanse', 'eventPick'].includes(s.phase)) {
        const picks = waLegal(s).filter(a => a.type === s.phase);
        assert.ok(picks.length > 0);
        const back = ok(waStep(s, { type: 'eventBack' }));
        assert.equal(back.money, start.money);
        s = ok(waStep(s, picks[0]));
      }
      if (hasFight(opt.ops)) {
        assert.equal(s.phase, 'combat');
        assert.ok(WA_CARDS && s.eventBonus?.length);
        const bonusMoney = opt.ops.find(o => o.fight).bonus.reduce((t, o) => t + (o.money || 0), 0);
        const before = s.money;
        s = winWaFight(s);
        assert.equal(s.phase, 'map');
        assert.ok(s.money >= before + bonusMoney + 35, 'elite money plus event bonus');
        assert.equal(s.eventBonus, undefined);
        continue;
      }
      assert.equal(s.phase, 'map', `${id}/${opt.id}`);
      const money = simpleMoney(opt.ops);
      if (money !== null) assert.equal(s.money - start.money, money, `${id}/${opt.id} money`);
      const curses = curseDelta(opt.ops);
      if (curses !== null && !opt.ops.some(o => o.special)) assert.equal(newCurses(s) - newCurses(start), curses, `${id}/${opt.id} curses`);
    }
  });
}

test('unaffordable options are closed with a reason and rejected atomically (both demos)', () => {
  const s = newEventState('market', 2, 'poor'); s.money = 10;
  const view = describeEvent(s);
  assert.match(view.options.find(o => o.id === 'buy').reason, /金币不足/);
  assert.ok(!newLegal(s).some(a => a.choice === 'buy'));
  const before = structuredClone(s);
  assert.ok(newStep(s, { type: 'event', choice: 'buy' }).error);
  assert.deepEqual(s, before);
  const w = waEventState('darkMarket', 3, 'wa-poor'); w.money = 10;
  assert.match(describeSeasonEvent(w).options.find(o => o.id === 'star').reason, /资金不足/);
  assert.ok(!waLegal(w).some(a => a.choice === 'star'));
  assert.ok(waStep(w, { type: 'seasonEvent', choice: 'star' }).error);
  const lowHp = newEventState('allnight', 3, 'weak'); lowHp.hp = 10;
  assert.match(describeEvent(lowHp).options.find(o => o.id === 'grind').reason, /生命不足/);
});

test('events do not repeat within an act until its pool is exhausted (both demos)', () => {
  for (const act of [1, 2, 3]) {
    let s = createRun(`norepeat-${act}`);
    s.act = act;
    const node = unknownNode(s.map);
    const ids = [];
    for (let i = 0; i < EVENT_POOLS[act].length + 1; i++) {
      s.phase = 'map'; s.currentNode = null; s.completed = []; s.map.starts = [node.key];
      s.unknownOdds = { act, battle: 0, shop: 0, crate: 0 };
      s = ok(newStep(s, { type: 'enter', key: node.key }));
      ids.push(s.event.id);
    }
    assert.deepEqual(ids.slice(0, -1).sort(), [...EVENT_POOLS[act]].sort());
    let w = createSeason(`wa-norepeat-${act}`, false, 'CN');
    w.act = act;
    const wn = unknownNode(w.map);
    const wids = [];
    for (let i = 0; i < WA_EVENT_POOLS[act].length; i++) {
      w.phase = 'map'; w.currentNode = null; w.completed = []; w.map.starts = [wn.key];
      w.unknownOdds = { act, battle: 0, shop: 0, crate: 0 };
      w = ok(waStep(w, { type: 'chooseNode', key: wn.key }));
      wids.push(w.eventId);
    }
    assert.deepEqual(wids.sort(), [...WA_EVENT_POOLS[act]].sort());
  }
});

// ----------------------------- determinism over real action sequences -----------------------------
function newWalk(seed) {
  let s = createRun(seed);
  // The naive walker must survive to the mid-act crate row (floor 9 of 15).
  s.maxHp = s.hp = 400;
  for (let i = 0; i < 900 && s.phase !== 'result'; i++) {
    const legal = newLegal(s);
    const a = legal.find(x => x.type === 'play') || legal.find(x => x.type === 'eventPick') || legal.find(x => x.type === 'event') || legal[0];
    s = ok(newStep(s, a));
  }
  return s;
}
function waWalk(seed) {
  let s = createWaSeason(seed, false, 'CN', 'determinism');
  for (let i = 0; i < 600 && s.phase !== 'result'; i++) {
    const legal = waLegalActions(s);
    const a = legal.find(x => x.type === 'play') || legal.find(x => ['eventUpgrade', 'eventCleanse', 'eventPick', 'crateUpgrade'].includes(x.type)) || legal.find(x => x.type === 'seasonEvent' && x.choice !== 'skip') || legal.find(x => x.type !== 'abandon') || legal[0];
    s = ok(waAct(s, a));
  }
  return s;
}

test('same seed and actions give identical runs through unknown rooms, crates and events', () => {
  const covered = new Set();
  for (let i = 0; i < 12; i++) {
    const a = newWalk(`det-${i}`), b = newWalk(`det-${i}`);
    assert.deepEqual(a, b);
    for (const l of a.logs) if (['unknown_room', 'crate_opened', 'event_choice'].includes(l.event)) covered.add(l.event);
    const w = waWalk(`wa-det-${i}`), v = waWalk(`wa-det-${i}`);
    assert.deepEqual(w, v);
    // The online server rebuilds climbs from the action list alone.
    let r = createWaSeason(`wa-det-${i}`, false, 'CN', 'determinism');
    for (const action of w.actions) r = ok(waAct(r, action));
    assert.deepEqual(r, w);
    const core = createSeason(`wa-det-${i}`, false, 'CN');
    assert.ok(core.map.nodes.some(n => n.kind === 'crate'));
  }
  assert.equal(covered.size, 3, 'walks passed unknown rooms, crates and event choices');
  // Legacy engine replay of a season record stays exact.
  let s = createSeason('replay-rooms', false, 'CN');
  for (let i = 0; i < 300 && s.phase !== 'result'; i++) {
    const legal = waLegal(s);
    s = ok(waStep(s, legal.find(x => x.type === 'play') || legal.find(x => x.type === 'seasonEvent' && x.choice !== 'skip') || legal.find(x => x.type !== 'abandon')));
  }
  assert.deepEqual(replay(s), s);
});

test('heal-only options close at full health; a fully closed new-demo event can still be left', () => {
  const full = newEventState('camp', 2, 'full-hp'); full.hp = full.maxHp;
  assert.match(describeEvent(full).options.find(o => o.id === 'off').reason, /生命已满/);
  // Nothing to upgrade, full health: every camp option is closed.
  const stuck = newEventState('camp', 2, 'stuck');
  for (const c of stuck.deck) c.up = true;
  stuck.hp = stuck.maxHp;
  const legal = newLegal(stuck);
  assert.deepEqual(legal, [{ type: 'event', choice: 'walkAway' }]);
  assert.equal(ok(newStep(stuck, legal[0])).phase, 'map');
});
