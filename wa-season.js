import {
  createSeason as createOriginalSeason,
  act as originalAct,
  clone,
  legalActions as originalLegalActions
} from './engine.js';

const WA_VERSION = 'wa-1';

function deepCopy(obj) {
  return clone(obj);
}

function isWaState(state) {
  return state && state.waVersion === WA_VERSION;
}

function makeCheckpoint(s) {
  if (!s || s.mode !== 'season' || !s.act || !s.runId) return null;
  return {
    id: `${s.runId}:${s.act}`,
    runId: s.runId,
    act: s.act,
    version: 'wa-pvp-1',
    seed: s.seed,
    region: s.region,
    deck: s.deck.map(c => ({ uid: c.uid, id: c.id, up: !!c.up })),
    skins: [...s.skins],
    maxHp: s.maxHp,
    hp: s.maxHp,
    money: s.money,
    actionsCount: s.actions ? s.actions.length : 0
  };
}

function addCheckpoint(s) {
  const cp = makeCheckpoint(s);
  if (!cp) return;
  const idx = s.checkpoints.findIndex(c => c.id === cp.id);
  if (idx >= 0) return;
  s.checkpoints.push(cp);
}

export function createWaSeason(seed = 'first-season', tutorial = false, region = 'CN', runId = 'local') {
  const s = createOriginalSeason(seed, tutorial, region);
  s.runId = String(runId);
  s.waVersion = WA_VERSION;
  s.checkpoints = [];
  return s;
}

export function extractCheckpoints(state) {
  if (!state) throw new Error('state required');
  return (state.checkpoints || []).map(cp => deepCopy(cp));
}

export function waAct(state, action) {
  if (!state) throw new Error('state required');
  if (!isWaState(state)) {
    return originalAct(state, action);
  }
  if (action.rev !== undefined && action.rev !== state.rev) {
    return { state, error: '界面已更新，请使用当前操作' };
  }
  let s = deepCopy(state);
  if (action.type === 'activity' && action.choice === 'toughness') {
    if (s.phase !== 'activity') return { state, error: '此操作已失效' };
    if (s.mode !== 'season') return { state, error: '未知操作' };
    s.maxHp += 6;
    s.hp += 6;
    s.rev++;
    const clean = { ...action };
    delete clean.rev;
    s.actions.push(clean);
    s.logs.push({ node: s.node || 0, turn: s.battle ? s.battle.turn : 0, text: '坚韧训练：最大声望和当前声望 +6。' });
    if (s.currentNode) {
      if (!s.completed.includes(s.currentNode)) s.completed.push(s.currentNode);
    }
    s.battle = null;
    delete s.reward;
    delete s.shop;
    delete s.eventOffers;
    delete s.eventId;
    delete s.pendingEvent;
    s.phase = 'map';
    return { state: s, error: null };
  }

  const result = originalAct(s, action);
  if (result.error) return result;
  const next = result.state;
  const prevPhase = s.phase;
  const nextPhase = next.phase;
  const prevAct = s.act;
  const shouldFullHeal = (prevPhase !== 'intermission' && nextPhase === 'intermission') || (s.outcome !== 'win' && next.outcome === 'win' && next.act === 3);
  if (shouldFullHeal) {
    const healAmount = next.maxHp - s.hp;
    next.hp = next.maxHp;
    next.intermissionHeal = healAmount;
    next.logs = next.logs.filter(l => !String(l.text).includes('晋级宣传'));
    next.logs.push({ node: next.node || 0, turn: next.battle ? next.battle.turn : 0, text: `完全恢复至最大声望：${next.maxHp}` });
    addCheckpoint(next);
  }
  return { state: next, error: null };
}

export function waLegalActions(state) {
  if (!state) return [];
  if (!isWaState(state)) {
    return originalLegalActions(state);
  }
  const actions = originalLegalActions(state);
  if (state.phase === 'activity') {
    const hasToughness = actions.some(a => a.type === 'activity' && a.choice === 'toughness');
    if (!hasToughness) {
      actions.push({ type: 'activity', choice: 'toughness', rev: state.rev });
    }
  }
  return actions;
}
