// Headless first-act playtest for the new demo. It drives the real engine
// through legalActions/act and records where choices actually mattered.
// Usage: node tools/playtest-new-demo.mjs [--seeds 10] [--acts 1] [--out reports/playtest/x.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRun, legalActions, act, battleEnemies, describeEvent } from '../new-demo/engine.js';
import { EVENTS } from '../new-demo/events.js';
import { CARDS, TEAMS, SUPPLIES, RELICS } from '../new-demo/content.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]]] : acc), []));
const SEEDS = Number(args.seeds || 10);
const ACTS = Number(args.acts || 1);
const OUT = args.out || 'reports/playtest/new-demo-act1.json';
const POLICIES = (args.policies || 'smart,naive,random').split(',');
// --opening 0 skips the 赛前准备 choice; --ascension N plays at that difficulty.
const OPENING = args.opening !== '0';
const ASCENSION = Number(args.ascension || 0);
// --unlock full|base|N: economy rules (skip compensation, 战术投资, rerolls) at that unlock
// tier for cards and equipment; --unlock off plays without economy rules.
const UNLOCK = args.unlock ?? 'full';
const tierArg = UNLOCK === 'full' ? 5 : UNLOCK === 'base' ? 0 : Number(UNLOCK);
const ECON = UNLOCK !== 'off' ? { econ: true, unlockTier: tierArg, gearTier: tierArg } : {};
const INVEST_ORDER = ['IN04', 'IN01', 'IN02', 'IN05', 'IN03'];

const costOf = c => (c.up && CARDS[c.id].upgradeCost !== undefined ? CARDS[c.id].upgradeCost : CARDS[c.id].cost);
const step = (s, a) => { const r = act(s, a); if (r.error) throw Error(`${JSON.stringify(a)}: ${r.error}`); r.state.logs = []; return r.state; };
// Group fights: every living enemy counts; a kill is worth extra because it
// removes that enemy's future damage (the bot's reason to focus fire).
const oneEnemyValue = st => (st.burn || 0) * 2 - (st.strength || 0) * 2 + (st.vuln || 0) * 3 + (st.weak || 0) * 2.5 + (st.smoke || 0) * 1.5 + (st.flash || 0) * 2.5 - (st.block || 0) * 0.9;
const enemyStatusValue = b => (b.deployables || []).reduce((v, d) => v + d.n * d.turns * 0.7, 0) + battleEnemies(b).filter(e => e.hp > 0).reduce((v, e) => v + oneEnemyValue(e.statuses) - 8, 0);
const enemyHpLeft = b => battleEnemies(b).reduce((v, e) => v + Math.max(0, e.hp), 0);

// Score the state right after the enemy turn resolved (1-ply lookahead on the
// revealed intent). HP is worth more than enemy HP, as a careful player plays.
function evaluate(s, hpWeight) {
  if (s.phase === 'result') return -1e6;
  if (s.phase !== 'combat') return 1e5 + s.hp * 10;
  const b = s.battle;
  return s.hp * hpWeight - enemyHpLeft(b) + enemyStatusValue(b) + b.powers.length * 6 + (b.powers.includes('barricade') ? b.playerBlock * 0.6 : 0) + squadValue(b) + keywordValue(b);
}

// Banked next-turn energy/draw (X-cost 蓄势待发) and growth gained this combat.
function keywordValue(b) {
  let v = (b.nextTurnEnergy || 0) * 4 + (b.nextTurnDraw || 0) * 2;
  for (const c of [...b.hand, ...b.drawPile, ...b.discardPile]) if (c.grow) v += c.grow * ((c.up && CARDS[c.id].upgradeGrowth) || CARDS[c.id].growth).n * 0.6;
  return v;
}

// Team trait progress carried into the next turn is worth something.
function squadValue(b) {
  const sq = b.squad;
  if (!sq) return 0;
  if (sq.id === 'momentum') return sq.armed ? 7 : sq.n * 1.2;
  if (sq.id === 'intel') return sq.n * 2;
  if (sq.id === 'fortify') return b.playerBlock * 0.4; // part of the leftover block carries over
  return 0;
}

