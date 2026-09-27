// Unlock progression, skip compensation, investments and shop rerolls (both demos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { UNLOCK_TIERS, UNLOCK_XP, LEGACY_UNLOCK_TIERS, LEGACY_UNLOCK_XP, tierOfXp, awardRun, normalizeProgress, progressTier, progressGearTier, runXp, validTier } from '../shared-unlock.js';
import * as wa from '../engine.js';
import { REGIONS, TACTICS } from '../content.js';
import { CARD_RARITY } from '../card-rarity.js';
import { GEAR_UNLOCKS, GEAR_UNLOCKS_V1, INVESTMENTS, SKIP_FUNDS, RULES_VERSION, ECON_VERSION } from '../wa-rules.js';
import * as nd from '../new-demo/engine.js';
import { TEAMS, CARDS as ND_CARDS, ARCHETYPES, REGION_CARD_IDS } from '../new-demo/content.js';
import { openStore } from '../online/store.mjs';
import { createOnlineHandler } from '../online/api.mjs';

test('unlock plan: four batches of 10 cards, starters and every rarity stay in the base pool, at most half of a direction locked', () => {
  assert.equal(UNLOCK_TIERS, 4); assert.deepEqual(UNLOCK_XP, [20, 30, 40, 50]);
  for (const region of Object.keys(REGIONS)) {
    const plan = wa.regionUnlockPlan(region), pool = REGIONS[region].pool;
    assert.equal(plan.tiers.length, UNLOCK_TIERS);
    for (const t of plan.tiers) assert.equal(t.length, 10);
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
    assert.equal(plan.tiers.length, UNLOCK_TIERS);
    assert.equal(plan.tiers.flat().length, 40);
    assert.equal(plan.base.length, 35);
    for (const id of plan.tiers.flat()) assert.ok(REGION_CARD_IDS[TEAMS[team].region].includes(id));
  }
});

// Legacy (econ 1) tier N must be contained in current tier min(N, 4), for cards and equipment.
const contains = (big, small) => small.every(id => big.includes(id));
const prefix = (tiers, n) => tiers.slice(0, n).flat();
test('legacy 5-batch partitions are kept for econ 1 and nest inside the 4-batch ones', () => {
  for (const r3 of [false, true]) for (const region of Object.keys(REGIONS)) {
    const now = wa.regionUnlockPlan(region, r3, 2), old = wa.regionUnlockPlan(region, r3, 1);
    assert.equal(old.tiers.length, LEGACY_UNLOCK_TIERS);
    assert.deepEqual(old.base, now.base);
    for (let n = 0; n <= LEGACY_UNLOCK_TIERS; n++) assert.ok(contains(prefix(now.tiers, Math.min(n, UNLOCK_TIERS)), prefix(old.tiers, n)), `${region} ${r3} ${n}`);
  }
  for (const team of Object.keys(TEAMS)) {
    const now = nd.teamUnlockPlan(team, 2), old = nd.teamUnlockPlan(team, 1);
    assert.equal(old.tiers.length, LEGACY_UNLOCK_TIERS); assert.deepEqual(old.base, now.base);
    for (let n = 0; n <= LEGACY_UNLOCK_TIERS; n++) assert.ok(contains(prefix(now.tiers, Math.min(n, UNLOCK_TIERS)), prefix(old.tiers, n)), `${team} ${n}`);
  }
  for (const [now, old] of [[GEAR_UNLOCKS, GEAR_UNLOCKS_V1], [nd.RELIC_UNLOCKS, nd.RELIC_UNLOCKS_V1]]) {
    assert.equal(now.length, UNLOCK_TIERS); assert.equal(old.length, LEGACY_UNLOCK_TIERS);
    assert.deepEqual([...now.flat()].sort(), [...old.flat()].sort());
    for (let n = 0; n <= LEGACY_UNLOCK_TIERS; n++) assert.ok(contains(prefix(now, Math.min(n, UNLOCK_TIERS)), prefix(old, n)), `gear ${n}`);
  }
  // Econ-1 seasons still get the legacy pools; econ-2 seasons the new ones.
  const s1 = wa.createSeason('legacy-pool', false, 'CN', { rules: RULES_VERSION, econ: 1, unlockTier: 1, gearTier: 1 });
  const s2 = wa.createSeason('legacy-pool', false, 'CN', { rules: RULES_VERSION, econ: 2, unlockTier: 1, gearTier: 1 });
  assert.equal(wa.offerPool(s1).length, wa.offerPool(s2).length - 2);
  assert.ok(wa.gearLocked(s1, GEAR_UNLOCKS[0][3]) && !wa.gearLocked(s2, GEAR_UNLOCKS[0][3]));
  assert.equal(wa.createSeason('x', false, 'CN', { rules: RULES_VERSION, econ: 1 }).unlockTier, LEGACY_UNLOCK_TIERS);
  assert.equal(wa.createSeason('x', false, 'CN', { rules: RULES_VERSION, econ: 2 }).unlockTier, UNLOCK_TIERS);
  assert.throws(() => wa.createSeason('x', false, 'CN', { rules: RULES_VERSION, econ: 2, unlockTier: 5 }), /解锁等级/);
  assert.throws(() => wa.createSeason('x', false, 'CN', { rules: RULES_VERSION, econ: 3 }), /经济规则/);
  assert.equal(ECON_VERSION, 2);
  assert.ok(validTier(5, LEGACY_UNLOCK_TIERS) && !validTier(5));
  // New-demo saved runs with econ 1 keep their legacy pools.
  const n1 = nd.createRun('nd-legacy', 'breach', { econ: 1, unlockTier: 5, gearTier: 5 });
  assert.equal(n1.econ, 1); assert.equal(n1.unlockTier, 5);
  assert.ok(!nd.relicLocked(n1, 'R49'));
  const n2 = nd.createRun('nd-now', 'breach', { econ: true, unlockTier: 5, gearTier: 3 });
  assert.equal(n2.econ, 2); assert.equal(n2.unlockTier, UNLOCK_TIERS);
  assert.ok(nd.relicLocked(n2, nd.RELIC_UNLOCKS[3][0]));
});

