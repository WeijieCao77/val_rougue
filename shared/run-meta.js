// Run bookkeeping shared by both demos: score formula, run history (last 30
// runs), the "seen" collection and a small per-run tracker. Pure functions;
// anything that touches storage takes the storage object as an argument so
// tests can pass a fake. No imports: the Wa build packs this file as-is.

export const HISTORY_CAP = 30;

// The score formula shown to the player. `each` is the points per unit.
export const SCORE_RULES = [
  { key: 'floors', label: '推进节点', each: 5, rule: '每完成 1 个路线节点 +5' },
  { key: 'elites', label: '击败强敌', each: 25, rule: '每击败 1 场强敌 +25' },
  { key: 'bosses', label: '击败幕末决赛', each: 50, rule: '每赢下 1 场幕末决赛 +50' },
  { key: 'perfect', label: '无伤战斗', each: 10, rule: '整场战斗没有失去生命 +10' },
  { key: 'hp', label: '剩余生命', each: 1, rule: '结算时每 1 点剩余生命 +1' },
  { key: 'gold', label: '持有金币', each: 1, per: 10, rule: '结算时每 10 金币 +1' },
  { key: 'victory', label: '三幕通关', each: 250, rule: '打通全部三幕 +250' }
];
export const DIFFICULTY_BONUS = 10; // percent per difficulty level

const int = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);

// summary: {floors, elites, bosses, perfect, hp, gold, won, ascension}
// terms: optional label overrides, e.g. {hp: '剩余声望', gold: '持有资金'}.
export function computeScore(summary = {}, terms = {}) {
  const lines = SCORE_RULES.map(r => {
    const raw = r.key === 'victory' ? (summary.won ? 1 : 0) : int(summary[r.key]);
    const count = r.per ? Math.floor(raw / r.per) : raw;
    return { key: r.key, label: terms[r.key] || r.label, rule: terms[r.key + 'Rule'] || r.rule, raw, count, each: r.each, points: count * r.each };
  });
  const subtotal = lines.reduce((n, l) => n + l.points, 0);
  const ascension = Math.min(20, int(summary.ascension));
  const percent = 100 + DIFFICULTY_BONUS * ascension;
  const total = Math.floor(subtotal * percent / 100);
  return { lines, subtotal, ascension, percent, total };
}

// One-line statement of the formula for the results and history screens.
export function scoreFormulaText(terms = {}) {
  const parts = SCORE_RULES.map(r => terms[r.key + 'Rule'] || r.rule);
  return `${parts.join('；')}。合计再乘以难度加成：每级难度 +${DIFFICULTY_BONUS}%。`;
}

