// season-map.js
import { generateRoute, routeSteps, CURRENT_MAP_VERSION } from './shared-route-generator.js';
// Pure ES module for act metadata, enemy configs, and deterministic map generation.
// This is a project-specific adaptation inspired by Slay the Spire's map structure,
// not a clone of its exact generator. It uses a seeded PRNG (FNV-1a + sfc32) to
// create reproducible maps with branching paths, guaranteed room types, and
// non-crossing edges.

export const ACTS = [
  {
    id: 1,
    name: '资格挑战',
    bossName: '第一次大师赛',
    subtitle: '常规赛'
  },
  {
    id: 2,
    name: '第一赛段',
    bossName: '第二次大师赛',
    subtitle: '晋级赛'
  },
  {
    id: 3,
    name: '第二赛段',
    bossName: '冠军赛',
    subtitle: '总决赛'
  }
];

// Enemy IDs for each act (excluding legacy act1 enemies already in content.js)
export const EXTRA_ENEMIES = {
  // Act 2 normal enemies
  A2_E01: { name: '第二幕基础进攻', hp: 48, script: [ [ { type: 'hit', n: 10, times: 1 } ], [ { type: 'hit', n: 12, times: 1 } ], [ { type: 'block', n: 6 }, { type: 'hit', n: 7, times: 1 } ] ], growth: 0 },
  A2_E02: { name: '第二幕信息压制', hp: 52, script: [ [ { type: 'hit', n: 10, times: 1 } ], [ { type: 'jam', id: 'ST04', n: 1 }, { type: 'hit', n: 8, times: 1 } ], [ { type: 'hit', n: 13, times: 1 } ] ], growth: 0 },
  A2_E03: { name: '第二幕多段突击', hp: 56, script: [ [ { type: 'hit', n: 4, times: 3 } ], [ { type: 'hit', n: 11, times: 1 } ], [ { type: 'block', n: 7 }, { type: 'hit', n: 8, times: 1 } ] ], growth: 0 },
  A2_E04: { name: '第二幕防守反击', hp: 54, script: [ [ { type: 'block', n: 11 }, { type: 'hit', n: 5, times: 1 } ], [ { type: 'hit', n: 16, times: 1 } ], [ { type: 'jam', id: 'ST03', n: 1 }, { type: 'hit', n: 9, times: 1 } ] ], growth: 0 },
  A2_E05: { name: '第二幕纪律控制', hp: 60, script: [ [ { type: 'weak', n: 1 } ], [ { type: 'hit', n: 14, times: 1 } ], [ { type: 'block', n: 9 }, { type: 'hit', n: 9, times: 1 } ] ], growth: 0 },
  A2_EL01: { name: '第二幕强敌', hp: 72, elite: true, script: [ [ { type: 'hit', n: 11, times: 1 }, { type: 'jam', id: 'ST03', n: 1 } ], [ { type: 'hit', n: 5, times: 3 } ], [ { type: 'block', n: 14 }, { type: 'jam', id: 'ST02', n: 1 } ] ], growth: 0 },
  A2_B01: { name: '第二次大师赛', hp: 110, boss: true, script: [ [ { type: 'weak', n: 1 }, { type: 'hit', n: 8, times: 1 } ], [ { type: 'jam', id: 'ST02', n: 2 }, { type: 'block', n: 12 } ], [ { type: 'hit', n: 5, times: 3 } ], [ { type: 'hit', n: 16, times: 1 } ] ], growth: 2 },

  // Act 3 normal enemies
  A3_E01: { name: '第三幕基础进攻', hp: 64, script: [ [ { type: 'hit', n: 13, times: 1 } ], [ { type: 'hit', n: 16, times: 1 } ], [ { type: 'block', n: 8 }, { type: 'hit', n: 10, times: 1 } ] ], growth: 0 },
  A3_E02: { name: '第三幕信息压制', hp: 70, script: [ [ { type: 'hit', n: 13, times: 1 } ], [ { type: 'jam', id: 'ST05', n: 2 }, { type: 'hit', n: 11, times: 1 } ], [ { type: 'hit', n: 17, times: 1 } ] ], growth: 0 },
  A3_E03: { name: '第三幕多段突击', hp: 76, script: [ [ { type: 'hit', n: 5, times: 3 } ], [ { type: 'hit', n: 15, times: 1 } ], [ { type: 'block', n: 9 }, { type: 'hit', n: 11, times: 1 } ] ], growth: 0 },
  A3_E04: { name: '第三幕防守反击', hp: 72, script: [ [ { type: 'block', n: 14 }, { type: 'hit', n: 7, times: 1 } ], [ { type: 'hit', n: 20, times: 1 } ], [ { type: 'jam', id: 'ST03', n: 2 }, { type: 'hit', n: 12, times: 1 } ] ], growth: 0 },
  A3_E05: { name: '第三幕纪律控制', hp: 82, script: [ [ { type: 'weak', n: 2 } ], [ { type: 'hit', n: 18, times: 1 } ], [ { type: 'block', n: 12 }, { type: 'hit', n: 12, times: 1 } ] ], growth: 0 },
  A3_EL01: { name: '第三幕强敌', hp: 96, elite: true, script: [ [ { type: 'hit', n: 14, times: 1 }, { type: 'jam', id: 'ST03', n: 2 } ], [ { type: 'hit', n: 6, times: 3 } ], [ { type: 'block', n: 18 }, { type: 'jam', id: 'ST02', n: 2 } ] ], growth: 0 },
  A3_B01: { name: '冠军赛', hp: 145, boss: true, script: [ [ { type: 'hit', n: 12, times: 1 }, { type: 'jam', id: 'ST03', n: 1 } ], [ { type: 'weak', n: 1 }, { type: 'hit', n: 5, times: 3 } ], [ { type: 'block', n: 16 }, { type: 'jam', id: 'ST01', n: 2 } ], [ { type: 'hit', n: 20, times: 1 } ] ], growth: 3 }
};

