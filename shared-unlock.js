// Unlock progression shared by both demos. Pure functions only: each UI keeps
// its own progress object in localStorage, and each engine records the tier a
// run was created with, so a run's card and equipment pools never change midway
// (and the Wa server replays the exact pool from the recorded tier).
//
// A first run starts from a reduced but complete pool: every rarity, and at least
// half of each build direction, stays in the base pool. Finishing runs grants
// experience; every tier adds one batch of cards to that team/region and one
// batch of equipment (equipment batches follow the highest tier of any team).
//
// Current progression (Wa econ 2, new-demo econ 2): 4 batches, 20/30/40/50 XP.
// The legacy progression (econ 1 runs and server records) used 5 batches of the
// same 40 locked cards with 20/25/30/35/40 XP; its partition is still built for
// replay. Both split the same ordered list of locked ids into consecutive chunks,
// so legacy tiers 1..N are always contained in current tiers 1..min(N, 4).
export const UNLOCK_TIERS = 4;
export const LEGACY_UNLOCK_TIERS = 5;
// Locked cards per team/region (the same for both partitions).
export const UNLOCK_LOCKED_CARDS = 40;
export const UNLOCK_CARDS_PER_TIER = UNLOCK_LOCKED_CARDS / UNLOCK_TIERS;
// Experience needed for each next tier (tier 1..4).
export const UNLOCK_XP = [20, 30, 40, 50];
export const LEGACY_UNLOCK_XP = [20, 25, 30, 35, 40];
// Progress objects saved under the legacy progression carry v:1 (or nothing).
export const PROGRESS_VERSION = 2;
// Experience from one run: every battle won, plus each act boss beaten, plus a full clear.
export const XP_RULES = { perWin: 1, perBoss: 10, fullClear: 10 };

const RARITIES = ['common', 'uncommon', 'rare'];
const MIN_BASE = { common: 6, uncommon: 4, rare: 2 };

