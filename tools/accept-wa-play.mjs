import fs from 'node:fs/promises';
import { createWaSeason as createSeason, waAct as act, waLegalActions as legalActions } from '../wa-season.js';
import { intent } from '../engine.js';
import { CARDS, effects } from '../content.js';

const MAX_STEPS = 2000;
const MAX_SEEDS_PER_REGION = 10;
const REGIONS = ['CN', 'AM', 'EMEA', 'PAC'];
const PROOF_TARGET = 2;
const WALL_TIME_MS = 110_000;

const results = {
  seedsTried: 0,
  firstActWins: 0,
  losses: 0,
  errors: 0,
  proofCount: 0,
  runs: []
};

const proofs = [];

function evaluateCombatState(state) {
  if (state.phase !== 'combat') {
    if (state.outcome === 'win') return 10000;
    if (state.outcome === 'loss') return -10000;
    if (state.outcome === 'abandoned') return -5000;
    if (state.phase === 'intermission' || state.phase === 'reward') return 8000;
    return 0;
  }
  const b = state.battle;
  let score = 0;
  // Enemy HP: lower is better (actual hp delta)
  score -= b.enemyHp * 100;
  // Player HP and block
  score += state.hp * 10;
  score += b.block * 5;
  // Enemy debuffs
  score += b.enemyWeak * 5;
  score += b.enemyVulnerable * 5;
  // Player debuffs negative
  score -= b.weak * 5;
  // Energy good
  score += b.energy * 2;
  // Incoming damage mitigation: penalty for unblocked damage
  const incoming = intent(state).reduce((sum, e) => sum + (e.type === 'hit' ? e.n * (e.times || 1) : 0), 0);
  if (incoming > 0) {
    const unblocked = Math.max(0, incoming - b.block);
    score -= unblocked * 3;
  }
  return score;
}

