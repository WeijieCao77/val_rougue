// Headless first-act playtest for the new demo. It drives the real engine
// through legalActions/act and records where choices actually mattered.
// Usage: node tools/playtest-new-demo.mjs [--seeds 10] [--acts 1] [--out reports/playtest/x.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRun, legalActions, act } from '../new-demo/engine.js';
import { CARDS, TEAMS } from '../new-demo/content.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]]] : acc), []));
const SEEDS = Number(args.seeds || 10);
const ACTS = Number(args.acts || 1);
const OUT = args.out || 'reports/playtest/new-demo-act1.json';

const costOf = c => (c.up && CARDS[c.id].upgradeCost !== undefined ? CARDS[c.id].upgradeCost : CARDS[c.id].cost);
const step = (s, a) => { const r = act(s, a); if (r.error) throw Error(`${JSON.stringify(a)}: ${r.error}`); r.state.logs = []; return r.state; };
const enemyStatusValue = b => (b.statuses.enemy.vuln || 0) * 3 + (b.statuses.enemy.weak || 0) * 2.5 + (b.statuses.enemy.smoke || 0) * 1.5 + (b.statuses.enemy.flash || 0) * 2.5 - (b.statuses.enemy.block || 0) * 0.9;

// Score the state right after the enemy turn resolved (1-ply lookahead on the
// revealed intent). HP is worth more than enemy HP, as a careful player plays.
function evaluate(s, hpWeight) {
  if (s.phase === 'result') return -1e6;
  if (s.phase !== 'combat') return 1e5 + s.hp * 10;
  const b = s.battle;
  return s.hp * hpWeight - b.enemyHp + enemyStatusValue(b) + b.powers.length * 6 + (b.powers.includes('barricade') ? b.playerBlock * 0.6 : 0);
}

function stateKey(s) {
  const b = s.battle;
  return [b.hand.map(c => c.id + (c.up ? '+' : '')).sort().join(','), b.energy, b.stance, b.enemyHp, b.playerBlock, s.hp,
    JSON.stringify(b.statuses), b.powers.join(','), b.attackPlayedThisTurn, b.blockPlayedThisTurn, b.stanceSwitchUsedThisTurn, b.drawPile.length].join('|');
}

// Enumerate distinct play lines for this turn. Returns terminal outcomes.
function searchTurn(s, hpWeight, budget = 2500) {
  const seen = new Set();
  const outcomes = [];
  let nodes = 0;
  const dfs = (cur, line) => {
    if (cur.phase !== 'combat') { outcomes.push({ line, score: evaluate(cur, hpWeight), end: cur }); return; }
    const k = stateKey(cur);
    if (seen.has(k)) return;
    seen.add(k);
    if (++nodes > budget) return;
    const ended = step(cur, { type: 'end' });
    outcomes.push({ line, score: evaluate(ended, hpWeight), end: ended, pre: cur });
    for (const a of legalActions(cur)) {
      if (a.type === 'end' || (a.type === 'play' && cur.battle.playsThisTurn >= 40)) continue;
      dfs(step(cur, a), [...line, a]);
    }
  };
  dfs(s, []);
  return outcomes;
}

// Careless baseline: play affordable cards in hand order, never switch stance.
function naiveLine(s) {
  let cur = s; const line = [];
  for (;;) {
    if (cur.phase !== 'combat') break;
    const a = cur.battle.playsThisTurn < 40 && legalActions(cur).find(x => x.type === 'play');
    if (!a) break;
    cur = step(cur, a); line.push(a);
  }
  return { line, cur };
}

function randomLine(s, rand) {
  let cur = s; const line = [];
  for (;;) {
    if (cur.phase !== 'combat') break;
    const options = cur.battle.playsThisTurn < 40 ? legalActions(cur).filter(x => x.type === 'play') : [];
    if (!options.length || rand() < 0.08) break;
    const a = options[Math.floor(rand() * options.length)];
    cur = step(cur, a); line.push(a);
  }
  return { line, cur };
}

