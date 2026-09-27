// Verification of a Wa season claim: replays the recorded run and returns the validated
// PvP snapshot of the requested act, or throws the HttpError the API answers with.
// Shared by the in-process path (tests, createOnlineHandler default) and the replay
// worker threads (online/replay-worker.mjs) so both run exactly the same code.
// Server-only module: it must never be added to the static whitelist in server.mjs.
import { validateSnapshot } from './duel.mjs';
import { createWaSeason, waAct, extractCheckpoints } from '../wa-season.js';
import { RULES_VERSIONS, ECON_VERSIONS, unlockTiersOf } from '../wa-rules.js';
import { HttpError } from './http-error.mjs';

const MAX_ACTIONS = 5000;

function validateRunId(runId) {
  if (typeof runId !== 'string' || runId.length < 1 || runId.length > 100) {
    throw new HttpError(400, '无效的runId');
  }
}

function validateSeed(seed) {
  if (typeof seed !== 'string' || seed.length < 1 || seed.length > 100) {
    throw new HttpError(400, '无效的seed');
  }
}

function validateRegion(region) {
  if (typeof region !== 'string' || region.length < 1 || region.length > 20) {
    throw new HttpError(400, '无效的region');
  }
}

async function yieldToEventLoop() {
  await new Promise(resolve => setImmediate(resolve));
}

// yieldEvery > 0 lets other requests run between chunks of actions (in-process mode);
// the worker pool passes 0 because a worker thread has nothing else to serve.
async function rebuildSnapshot(run, act, yieldEvery) {
  if (!run || typeof run !== 'object') throw new HttpError(400, '无效的运行数据');
  validateRunId(run.runId);
  validateSeed(run.seed);
  validateRegion(run.region);
  if (!Array.isArray(run.actions) || run.actions.length > MAX_ACTIONS) {
    throw new HttpError(400, '无效的行动列表');
  }
  for (const action of run.actions) {
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      throw new HttpError(400, '无效的行动');
    }
    if (action.type === 'tutorial') {
      throw new HttpError(400, '教程行动不被允许');
    }
  }

  // Rules 1 records replay unchanged; rules 3 adds group fights, encounter/boss pools and keyword cards.
  if (run.rules !== undefined && !RULES_VERSIONS.includes(run.rules)) throw new HttpError(400, '无效的规则版本');
  if (run.ascension !== undefined && (!Number.isInteger(run.ascension) || run.ascension < 0 || run.ascension > 10 || !run.rules)) {
    throw new HttpError(400, '无效的难度等级');
  }
  // Runs recorded before the 15-floor acts carry no mapVersion and replay on the
  // 12-step map (version 1) with that version's opponent tuning.
  if (run.mapVersion !== undefined && run.mapVersion !== 2) throw new HttpError(400, '无效的地图版本：请用当前版本重新完成这一幕');
  // Economy rules (unlock tiers, skip compensation, investments, rerolls). Records
  // without `econ` replay on the full pools; with it, both tiers must be recorded.
  // econ 1: 5 unlock batches (tiers 0..5); econ 2: 4 batches (tiers 0..4).
  const validTier = n => Number.isInteger(n) && n >= 0 && n <= unlockTiersOf(run.econ);
  if (run.econ !== undefined && (!ECON_VERSIONS.includes(run.econ) || run.rules === undefined)) throw new HttpError(400, '无效的经济规则版本');
  if (run.econ !== undefined && (!validTier(run.unlockTier) || !validTier(run.gearTier))) throw new HttpError(400, '无效的解锁等级');
  if (run.econ === undefined && (run.unlockTier !== undefined || run.gearTier !== undefined)) throw new HttpError(400, '无效的解锁等级');
  let state;
  try {
    state = createWaSeason(run.seed, false, run.region, run.runId, { rules: run.rules, ascension: run.ascension, mapVersion: run.mapVersion ?? 1, ...(run.econ !== undefined ? { econ: run.econ, unlockTier: run.unlockTier, gearTier: run.gearTier } : {}) });
  } catch {
    throw new HttpError(400, '无效的运行数据');
  }

  for (let i = 0; i < run.actions.length; i++) {
    if (yieldEvery > 0 && i % yieldEvery === 0) await yieldToEventLoop();
    const action = run.actions[i];
    try {
      const result = waAct(state, action);
      if (result.error) {
        throw new HttpError(400, '无效的行动序列');
      }
      state = result.state;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, '无效的行动序列');
    }
  }

  const checkpoints = extractCheckpoints(state);
  const checkpoint = checkpoints.find(cp => cp.act === act);
  if (!checkpoint) {
    throw new HttpError(400, '未找到指定幕的检查点');
  }
  return checkpoint;
}

function validateArchiveSnapshot(snapshot) {
  try {
    const validated = validateSnapshot(snapshot);
    validated.deckCount = validated.deck.length;
    return validated;
  } catch {
    throw new HttpError(400, '快照无效');
  }
}

export async function verifyClaim(run, act, { yieldEvery = 100 } = {}) {
  const snapshot = await rebuildSnapshot(run, act, yieldEvery);
  return validateArchiveSnapshot(snapshot);
}
