// season-map.js
import { generateRoute, ROUTE_STEPS } from '../shared-route-generator.js';
// Pure ES module for act metadata, enemy configs, and deterministic map generation.
// This is a project-specific adaptation inspired by Slay the Spire's map structure,
// not a clone of its exact generator. It uses a seeded PRNG (FNV-1a + sfc32) to
// create reproducible maps with branching paths, guaranteed room types, and
// non-crossing edges.

export const ACTS = [
  { id: 1, name: '资格赛', bossName: '资格赛决战', subtitle: '常规赛' },
  { id: 2, name: '晋级赛', bossName: '晋级赛决战', subtitle: '晋级赛' },
  { id: 3, name: '总决赛', bossName: '总决赛决战', subtitle: '总决赛' }
];

export const EXTRA_ENEMIES = {
  A2_E01: { name: '第二幕基础进攻', hp: 48, script: [ [ { type: 'hit', n: 10, times: 1 } ], [ { type: 'hit', n: 12, times: 1 } ], [ { type: 'block', n: 6 }, { type: 'hit', n: 7, times: 1 } ] ], growth: 0 },
  A2_E02: { name: '第二幕信息压制', hp: 52, script: [ [ { type: 'hit', n: 10, times: 1 } ], [ { type: 'jam', id: 'ST01', n: 1 }, { type: 'hit', n: 8, times: 1 } ], [ { type: 'hit', n: 13, times: 1 } ] ], growth: 0 },
  A2_E03: { name: '第二幕多段突击', hp: 56, script: [ [ { type: 'hit', n: 4, times: 3 } ], [ { type: 'hit', n: 11, times: 1 } ], [ { type: 'block', n: 7 }, { type: 'hit', n: 8, times: 1 } ] ], growth: 0 },
  A2_E04: { name: '第二幕防守反击', hp: 54, script: [ [ { type: 'block', n: 11 }, { type: 'hit', n: 5, times: 1 } ], [ { type: 'hit', n: 16, times: 1 } ], [ { type: 'jam', id: 'ST03', n: 1 }, { type: 'hit', n: 9, times: 1 } ] ], growth: 0 },
  A2_E05: { name: '第二幕纪律控制', hp: 60, script: [ [ { type: 'weak', n: 1 } ], [ { type: 'hit', n: 14, times: 1 } ], [ { type: 'block', n: 9 }, { type: 'hit', n: 9, times: 1 } ] ], growth: 0 },
  A2_EL01: { name: '第二幕强敌', hp: 72, elite: true, script: [ [ { type: 'hit', n: 11, times: 1 }, { type: 'jam', id: 'ST03', n: 1 } ], [ { type: 'hit', n: 5, times: 3 } ], [ { type: 'block', n: 14 }, { type: 'jam', id: 'ST02', n: 1 } ] ], growth: 0 },
  A2_B01: { name: '晋级赛决战', hp: 110, boss: true, script: [ [ { type: 'weak', n: 1 }, { type: 'hit', n: 8, times: 1 } ], [ { type: 'jam', id: 'ST02', n: 2 }, { type: 'block', n: 12 } ], [ { type: 'hit', n: 5, times: 3 } ], [ { type: 'hit', n: 16, times: 1 } ] ], growth: 2 },

  A3_E01: { name: '第三幕基础进攻', hp: 64, script: [ [ { type: 'hit', n: 13, times: 1 } ], [ { type: 'hit', n: 16, times: 1 } ], [ { type: 'block', n: 8 }, { type: 'hit', n: 10, times: 1 } ] ], growth: 0 },
  A3_E02: { name: '第三幕信息压制', hp: 70, script: [ [ { type: 'hit', n: 13, times: 1 } ], [ { type: 'jam', id: 'ST01', n: 2 }, { type: 'hit', n: 11, times: 1 } ], [ { type: 'hit', n: 17, times: 1 } ] ], growth: 0 },
  A3_E03: { name: '第三幕多段突击', hp: 76, script: [ [ { type: 'hit', n: 5, times: 3 } ], [ { type: 'hit', n: 15, times: 1 } ], [ { type: 'block', n: 9 }, { type: 'hit', n: 11, times: 1 } ] ], growth: 0 },
  A3_E04: { name: '第三幕防守反击', hp: 72, script: [ [ { type: 'block', n: 14 }, { type: 'hit', n: 7, times: 1 } ], [ { type: 'hit', n: 20, times: 1 } ], [ { type: 'jam', id: 'ST03', n: 2 }, { type: 'hit', n: 12, times: 1 } ] ], growth: 0 },
  A3_E05: { name: '第三幕纪律控制', hp: 82, script: [ [ { type: 'weak', n: 2 } ], [ { type: 'hit', n: 18, times: 1 } ], [ { type: 'block', n: 12 }, { type: 'hit', n: 12, times: 1 } ] ], growth: 0 },
  A3_EL01: { name: '第三幕强敌', hp: 96, elite: true, script: [ [ { type: 'hit', n: 14, times: 1 }, { type: 'jam', id: 'ST03', n: 2 } ], [ { type: 'hit', n: 6, times: 3 } ], [ { type: 'block', n: 18 }, { type: 'jam', id: 'ST02', n: 2 } ] ], growth: 0 },
  A3_B01: { name: '总决赛决战', hp: 145, boss: true, script: [ [ { type: 'hit', n: 12, times: 1 }, { type: 'jam', id: 'ST03', n: 1 } ], [ { type: 'weak', n: 1 }, { type: 'hit', n: 5, times: 3 } ], [ { type: 'block', n: 16 }, { type: 'jam', id: 'ST01', n: 2 } ], [ { type: 'hit', n: 20, times: 1 } ] ], growth: 3 }
};


