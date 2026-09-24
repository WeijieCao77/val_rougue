// Headless season playtest for the Wa demo (careful per-turn search player).
// Usage: node tools/playtest-wa.mjs [--seeds 6] [--acts 3] [--out reports/playtest/wa.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createWaSeason, waAct, waLegalActions } from '../wa-season.js';
import { CARDS, REGIONS, effects } from '../content.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]]] : acc), []));
const SEEDS = Number(args.seeds || 6);
const ACTS = Number(args.acts || 3);
const OUT = args.out || 'reports/playtest/wa.json';

const step = (s, a) => { const r = waAct(s, a); if (r.error) throw Error(`${JSON.stringify(a)}: ${r.error}`); r.state.logs = []; return r.state; };
const legal = s => waLegalActions(s).map(({ rev, ...a }) => a);

function evaluate(s) {
  if (s.phase === 'result') return s.outcome === 'win' ? 1e5 : -1e6;
  if (s.phase !== 'combat') return 1e5 + s.hp * 10;
  const b = s.battle;
  return s.hp * 1.6 - b.enemyHp + b.enemyWeak * 2.5 + b.enemyVulnerable * 3 - (b.enemyStrength || 0) * 0.5 - (b.aim ? 6 : 0) - b.turn * 0.6 + b.powers.length * 6;
}
const key = s => { const b = s.battle; return [b.hand.map(c => c.id + (c.up ? '+' : '')).sort().join(','), b.energy, b.enemyHp, b.block, s.hp, b.enemyWeak, b.enemyVulnerable, b.enemyBlock, b.aim, b.enemyStrength, b.draw.length].join('|'); };

function searchTurn(s, budget = 2000) {
  const seen = new Set(); let best = null, nodes = 0;
  const dfs = (cur, line) => {
    if (cur.phase !== 'combat') { const sc = evaluate(cur); if (!best || sc > best.sc) best = { sc, line }; return; }
    const k = key(cur); if (seen.has(k) || ++nodes > budget) return; seen.add(k);
    const ended = step(cur, { type: 'end' }); const sc = evaluate(ended);
    if (!best || sc > best.sc) best = { sc, line };
    for (const a of legal(cur)) if (a.type === 'play') dfs(step(cur, a), [...line, a]);
  };
  dfs(s, []);
  return best.line;
}
const hitValue = id => (CARDS[id]?.effects || []).reduce((v, e) => v + (e.type === 'hit' ? e.n * e.times : e.type === 'block' ? e.n * 0.8 : e.type === 'draw' ? e.n * 3 : e.type === 'weak' || e.type === 'vulnerable' ? e.n * 3 : 2), 0) / ((CARDS[id]?.cost ?? 1) + 0.8);

function playRun(seed, region) {
  let s = createWaSeason(seed, false, region, seed);
  const log = { seed, region, fights: [], result: null };
  let fight = null, guard = 0;
  while (s.phase !== 'result' && guard++ < 6000) {
    if (fight && s.phase === 'combat' && fight.turns >= 60) { log.result = 'stalled'; log.diedAt = fight.enemy; break; }
    if (s.phase === 'intermission') { if (s.act >= ACTS) { log.result = 'act-clear'; break; } s = step(s, { type: 'nextAct' }); continue; }
    const acts = legal(s);
    if (s.phase === 'map') {
      const nodes = acts.map(a => s.map.nodes.find(n => n.key === a.key));
      const pct = s.hp / s.maxHp;
      const rank = n => ({ elite: pct > 0.7 ? 5 : -3, rest: pct < 0.5 ? 6 : 1, shop: s.money >= 90 ? 4 : 0, event: 3, battle: 2.5, boss: 9 }[n.kind] ?? 0);
      const i = nodes.map(rank).reduce((bi, v, j, arr) => (v > arr[bi] ? j : bi), 0);
      s = step(s, acts[i]);
      if (s.phase === 'combat') fight = { act: s.act, enemy: s.battle.enemy, hp0: s.hp, turns: 0 };
      continue;
    }
    if (s.phase === 'combat') {
      for (const a of searchTurn(s)) { s = step(s, a); if (s.phase !== 'combat') break; }
      if (s.phase === 'combat') s = step(s, { type: 'end' });
      fight.turns++;
      if (s.phase !== 'combat') { fight.lost = fight.hp0 - s.hp; fight.won = s.phase !== 'result' || s.outcome === 'win'; log.fights.push(fight); }
      continue;
    }
    if (s.phase === 'reward') {
      const offers = acts.filter(a => a.id).sort((x, y) => hitValue(y.id) - hitValue(x.id));
      s = step(s, offers[0] && hitValue(offers[0].id) > 6 ? offers[0] : { type: 'recruit', id: null });
      continue;
    }
    if (s.phase === 'skin') { s = step(s, acts.find(a => a.id) || acts[0]); continue; }
    if (s.phase === 'shop') {
      const rm = acts.find(a => a.type === 'remove' && CARDS[s.deck.find(c => c.uid === a.uid).id].cost === 1 && hitValue(s.deck.find(c => c.uid === a.uid).id) < 5);
      s = step(s, rm || acts.find(a => a.type === 'leaveShop'));
      continue;
    }
    if (s.phase === 'activity') {
      const pref = s.hp / s.maxHp < 0.6 ? ['fans', 'toughness', 'upgrade'] : ['upgrade', 'toughness', 'fans'];
      const a = pref.map(c => acts.find(x => x.type === 'activity' && x.choice === c)).find(Boolean) || acts.find(x => x.choice === 'skip');
      s = step(s, a);
      continue;
    }
    if (['upgrade', 'eventUpgrade'].includes(s.phase)) { s = step(s, acts.find(a => a.uid) || acts[acts.length - 1]); continue; }
    if (['cleanse', 'eventCleanse'].includes(s.phase)) { s = step(s, acts.find(a => a.uid) || acts[acts.length - 1]); continue; }
    if (s.phase === 'trial') { s = step(s, acts.find(a => a.id === null)); continue; }
    if (s.phase === 'event') { s = step(s, acts.find(a => a.choice === 'skip') || acts[0]); continue; }
    throw Error('unhandled phase ' + s.phase);
  }
  if (!log.result) log.result = s.outcome || 'stopped';
  if (log.result === 'loss') log.diedAt = fight?.enemy;
  return log;
}

const runs = [];
for (const region of Object.keys(REGIONS)) for (let i = 1; i <= SEEDS; i++) { const t = Date.now(); const r = playRun(`wa-pt-${i}`, region); runs.push(r); console.error(region, i, r.result, r.diedAt || '', ((Date.now() - t) / 1000).toFixed(0) + 's', 'fights', r.fights.length, 'maxTurns', Math.max(0, ...r.fights.map(f => f.turns))); }
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(runs, null, 1));
const by = {};
for (const r of runs) for (const f of r.fights) { const g = (by[f.enemy] ||= { n: 0, lost: 0, turns: 0, wins: 0 }); g.n++; g.lost += f.lost; g.turns += f.turns; g.wins += f.won ? 1 : 0; }
for (const [k, g] of Object.entries(by).sort()) console.log(k.padEnd(10), 'n', String(g.n).padStart(3), 'avgLost', (g.lost / g.n).toFixed(1).padStart(5), 'turns', (g.turns / g.n).toFixed(1), 'win', `${g.wins}/${g.n}`);
const res = {}; for (const r of runs) res[`${r.region}:${r.result}`] = (res[`${r.region}:${r.result}`] || 0) + 1;
console.log(JSON.stringify(res));