test('saved progress migration: legacy experience never loses an unlocked card or equipment piece', () => {
  const legacyTier = xp => tierOfXp(xp, LEGACY_UNLOCK_XP).tier;
  for (let xp = 0; xp <= 200; xp++) {
    const p = normalizeProgress({ v: 1, xp: { CN: xp, AM: 3 }, awarded: { r: 5 }, all: false });
    assert.equal(p.v, 2);
    assert.ok(p.xp.CN >= xp, `xp ${xp} lowered`);
    const oldT = legacyTier(xp), newT = progressTier(p, 'CN');
    assert.ok(newT >= Math.min(oldT, UNLOCK_TIERS), `xp ${xp}: legacy ${oldT} -> ${newT}`);
    if (xp >= 150) assert.equal(newT, UNLOCK_TIERS);
    assert.ok(progressGearTier(p) >= Math.min(oldT, UNLOCK_TIERS));
    for (const region of Object.keys(REGIONS)) {
      const old = wa.regionUnlockPlan(region, true, 1), now = wa.regionUnlockPlan(region, true, 2);
      assert.ok(contains(prefix(now.tiers, newT), prefix(old.tiers, oldT)));
    }
    assert.ok(contains(prefix(GEAR_UNLOCKS, progressGearTier(p)), prefix(GEAR_UNLOCKS_V1, oldT)));
    // Migrating twice changes nothing; a v2 save is never re-migrated.
    assert.deepEqual(normalizeProgress(p), p);
  }
  assert.deepEqual(normalizeProgress({ v: 1, xp: { CN: 46, EMEA: 112, PAC: 80, AM: 12 } }).xp, { CN: 50, EMEA: 140, PAC: 90, AM: 12 });
  assert.deepEqual(normalizeProgress({ xp: { CN: 150 } }).xp, { CN: 150 });
  assert.deepEqual(normalizeProgress({ v: 2, xp: { CN: 46 } }).xp, { CN: 46 });
  assert.equal(progressTier(normalizeProgress({ v: 1, xp: {}, all: true }), 'CN'), UNLOCK_TIERS);
  assert.equal(normalizeProgress({ v: 1, all: true }).all, true);
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

test('Wa: an econ-2 season at tier 2 offers only its 4-batch pools and replays exactly', () => {
  const plan = wa.regionUnlockPlan('EMEA', true, 2), open = new Set([...plan.base, ...prefix(plan.tiers, 2)]);
  const lockedGear = new Set(prefix(GEAR_UNLOCKS, 4).filter(id => !prefix(GEAR_UNLOCKS, 2).includes(id)));
  let s = wa.createSeason('econ2-t2', false, 'EMEA', { rules: RULES_VERSION, econ: 2, unlockTier: 2, gearTier: 2 });
  assert.equal(s.econ, 2);
  const seen = new Set(), gear = new Set();
  s = playWa(s, (st, acts) => {
    if (st.reward?.offers) st.reward.offers.forEach(id => id && seen.add(id));
    if (st.shop?.slots) st.shop.slots.forEach(id => id && seen.add(id));
    (st.shop?.gear || []).forEach(id => id && gear.add(id));
    (st.reward?.bossGear || []).forEach(id => gear.add(id));
    return acts.find(a => a.type === 'rerollShop') || acts[0];
  });
  assert.ok(seen.size > 5);
  const pool3 = new Set(REGIONS.EMEA.pool3);
  for (const id of seen) if (pool3.has(id)) assert.ok(open.has(id), id);
  for (const id of gear) assert.ok(!lockedGear.has(id), id);
  const again = wa.replay({ version: s.version, seed: s.seed, region: s.region, rules: s.rules, ascension: s.ascension, econ: 2, unlockTier: 2, gearTier: 2, mapVersion: s.mapVersion, actions: s.actions });
  assert.deepEqual(again.deck, s.deck);
  assert.equal(again.hp, s.hp);
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
    assert.equal((await request('POST', '/api/archive/claim', { token, body: { run: { ...run, econ: 3 }, act: 1 } })).status, 400);
    // econ 2 (4 batches): tiers 0..4 only; tier 5 exists only under econ 1.
    assert.equal((await request('POST', '/api/archive/claim', { token, body: { run: { ...run, econ: 2, unlockTier: 5, gearTier: 0 }, act: 1 } })).status, 400);
    assert.equal((await request('POST', '/api/archive/claim', { token, body: { run: { ...run, econ: 2, unlockTier: 0, gearTier: 5 }, act: 1 } })).status, 400);
    const ok = await request('POST', '/api/archive/claim', { token, body: { run, act: 1 } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    // Current seasons record rules 4 + the 15-floor map + economy; the server used to
    // accept economy only with rules 1, so every act upload (and PvP) failed.
    const r4 = JSON.parse(await readFile(new URL('./fixtures/econ-claim-rules4.json', import.meta.url), 'utf8'));
    assert.equal(r4.rules, 4); assert.equal(r4.econ, 1); assert.equal(r4.mapVersion, 2);
    const ok4 = await request('POST', '/api/archive/claim', { token, body: { run: r4, act: 1 } });
    assert.equal(ok4.status, 200, JSON.stringify(ok4.body));
    // An econ-2 record (base tiers are the same cards under both partitions) replays too.
    const e2 = { ...r4, econ: 2, runId: r4.runId + '-e2' };
    const ok2 = await request('POST', '/api/archive/claim', { token, body: { run: e2, act: 1 } });
    assert.equal(ok2.status, 200, JSON.stringify(ok2.body));
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
  const seen = new Set(), gear = new Set();
  let skipped = 0, rerolled = 0, invested = 0, s;
  // Several seeds: the naive first-action policy can lose early to the weak-pool openers.
  for (const seed of ['nd-econ', 'nd-econ-2', 'nd-econ-3', 'nd-econ-4']) s = playNd(nd.createRun(seed, team, { econ: true, unlockTier: 0, gearTier: 0, opening: true }), (st, acts) => {
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
