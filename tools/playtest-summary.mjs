// Per-enemy summary of a playtest report written by tools/playtest-new-demo.mjs.
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2]));
const policy = process.argv[3] || 'smart';
const by = {};
for (const r of d.runs.filter(r => r.policy === policy)) for (const f of r.fights) {
  const g = (by[`${f.act}:${f.enemy}`] ||= { n: 0, lost: 0, turns: 0, max: 0, wins: 0 });
  const l = f.turns.reduce((s, t) => s + t.hpLost, 0);
  g.n++; g.lost += l; g.max = Math.max(g.max, l); g.turns += f.turns.length; g.wins += f.won ? 1 : 0;
}
for (const [k, g] of Object.entries(by).sort()) console.log(k.padEnd(10), 'n', String(g.n).padStart(3), 'avgLost', (g.lost / g.n).toFixed(1).padStart(5), 'max', String(g.max).padStart(3), 'turns', (g.turns / g.n).toFixed(1), 'win', `${g.wins}/${g.n}`);
const rs = d.runs.filter(r => r.policy === policy);
let offered = 0, taken = 0;
for (const r of rs) for (const w of r.rewards) { offered++; if (w.took) taken++; }
console.log('rewards taken', taken, '/', offered, '| results', JSON.stringify(rs.reduce((a, r) => ((a[r.result] = (a[r.result] || 0) + 1), a), {})));