function stateKey(s) {
  const b = s.battle;
  return [b.hand.map(c => c.id + (c.up ? '+' : '') + (c.grow ? 'g' + c.grow : '')).sort().join(','), b.energy, (b.nextTurnEnergy || 0) + '/' + (b.nextTurnDraw || 0), b.stance, battleEnemies(b).map(e => e.hp).join('/'), b.playerBlock, s.hp,
    JSON.stringify(b.statuses) + JSON.stringify(battleEnemies(b).map(e => e.statuses)), b.powers.join(','), b.attackPlayedThisTurn, b.blockPlayedThisTurn, b.stanceSwitchUsedThisTurn, b.drawPile.length, JSON.stringify(b.squad || null)].join('|');
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
    if (!cur.battle.pendingDiscover) {
      const ended = step(cur, { type: 'end' });
      outcomes.push({ line, score: evaluate(ended, hpWeight), end: ended, pre: cur });
    }
    for (const a of legalActions(cur)) {
      if (a.type === 'end' || a.type === 'useSupply' || (a.type === 'play' && cur.battle.playsThisTurn >= 40)) continue;
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
    const a = cur.battle.pendingDiscover ? legalActions(cur)[0] : cur.battle.playsThisTurn < 40 && legalActions(cur).find(x => x.type === 'play');
    if (!a) break;
    cur = step(cur, a); line.push(a);
  }
  return { line, cur };
}