const roomNames = { battle: '常规比赛', elite: '高压强敌', event: '未知', shop: "战术补给", rest: "战术休整", crate: '补给箱' };
const battleNames = { E01: '新秀步枪', E02: '远点狙击', E03: '突破双枪', E04: '哨位架枪', E05: '烟雾控场', E06: '前哨侦察' };
// Keys of FIELDS in content.js; kept here to avoid a map→content import cycle.
const FIELD_IDS = ['corridor', 'longrange', 'smoky', 'highground', 'overtime', 'eco'];
// Multi-enemy encounters (GROUPS in content.js).
const NORMAL_GROUPS = { G01: '步枪火力组', G02: '侦察突击组', G03: '自动炮塔阵', G04: '交叉狙击组' };
const ELITE_GROUPS = { GE1: '王牌狙击小组' };
// Encounter pools (2026-09-24), after Slay the Spire's weak/strong split: the
// opening floors of an act draw single opponents from the weak pool; later
// floors, and unknown-room ambushes after them, draw from the strong pool, where
// group fights live. The path is not known when the map is built, so "the first
// N fights" is approximated by floor: act-1 floors 1-4 hold 2-4 fights (about 3
// on average); act-2/3 floors 1-2 are always the first two fights.
export const WEAK_POOL = ['E01', 'E02', 'E05', 'E06'];
export const STRONG_SINGLES = ['E03', 'E04', 'E05'];
export const STRONG_GROUPS = Object.keys(NORMAL_GROUPS);
export const ELITE_POOL = ['EL01', 'EL02', 'GE1'];
export const WEAK_STEPS = { 1: 4, 2: 2, 3: 2 };
// Share of strong-pool fights that are group fights.
const GROUP_SHARE = 0.4;
// Boss candidates per act (details in BOSSES, content.js). One is drawn per act
// from the run seed, so a reloaded save or rebuilt map always shows the same boss.
export const BOSS_POOL = { 1: ['B01', 'B02', 'B03'], 2: ['A2_B01', 'A2_B02', 'A2_B03'], 3: ['A3_B01', 'A3_B02', 'A3_B03'] };
const BOSS_NAMES = { B01: '资格赛冠军卫队', B02: '重装守门人', B03: '毒雾调度员', A2_B01: '晋级赛冠军卫队', A2_B02: '闪击突击王', A2_B03: '战区统帅', A3_B01: '总决赛冠军卫队', A3_B02: '情报先知', A3_B03: '暗影猎手' };
export function bossForAct(seed, act) {
  return mixedChoice(seed + '|' + act + '|boss', BOSS_POOL[act]);
}
function roll(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 1000) / 1000;
}
function choice(seed, values) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return values[(hash >>> 0) % values.length];
}
// FNV followed by a 32-bit finalizer: seeds that differ only slightly (pt-1,
// pt-2 ...) still spread evenly. Used for the boss and encounter picks.
function mixedChoice(seed, values) {
  let h = 2166136261;
  for (const char of String(seed)) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return values[(h >>> 0) % values.length];
}
// Pick from `pool`: never an id fought by a parent or grandparent (`hard`) when
// avoidable, preferably not one met a little further back or waiting in an
// unknown room (`soft`), then the ids used least so far this act; ties by seed.
function pickFresh(seed, pool, { hard, soft }, used) {
  const tiers = [pool.filter(id => !hard.has(id) && !soft.has(id)), pool.filter(id => !hard.has(id)), pool];
  const cands = tiers.find(t => t.length);
  const least = Math.min(...cands.map(id => used[id] || 0));
  return mixedChoice(seed, cands.filter(id => (used[id] || 0) === least));
}
// The weak pool is small, so its fights are placed together: a seeded
// backtracking search gives every weak fight an id that no fight on its parent
// or grandparent floor uses (any route through the opening floors then meets
// no back-to-back repeat). Returns key -> id; empty if no placement exists.
function assignWeakFights(nodes, parentsOf, seed) {
  const pos = new Map(nodes.map((n, i) => [n.key, i]));
  const near = nodes.map(n => {
    const out = new Set();
    for (const p of parentsOf.get(n.key) || []) {
      if (pos.has(p.key)) out.add(pos.get(p.key));
      for (const g of parentsOf.get(p.key) || []) if (pos.has(g.key)) out.add(pos.get(g.key));
    }
    return [...out];
  });
  // FNV alone barely changes when only the last character differs, so the
  // per-id rank is mixed through a 32-bit finalizer before sorting.
  const rank = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
  const prefs = nodes.map(n => WEAK_POOL.slice().sort((a, b) => rank(`${a}|${seed}|${n.key}`) - rank(`${b}|${seed}|${n.key}`)));
  const pick = new Array(nodes.length);
  let budget = 20000;
  const place = i => {
    if (i === nodes.length) return true;
    if (--budget < 0) return false;
    // Least-used first keeps the four openers evenly spread.
    const count = id => pick.slice(0, i).filter(x => x === id).length;
    const order = prefs[i].slice().sort((a, b) => count(a) - count(b));
    for (const id of order) {
      if (near[i].some(j => pick[j] === id)) continue;
      pick[i] = id;
      if (place(i + 1)) return true;
    }
    pick[i] = undefined;
    return false;
  };
  if (!place(0)) return new Map();
  return new Map(nodes.map((n, i) => [n.key, pick[i]]));
}
// Difficulty level 1+: some later ordinary fights become elites (never next to
// another elite), so a run meets noticeably more of them.
const ASC_ELITE_SHARE = 0.25;
export function buildMap(seed, act, ascension = 0) {
  if (![1, 2, 3].includes(act)) throw Error('未知赛段');
  const map = generateRoute(seed, act);
  const actKey = key => `a${act}-${key}`;
  for (const node of map.nodes) node.key = actKey(node.key);
  for (const edge of map.edges) { edge.from = actKey(edge.from); edge.to = actKey(edge.to); }
  map.starts = map.starts.map(actKey);
  map.bossId = actKey(map.bossId);
  const byKey = new Map(map.nodes.map(node => [node.key, node]));
  const prefix = act === 1 ? '' : 'A' + act + '_';
  if (ascension >= 1) {
    for (const node of map.nodes) {
      if (node.kind !== 'battle' || node.step < ROUTE_STEPS.ascEliteMin || node.step >= ROUTE_STEPS.rest) continue;
      const near = map.edges.filter(e => e.to === node.key || e.from === node.key).map(e => byKey.get(e.to === node.key ? e.from : e.to));
      if (near.some(n => n?.kind === 'elite')) continue;
      if (roll(seed + '|' + act + '|' + node.key + '|ascElite') < ASC_ELITE_SHARE) node.kind = 'elite';
    }
  }
  const parentsOf = new Map(map.nodes.map(n => [n.key, []]));
  for (const e of map.edges) parentsOf.get(e.to)?.push(byKey.get(e.from));
  // Encounter ids met by ancestors: fights one or two floors back are `hard`
  // (never repeated when avoidable); fights up to `depth` floors back and
  // unknown-room ambushes are `soft` (avoided while there is still a choice).
  const ids = new Map();
  const recentIds = (node, depth, kind) => {
    const hard = new Set(), soft = new Set();
    let layer = parentsOf.get(node.key) || [];
    for (let d = 0; d < depth && layer.length; d++) {
      for (const p of layer) {
        const v = ids.get(p.key);
        if (v && v.kind === kind) (d < 2 && v.fight ? hard : soft).add(v.id);
      }
      layer = [...new Set(layer.flatMap(p => parentsOf.get(p.key) || []))];
    }
    return { hard, soft };
  };
  const used = {};
  const eliteUsed = {};
  const weakSteps = WEAK_STEPS[act];
  const ordered = map.nodes.slice().sort((a, b) => a.step - b.step || a.lane - b.lane);
  const weakPreset = assignWeakFights(ordered.filter(n => n.kind === 'battle' && n.step <= weakSteps), parentsOf, seed + '|' + act);
  for (const node of ordered) {
    const base = seed + '|' + act + '|' + node.key;
    if (node.kind === 'battle' || node.kind === 'event') {
      const recent = recentIds(node, 3, 'normal');
      let id;
      if (weakPreset.has(node.key)) id = weakPreset.get(node.key);
      else if (node.step <= weakSteps) id = pickFresh(base + '|enemy', WEAK_POOL, recent, used);
      else {
        const group = roll(base + '|group') < GROUP_SHARE;
        let pool = group ? STRONG_GROUPS : STRONG_SINGLES;
        if (pool.every(x => recent.hard.has(x))) pool = group ? STRONG_SINGLES : STRONG_GROUPS;
        id = pickFresh(base + '|enemy', pool, recent, used);
      }
      ids.set(node.key, { kind: 'normal', id, fight: node.kind === 'battle' });
      if (node.kind === 'battle') {
        used[id] = (used[id] || 0) + 1;
        node.enemy = prefix + id;
        node.name = NORMAL_GROUPS[id] || battleNames[id];
        if (NORMAL_GROUPS[id]) node.group = true;
        if (node.step > 2) node.field = choice(base + '|field', FIELD_IDS);
      } else {
        node.name = roomNames.event;
        // An unknown room can turn out to be a fight; its opponent is fixed by seed.
        node.ambush = prefix + id;
      }
    } else if (node.kind === 'elite') {
      // Elites are few per act: avoid any repeat along a route where possible.
      const id = pickFresh(base + '|elite', ELITE_POOL, recentIds(node, 16, 'elite'), eliteUsed);
      eliteUsed[id] = (eliteUsed[id] || 0) + 1;
      ids.set(node.key, { kind: 'elite', id, fight: true });
      node.enemy = prefix + id;
      if (ELITE_GROUPS[id]) node.group = true;
      node.field = choice(base + '|field', FIELD_IDS);
      node.name = roomNames.elite;
    } else if (node.kind === 'boss') {
      node.enemy = bossForAct(seed, act);
      node.name = BOSS_NAMES[node.enemy] || ACTS[act - 1].bossName;
    } else {
      node.name = roomNames[node.kind];
    }
  }
  return { act, ...map, boss: bossForAct(seed, act) };
}
export function availableNodes(s) {
  if (s?.mode !== 'season' || s.phase !== 'map') return [];
  const keys = s.currentNode === null ? s.map.starts : s.map.edges.filter(e => e.from === s.currentNode).map(e => e.to);
  return s.map.nodes.filter(n => keys.includes(n.key) && !s.completed.includes(n.key));
}