// Rough card value for rewards/shop. Not a balance model; just a player's taste.
function cardValue(id) {
  const d = CARDS[id];
  if (!d) return -5;
  if (d.type === 'power') return { tactical_core: 9, attack_core: 8, defense_core: 6, tactical_master: 11, inflame: 9, footwork: 7, barricade: 5, clutch_core: 6, final_push: 6, dark_embrace: 4, smoke_core: 5, flash_core: 5, upgrade_core: 4 }[d.power] || 5;
  let v = 0;
  const walk = (e, m = 1) => {
    if (e.type === 'attack') v += e.n * (e.times || 1) * m;
    else if (e.type === 'block') v += e.n * 0.8 * m;
    else if (e.type === 'draw') v += e.n * 3.5 * m;
    else if (e.type === 'energy') v += e.n * 5 * m;
    else if (e.type === 'smoke') v += e.n * 1.6 * m;
    else if (e.type === 'flash') v += e.n * 2.6 * m;
    else if (e.type === 'weak') v += e.n * 2.5 * m;
    else if (e.type === 'vuln') v += e.n * 3.5 * m;
    else if (e.type === 'heal') v += e.n * 0.8 * m;
    else if (e.type === 'conditional') walk(e.effect, 0.6 * m);
    else if (e.type === 'repeat') walk(e.effect, e.times * m);
    else if (e.type === 'stanceSwitch') v += 1;
  };
  d.effects.forEach(e => walk(e));
  const eff = v / (d.cost + 0.8);
  return eff - (d.exhaust ? 1 : 0);
}

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function playRun(seed, team, policy) {
  let s = createRun(seed, team);
  const rand = mulberry(seed.length * 7919 + team.length);
  const log = { seed, team, policy, fights: [], route: [], rewards: [], result: null, finalDeck: null };
  let fight = null;
  let guard = 0;
  while (s.phase !== 'result' && guard++ < 5000) {
    if (s.act > ACTS) break;
    if (s.phase === 'intermission') { if (s.act >= ACTS) { log.result = 'act-clear'; break; } s = step(s, { type: 'nextAct' }); continue; }
    if (s.phase === 'map') {
      const opts = legalActions(s);
      const nodes = opts.map(o => s.map.nodes.find(n => n.key === o.key));
      let pick;
      if (policy === 'random') pick = opts[Math.floor(rand() * opts.length)];
      else {
        const hpPct = s.hp / s.maxHp;
        const rank = n => ({ elite: hpPct > 0.7 ? 5 : -3, rest: hpPct < 0.5 ? 6 : 1, shop: s.money >= 110 ? 4 : 0, event: 3, battle: hpPct > 0.45 ? 2.5 : 0.5, boss: 9 }[n.kind] ?? 0);
        pick = opts[nodes.map(rank).reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0)];
      }
      const chosen = s.map.nodes.find(n => n.key === pick.key);
      log.route.push({ step: chosen.step, options: nodes.map(n => n.kind), chose: chosen.kind, enemy: chosen.enemy, hp: s.hp, maxHp: s.maxHp, money: s.money });
      s = step(s, pick);
      if (s.phase === 'combat') fight = { act: s.act, enemy: s.battle.enemyId, kind: chosen.kind, hpStart: s.hp, turns: [], won: false };
      continue;
    }
    if (s.phase === 'combat') {
      const b = s.battle;
      const turnInfo = { turn: b.turn, intent: JSON.stringify(b.enemyIntent), hand: b.hand.map(c => c.id), energy: b.energy };
      const playableCost = b.hand.filter(c => c.id in CARDS).reduce((sum, c) => sum + costOf(c), 0);
      turnInfo.canPlayWholeHand = playableCost <= b.energy;
      let line;
      if (policy === 'smart') {
        const hpWeight = 1.6;
        const outs = searchTurn(s, hpWeight);
        outs.sort((x, y) => y.score - x.score);
        const best = outs[0];
        const distinct = [...new Set(outs.map(o => Math.round(o.score)))];
        const naive = naiveLine(s);
        const naiveEnd = naive.cur.phase === 'combat' ? step(naive.cur, { type: 'end' }) : naive.cur;
        turnInfo.lines = outs.length;
        turnInfo.distinctOutcomes = distinct.length;
        turnInfo.gapVsNaive = Math.round(best.score - evaluate(naiveEnd, hpWeight));
        // Best line vs best line that plays the same cards in any order is not
        // tracked; the gap vs a careless in-order play is the practical signal.
        turnInfo.usedStance = best.line.some(a => a.type === 'stance');
        line = best.line;
        turnInfo.played = line.filter(a => a.type === 'play').map(a => s.battle.hand.find(c => c.uid === a.uid)?.id);
        turnInfo.leftUnplayed = s.battle.hand.filter(c => !line.some(a => a.uid === c.uid) && c.id in CARDS).map(c => c.id);
      } else if (policy === 'naive') {
        line = naiveLine(s).line;
      } else {
        line = randomLine(s, rand).line;
      }
      const hpBefore = s.hp;
      for (const a of line) { s = step(s, a); if (s.phase !== 'combat') break; }
      if (s.phase === 'combat') s = step(s, { type: 'end' });
      turnInfo.hpLost = hpBefore - s.hp;
      fight.turns.push(turnInfo);
      if (s.phase !== 'combat') {
        fight.won = s.phase !== 'result';
        fight.hpEnd = s.hp;
        log.fights.push(fight);
      }
      continue;
    }
    if (s.phase === 'reward') {
      const pool = s.battle.rewardPool;
      let id = null;
      if (policy === 'random') id = rand() < 0.75 ? pool[Math.floor(rand() * pool.length)] : null;
      else if (policy === 'smart') {
        const deckAvg = s.deck.reduce((sum, c) => sum + cardValue(c.id), 0) / s.deck.length;
        const best = pool.map(pid => ({ pid, v: cardValue(pid) })).sort((a, b) => b.v - a.v)[0];
        id = best.v > deckAvg * 1.05 ? best.pid : null;
        log.rewards.push({ act: s.act, pool: pool.map(pid => `${CARDS[pid].name}(${CARDS[pid].cost}/${CARDS[pid].rarity[0]}/${cardValue(pid).toFixed(1)})`), deckAvg: +deckAvg.toFixed(1), took: id ? CARDS[id].name : null });
      } else id = pool[0];
      s = step(s, { type: 'reward', id });
      continue;
    }
    if (s.phase === 'rest') {
      const ups = legalActions(s).filter(a => a.choice === 'upgrade');
      let a;
      if (s.hp / s.maxHp < 0.55 || !ups.length) a = { type: 'rest', choice: 'heal' };
      else a = ups.sort((x, y) => cardValue(s.deck.find(c => c.uid === y.uid).id) - cardValue(s.deck.find(c => c.uid === x.uid).id))[0];
      if (policy === 'random') { const all = legalActions(s); a = all[Math.floor(rand() * all.length)]; }
      log.route[log.route.length - 1].did = a.choice;
      s = step(s, a);
      continue;
    }
    if (s.phase === 'shop') {
      const all = legalActions(s);
      let a = { type: 'leave' };
      if (policy === 'smart') {
        const buys = all.filter(x => x.type === 'buy').sort((x, y) => cardValue(y.id) - cardValue(x.id));
        const idOf = x => s.deck.find(c => c.uid === x.uid).id;
        const removes = all.filter(x => x.type === 'remove' && (!CARDS[idOf(x)] || (CARDS[idOf(x)].tag === 'basic' && cardValue(idOf(x)) < 6))).sort((x, y) => cardValue(idOf(x)) - cardValue(idOf(y)));
        if (removes.length && !log._removed?.includes(s.currentNode)) { a = removes[0]; log._removed = [...(log._removed || []), s.currentNode]; }
        else if (buys.length && cardValue(buys[0].id) > 7) a = buys[0];
      } else if (policy === 'random') a = all[Math.floor(rand() * all.length)];
      if (a.type !== 'leave') (log.route[log.route.length - 1].shop ||= []).push(a.type === 'buy' ? 'buy ' + CARDS[a.id].name : a.type === 'remove' ? 'remove ' + (CARDS[s.deck.find(c => c.uid === a.uid).id]?.name || s.deck.find(c => c.uid === a.uid).id) : a.type);
      s = step(s, a);
      continue;
    }
    if (s.phase === 'event') {
      const all = legalActions(s);
      let a = all[0];
      if (policy === 'random') a = all[Math.floor(rand() * all.length)];
      const tries = all.map(x => { const r = act(s, x); return r.error ? null : x; }).filter(Boolean);
      if (!tries.includes(a)) a = tries[tries.length - 1];
      log.route[log.route.length - 1].event = `${s.event.id}:${a.choice}`;
      s = step(s, a);
      continue;
    }
    throw Error('unhandled phase ' + s.phase);
  }
  if (!log.result) log.result = s.phase === 'result' ? s.result : 'stopped';
  if (log.result === 'loss') log.diedAt = fight ? `${fight.enemy} act${fight.act} turn${fight.turns.length}` : '?';
  log.finalDeck = s.deck.map(c => (CARDS[c.id]?.name || c.id) + (c.up ? '+' : ''));
  log.hpEnd = s.hp; log.maxHp = s.maxHp;
  delete log._removed;
  return log;
}