function randomLine(s, rand) {
  let cur = s; const line = [];
  for (;;) {
    if (cur.phase !== 'combat') break;
    if (cur.battle.pendingDiscover) { const a = legalActions(cur)[0]; cur = step(cur, a); line.push(a); continue; }
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
  if (d.type === 'power') return { tactical_core: 9, attack_core: 8, defense_core: 6, tactical_master: 11, inflame: 9, footwork: 7, barricade: 5, clutch_core: 6, final_push: 6, dark_embrace: 4, smoke_core: 5, flash_core: 5, upgrade_core: 4, knife_master: 5, feel_no_pain: 6, burn_core: 9, turret_core: 5, combo_core: 6 }[d.power] || 5;
  let v = 0;
  const walk = (e, m = 1) => {
    if (e.all) m *= 1.5; // area effects: worth more across a run with group fights
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
    else if (e.type === 'burn') v += e.n * 2.2 * m;
    else if (e.type === 'deploy') v += e.n * e.turns * 0.8 * m;
    else if (e.type === 'discover') v += 6 * m;
    else if (e.type === 'addCardToHand') v += 4 * e.n * m;
    else if (e.type === 'overload') v -= 4 * e.n * m;
    else if (e.type === 'attackFromBlock' || e.type === 'detonate' || e.type === 'burnMultiply' || e.type === 'fireTurrets') v += 7 * m;
    else if (e.type === 'strength') v += 5 * e.n * m;
    // X-cost cards are valued as if played with 3 energy (X = 3).
    else if (e.type === 'xRepeat') walk(e.effect, (3 + (e.plus || 0)) * m);
    else if (e.type === 'xMul') walk({ ...e.effect, n: e.effect.n * (3 + (e.plus || 0)) }, m);
    else if (e.type === 'nextTurnX') v += ((e.energy || 0) * 5 + (e.draw || 0) * 3.5) * (3 + (e.plus || 0)) * m;
  };
  d.effects.forEach(e => walk(e));
  // 成长 pays off over repeat plays; 虚无 is a small risk, 固有 a small plus.
  if (d.growth) v += d.growth.n * 1.5;
  if (d.ethereal) v -= 1;
  if (d.innate) v += 1;
  const eff = v / ((d.x ? 3 : d.cost) + 0.8);
  return eff - (d.exhaust ? 1 : 0);
}

// Static expected value of an event option, read from its ops (the bot never
// peeks at the seeded outcome of a gamble).
function opsValue(s, ops) {
  const hpPct = s.hp / s.maxHp;
  let v = 0;
  for (const op of ops || []) {
    if (op.money) v += op.money * 0.25;
    if (op.hp > 0) v += Math.min(op.hp, s.maxHp - s.hp) * 0.8;
    if (op.hp < 0) v += op.hp * (hpPct < 0.5 ? 1.6 : 1);
    if (op.healPct) v += Math.min(Math.ceil(s.maxHp * op.healPct), s.maxHp - s.hp) * 0.8;
    if (op.maxHp) v += op.maxHp * (op.maxHp > 0 ? 1.5 : 2);
    if (op.equip) v += 30;
    if (op.curse) v -= 15;
    if (op.card) v += { rare: 10, uncommon: 6, common: 3 }[op.card] || 4;
    if (op.upgradeRandom) v += op.upgradeRandom * 5;
    if (op.transformRandom) v += op.transformRandom;
    if (op.pick) v += { upgrade: 7, remove: 8, transform: 3, duplicate: 6, cleanse: 14 }[op.pick] || 0;
    if (op.gamble) v += op.gamble.p * opsValue(s, op.gamble.win) + (1 - op.gamble.p) * opsValue(s, op.gamble.lose);
    if (op.fight) v += hpPct > 0.7 ? 10 + opsValue(s, op.bonus) : -30;
  }
  return v;
}
function pickCard(s, kind, uids) {
  const val = uid => { const c = s.deck.find(x => x.uid === uid); return CARDS[c.id] ? cardValue(c.id) + (c.up ? 1 : 0) : -20; };
  const sorted = [...uids].sort((a, b) => val(a) - val(b));
  return ['remove', 'transform', 'cleanse'].includes(kind) ? sorted[0] : sorted[sorted.length - 1];
}
// Supplies: use them when the coming enemy turn is dangerous, and spend the
// offensive ones early in elite/boss fights (or when every slot is full).
const DEFENSIVE = ['P01', 'P11', 'P07', 'P17', 'P08', 'P05', 'P15'];
const OFFENSIVE = ['P02', 'P04', 'P10', 'P03', 'P13', 'P14', 'P09', 'P12', 'P06', 'P16', 'P18'];
function incomingDamage(s) {
  let dmg = 0;
  for (const e of battleEnemies(s.battle).filter(x => x.hp > 0)) for (const a of e.intent || []) if (a.type === 'hit') dmg += (a.n + (e.statuses.strength || 0)) * a.times; else if (a.type === 'snipe') dmg += a.n;
  return Math.max(0, dmg - s.battle.playerBlock);
}
function supplyAction(s, kind) {
  const legal = legalActions(s).filter(a => a.type === 'useSupply');
  if (!legal.length) return null;
  const ids = s.supplies;
  const danger = s.hp - incomingDamage(s) < s.maxHp * 0.3 || s.hp < s.maxHp * 0.3;
  const big = kind === 'elite' || kind === 'boss';
  const full = ids.length >= 3;
  const order = danger ? DEFENSIVE : (big && s.battle.turn <= 2) || (full && s.battle.turn === 1) ? OFFENSIVE : [];
  for (const id of order) {
    const index = ids.indexOf(id);
    if (index < 0) continue;
    const opts = legal.filter(a => a.index === index);
    if (!opts.length) continue;
    // Aimed supplies go to the enemy with the most HP.
    const living = battleEnemies(s.battle).filter(e => e.hp > 0);
    const target = living.slice().sort((a, b) => b.hp - a.hp)[0];
    return opts.find(a => a.target === target?.uid) || opts[0];
  }
  return null;
}

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function playRun(seed, team, policy) {
  let s = createRun(seed, team, { opening: OPENING, ascension: ASCENSION, ...ECON });
  const rand = mulberry(seed.length * 7919 + team.length);
  const log = { seed, team, policy, actsCleared: 0, opening: null, fights: [], route: [], rewards: [], result: null, finalDeck: null };
  let fight = null;
  let guard = 0;
  while (s.phase !== 'result' && guard++ < 5000) {
    // Equipment slots full: replace the weakest piece if the new one ranks higher, else decline.
    if (s.pendingRelics?.length) {
      const rank = id => ({ common: 1, uncommon: 2, shop: 2, rare: 3, boss: 4 }[RELICS[id].tier] + (RELICS[id].energy ? 1 : 0));
      let low = 0;
      s.relics.forEach((r, i) => { if (rank(r.id) < rank(s.relics[low].id)) low = i; });
      const a = rank(s.pendingRelics[0]) > rank(s.relics[low].id) ? { type: 'replaceRelic', index: low } : { type: 'declineRelic' };
      (log.slotChoices ||= []).push(a.type);
      s = step(s, a);
      continue;
    }
    if (s.act > ACTS) break;
    if (s.phase === 'intermission') { log.actsCleared = s.act; if (s.act >= ACTS) { log.result = 'act-clear'; break; } s = step(s, { type: 'nextAct' }); continue; }
    // 赛前准备: take the first free bonus; card picks use the same card taste as rewards.
    if (s.phase === 'opening') {
      const all = legalActions(s);
      const a = policy === 'random' ? all[Math.floor(rand() * all.length)] : all.find(x => s.opening.options.find(o => o.id === x.choice)?.group === 'free') || all[0];
      log.opening = a.choice;
      s = step(s, a);
      continue;
    }
    if (s.phase === 'openingPick') {
      const all = legalActions(s);
      const idOf = x => s.deck.find(c => c.uid === x.uid)?.id;
      let a;
      if (s.opening.pick.kind === 'card') a = all.filter(x => x.id).sort((x, y) => cardValue(y.id) - cardValue(x.id))[0] || all[0];
      else if (s.opening.pick.kind === 'remove') a = all.slice().sort((x, y) => cardValue(idOf(x)) - cardValue(idOf(y)))[0];
      else a = all.slice().sort((x, y) => cardValue(idOf(y)) - cardValue(idOf(x)))[0];
      if (policy === 'random') a = all[Math.floor(rand() * all.length)];
      log.opening += ':' + (a.id || idOf(a) || 'skip');
      s = step(s, a);
      continue;
    }
    if (s.phase === 'map') {
      const opts = legalActions(s);
      const nodes = opts.map(o => s.map.nodes.find(n => n.key === o.key));
      let pick;
      if (policy === 'random') pick = opts[Math.floor(rand() * opts.length)];
      else {
        const hpPct = s.hp / s.maxHp;
        const rank = n => ({ elite: hpPct > 0.7 ? 5 : -3, rest: hpPct < 0.5 ? 6 : 1, shop: s.money >= 110 ? 4 : 0, event: 3, crate: 4, battle: hpPct > 0.45 ? 2.5 : 0.5, boss: 9 }[n.kind] ?? 0);
        pick = opts[nodes.map(rank).reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0)];
      }
      const chosen = s.map.nodes.find(n => n.key === pick.key);
      log.route.push({ step: chosen.step, options: nodes.map(n => n.kind), chose: chosen.kind, enemy: chosen.enemy, hp: s.hp, maxHp: s.maxHp, money: s.money });
      s = step(s, pick);
      if (chosen.kind === 'event') log.route[log.route.length - 1].revealed = s.map.nodes.find(n => n.key === chosen.key).revealed;
      if (s.phase === 'combat') {
        const idx = log.fights.filter(f => f.act === s.act).length;
        const group = (s.battle.enemies?.length || 1) > 1;
        fight = { act: s.act, idx, enemy: chosen.enemy || s.battle.encounter, kind: chosen.kind === 'event' ? 'ambush' : chosen.kind, group, hpStart: s.hp, turns: [], won: false };
      }
      continue;
    }
    if (s.phase === 'combat' && policy === 'smart' && !s.battle.pendingDiscover) {
      const use = supplyAction(s, fight?.kind);
      if (use) { (log.supplies ||= []).push(s.supplies[use.index]); s = step(s, use); continue; }
    }
    if (s.phase === 'combat') {
      const b = s.battle;
      const turnInfo = { turn: b.turn, intent: JSON.stringify(battleEnemies(b).filter(e => e.hp > 0).map(e => e.intent)), hand: b.hand.map(c => c.id), energy: b.energy };
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
    if (s.phase === 'reward' && s.battle.rewardSupply) {
      const take = legalActions(s).find(a => a.type === 'takeSupply' && a.replace == null);
      if (take && policy !== 'naive') { s = step(s, take); continue; }
    }
    if (s.phase === 'bossRelic') {
      const all = legalActions(s).filter(a => a.id);
      const a = policy === 'random' ? all[Math.floor(rand() * all.length)] : all.find(x => RELICS[x.id].energy && x.id !== 'R41') || all.find(x => x.id !== 'R41') || { type: 'bossRelic', id: null };
      (log.relics ||= []).push(a.id);
      s = step(s, a);
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
      // Skipping: keep one free shelf reroll in reserve when gold is healthy, otherwise take the gold.
      const comp = !s.econ || id ? {} : { comp: policy === 'smart' && !s.freeRerolls && s.money >= 100 ? 'reroll' : 'gold' };
      if (!id && s.econ) (log.skips ||= []).push(comp.comp);
      s = step(s, { type: 'reward', id, ...comp });
      continue;
    }
    if (s.phase === 'rest') {
      const ups = legalActions(s).filter(a => a.choice === 'upgrade');
      let a;
      if (s.hp / s.maxHp < 0.55 || !ups.length) a = legalActions(s).find(x => x.choice === 'heal') || (ups.length ? ups[0] : { type: 'rest', choice: 'maxHp' });
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
        const gear = all.filter(x => x.type === 'buyRelic');
        // Economy: investments in a fixed taste order; reroll the shelf when nothing on it is worth buying.
        const invest = all.find(x => x.type === 'buyInvest') && INVEST_ORDER.indexOf(s.shop.invest) <= 3 ? { type: 'buyInvest' } : null;
        const reroll = all.find(x => x.type === 'rerollShop') && (s.freeRerolls > 0 || (s.money >= 170 && !(s.shop.rerolls > 0))) ? { type: 'rerollShop' } : null;
        if (removes.length && !log._removed?.includes(s.currentNode)) { a = removes[0]; log._removed = [...(log._removed || []), s.currentNode]; }
        else if (invest) a = invest;
        else if (gear.length) a = gear[0];
        else if (buys.length && cardValue(buys[0].id) > 7) a = buys[0];
        else if (reroll) a = reroll;
      } else if (policy === 'random') a = all[Math.floor(rand() * all.length)];
      if (a.type !== 'leave') (log.route[log.route.length - 1].shop ||= []).push(a.type === 'buy' ? 'buy ' + CARDS[a.id].name : a.type === 'buyRelic' ? 'gear ' + RELICS[s.shop.relics[a.index].id].name : a.type === 'buySupply' ? 'supply' : a.type === 'remove' ? 'remove ' + (CARDS[s.deck.find(c => c.uid === a.uid).id]?.name || s.deck.find(c => c.uid === a.uid).id) : a.type);
      s = step(s, a);
      continue;
    }
    if (s.phase === 'crate') {
      if (!s.crate.opened) (log.route[log.route.length - 1].crate = s.crate.size);
      s = step(s, legalActions(s)[0]);
      continue;
    }
    if (s.phase === 'event') {
      const all = legalActions(s);
      let a;
      if (policy === 'random') a = all[Math.floor(rand() * all.length)];
      else if (s.event.pending) {
        const view = describeEvent(s);
        a = { type: 'eventPick', uid: pickCard(s, view.pending.kind, view.pending.candidates) };
      } else {
        const opts = EVENTS[s.event.id].options.filter(o => all.some(x => x.choice === o.id));
        const best = opts.map(o => ({ o, v: policy === 'naive' ? (o.ops.length ? 1 : 0) : opsValue(s, o.ops) })).sort((x, y) => y.v - x.v)[0];
        a = best ? { type: 'event', choice: best.o.id } : all[0];
      }
      if (a.type === 'event') log.route[log.route.length - 1].event = `${s.event.id}:${a.choice}`;
      s = step(s, a);
      if (s.phase === 'combat') {
        const idx = log.fights.filter(f => f.act === s.act).length;
        fight = { act: s.act, idx, enemy: s.battle.encounter, kind: 'elite', group: false, hpStart: s.hp, turns: [], won: false, fromEvent: true };
      }
      continue;
    }
    throw Error('unhandled phase ' + s.phase);
  }
  if (!log.result) log.result = s.phase === 'result' ? s.result : 'stopped';
  if (log.result === 'win') log.actsCleared = 3;
  if (log.result === 'loss') log.diedAt = fight ? `${fight.enemy} act${fight.act} turn${fight.turns.length}` : '?';
  log.finalDeck = s.deck.map(c => (CARDS[c.id]?.name || c.id) + (c.up ? '+' : ''));
  log.hpEnd = s.hp; log.maxHp = s.maxHp;
  log.gear = s.relics.map(r => r.id);
  if (s.econ) log.invest = [...s.invest];
  delete log._removed;
  return log;
}

