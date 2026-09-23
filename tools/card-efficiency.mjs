// Rough per-cost value audit of the new demo's regular card pool.
// Weights are a heuristic for spotting outliers, not a balance model.
import { CARDS, REGION_CARD_IDS, SHARED_CARD_IDS } from '../new-demo/content.js';

export function points(effects) {
  let v = 0;
  const w = (e, m = 1) => {
    const t = e.type;
    if (t === 'attack') v += e.n * (e.times || 1) * m;
    else if (t === 'block') v += e.n * 0.8 * m;
    else if (t === 'draw') v += e.n * 3.5 * m;
    else if (t === 'energy') v += e.n * 5 * m;
    else if (t === 'smoke') v += e.n * 1.6 * m;
    else if (t === 'flash') v += e.n * 2.6 * m;
    else if (t === 'weak') v += e.n * 2.5 * m;
    else if (t === 'vuln') v += e.n * 3.5 * m;
    else if (t === 'heal') v += e.n * 0.8 * m;
    else if (t === 'conditional') w(e.effect, 0.6 * m);
    else if (t === 'repeat') w(e.effect, e.times * m);
  };
  effects.forEach(e => w(e));
  return v;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('card-efficiency.mjs')) {
  const pool = [...SHARED_CARD_IDS, ...Object.values(REGION_CARD_IDS).flat()].filter(id => CARDS[id].type !== 'power');
  const by = {};
  for (const id of pool) (by[`${CARDS[id].rarity}/${CARDS[id].cost}`] ||= []).push(points(CARDS[id].effects));
  for (const k of Object.keys(by).sort()) console.log(k.padEnd(12), 'n', String(by[k].length).padStart(3), 'avg pts', (by[k].reduce((a, b) => a + b, 0) / by[k].length).toFixed(1));
  const loops = pool.filter(id => CARDS[id].cost === 0 && CARDS[id].effects.some(e => e.type === 'draw') && !CARDS[id].exhaust);
  console.log('non-exhaust 0-cost draw cards:', loops.length, loops.map(id => `${id}:${CARDS[id].name}`).join(' '));
}
