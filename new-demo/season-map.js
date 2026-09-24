// season-map.js
import { generateRoute } from '../shared-route-generator.js';
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

// Seeded PRNG: FNV-1a hash to initialize sfc32 generator.
const roomNames = { battle: '常规比赛', elite: '高压强敌', event: '未知事件', shop: "战术补给", rest: "战术休整" };
const battleNames = { E01: '新秀步枪', E02: '远点狙击', E03: '突破双枪', E04: '哨位架枪', E05: '烟雾控场', E06: '前哨侦察' };
// Keys of FIELDS in content.js; kept here to avoid a map→content import cycle.
const FIELD_IDS = ['corridor', 'longrange', 'smoky', 'highground', 'overtime', 'eco'];
// Multi-enemy encounters (GROUPS in content.js). From step 3 on, roughly a third
// of ordinary and elite fights become group fights, chosen by seed.
const NORMAL_GROUPS = { G01: '步枪火力组', G02: '侦察突击组', G03: '自动炮塔阵', G04: '交叉狙击组' };
const ELITE_GROUPS = { GE1: '王牌狙击小组' };
const GROUP_SHARE = 0.35;
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
export function buildMap(seed, act) {
  if (![1, 2, 3].includes(act)) throw Error('未知赛段');
  const map = generateRoute(seed, act);
  const actKey = key => `a${act}-${key}`;
  for (const node of map.nodes) node.key = actKey(node.key);
  for (const edge of map.edges) { edge.from = actKey(edge.from); edge.to = actKey(edge.to); }
  map.starts = map.starts.map(actKey);
  map.bossId = actKey(map.bossId);
  const byKey = new Map(map.nodes.map(node => [node.key, node]));
  const prefix = act === 1 ? '' : 'A' + act + '_';
  for (const node of map.nodes) {
    if (node.kind === 'battle') {
      const ids = node.step <= 2 ? (act === 1 ? ['E01'] : ['E01', 'E03', 'E06']) : node.step === 3 ? ['E02', 'E03', 'E06'] : ['E02', 'E03', 'E04', 'E05', 'E06'];
      const parents = map.edges.filter(edge => edge.to === node.key).map(edge => byKey.get(edge.from));
      const fresh = ids.filter(id => !parents.some(parent => parent.enemy === prefix + id));
      const id = choice(seed + '|' + act + '|' + node.key + '|enemy', fresh.length ? fresh : ids);
      node.enemy = prefix + id;
      node.name = battleNames[id];
      if (node.step >= 3 && roll(seed + '|' + act + '|' + node.key + '|group') < GROUP_SHARE) {
        const gid = choice(seed + '|' + act + '|' + node.key + '|groupId', Object.keys(NORMAL_GROUPS));
        node.enemy = prefix + gid;
        node.name = NORMAL_GROUPS[gid];
        node.group = true;
      }
      if (node.step > 2) node.field = choice(seed + '|' + act + '|' + node.key + '|field', FIELD_IDS);
    } else if (node.kind === 'elite') {
      node.enemy = prefix + choice(seed + '|' + act + '|' + node.key + '|elite', ['EL01', 'EL02']);
      if (roll(seed + '|' + act + '|' + node.key + '|group') < GROUP_SHARE) { node.enemy = prefix + choice(seed + '|' + act + '|' + node.key + '|groupId', Object.keys(ELITE_GROUPS)); node.group = true; }
      node.field = choice(seed + '|' + act + '|' + node.key + '|field', FIELD_IDS);
      node.name = roomNames.elite;
    } else if (node.kind === 'boss') {
      node.enemy = prefix + 'B01';
      node.name = ACTS[act - 1].bossName;
    } else {
      node.name = roomNames[node.kind];
    }
  }
  return { act, ...map };
}
export function availableNodes(s) {
  if (s?.mode !== 'season' || s.phase !== 'map') return [];
  const keys = s.currentNode === null ? s.map.starts : s.map.edges.filter(e => e.from === s.currentNode).map(e => e.to);
  return s.map.nodes.filter(n => keys.includes(n.key) && !s.completed.includes(n.key));
}
