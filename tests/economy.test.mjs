// Unlock progression, skip compensation, investments and shop rerolls (both demos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { UNLOCK_TIERS, UNLOCK_XP, tierOfXp, awardRun, normalizeProgress, progressTier, progressGearTier, runXp } from '../shared-unlock.js';
import * as wa from '../engine.js';
import { REGIONS, TACTICS } from '../content.js';
import { CARD_RARITY } from '../card-rarity.js';
import { GEAR_UNLOCKS, INVESTMENTS, SKIP_FUNDS } from '../wa-rules.js';
import * as nd from '../new-demo/engine.js';
import { TEAMS, CARDS as ND_CARDS, ARCHETYPES, REGION_CARD_IDS } from '../new-demo/content.js';
import { openStore } from '../online/store.mjs';
import { createOnlineHandler } from '../online/api.mjs';

test('unlock plan: five batches of 8 cards, starters and every rarity stay in the base pool, at most half of a direction locked', () => {
  for (const region of Object.keys(REGIONS)) {
    const plan = wa.regionUnlockPlan(region), pool = REGIONS[region].pool;
    assert.equal(plan.tiers.length, UNLOCK_TIERS);
    for (const t of plan.tiers) assert.equal(t.length, 8);
    assert.equal(plan.base.length + 40, pool.length);
    for (const id of REGIONS[region].start) assert.ok(plan.base.includes(id));
    for (const r of ['common', 'uncommon', 'rare']) assert.ok(plan.base.filter(id => CARD_RARITY[id] === r).length >= 2, `${region} base ${r}`);
    const locked = plan.tiers.flat(), dirs = {};
    for (const id of pool) { const d = TACTICS[id]?.archetype; if (d) (dirs[d] ||= { n: 0, locked: 0 }).n++; }
    for (const id of locked) { const d = TACTICS[id]?.archetype; if (d) dirs[d].locked++; }
    for (const [d, v] of Object.entries(dirs)) assert.ok(v.locked <= Math.floor(v.n / 2), `${region} ${d}`);
    assert.deepEqual(wa.regionUnlockPlan(region), plan);
  }
  for (const team of Object.keys(TEAMS)) {
    const plan = nd.teamUnlockPlan(team);
    assert.equal(plan.tiers.flat().length, 40);
    assert.equal(plan.base.length, 35);
    for (const id of plan.tiers.flat()) assert.ok(REGION_CARD_IDS[TEAMS[team].region].includes(id));
  }
});

test('unlock experience: tiers, per-run awards counted once, all-unlock toggle', () => {
  assert.deepEqual(tierOfXp(0), { tier: 0, into: 0, need: UNLOCK_XP[0] });
  assert.deepEqual(tierOfXp(UNLOCK_XP[0] + 3), { tier: 1, into: 3, need: UNLOCK_XP[1] });
  assert.equal(tierOfXp(1e6).tier, UNLOCK_TIERS);
  assert.equal(runXp({ wins: 9, bosses: 1, cleared: false }), 19);
  let p = normalizeProgress({});
  let r = awardRun(p, 'CN', 'run-a', 12); p = r.progress;
  assert.equal(r.gained, 12);
  r = awardRun(p, 'CN', 'run-a', 25); p = r.progress;
  assert.equal(r.gained, 13);
  assert.equal(r.fromTier, 0); assert.equal(r.toTier, 1); assert.equal(r.toGear, 1);
  assert.equal(awardRun(p, 'CN', 'run-a', 25).gained, 0);
  assert.equal(progressTier(p, 'CN'), 1); assert.equal(progressTier(p, 'AM'), 0); assert.equal(progressGearTier(p), 1);
  assert.equal(progressTier({ ...p, all: true }, 'AM'), UNLOCK_TIERS);
});

function playWa(s, pick, limit = 3000) {
  for (let i = 0; i < limit && s.phase !== 'result'; i++) {
    const a = pick(s, wa.legalActions(s));
    const r = wa.act(s, a);
    assert.equal(r.error, null, JSON.stringify(a));
    s = r.state;
  }
  return s;
}

test('Wa: a base-tier season only offers base cards and equipment, and replays exactly', () => {
  const base = new Set(wa.regionUnlockPlan('AM').base), lockedGear = new Set(GEAR_UNLOCKS.flat());
  let s = wa.createSeason('econ-base', false, 'AM', { rules: 1, econ: 1, unlockTier: 0, gearTier: 0 });
  assert.equal(wa.offerPool(s).length, 35);
  const seen = new Set(), gear = new Set();
  s = playWa(s, (st, acts) => {
    if (st.reward?.offers) st.reward.offers.forEach(id => seen.add(id));
    if (st.shop?.slots) st.shop.slots.forEach(id => id && seen.add(id));
    (st.shop?.gear || []).forEach(id => id && gear.add(id));
    (st.reward?.bossGear || []).forEach(id => gear.add(id));
    return acts.find(a => a.type === 'rerollShop') || acts[0];
  });
  assert.ok(seen.size > 5);
  for (const id of seen) assert.ok(base.has(id), id);
  for (const id of [...gear, ...s.skins]) assert.ok(!lockedGear.has(id), id);
  const again = wa.replay({ version: s.version, seed: s.seed, region: s.region, rules: 1, econ: 1, unlockTier: 0, gearTier: 0, mapVersion: s.mapVersion, actions: s.actions });
  assert.deepEqual(again.deck, s.deck);
  assert.throws(() => wa.createSeason('x', false, 'AM', { econ: 1 }), /经济规则/);
  assert.throws(() => wa.createSeason('x', false, 'AM', { rules: 1, econ: 1, unlockTier: 6 }), /解锁等级/);
  assert.equal(wa.offerPool(wa.createSeason('x', false, 'AM', { rules: 1 })).length, 75);
});