function readJson(storage, key, fallback) {
  try { const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function writeJson(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// ---- history ----
export function loadHistory(storage, key) {
  const list = readJson(storage, key, []);
  if (!Array.isArray(list)) return [];
  return list.filter(e => e && typeof e === 'object' && typeof e.id === 'string' && ['win', 'loss', 'abandon'].includes(e.outcome)).slice(0, HISTORY_CAP);
}

// Newest first, at most HISTORY_CAP entries. Recording the same run id twice
// keeps the first record (a results screen may render more than once).
export function addHistory(list, entry, cap = HISTORY_CAP) {
  const current = Array.isArray(list) ? list : [];
  if (!entry || typeof entry.id !== 'string') return current.slice(0, cap);
  if (current.some(e => e.id === entry.id)) return current.slice(0, cap);
  return [entry, ...current].slice(0, cap);
}

export function recordRun(storage, key, entry) {
  const before = loadHistory(storage, key);
  if (!entry || before.some(e => e.id === entry.id)) return before;
  const after = addHistory(before, entry);
  writeJson(storage, key, after);
  return after;
}

// ---- collection ("seen") ----
export const SEEN_CATEGORIES = ['cards', 'gear', 'supplies', 'enemies'];

export function emptyCollection() {
  return Object.fromEntries(SEEN_CATEGORIES.map(k => [k, []]));
}

export function loadCollection(storage, key) {
  const raw = readJson(storage, key, null);
  const out = emptyCollection();
  if (raw && typeof raw === 'object') for (const k of SEEN_CATEGORIES) if (Array.isArray(raw[k])) out[k] = [...new Set(raw[k].filter(x => typeof x === 'string'))];
  return out;
}

// found: {cards: iterable, gear: iterable, ...}. Returns {collection, changed, added}.
export function mergeSeen(collection, found = {}) {
  const next = emptyCollection();
  const added = emptyCollection();
  let changed = false;
  for (const k of SEEN_CATEGORIES) {
    const set = new Set(collection?.[k] || []);
    for (const id of found[k] || []) {
      if (typeof id !== 'string' || !id || set.has(id)) continue;
      set.add(id); added[k].push(id); changed = true;
    }
    next[k] = [...set];
  }
  return { collection: next, changed, added };
}

export function markSeen(storage, key, found) {
  const { collection, changed } = mergeSeen(loadCollection(storage, key), found);
  if (changed) writeJson(storage, key, collection);
  return collection;
}

// "已发现 X / Y" for one category: only ids that exist in `allIds` count.
export function seenCount(collection, category, allIds) {
  const seen = new Set(collection?.[category] || []);
  const ids = [...allIds];
  return { seen: ids.filter(id => seen.has(id)).length, total: ids.length };
}

// ---- per-run tracker ----
// Snapshots: {seed, phase, hp, inCombat, fight: {enemy, name, act, floor, kind}}.
// Counts perfect fights and elites, and remembers the fight in progress so a
// loss can name the enemy and floor.
export function newTracker(seed, now = Date.now()) {
  return { seed: String(seed), startedAt: now, fights: 0, perfect: 0, elites: 0, bosses: 0, current: null, lastFight: null, last: null };
}

export function trackStep(tracker, snap, now = Date.now()) {
  let t = tracker && tracker.seed === String(snap.seed) ? { ...tracker } : newTracker(snap.seed, now);
  const last = t.last;
  if (snap.inCombat && (!last || !last.inCombat || !t.current)) {
    t.current = { ...(snap.fight || {}), hpStart: snap.hp, lost: 0 };
  } else if (snap.inCombat && last?.inCombat && t.current) {
    t.current = { ...t.current, lost: t.current.lost + Math.max(0, last.hp - snap.hp) };
  }
  if (!snap.inCombat && last?.inCombat && t.current) {
    const lost = t.current.lost + Math.max(0, last.hp - snap.hp);
    // A run that ended mid-fight (loss or abandon) did not win that fight.
    const won = (!snap.outcome || snap.outcome === 'win') && snap.hp > 0;
    const fight = { ...t.current, lost, won };
    if (won) {
      t.fights += 1;
      if (lost === 0) t.perfect += 1;
      if (fight.kind === 'elite') t.elites += 1;
      if (fight.kind === 'boss') t.bosses += 1;
    }
    t.lastFight = fight;
    t.current = null;
  }
  t.last = { phase: snap.phase, hp: snap.hp, inCombat: !!snap.inCombat };
  return t;
}

export function loadTracker(storage, key, seed) {
  const t = readJson(storage, key, null);
  return t && t.seed === String(seed) ? t : null;
}
export function saveTracker(storage, key, tracker) { return writeJson(storage, key, tracker); }

// ---- deck viewer ----
// cards: [{id, up, uid}], opts: {type, cost, sort}, info: {typeOf, costOf, nameOf, orderOf}
// cost filter: '' (all), '0', '1', '2', '3+' or 'x' (unplayable / X).
export function filterSortCards(cards, opts = {}, info = {}) {
  const typeOf = info.typeOf || (() => '');
  const costOf = info.costOf || (() => null);
  const nameOf = info.nameOf || (c => c.id);
  const orderOf = info.orderOf || (() => 0);
  const costKey = c => {
    const n = costOf(c);
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 'x';
    return n >= 3 ? '3+' : String(n);
  };
  const costNum = c => { const n = costOf(c); return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 99; };
  const list = cards.map((c, i) => ({ c, i })).filter(({ c }) => (!opts.type || typeOf(c) === opts.type) && (!opts.cost || costKey(c) === opts.cost));
  const byName = (a, b) => String(nameOf(a.c)).localeCompare(String(nameOf(b.c)), 'zh-Hans-CN') || Number(!!a.c.up) - Number(!!b.c.up) || a.i - b.i;
  const sorters = {
    acquired: (a, b) => a.i - b.i,
    cost: (a, b) => costNum(a.c) - costNum(b.c) || byName(a, b),
    name: byName,
    type: (a, b) => orderOf(a.c) - orderOf(b.c) || costNum(a.c) - costNum(b.c) || byName(a, b)
  };
  list.sort(sorters[opts.sort] || sorters.acquired);
  return list.map(x => x.c);
}

export const SORT_LABELS = { acquired: '获得顺序', cost: '费用', type: '类型', name: '名称' };
export const COST_FILTERS = [['', '全部费用'], ['0', '0 费'], ['1', '1 费'], ['2', '2 费'], ['3+', '3 费及以上'], ['x', '不可打出']];

export function formatDuration(ms) {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h} 小时 ${m} 分` : m ? `${m} 分 ${sec} 秒` : `${sec} 秒`;
}
