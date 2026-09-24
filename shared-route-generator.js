// Seeded, seven-lane route topology shared by both demos. Room weights are this
// game's own tuning; this is not Slay the Spire's exact map generator.
const hash = value => {
  let h = 2166136261;
  for (const char of String(value)) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
};
const randomFrom = seed => {
  let a = hash(seed);
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
const shuffle = (items, random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const key = (step, lane) => `r${step}c${lane}`;
const crosses = (left, right) => left.fromLane < right.fromLane && left.toLane > right.toLane || left.fromLane > right.fromLane && left.toLane < right.toLane;

// Map versions. Version 1 is the earlier 12-step act (11 floors + boss); it is
// kept byte-for-byte so older Wa run records still replay on the online server.
// Version 2 (current) is a 15-floor act with the boss on step 16, following the
// pacing of Slay the Spire's acts (fights first, a mid-act treasure row, a rest
// row right before the boss, no elites or rest sites in the opening floors).
// The fixed shop row and all room weights are this game's own choices.
const ROUTE_CONFIGS = {
  1: {
    boss: 12, rest: 11, shop: 6, crate: 8, battleFixed: [1, 2], weighted: [3, 4, 5, 7, 9, 10],
    eliteMin: 1, restMin: 1, ascEliteMin: 4, minElites: 1,
    weights: [['battle', 0.49], ['event', 0.20], ['shop', 0.08], ['rest', 0.08], ['elite', 0.15]]
  },
  2: {
    boss: 16, rest: 15, shop: 7, crate: 9, battleFixed: [1, 2], weighted: [3, 4, 5, 6, 8, 10, 11, 12, 13, 14],
    eliteMin: 6, restMin: 6, ascEliteMin: 6, minElites: 2, minElitesOnPath: 2,
    weights: [['battle', 0.40], ['event', 0.28], ['shop', 0.05], ['rest', 0.09], ['elite', 0.18]]
  }
};
export const CURRENT_MAP_VERSION = 2;
export const MAP_VERSIONS = Object.keys(ROUTE_CONFIGS).map(Number);
export function routeSteps(version = CURRENT_MAP_VERSION) {
  const c = ROUTE_CONFIGS[version];
  if (!c) throw Error('未知地图版本');
  return { shop: c.shop, crate: c.crate, rest: c.rest, boss: c.boss, floors: c.boss - 1, ascEliteMin: c.ascEliteMin };
}
// Current layout (both demos start new runs on it).
export const ROUTE_STEPS = routeSteps(CURRENT_MAP_VERSION);
const START_LANE_COUNT = 4;
const LANE_COUNT = 7;
const MIN_WIDTH = 3;
const MAX_WIDTH = 6;

function topology(random, cfg) {
  const BOSS_STEP = cfg.boss, NORMAL_MAX_STEP = cfg.boss - 1;
  const starts = shuffle([0, 1, 2, 3, 4, 5, 6], random).slice(0, START_LANE_COUNT).sort((a, b) => a - b);
  const walkers = shuffle([...starts, starts[Math.floor(random() * START_LANE_COUNT)], starts[Math.floor(random() * START_LANE_COUNT)]], random);
  const rows = Array.from({ length: BOSS_STEP }, () => new Set());
  const edges = new Map();
  for (let walker = 0; walker < walkers.length; walker++) {
    let lane = walkers[walker];
    rows[1].add(lane);
    for (let step = 1; step < NORMAL_MAX_STEP; step++) {
      const existing = [...edges.values()].filter(e => e.step === step);
      const choices = shuffle([lane - 1, lane, lane + 1].filter(next => next >= 0 && next < LANE_COUNT), random)
        .filter(next => !existing.some(e => crosses(e, { fromLane: lane, toLane: next })));
      const next = choices[0]; // Staying in the same lane is always a valid fallback.
      rows[step + 1].add(next);
      const edge = { from: key(step, lane), to: key(step + 1, next), step, fromLane: lane, toLane: next };
      edges.set(`${edge.from}>${edge.to}`, edge);
      lane = next;
    }
  }
  // Add short alternative connections between existing paths. No new node is
  // introduced, so every visible node remains part of a start-to-boss walk.
  for (let step = 1; step < NORMAL_MAX_STEP; step++) {
    const candidates = shuffle([...rows[step]].flatMap(fromLane => [...rows[step + 1]]
      .filter(toLane => Math.abs(fromLane - toLane) <= 1)
      .map(toLane => ({ from: key(step, fromLane), to: key(step + 1, toLane), step, fromLane, toLane }))), random);
    for (const candidate of candidates) {
      if (edges.has(`${candidate.from}>${candidate.to}`)) continue;
      if ([...edges.values()].some(e => e.step === step && crosses(e, candidate))) continue;
      if (random() < 0.42) edges.set(`${candidate.from}>${candidate.to}`, candidate);
    }
  }
  const widths = rows.slice(1, BOSS_STEP).map(row => row.size);
  if (widths.some(width => width < MIN_WIDTH || width > MAX_WIDTH) || Math.max(...widths) < 5 || new Set(widths).size < 2) return null;
  const graphEdges = [...edges.values()].map(({ from, to }) => ({ from, to }));
  for (const lane of rows[NORMAL_MAX_STEP]) graphEdges.push({ from: key(NORMAL_MAX_STEP, lane), to: 'boss' });
  const outgoing = new Map(), incoming = new Map();
  for (const { from, to } of graphEdges) {
    outgoing.set(from, (outgoing.get(from) || 0) + 1);
    incoming.set(to, (incoming.get(to) || 0) + 1);
  }
  const branches = [...outgoing].filter(([node, count]) => node !== 'boss' && count > 1).length;
  const merges = [...incoming].filter(([node, count]) => node !== 'boss' && count > 1).length;
  if (branches < 3 || merges < 1) return null;
  return { rows, starts: starts.map(lane => key(1, lane)), edges: graphEdges };
}

function assignRooms(nodes, edges, random, cfg) {
  const { battleFixed: BATTLE_FIXED_STEPS, weighted: WEIGHTED_STEPS, shop: SHOP_STEP, crate: CRATE_STEP, rest: REST_STEP, boss: BOSS_STEP } = cfg;
  const byKey = new Map(nodes.map(node => [node.key, node]));
  const inbound = new Map(nodes.map(node => [node.key, []]));
  const outbound = new Map(nodes.map(node => [node.key, []]));
  for (const edge of edges) {
    if (edge.to === 'boss') continue;
    inbound.get(edge.to).push(byKey.get(edge.from));
    outbound.get(edge.from).push(byKey.get(edge.to));
  }
  // These are this demo's room weights, not Slay the Spire's probabilities.
  const weights = cfg.weights;
  for (const node of nodes) {
    if (BATTLE_FIXED_STEPS.includes(node.step)) { node.kind = 'battle'; continue; }
    if (node.step === SHOP_STEP) { node.kind = 'shop'; continue; }
    if (node.step === CRATE_STEP) { node.kind = 'crate'; continue; }
    if (node.step === REST_STEP) { node.kind = 'rest'; continue; }
    if (node.step === BOSS_STEP) { node.kind = 'boss'; continue; }
    if (WEIGHTED_STEPS.includes(node.step)) {
      const allowed = weights.filter(([kind]) => {
        if (node.step === SHOP_STEP - 1 && kind === 'shop') return false;
        if (node.step === REST_STEP - 1 && kind === 'rest') return false;
        if (kind === 'elite' && node.step < cfg.eliteMin) return false;
        if (kind === 'rest' && node.step < cfg.restMin) return false;
        return !['elite', 'shop', 'rest'].includes(kind) || !inbound.get(node.key).some(parent => parent.kind === kind);
      });
      const total = allowed.reduce((sum, [, weight]) => sum + weight, 0);
      let ticket = random() * total;
      node.kind = allowed.find(([, weight]) => (ticket -= weight) < 0)?.[0] || 'battle';
    } else {
      node.kind = 'battle';
    }
  }
  for (const [kind, least] of [['event', 1], ['elite', cfg.minElites]]) {
    while (nodes.filter(node => node.kind === kind).length < least) {
      const candidates = nodes.filter(node => WEIGHTED_STEPS.includes(node.step) && node.kind === 'battle'
        && (kind !== 'elite' || node.step >= cfg.eliteMin)
        && !inbound.get(node.key).some(parent => parent.kind === kind)
        && !outbound.get(node.key).some(child => child.kind === kind));
      if (!candidates.length) return false;
      shuffle(candidates, random)[0].kind = kind;
    }
  }
  return true;
}

// Largest number of elites a single start-to-boss walk can visit, so every act
// offers at least one route for players who hunt elites for equipment.
function mostElitesOnOnePath(nodes, edges, starts) {
  const best = new Map([['boss', 0]]);
  for (const node of [...nodes].sort((a, b) => b.step - a.step)) {
    if (node.key === 'boss') continue;
    const next = edges.filter(e => e.from === node.key).map(e => best.get(e.to) || 0);
    best.set(node.key, (node.kind === 'elite' ? 1 : 0) + Math.max(0, ...next));
  }
  return Math.max(...starts.map(key => best.get(key)));
}

export function generateRoute(seed, act, version = CURRENT_MAP_VERSION) {
  const cfg = ROUTE_CONFIGS[version];
  if (!cfg) throw Error('未知地图版本');
  const BOSS_STEP = cfg.boss, NORMAL_MAX_STEP = cfg.boss - 1;
  for (let attempt = 0; attempt < 150; attempt++) {
    const random = randomFrom(`${seed}|${act}|route|${attempt}`);
    const shape = topology(random, cfg);
    if (!shape) continue;
    const nodes = [];
    for (let step = 1; step <= NORMAL_MAX_STEP; step++) for (const lane of [...shape.rows[step]].sort((a, b) => a - b)) {
      nodes.push({ key: key(step, lane), step, lane, x: 8 + lane * 14, y: 94 - (step - 1) * 88 / (BOSS_STEP - 1), kind: 'battle', name: '' });
    }
    nodes.push({ key: 'boss', step: BOSS_STEP, lane: 3, x: 50, y: 6, kind: 'boss', name: '' });
    if (!assignRooms(nodes, shape.edges, random, cfg)) continue;
    if (cfg.minElitesOnPath && mostElitesOnOnePath(nodes, shape.edges, shape.starts) < cfg.minElitesOnPath) continue;
    return { nodes, edges: shape.edges, starts: shape.starts, bossId: 'boss' };
  }
  throw Error('无法生成符合路线约束的地图');
}