// --seed-start N offsets the seed names (pt-N ...) so larger samples can run in parallel.
const SEED_START = Number(args["seed-start"] || 1);
const seeds = Array.from({ length: SEEDS }, (_, i) => `pt-${i + SEED_START}`);
const runs = [];
const t0 = Date.now();
for (const team of (args.teams ? args.teams.split(',') : Object.keys(TEAMS))) for (const policy of POLICIES) for (const seed of seeds) runs.push(playRun(seed, team, policy));

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

// Per-category HP cost for the smart policy: what a fight of each kind costs.
const cat = {};
for (const r of runs.filter(r => r.policy === 'smart')) for (const f of r.fights) {
  const kind = f.kind === 'battle' ? (f.act === 1 && f.idx < 2 ? 'first2' : 'normal') : f.kind;
  for (const k of [`act${f.act}/${kind}`, ...(f.group ? [`act${f.act}/${f.kind}-group`] : [])]) {
    const c = (cat[k] ||= { fights: 0, hpLost: 0, losses: 0, turns: 0 });
    c.fights++; c.hpLost += f.turns.reduce((s, t) => s + t.hpLost, 0); c.turns += f.turns.length; if (!f.won) c.losses++;
  }
}
const smartRuns = runs.filter(r => r.policy === 'smart');
console.log('per-team smart act clears (act1 / act2 / full):');
console.table(Object.fromEntries((args.teams ? args.teams.split(',') : Object.keys(TEAMS)).map(t => { const rs = smartRuns.filter(r => r.team === t); const c = n => `${rs.filter(r => r.actsCleared >= n).length}/${rs.length}`; return [t, { act1: c(1), act2: c(2), full: c(3) }]; })));
console.log(`smart clear rate: ${smartRuns.filter(r => r.result === 'act-clear' || r.result === 'win').length}/${smartRuns.length}`);
if (ECON.econ) {
  const count = list => list.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
  const firsts = smartRuns.map(r => r.fights[0]).filter(Boolean).map(f => f.turns.reduce((n, t) => n + t.hpLost, 0));
  console.log('unlock', UNLOCK, 'first fight avg hp lost', (firsts.reduce((a, b) => a + b, 0) / (firsts.length || 1)).toFixed(1), 'invest', JSON.stringify(count(smartRuns.flatMap(r => r.invest || []))), 'skips', JSON.stringify(count(smartRuns.flatMap(r => r.skips || []))), 'shop', JSON.stringify(count(smartRuns.flatMap(r => r.route.flatMap(x => x.shop || []).map(m => m.split(' ')[0])))));
}
console.table(Object.fromEntries(Object.entries(cat).sort().map(([k, c]) => [k, { fights: c.fights, avgHpLost: +(c.hpLost / c.fights).toFixed(1), avgTurns: +(c.turns / c.fights).toFixed(1), deaths: c.losses }])));