function chooseCombatAction(state) {
  const legal = legalActions(state).filter(a => a.type === 'play' || a.type === 'end');
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  const currentScore = evaluateCombatState(state);
  let bestAction = null;
  let bestScore = -Infinity;

  for (const action of legal) {
    const res = act(state, action);
    if (res.error) continue;
    const score = evaluateCombatState(res.state);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  // Prefer ending turn if no play action strictly improves the score
  if (bestAction && bestAction.type !== 'end' && bestScore <= currentScore) {
    return legal.find(a => a.type === 'end') || bestAction;
  }
  return bestAction;
}

function nodeScore(node, state) {
  let score = 0;
  if (node.kind === 'rest' && state.hp < state.maxHp * 0.7) score += 100;
  if (node.kind === 'shop' && state.money >= 40) score += 60;
  if (node.kind === 'event') score += 30;
  if (node.kind === 'battle') score += 20;
  if (node.kind === 'elite') score -= 20;
  if (node.kind === 'boss') score -= 50;
  if (node.kind === 'rest' && state.hp >= state.maxHp) score -= 50;
  return score;
}

function chooseMapAction(state) {
  const legal = legalActions(state).filter(a => a.type === 'chooseNode');
  if (legal.length === 0) return null;
  let bestAction = legal[0];
  let bestScore = -Infinity;
  for (const action of legal) {
    const node = state.map.nodes.find(n => n.key === action.key);
    if (node) {
      const score = nodeScore(node, state);
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }
  }
  return bestAction;
}

function evaluateCard(id) {
  let score = 0;
  const cardEffects = effects({ id, up: false });
  for (const eff of cardEffects) {
    if (eff.type === 'hit') score += eff.n * (eff.times || 1) * 2;
    else if (eff.type === 'block') score += eff.n * 2;
    else if (eff.type === 'draw') score += eff.n * 1.5;
    else if (eff.key === 'duel' || eff.key === 'init') score += eff.n * 3;
    else if (eff.key === 'energy') score += eff.n * 4;
    else if (eff.key === 'extraDraw') score += eff.n * 3;
    else if (eff.type === 'weak' || eff.type === 'vulnerable') score += 2;
  }
  const card = CARDS[id];
  if (card && card.player) {
    if (card.cost <= 1) score += 5;
    if (card.cost === 0) score += 3;
  }
  return score;
}

function chooseRewardAction(state) {
  const legal = legalActions(state).filter(a => a.type === 'recruit');
  if (legal.length === 0) return null;
  const offers = state.reward.offers || [];
  const skip = legal.find(a => a.id === null);
  if (offers.length === 0) return skip;
  let bestScore = -Infinity;
  let bestAction = skip;
  for (const id of offers) {
    const action = legal.find(a => a.id === id);
    if (action) {
      const score = evaluateCard(id);
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }
  }
  return bestAction;
}

function chooseShopAction(state) {
  const legal = legalActions(state);
  const buyActions = legal.filter(a => a.type === 'buy');
  for (let slot = 2; slot >= 0; slot--) {
    const buy = buyActions.find(a => a.slot === slot);
    if (buy) return buy;
  }
  const removeActions = legal.filter(a => a.type === 'remove' && state.deck.some(c => c.uid === a.uid && c.id.startsWith('CU')));
  if (removeActions.length > 0) return removeActions[0];
  const leaveShop = legal.find(a => a.type === 'leaveShop');
  return leaveShop || null;
}

function chooseEventAction(state) {
  const legal = legalActions(state).filter(a => a.type === 'seasonEvent');
  if (legal.length === 0) return null;
  const eventId = state.eventId;
  const choices = legal.map(a => a.choice);
  let preferred;
  switch (eventId) {
    case 'sponsor':
      preferred = state.money < 100 ? 'accept' : 'skip';
      break;
    case 'trial':
      preferred = 'accept';
      break;
    case 'scrim':
      preferred = (state.hp < state.maxHp && state.money >= 20) ? 'safe' : (state.hp > 8 ? 'risk' : 'skip');
      break;
    case 'training':
      preferred = (state.deck.some(c => CARDS[c.id].player && !c.up)) ? (state.money >= 40 ? 'paid' : 'risky') : 'skip';
      break;
    case 'rally':
      preferred = (state.deck.some(c => c.id.startsWith('CU')) && state.money >= 60) ? 'cleanse' : 'sponsor';
      break;
    default:
      preferred = 'skip';
  }
  const action = legal.find(a => a.choice === preferred);
  return action || legal[0];
}

function chooseActivityAction(state) {
  const legal = legalActions(state).filter(a => a.type === 'activity');
  if (legal.length === 0) return null;
  const hasFans = legal.some(a => a.choice === 'fans');
  const hasUpgrade = legal.some(a => a.choice === 'upgrade');
  const hasCleanse = legal.some(a => a.choice === 'cleanse');
  if (hasFans && state.hp < state.maxHp) {
    return legal.find(a => a.choice === 'fans');
  }
  if (hasUpgrade && state.deck.some(c => CARDS[c.id].player && !c.up)) {
    return legal.find(a => a.choice === 'upgrade');
  }
  if (hasCleanse && state.deck.some(c => c.id.startsWith('CU'))) {
    return legal.find(a => a.choice === 'cleanse');
  }
  return legal.find(a => a.choice === 'skip') || legal[0];
}

function evaluateUpgradeCard(uid, state) {
  const card = state.deck.find(c => c.uid === uid);
  if (!card) return -Infinity;
  let score = 0;
  const baseEffects = effects({ id: card.id, up: false });
  for (const eff of baseEffects) {
    if (eff.type === 'hit') score += 10;
    if (eff.type === 'block') score += 8;
    if (CARDS[card.id].cost <= 1) score += 5;
  }
  return score;
}

function chooseUpgradeCardAction(state) {
  const legal = legalActions(state).filter(a => a.type === 'upgrade');
  if (legal.length === 0) return null;
  let bestAction = legal[0];
  let bestScore = -Infinity;
  for (const action of legal) {
    const score = evaluateUpgradeCard(action.uid, state);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  return bestAction;
}

function chooseCleanseCardAction(state) {
  const legal = legalActions(state).filter(a => a.type === 'cleanse');
  if (legal.length === 0) return null;
  // Prefer removing CU02 (舆论压力) over CU01 (磨合不足)
  return legal.find(a => state.deck.find(c => c.uid === a.uid && c.id === 'CU02')) || legal[0];
}

function chooseEventUpgradeCardAction(state) {
  const legal = legalActions(state).filter(a => a.type === 'eventUpgrade');
  if (legal.length === 0) return null;
  let bestAction = legal[0];
  let bestScore = -Infinity;
  for (const action of legal) {
    const score = evaluateUpgradeCard(action.uid, state);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  return bestAction;
}

function chooseEventCleanseCardAction(state) {
  const legal = legalActions(state).filter(a => a.type === 'eventCleanse');
  if (legal.length === 0) return null;
  return legal.find(a => state.deck.find(c => c.uid === a.uid && c.id === 'CU02')) || legal[0];
}

function chooseAction(state) {
  switch (state.phase) {
    case 'combat':
      return chooseCombatAction(state);
    case 'map':
      return chooseMapAction(state);
    case 'reward':
      return chooseRewardAction(state);
    case 'shop':
      return chooseShopAction(state);
    case 'event':
      return chooseEventAction(state);
    case 'activity':
      return chooseActivityAction(state);
    case 'trial': {
      const legal = legalActions(state).filter(a => a.type === 'trial');
      if (legal.length === 0) return null;
      const accept = legal.find(a => a.id !== null);
      return accept || legal[0];
    }
    case 'upgrade':
      return chooseUpgradeCardAction(state);
    case 'cleanse':
      return chooseCleanseCardAction(state);
    case 'intermission': {
      const legal = legalActions(state).filter(a => a.type === 'nextAct');
      return legal.length > 0 ? legal[0] : null;
    }
    case 'skin': {
      const legal = legalActions(state).filter(a => a.type === 'skin');
      if (legal.length === 0) return null;
      const take = legal.find(a => a.id !== null);
      const skip = legal.find(a => a.id === null);
      return take || skip;
    }
    case 'eventUpgrade':
      return chooseEventUpgradeCardAction(state);
    case 'eventCleanse':
      return chooseEventCleanseCardAction(state);
    case 'eventPick':
    case 'crate':
      return legalActions(state)[0] || null;
    default:
      return null;
  }
}

async function main() {
  const startTime = Date.now();
  try {
    await fs.mkdir('reports/dual-demo', { recursive: true });
  } catch {}

  outer:
  for (const region of REGIONS) {
    for (let i = 0; i < MAX_SEEDS_PER_REGION; i++) {
      if (Date.now() - startTime > WALL_TIME_MS) break outer;
      if (proofs.length >= PROOF_TARGET) break outer;
      const seed = `${region}-${i}`;
      const runId = `run-${region}-${i}`;
      results.seedsTried++;
      let state;
      try {
        state = createSeason(seed, false, region, runId);
      } catch (e) {
        results.errors++;
        results.runs.push({ runId, seed, region, status: 'error', error: e.message });
        continue;
      }
      let steps = 0;
      let status = 'unknown';
      let errorMsg = null;
      let actionsSnapshot = [];
      while (state.phase !== 'result' && steps < MAX_STEPS) {
        if (Date.now() - startTime > WALL_TIME_MS) break;
        const legal = legalActions(state);
        if (legal.length === 0) {
          status = 'error';
          errorMsg = 'No legal actions';
          break;
        }
        const action = chooseAction(state);
        if (!action) {
          status = 'error';
          errorMsg = 'No action chosen';
          break;
        }
        const res = act(state, action);
        if (res.error) {
          status = 'error';
          errorMsg = res.error;
          break;
        }
        state = res.state;
        actionsSnapshot = state.actions.slice();
        steps++;
        // Check for first act completion: transition to intermission after act 1
        if (state.phase === 'intermission' && state.act === 1) {
          status = 'firstActWin';
          break;
        }
        if (state.phase === 'result') {
          status = state.outcome || 'unknown';
          break;
        }
      }
      // final classification
      if (status === 'firstActWin') {
        results.firstActWins++;
      } else if (state.phase === 'result' && state.outcome === 'loss') {
        results.losses++;
        status = 'loss';
      } else if (status === 'error') {
        results.errors++;
      } else {
        if (state.phase === 'result' && state.outcome === 'abandoned') {
          status = 'abandoned';
          results.losses++;
        } else {
          status = 'timeout';
          results.errors++;
        }
      }
      results.runs.push({
        runId, seed, region, status, steps,
        finalPhase: state.phase,
        act: state.act,
        hp: state.hp,
        maxHp: state.maxHp,
        error: errorMsg,
      });
      if (status === 'firstActWin') {
        proofs.push({
          run: {
            runId,
            seed,
            region,
            actions: actionsSnapshot,
          },
          act: 1,
        });
        results.proofCount = proofs.length;
      }
      if (proofs.length >= PROOF_TARGET) break;
    }
  }

  try {
    await fs.writeFile('reports/dual-demo/real-play-results.json', JSON.stringify(results, null, 2));
    await fs.writeFile('reports/dual-demo/verified-proofs.json', JSON.stringify(proofs, null, 2));
  } catch (e) {
    console.error('Failed to write reports:', e);
  }

  console.log('Summary:', {
    seedsTried: results.seedsTried,
    firstActWins: results.firstActWins,
    losses: results.losses,
    errors: results.errors,
    proofCount: results.proofCount,
  });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