const seeds = Array.from({ length: SEEDS }, (_, i) => `pt-${i + 1}`);
const runs = [];
const t0 = Date.now();
for (const team of Object.keys(TEAMS)) for (const policy of ['smart', 'naive', 'random']) for (const seed of seeds) runs.push(playRun(seed, team, policy));

const summary = {};
for (const r of runs) {
  const k = `${r.team}/${r.policy}`;
  const g = (summary[k] ||= { runs: 0, clears: 0, deaths: {}, fights: 0, fightTurns: 0, hpLostPerFight: 0, bossHpLeft: [], turns: 0, wholeHand: 0, gap5: 0, gap10: 0, stanceTurns: 0, leftovers: {} });
  g.runs++;
  if (r.result === 'act-clear' || r.result === 'win') g.clears++;
  if (r.result === 'loss') g.deaths[r.diedAt.split(' ')[0]] = (g.deaths[r.diedAt.split(' ')[0]] || 0) + 1;
  for (const f of r.fights) {
    g.fights++; g.fightTurns += f.turns.length;
    g.hpLostPerFight += f.turns.reduce((s, t) => s + t.hpLost, 0);
    for (const t of f.turns) {
      g.turns++;
      if (t.canPlayWholeHand) g.wholeHand++;
      if (t.gapVsNaive >= 5) g.gap5++;
      if (t.gapVsNaive >= 10) g.gap10++;
      if (t.usedStance) g.stanceTurns++;
      for (const id of t.leftUnplayed || []) g.leftovers[CARDS[id].name] = (g.leftovers[CARDS[id].name] || 0) + 1;
    }
  }
}
for (const g of Object.values(summary)) {
  g.avgFightTurns = +(g.fightTurns / g.fights).toFixed(2);
  g.avgHpLostPerFight = +(g.hpLostPerFight / g.fights).toFixed(1);
  g.wholeHandPct = Math.round((100 * g.wholeHand) / g.turns);
  g.gap5Pct = Math.round((100 * g.gap5) / g.turns);
  g.gap10Pct = Math.round((100 * g.gap10) / g.turns);
  g.stancePct = Math.round((100 * g.stanceTurns) / g.turns);
  g.leftovers = Object.fromEntries(Object.entries(g.leftovers).sort((a, b) => b[1] - a[1]).slice(0, 6));
  delete g.fightTurns; delete g.hpLostPerFight; delete g.wholeHand; delete g.gap5; delete g.gap10; delete g.stanceTurns; delete g.bossHpLeft;
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), seeds, acts: ACTS, summary, runs }, null, 1));
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${OUT}`);
console.table(Object.fromEntries(Object.entries(summary).map(([k, g]) => [k, { clears: `${g.clears}/${g.runs}`, turnsPerFight: g.avgFightTurns, hpLost: g.avgHpLostPerFight, wholeHand: g.wholeHandPct + '%', gap5: g.gap5Pct + '%', gap10: g.gap10Pct + '%', stance: g.stancePct + '%', deaths: JSON.stringify(g.deaths) }])));
