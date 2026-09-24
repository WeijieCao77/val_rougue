// Headless season playtest for the Wa demo (careful per-turn search player).
// Usage: node tools/playtest-wa.mjs [--seeds 6] [--acts 3] [--out reports/playtest/wa.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createWaSeason, waAct, waLegalActions } from '../wa-season.js';
import { CARDS, REGIONS, effects } from '../content.js';
import { describeSeasonEvent } from '../engine.js';
import { WA_EVENTS } from '../wa-events.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]]] : acc), []));
const SEEDS = Number(args.seeds || 6);
const ACTS = Number(args.acts || 3);
const OUT = args.out || 'reports/playtest/wa.json';
const SKIP_EVENTS = args.events === 'skip'; // --events skip: always decline events (A/B against older runs)

const step = (s, a) => { const r = waAct(s, a); if (r.error) throw Error(`${JSON.stringify(a)}: ${r.error}`); r.state.logs = []; return r.state; };
const legal = s => waLegalActions(s).map(({ rev, ...a }) => a);

function evaluate(s) {
  if (s.phase === 'result') return s.outcome === 'win' ? 1e5 : -1e6;
  if (s.phase !== 'combat') return 1e5 + s.hp * 10;
  const b = s.battle;
  return s.hp * 1.6 - b.enemyHp + (b.enemyBurn || 0) * 2 + (b.deployables || []).reduce((v, d) => v + d.n * d.turns * 0.7, 0) + (b.selfStrength || 0) * 3 + b.enemyWeak * 2.5 + b.enemyVulnerable * 3 - (b.enemyStrength || 0) * 0.5 - (b.aim ? 6 : 0) - b.turn * 0.6 + b.powers.length * 6;
}
const key = s => { const b = s.battle; return [b.hand.map(c => c.id + (c.up ? '+' : '')).sort().join(','), b.energy, b.enemyHp, b.block, s.hp, b.enemyWeak, b.enemyVulnerable, b.enemyBlock, b.aim, b.enemyStrength, b.draw.length, b.enemyBurn, b.plays, b.selfStrength, (b.deployables || []).length].join('|'); };

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
const effValue = e => e.type === 'combo' ? effValue(e.effect) * 0.7 : e.type === 'hit' ? e.n * e.times + (e.ifVuln || e.ifBurn || 0) * 0.5 : e.type === 'block' ? e.n * 0.8 : e.type === 'draw' ? e.n * 3 : e.type === 'weak' || e.type === 'vulnerable' ? e.n * 3 : e.type === 'burn' ? e.n * 2.2 : e.type === 'deploy' ? e.n * e.turns * 0.8 : e.type === 'overload' ? -4 * e.n : e.type === 'strength' ? 5 * e.n : ['burnMultiply', 'detonate', 'bodyslam', 'fireTurrets'].includes(e.type) ? 7 : 2;
const hitValue = id => (CARDS[id]?.effects || []).reduce((v, e) => v + effValue(e), 0) / ((CARDS[id]?.cost ?? 1) + 0.8);

// Static expected value of an event option, read from its ops (no peeking at
// seeded gamble outcomes).
function opsValue(s, ops) {
  const hpPct = s.hp / s.maxHp;
  let v = 0;
  for (const op of ops || []) {
    if (op.money) v += op.money * 0.25;
    if (op.hp > 0) v += Math.min(op.hp, s.maxHp - s.hp) * 0.8;
    if (op.hp < 0) v += op.hp * (hpPct < 0.5 ? 1.6 : 1);
    if (op.healPct) v += Math.min(Math.ceil(s.maxHp * op.healPct), s.maxHp - s.hp) * 0.8;
    if (op.maxHp) v += op.maxHp * (op.maxHp > 0 ? 1.5 : 2);
    if (op.equip) v += s.skins.length < 3 ? 20 : op.equip.fallback * 0.25;
    if (op.curse) v -= 15;
    if (op.card) v += op.card === 'star' ? 8 : 5;
    if (op.upgradeRandom) v += op.upgradeRandom * 5;
    if (op.transformRandom) v += op.transformRandom;
    if (op.pick) v += { upgrade: 7, remove: 8, transform: 3, duplicate: 6, cleanse: 14 }[op.pick] || 0;
    if (op.gamble) v += op.gamble.p * opsValue(s, op.gamble.win) + (1 - op.gamble.p) * opsValue(s, op.gamble.lose);
    if (op.fight) v += hpPct > 0.7 ? 10 + opsValue(s, op.bonus) : -30;
    if (op.special) v -= 1;
  }
  return v;
}
function pickCard(s, kind, uids) {
  const val = uid => { const c = s.deck.find(x => x.uid === uid); return c.id.startsWith('CU') ? -20 : hitValue(c.id) + (c.up ? 1 : 0); };
  const sorted = [...uids].sort((a, b) => val(a) - val(b));
  return ['remove', 'transform', 'cleanse'].includes(kind) ? sorted[0] : sorted[sorted.length - 1];
}

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
      const rank = n => ({ elite: pct > 0.7 ? 5 : -3, rest: pct < 0.5 ? 6 : 1, shop: s.money >= 90 ? 4 : 0, event: 3, crate: 4, battle: 2.5, boss: 9 }[n.kind] ?? 0);
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
    if (['upgrade', 'cleanse'].includes(s.phase)) { s = step(s, acts.find(a => a.uid) || acts[acts.length - 1]); continue; }
    if (['eventUpgrade', 'eventCleanse', 'eventPick'].includes(s.phase)) {
      const view = describeSeasonEvent(s);
      s = step(s, { type: s.phase, uid: pickCard(s, view.pending.kind, view.pending.candidates) });
      continue;
    }
    if (s.phase === 'crate') {
      const ups = acts.filter(a => a.type === 'crateUpgrade');
      s = step(s, ups.length ? { type: 'crateUpgrade', uid: pickCard(s, 'upgrade', ups.map(a => a.uid)) } : acts[0]);
      continue;
    }
    if (s.phase === 'trial') {
      const best = [...s.eventOffers].sort((x, y) => hitValue(y) - hitValue(x))[0];
      s = step(s, { type: 'trial', id: best && hitValue(best) > 6 ? best : null });
      if (s.phase === 'event') s = step(s, { type: 'seasonEvent', choice: 'skip' });
      continue;
    }
    if (s.phase === 'event') {
      const opts = WA_EVENTS[s.eventId].options.filter(o => acts.some(a => a.choice === o.id));
      const best = opts.map(o => ({ o, v: opsValue(s, o.ops) })).sort((x, y) => y.v - x.v)[0];
      (log.events ||= []).push(`${s.eventId}:${!SKIP_EVENTS && best && best.v > 0 ? best.o.id : 'skip'}`);
      s = step(s, { type: 'seasonEvent', choice: !SKIP_EVENTS && best && best.v > 0 ? best.o.id : 'skip' });
      if (s.phase === 'combat') fight = { act: s.act, enemy: s.battle.enemy, hp0: s.hp, turns: 0, fromEvent: true };
      continue;
    }
    throw Error('unhandled phase ' + s.phase);
  }
  log.deck = s.deck.map(c => c.id);
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