// Seeded PRNG: FNV-1a hash to initialize sfc32 generator.
const roomNames = { battle: '常规比赛', elite: '高压强敌', event: '未知', shop: "转会市场", rest: "俱乐部活动", crate: '补给箱' };
const battleNames = { E01: '基础进攻', S_E01: '新秀步枪', S_E02: '远点狙击', S_E03: '突破双枪', S_E04: '哨位架枪', S_E05: '烟雾控场', S_E06: '前哨侦察' };
// Keys of FIELDS in content.js (kept here to avoid a map→content import cycle).
const FIELD_IDS = ['corridor', 'longrange', 'suppress', 'highground', 'overtime', 'eco'];
function choice(seed, values) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return values[(hash >>> 0) % values.length];
}
// mapVersion 1 = the older 12-step act, kept only so old run records replay.
export function buildMap(seed, act, ascension = 0, mapVersion = CURRENT_MAP_VERSION) {
  if (![1, 2, 3].includes(act)) throw Error('未知赛段');
  const map = generateRoute(seed, act, mapVersion);
  const steps = routeSteps(mapVersion);
  const actKey = key => `a${act}-${key}`;
  for (const node of map.nodes) node.key = actKey(node.key);
  for (const edge of map.edges) { edge.from = actKey(edge.from); edge.to = actKey(edge.to); }
  map.starts = map.starts.map(actKey);
  map.bossId = actKey(map.bossId);
  const byKey = new Map(map.nodes.map(node => [node.key, node]));
  const prefix = act === 1 ? '' : 'A' + act + '_';
  // Difficulty 1+: some later ordinary fights become elites (never next to another elite).
  if (ascension >= 1) {
    const near = node => map.edges.filter(e => e.to === node.key || e.from === node.key).map(e => byKey.get(e.to === node.key ? e.from : e.to));
    for (const node of map.nodes) {
      if (node.kind !== 'battle' || node.step < steps.ascEliteMin || node.step >= steps.rest) continue;
      if (near(node).some(other => other.kind === 'elite')) continue;
      if (choice(seed + '|' + act + '|' + node.key + '|asc-elite', [0, 1, 2]) === 0) node.kind = 'elite';
    }
  }
  for (const node of map.nodes) {
    if (node.kind === 'battle') {
      const ids = node.step <= 2 ? (act === 1 ? ['S_E01'] : ['S_E01', 'S_E03', 'S_E06']) : node.step === 3 ? ['S_E02', 'S_E03', 'S_E06'] : ['S_E02', 'S_E03', 'S_E04', 'S_E05', 'S_E06'];
      const parents = map.edges.filter(edge => edge.to === node.key).map(edge => byKey.get(edge.from));
      const fresh = ids.filter(id => !parents.some(parent => parent.enemy === prefix + id));
      const id = choice(seed + '|' + act + '|' + node.key + '|enemy', fresh.length ? fresh : ids);
      node.enemy = prefix + id;
      node.name = battleNames[id];
      if (node.step > 2) node.field = choice(seed + '|' + act + '|' + node.key + '|field', FIELD_IDS);
    } else if (node.kind === 'elite') {
      node.enemy = prefix + choice(seed + '|' + act + '|' + node.key + '|elite', ['S_EL01', 'S_EL02']);
      node.field = choice(seed + '|' + act + '|' + node.key + '|field', FIELD_IDS);
      node.name = roomNames.elite;
    } else if (node.kind === 'boss') {
      node.enemy = prefix + 'S_B01';
      node.name = ACTS[act - 1].bossName;
    } else {
      node.name = roomNames[node.kind];
      // An unknown room can turn out to be a fight; its opponent is fixed by seed.
      if (node.kind === 'event') node.ambush = prefix + choice(seed + '|' + act + '|' + node.key + '|ambush', ['S_E02', 'S_E03', 'S_E04', 'S_E05', 'S_E06']);
    }
  }
  return { act, ...map };
}
export function availableNodes(s) {
  if (s?.mode !== 'season' || s.phase !== 'map') return [];
  const keys = s.currentNode === null ? s.map.starts : s.map.edges.filter(e => e.from === s.currentNode).map(e => e.to);
  return s.map.nodes.filter(n => keys.includes(n.key) && !s.completed.includes(n.key));
}
