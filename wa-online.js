// wa-online.js - browser helper for online PvP integration.
// Plain named exports only; supports bundler expectations.

const TOKEN_KEY = 'wa-online-token';
const PENDING_KEY = 'wa-archive-pending';
const PROCESSED_PREFIX = 'wa-processed-';
let syncPromise = null;
let latestState = null;
let latestNotify = () => {};

export function loadAccount() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed;
    return null;
  } catch {
    return null;
  }
}

export function saveAccount(token) {
  try {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return false;
    localStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function getPendingProofCache() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setPendingProofCache(proof) {
  try {
    const existing = getPendingProofCache();
    if (existing && existing.checkpoint?.id !== proof?.checkpoint?.id) {
      // Only block if both proofs belong to same owner or current owner unknown
      if (existing.ownerToken === proof.ownerToken || existing.ownerToken === null || proof.ownerToken === null) {
        return { error: '已有未处理的离线云端保存，请先处理旧记录。' };
      }
      // They belong to different accounts; allow overwrite
      localStorage.setItem(PENDING_KEY, JSON.stringify(proof));
      return { ok: true };
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(proof));
    return { ok: true };
  } catch (err) {
    return { error: '无法缓存待定保存：' + err.message };
  }
}

export function clearPendingProofCache() {
  try {
    localStorage.removeItem(PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}

function getProcessedKey(token) {
  return PROCESSED_PREFIX + (token || 'anonymous');
}

function getProcessedCheckpoints(token) {
  try {
    const raw = localStorage.getItem(getProcessedKey(token));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function setProcessedCheckpoints(token, set) {
  try {
    localStorage.setItem(getProcessedKey(token), JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    err.status = 0; // network error indicator
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const apiCreateAccount = async () => {
  const data = await apiFetch('/api/account', { method: 'POST', body: JSON.stringify({}) });
  if (!data.token) throw new Error('创建账号响应缺少 token');
  return data.token;
};

export const apiGetAccount = async (token) => apiFetch('/api/account', { token });

export const apiClaimArchive = async (token, run, act) =>
  apiFetch('/api/archive/claim', { method: 'POST', token, body: JSON.stringify({ run, act }) });

export const apiResolvePending = async (token, decision) =>
  apiFetch('/api/archive/resolve', { method: 'POST', token, body: JSON.stringify(decision) });

export const apiCreateRoom = async (token, archiveId) =>
  apiFetch('/api/rooms', { method: 'POST', token, body: JSON.stringify({ archiveId }) });

export const apiJoinRoom = async (token, code, archiveId) =>
  apiFetch('/api/rooms/join', { method: 'POST', token, body: JSON.stringify({ code, archiveId }) });

export const apiGetRoom = async (token, code) =>
  apiFetch(`/api/rooms/${encodeURIComponent(code)}`, { token });

export const apiReady = async (token, code, ready, archiveId) =>
  apiFetch(`/api/rooms/${encodeURIComponent(code)}/ready`, {
    method: 'POST',
    token,
    body: JSON.stringify({ ready, archiveId })
  });

export const apiAction = async (token, code, requestId, expectedRev, command) =>
  apiFetch(`/api/rooms/${encodeURIComponent(code)}/action`, {
    method: 'POST',
    token,
    body: JSON.stringify({ requestId, expectedRev, command })
  });

export const apiLeaveRoom = async (token, code) =>
  apiFetch(`/api/rooms/${encodeURIComponent(code)}/leave`, { method: 'POST', token, body: JSON.stringify({}) });

export function buildRunFromSeason(season, checkpoint) {
  if (!season || season.waVersion !== 'wa-1' || !season.runId) return null;
  const actions = Array.isArray(season.actions) ? season.actions.slice(0, checkpoint.actionsCount) : [];
  return {
    runId: season.runId,
    seed: season.seed,
    region: season.region,
    ...(season.rules ? { rules: season.rules, ascension: season.ascension || 0 } : {}),
    // 15-floor acts; records without it replay on the older 12-step map.
    ...(season.mapVersion ? { mapVersion: season.mapVersion } : {}),
    // Economy rules: the unlock tiers fix which cards and equipment the season could offer.
    ...(season.econ ? { econ: season.econ, unlockTier: season.unlockTier, gearTier: season.gearTier } : {}),
    actions
  };
}

export async function syncWaCheckpoint(state, notify = () => {}) {
  if (!state || state.waVersion !== 'wa-1' || !state.runId || !Array.isArray(state.checkpoints)) return null;

  // If no checkpoints, return immediately without creating syncPromise to avoid blocking.
  if (state.checkpoints.length === 0) return null;

  // If sync already in progress, store the latest requested state/notify and wait for current completion.
  if (syncPromise) {
    latestState = state;
    latestNotify = notify;
    return syncPromise;
  }

  // No active sync, start new.
  syncPromise = (async () => {
    // Helper to process a single state with its checkpoints.
    const processState = async (st, nt) => {
      // Early exit if no checkpoints at all
      if (!st || st.checkpoints.length === 0) return null;

      let token = loadAccount();
      // Determine unprocessed checkpoints using processed set if token exists, else assume all unprocessed.
      const processed = token ? getProcessedCheckpoints(token) : new Set();
      let idx = 0;
      while (idx < st.checkpoints.length && processed.has(st.checkpoints[idx].id)) idx++;
      if (idx >= st.checkpoints.length) return null; // all processed

      // Ensure token (create if missing)
      if (!token) {
        try {
          token = await apiCreateAccount();
          if (!saveAccount(token)) throw new Error('无法保存账号凭证');
        } catch (err) {
          // Cannot create account, but we can still cache proof with null owner for offline retry
          token = null;
          nt('云端账号创建失败：' + err.message);
        }
        // If token creation failed, we still proceed but only to cache proof, not sync.
      }

      // If token is null, we cannot sync, so just cache proof for the first unprocessed checkpoint and return.
      if (!token) {
        const cp = st.checkpoints[idx];
        const run = buildRunFromSeason(st, cp);
        if (run) {
          const proof = { checkpoint: cp, run, act: cp.act, createdAt: Date.now(), ownerToken: null };
          const setRes = setPendingProofCache(proof);
          if (setRes.error) nt(setRes.error);
          else nt('账号未就绪，离线保存已暂存，待账号恢复后处理。');
        }
        return null;
      }

      // Token exists, process checkpoint(s) sequentially.
      while (idx < st.checkpoints.length) {
        const cp = st.checkpoints[idx];
        if (processed.has(cp.id)) { idx++; continue; }
        const run = buildRunFromSeason(st, cp);
        if (!run) { idx++; continue; }

        const proof = { checkpoint: cp, run, act: cp.act, createdAt: Date.now(), ownerToken: token };

        const existing = getPendingProofCache();
        if (existing && existing.checkpoint?.id !== cp.id) {
          const existingOwner = existing.ownerToken;
          const newOwner = token;
          // Never overwrite offline proof from another account, including unknown ownership.
          if (existingOwner !== newOwner) {
            nt('已有未处理的离线云端保存，可能属于其他账号，请先处理旧记录。');
            return null;
          }
        }

        const setRes = setPendingProofCache(proof);
        if (setRes.error) {
          nt(setRes.error);
          return null;
        }

        try {
          const { ownerToken, ...safeProof } = proof;
          const res = await apiClaimArchive(token, run, cp.act);
          const status = res.status || '';
          if (status === 'saved' || status === 'discard' || status === 'discarded' || status === 'processed' || status === 'replaced') {
            // Success: clear proof and mark processed
            clearPendingProofCache();
            processed.add(cp.id);
            setProcessedCheckpoints(token, processed);
            nt(status === 'saved' || status === 'processed' || status === 'replaced' ? '云端已保存' : '云端已放弃该检查点');
            idx++; // continue to next checkpoint
          } else if (status === 'pending') {
            // Server pending: clear local proof and mark processed to avoid blocking next acts and duplicate notice.
            clearPendingProofCache();
            processed.add(cp.id);
            setProcessedCheckpoints(token, processed);
            nt('云端保存已满位，待你在 PvP 页面选择替换或放弃。');
            return null; // stop processing further
          } else {
            nt('云端保存状态未知：' + status);
            return null; // keep proof for retry
          }
        } catch (err) {
          nt('云端保存失败：' + err.message);
          return null; // keep proof for retry
        }
      }
      return null;
    };

    // Process the initial state.
    const result = await processState(state, notify);
    // After finishing, check if a latest state was queued while we were processing.
    if (latestState && latestState !== state) {
      const queuedState = latestState;
      const queuedNotify = latestNotify;
      // Clear latest before processing to avoid re-processing if recursive calls happen.
      latestState = null;
      latestNotify = () => {};
      // Process queued state once; if it fails, we do not retry automatically.
      await processState(queuedState, queuedNotify);
    }
    return result;
  })();

  try {
    return await syncPromise;
  } finally {
    syncPromise = null;
    // Also clear any remaining latest state to avoid stale references.
    latestState = null;
    latestNotify = () => {};
  }
}
