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

function topology(random) {
  const starts = shuffle([0, 1, 2, 3, 4, 5, 6], random).slice(0, 4).sort((a, b) => a - b);
  const walkers = shuffle([...starts, starts[Math.floor(random() * 4)], starts[Math.floor(random() * 4)]], random);
  const rows = Array.from({ length: 16 }, () => new Set());
  const edges = new Map();
  for (let walker = 0; walker < walkers.length; walker++) {
    let lane = walkers[walker];
    rows[1].add(lane);
    for (let step = 1; step < 15; step++) {
      const existing = [...edges.values()].filter(e => e.step === step);
      const choices = shuffle([lane - 1, lane, lane + 1].filter(next => next >= 0 && next <= 6), random)
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
  for (let step = 1; step < 15; step++) {
    const candidates = shuffle([...rows[step]].flatMap(fromLane => [...rows[step + 1]]
      .filter(toLane => Math.abs(fromLane - toLane) <= 1)
      .map(toLane => ({ from: key(step, fromLane), to: key(step + 1, toLane), step, fromLane, toLane }))), random);
    for (const candidate of candidates) {
      if (edges.has(`${candidate.from}>${candidate.to}`)) continue;
      if ([...edges.values()].some(e => e.step === step && crosses(e, candidate))) continue;
      if (random() < 0.42) edges.set(`${candidate.from}>${candidate.to}`, candidate);
    }
  }
  const widths = rows.slice(1).map(row => row.size);
  if (widths.some(width => width < 3 || width > 6) || Math.max(...widths) < 5 || new Set(widths).size < 2) return null;
  const graphEdges = [...edges.values()].map(({ from, to }) => ({ from, to }));
  for (const lane of rows[15]) graphEdges.push({ from: key(15, lane), to: 'boss' });
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
    inbound.get(edge.to).push(byKey.get(edge.from));
    outbound.get(edge.from).push(byKey.get(edge.to));
  }
  const weights = [['battle', 0.54], ['event', 0.17], ['shop', 0.10], ['rest', 0.09], ['elite', 0.10]];
  for (const node of nodes) {
    if (node.step <= 2) { node.kind = 'battle'; continue; }
    if (node.step === 15) { node.kind = 'rest'; continue; }
    if (node.step === 16) { node.kind = 'boss'; continue; }
    const allowed = weights.filter(([kind]) => !['elite', 'shop', 'rest'].includes(kind) || !inbound.get(node.key).some(parent => parent.kind === kind));
    const total = allowed.reduce((sum, [, weight]) => sum + weight, 0);
    let ticket = random() * total;
    node.kind = allowed.find(([, weight]) => (ticket -= weight) < 0)?.[0] || 'battle';
  }
  for (const kind of ['event', 'shop', 'elite']) {
    while (nodes.filter(node => node.kind === kind).length < 2) {
      const candidates = nodes.filter(node => node.step >= 3 && node.step <= 14 && node.kind === 'battle'
        && !inbound.get(node.key).some(parent => parent.kind === kind)
        && !outbound.get(node.key).some(child => child.kind === kind));
      if (!candidates.length) return false;
      shuffle(candidates, random)[0].kind = kind;
    }
  }
  return true;
}

export function generateRoute(seed, act) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const random = randomFrom(`${seed}|${act}|route|${attempt}`);
    const shape = topology(random);
    if (!shape) continue;
    const nodes = [];
    for (let step = 1; step <= 15; step++) for (const lane of [...shape.rows[step]].sort((a, b) => a - b)) {
      nodes.push({ key: key(step, lane), step, lane, x: 8 + lane * 14, y: 94 - (step - 1) * 88 / 15, kind: 'battle', name: '' });
    }
    nodes.push({ key: 'boss', step: 16, lane: 3, x: 50, y: 6, kind: 'boss', name: '' });
    if (!assignRooms(nodes, shape.edges, random)) continue;
    return { nodes, edges: shape.edges, starts: shape.starts, bossId: 'boss' };
  }
  throw Error('无法生成符合路线约束的地图');
}