// Drives a season to its first shop / reward phase with the first legal action.
function waUntil(s, phase, extra = () => null) {
  s = structuredClone(s); s.maxHp = s.hp = 5000; // the first-action player must not lose on the way
  for (let i = 0; i < 4000 && s.phase !== phase; i++) {
    const acts = wa.legalActions(s);
    const a = extra(s, acts) || acts.find(x => x.type === 'chooseNode' && s.map.nodes.find(n => n.key === x.key)?.kind === phase) || acts[0];
    s = wa.act(s, a).state;
    assert.notEqual(s.phase, 'result');
  }
  return s;
}

test('Wa: skipping a recruit pays 15 funds or a free reroll; rerolls escalate 20/30 per market', () => {
  let s = wa.createSeason('econ-skip', false, 'CN', { rules: 1, econ: 1, unlockTier: 5, gearTier: 5 });
  s = waUntil(s, 'reward');
  const acts = wa.legalActions(s).filter(a => a.type === 'recruit' && a.id === null);
  assert.deepEqual(acts.map(a => a.comp), ['money', 'reroll']);
  const money = wa.act(s, { type: 'recruit', id: null, comp: 'money' }).state;
  assert.equal(money.money, s.money + SKIP_FUNDS);
  s = wa.act(s, { type: 'recruit', id: null, comp: 'reroll' }).state;
  assert.equal(s.freeRerolls, 1);
  s = waUntil(s, 'shop', (st, a) => a.find(x => x.type === 'recruit' && x.comp === 'money'));
  assert.equal(s.freeRerolls, 1);
  s.money = 500;
  assert.equal(wa.rerollPrice(s), 0);
  const before = s.shop.slots.join();
  s = wa.act(s, { type: 'rerollShop' }).state;
  assert.equal(s.money, 500); assert.equal(s.freeRerolls, 0);
  assert.equal(wa.rerollPrice(s), 20);
  s = wa.act(s, { type: 'rerollShop' }).state;
  assert.equal(s.money, 480); assert.equal(wa.rerollPrice(s), 30);
  assert.equal(s.shop.slots.length, 3);
  assert.ok(before.length);
});

test('Wa: one investment per market, bought once, with its season-long effect', () => {
  let s = wa.createSeason('econ-invest', false, 'EMEA', { rules: 1, econ: 1, unlockTier: 5, gearTier: 5 });
  s = waUntil(s, 'shop');
  assert.ok(INVESTMENTS[s.shop.invest]);
  s.money = 1000;
  const id = s.shop.invest;
  s = wa.act(s, { type: 'buyInvest' }).state;
  assert.deepEqual(s.invest, [id]);
  assert.equal(s.money, 1000 - INVESTMENTS[id].price);
  assert.ok(wa.act(s, { type: 'buyInvest' }).error);
  // Effects, applied directly on a copy.
  const t = structuredClone(s); t.invest = ['IV02']; t.hp = 10;
  assert.equal(wa.restRate(t), 0.4);
  t.invest = ['IV03']; t.phase = 'map';
  const u = waUntil(t, 'shop');
  assert.equal(u.shop.slots.length, 4);
  assert.ok(!Object.keys(INVESTMENTS).filter(k => u.invest.includes(k)).includes(u.shop.invest));
});

