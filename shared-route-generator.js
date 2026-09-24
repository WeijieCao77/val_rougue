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

const BOSS_STEP = 12;
const NORMAL_MAX_STEP = 11;
const REST_STEP = 11;
const SHOP_STEP = 6;
// Mid-act supply crate row (an adaptation of Slay the Spire's mid-act treasure).
const CRATE_STEP = 8;
const BATTLE_FIXED_STEPS = [1, 2];
const WEIGHTED_STEPS = [3, 4, 5, 7, 9, 10];
export const ROUTE_STEPS = { shop: SHOP_STEP, crate: CRATE_STEP, rest: REST_STEP, boss: BOSS_STEP };
const START_LANE_COUNT = 4;
const LANE_COUNT = 7;
const MIN_WIDTH = 3;
const MAX_WIDTH = 6;

function topology(random) {
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

function assignRooms(nodes, edges, random) {
  const byKey = new Map(nodes.map(node => [node.key, node]));
  const inbound = new Map(nodes.map(node => [node.key, []]));
  const outbound = new Map(nodes.map(node => [node.key, []]));
  for (const edge of edges) {
    if (edge.to === 'boss') continue;
    inbound.get(edge.to).push(byKey.get(edge.from));
    outbound.get(edge.from).push(byKey.get(edge.to));
  }
  // Fewer total stops would otherwise sharply reduce access to elite rewards.
  // These are this demo's room weights, not Slay the Spire's probabilities.
  const weights = [['battle', 0.49], ['event', 0.20], ['shop', 0.08], ['rest', 0.08], ['elite', 0.15]];
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
        return !['elite', 'shop', 'rest'].includes(kind) || !inbound.get(node.key).some(parent => parent.kind === kind);
      });
      const total = allowed.reduce((sum, [, weight]) => sum + weight, 0);
      let ticket = random() * total;
      node.kind = allowed.find(([, weight]) => (ticket -= weight) < 0)?.[0] || 'battle';
    } else {
      node.kind = 'battle';
    }
  }
  for (const kind of ['event', 'elite']) {
    while (nodes.filter(node => node.kind === kind).length < 1) {
      const candidates = nodes.filter(node => WEIGHTED_STEPS.includes(node.step) && node.kind === 'battle'
        && !inbound.get(node.key).some(parent => parent.kind === kind)
        && !outbound.get(node.key).some(child => child.kind === kind));
      if (!candidates.length) return false;
      shuffle(candidates, random)[0].kind = kind;
    }
  }
  return true;
}

export function generateRoute(seed, act) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const random = randomFrom(`${seed}|${act}|route|${attempt}`);
    const shape = topology(random);
    if (!shape) continue;
    const nodes = [];
    for (let step = 1; step <= NORMAL_MAX_STEP; step++) for (const lane of [...shape.rows[step]].sort((a, b) => a - b)) {
      nodes.push({ key: key(step, lane), step, lane, x: 8 + lane * 14, y: 94 - (step - 1) * 88 / (BOSS_STEP - 1), kind: 'battle', name: '' });
    }
    nodes.push({ key: 'boss', step: BOSS_STEP, lane: 3, x: 50, y: 6, kind: 'boss', name: '' });
    if (!assignRooms(nodes, shape.edges, random)) continue;
    return { nodes, edges: shape.edges, starts: shape.starts, bossId: 'boss' };
  }
  throw Error('无法生成符合路线约束的地图');
}