function hash(text) {
  let h = 2166136261 >>> 0;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

// ids: the full regular pool of one team/region. start: its starting-deck ids
// (never locked). rarityOf(id) -> common|uncommon|rare. groupOf(id) -> build
// direction or null; at most half of each direction is locked.
// tierCount: number of batches (UNLOCK_TIERS, or LEGACY_UNLOCK_TIERS for econ 1).
// Returns { base: [...ids], tiers: [[...ids] x tierCount] }, deterministic. The
// locked set and its order do not depend on tierCount.
export function planCardUnlocks(ids, { start = [], rarityOf, groupOf = () => null, salt = '', tierCount = UNLOCK_TIERS } = {}) {
  const fixed = new Set(start);
  const candidates = [...new Set(ids)].filter(id => !fixed.has(id));
  const byRarity = Object.fromEntries(RARITIES.map(r => [r, candidates.filter(id => rarityOf(id) === r).sort((a, b) => hash(salt + a) - hash(salt + b) || (a < b ? -1 : 1))]));
  const total = Math.min(UNLOCK_LOCKED_CARDS, Math.max(0, candidates.length - 12));
  const n = candidates.length || 1;
  const want = Object.fromEntries(RARITIES.map(r => [r, Math.max(0, Math.min(Math.round(total * byRarity[r].length / n), byRarity[r].length - MIN_BASE[r]))]));
  // Fix rounding so the locked count is exactly `total` when capacity allows.
  let diff = total - RARITIES.reduce((s, r) => s + want[r], 0);
  for (let guard = 0; diff !== 0 && guard < 100; guard++) {
    const r = RARITIES[guard % 3];
    if (diff > 0 && want[r] < byRarity[r].length - MIN_BASE[r]) { want[r]++; diff--; }
    else if (diff < 0 && want[r] > 0) { want[r]--; diff++; }
  }
  const groupSize = {}, groupLocked = {};
  for (const id of candidates) { const g = groupOf(id); if (g) groupSize[g] = (groupSize[g] || 0) + 1; }
  const locked = [];
  for (const r of RARITIES) {
    const picked = [];
    const tryPick = strict => {
      for (const id of byRarity[r]) {
        if (picked.length >= want[r]) return;
        if (picked.includes(id)) continue;
        const g = groupOf(id);
        if (strict && g && (groupLocked[g] || 0) >= Math.floor(groupSize[g] / 2)) continue;
        picked.push(id);
        if (g) groupLocked[g] = (groupLocked[g] || 0) + 1;
      }
    };
    tryPick(true);
    tryPick(false);
    // Spread each rarity evenly over the tiers.
    picked.forEach((id, i) => locked.push({ id, at: (i + 0.5) / picked.length, r: RARITIES.indexOf(r) }));
  }
  locked.sort((a, b) => a.at - b.at || a.r - b.r);
  const tiers = splitBatches(locked.map(x => x.id), tierCount);
  const lockedSet = new Set(locked.map(x => x.id));
  return { base: ids.filter(id => !lockedSet.has(id)), tiers };
}

// Splits an ordered list into `count` consecutive chunks of ceil(n / count).
export function splitBatches(list, count) {
  const per = Math.ceil(list.length / count) || 0;
  return Array.from({ length: count }, (_, t) => list.slice(t * per, (t + 1) * per));
}

// Ids available at `tier` (0 = base pool, tiers.length = everything), in pool order.
export function unlockedFrom(plan, ids, tier) {
  const open = new Set(plan.base);
  for (let t = 0; t < Math.min(tier, plan.tiers.length); t++) for (const id of plan.tiers[t]) open.add(id);
  return ids.filter(id => open.has(id));
}

// Tier of an id in a batch list (0 = base / not listed).
export function tierOfId(tiers, id) {
  for (let t = 0; t < tiers.length; t++) if (tiers[t].includes(id)) return t + 1;
  return 0;
}

export function validTier(n, max = UNLOCK_TIERS) {
  return Number.isInteger(n) && n >= 0 && n <= max;
}

// { tier, into, need }: `into` experience collected toward the next tier out of `need`
// (need 0 once every tier is open).
export function tierOfXp(xp, table = UNLOCK_XP) {
  let left = Math.max(0, Math.floor(Number(xp) || 0));
  for (let t = 0; t < table.length; t++) {
    if (left < table[t]) return { tier: t, into: left, need: table[t] };
    left -= table[t];
  }
  return { tier: table.length, into: 0, need: 0 };
}

// Experience at which `tier` opens under the current progression.
export function xpForTier(tier) {
  return UNLOCK_XP.slice(0, Math.max(0, Math.min(tier, UNLOCK_TIERS))).reduce((a, b) => a + b, 0);
}

// Legacy (5-batch) experience -> current experience. A player at legacy tier N
// had the first N legacy batches; current tiers 1..min(N, 4) cover all of them,
// so experience is raised to that tier's threshold when it is below it (never lowered).
export function migrateLegacyXp(xp) {
  const n = Math.max(0, Math.floor(Number(xp) || 0));
  return Math.max(n, xpForTier(Math.min(tierOfXp(n, LEGACY_UNLOCK_XP).tier, UNLOCK_TIERS)));
}

export function runXp({ wins = 0, bosses = 0, cleared = false }) {
  return wins * XP_RULES.perWin + bosses * XP_RULES.perBoss + (cleared ? XP_RULES.fullClear : 0);
}

// ---- progress object helpers: { v:2, xp:{[key]:n}, awarded:{[runId]:n}, all:bool } ----
// A save without v:2 was earned under the legacy 5-batch progression and is
// migrated once (see migrateLegacyXp); the result is saved back as v:2.
export function normalizeProgress(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const legacy = p.v !== PROGRESS_VERSION;
  const xp = {}, awarded = {};
  for (const [k, v] of Object.entries(p.xp || {})) if (Number.isFinite(v) && v >= 0) xp[k] = legacy ? migrateLegacyXp(v) : Math.floor(v);
  for (const [k, v] of Object.entries(p.awarded || {})) if (Number.isFinite(v) && v >= 0) awarded[k] = Math.floor(v);
  return { v: PROGRESS_VERSION, xp, awarded, all: p.all === true };
}
export function progressTier(progress, key) {
  return progress.all ? UNLOCK_TIERS : tierOfXp(progress.xp[key] || 0).tier;
}
export function progressGearTier(progress) {
  if (progress.all) return UNLOCK_TIERS;
  return Math.max(0, ...Object.values(progress.xp).map(x => tierOfXp(x).tier));
}
// Adds the run's experience not yet awarded. Returns { progress, gained, key, fromTier, toTier, fromGear, toGear }.
export function awardRun(progress, key, runId, xp) {
  const next = normalizeProgress(progress);
  const before = next.awarded[runId] || 0;
  const gained = Math.max(0, Math.floor(xp) - before);
  const fromTier = tierOfXp(next.xp[key] || 0).tier, fromGear = progressGearTier({ ...next, all: false });
  if (gained) {
    next.xp[key] = (next.xp[key] || 0) + gained;
    next.awarded[runId] = before + gained;
    const ids = Object.keys(next.awarded);
    if (ids.length > 30) for (const id of ids.slice(0, ids.length - 30)) delete next.awarded[id];
  }
  return { progress: next, gained, key, fromTier, toTier: tierOfXp(next.xp[key] || 0).tier, fromGear, toGear: progressGearTier({ ...next, all: false }) };
}