test('server: an economy season replays with its recorded unlock tiers; wrong or missing tiers are refused', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'econ-'));
  const store = await openStore({ dataDir: dir });
  const handler = createOnlineHandler(store);
  // Same mock request shape as tests/online-api.test.mjs.
  const request = async (method, url, { token, body } = {}) => {
    const req = { method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, socket: { remoteAddress: '127.0.0.1' },
      on(event, cb) { if (event === 'data' && body) cb(Buffer.from(JSON.stringify(body))); if (event === 'end') cb(); } };
    const res = { statusCode: 0, body: '', writeHead(s) { this.statusCode = s; }, end(d) { this.body = d || ''; } };
    await handler(req, res, new URL(url, 'http://localhost'));
    let parsed = null; try { parsed = JSON.parse(res.body); } catch {}
    return { status: res.statusCode, body: parsed };
  };
  try {
    const run = JSON.parse(await readFile(new URL('./fixtures/econ-claim.json', import.meta.url), 'utf8'));
    assert.equal(run.econ, 1); assert.equal(run.unlockTier, 0);
    const account = await request('POST', '/api/account');
    const token = account.body?.token;
    assert.ok(token, JSON.stringify(account.body));
    const noEcon = { ...run }; delete noEcon.econ; delete noEcon.unlockTier; delete noEcon.gearTier;
    assert.equal((await request('POST', '/api/archive/claim', { token, body: { run: noEcon, act: 1 } })).status, 400);
    assert.equal((await request('POST', '/api/archive/claim', { token, body: { run: { ...run, unlockTier: 5, gearTier: 5 }, act: 1 } })).status, 400);
    assert.equal((await request('POST', '/api/archive/claim', { token, body: { run: { ...run, unlockTier: 9 }, act: 1 } })).status, 400);
    assert.equal((await request('POST', '/api/archive/claim', { token, body: { run: { ...run, econ: 2 }, act: 1 } })).status, 400);
    const ok = await request('POST', '/api/archive/claim', { token, body: { run, act: 1 } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

function playNd(s, pick, limit = 3000) {
  for (let i = 0; i < limit && s.phase !== 'result'; i++) {
    const a = pick(s, nd.legalActions(s));
    const r = nd.act(s, a);
    assert.ok(!r.error, `${JSON.stringify(a)} ${r.error}`);
    s = r.state;
  }
  return s;
}

test('new demo: base tier offers only base team cards and unlocked equipment; economy actions work', () => {
  const team = 'utility', base = new Set(nd.teamUnlockPlan(team).base), locked = new Set(nd.teamUnlockPlan(team).tiers.flat()), lockedGear = new Set(nd.RELIC_UNLOCKS.flat());
  let s = nd.createRun('nd-econ', team, { econ: true, unlockTier: 0, gearTier: 0, opening: true });
  const seen = new Set(), gear = new Set();
  let skipped = 0, rerolled = 0, invested = 0;
  s = playNd(s, (st, acts) => {
    (st.battle?.rewardPool || []).forEach(id => seen.add(id));
    (st.shop?.cards || []).forEach(c => seen.add(c.id));
    (st.shop?.relics || []).forEach(r => gear.add(r.id));
    (st.bossRelic?.options || []).forEach(id => gear.add(id));
    const inv = acts.find(a => a.type === 'buyInvest'); if (inv) { invested++; return inv; }
    const rr = acts.find(a => a.type === 'rerollShop'); if (rr && rerolled < 3) { rerolled++; return rr; }
    const sk = acts.find(a => a.type === 'reward' && a.comp === 'reroll'); if (sk) { skipped++; return sk; }
    return acts[0];
  });
  assert.ok(seen.size > 5);
  for (const id of seen) assert.ok(!locked.has(id), id);
  assert.ok([...seen].some(id => base.has(id)));
  for (const id of [...gear, ...s.relics.map(r => r.id)]) assert.ok(!lockedGear.has(id), id);
  assert.ok(skipped > 0);
  const full = nd.createRun('nd-full', team, { econ: true });
  assert.equal(full.unlockTier, UNLOCK_TIERS);
  // Runs without `econ` keep the old reward actions.
  const plain = nd.createRun('nd-plain', team);
  assert.equal(plain.econ, undefined);
});

test('new demo: skip gold, reroll pricing and investments', () => {
  let s = nd.createRun('nd-shop', 'breach', { econ: true });
  for (let i = 0; i < 3000 && s.phase !== 'reward'; i++) s = nd.act(s, nd.legalActions(s)[0]).state;
  assert.equal(s.phase, 'reward');
  const gold = nd.act(s, { type: 'reward', id: null, comp: 'gold' }).state;
  assert.equal(gold.money, s.money + nd.SKIP_GOLD);
  const rr = nd.act(s, { type: 'reward', id: null, comp: 'reroll' }).state;
  assert.equal(rr.freeRerolls, 1);
  // Put the run in a shop directly.
  const shop = structuredClone(rr);
  shop.phase = 'map';
  let t = shop;
  for (let i = 0; i < 3000 && t.phase !== 'shop'; i++) {
    const acts = nd.legalActions(t);
    const a = acts.find(x => x.type === 'enter' && t.map.nodes.find(n => n.key === x.key)?.kind === 'shop') || acts.find(x => x.comp === 'gold') || acts[0];
    t = nd.act(t, a).state;
    assert.notEqual(t.phase, 'result');
  }
  t.money = 1000;
  assert.equal(nd.rerollPrice(t), 0);
  t = nd.act(t, { type: 'rerollShop' }).state;
  assert.equal(t.money, 1000);
  assert.equal(nd.rerollPrice(t), 20);
  t = nd.act(t, { type: 'rerollShop' }).state;
  assert.equal(t.money, 980);
  assert.equal(nd.rerollPrice(t), 30);
  assert.equal(t.shop.cards.length, 5);
  const id = t.shop.invest;
  assert.ok(nd.INVESTMENTS[id]);
  t = nd.act(t, { type: 'buyInvest' }).state;
  assert.deepEqual(t.invest, [id]);
  assert.ok(nd.act(t, { type: 'buyInvest' }).error);
  const u = structuredClone(t); u.invest = ['IN02'];
  assert.equal(nd.restHealRate(u), 0.4);
});
