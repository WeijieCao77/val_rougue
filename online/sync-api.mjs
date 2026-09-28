// Progress sync between devices (both demos, separately).
//
//   POST /api/sync/code    { demo, bundle, savedAt, device }            → new link + code
//                          { demo, syncId, secret }                    → code for an existing link
//   POST /api/sync/redeem  { demo, code, bundle?, savedAt?, device? }  → { syncId, secret, rev, savedAt, device, bundle }
//   POST /api/sync/sync    { syncId, secret, rev, dirty, savedAt, bundle?, device }
//                          → { status: 'uptodate' | 'pushed' | 'pulled', rev, savedAt, device, bundle?, backup }
//   POST /api/sync/restore { syncId, secret }                          → swaps current and backup
//
// A code is 6 characters from an unambiguous alphabet, valid 10 minutes, single use.
// Both devices then share the sync id; each holds its own secret token (the server keeps
// only sha256 hashes, at most 8 devices per link). Conflict
// rule: revisions increase by one per accepted upload; when a device uploads on top of
// an older revision than the server's (both devices changed since their last sync), the
// copy saved later (savedAt) becomes current and the other one is kept as a one-slot
// backup that the player can restore. Bundles are stored gzip-compressed.
import { randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { sha256 } from './store.mjs';
import { HttpError, sendJson, sendError, readJsonBody, RateLimiter, clientIpOf } from './api.mjs';

export const SYNC_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SYNC_CODE_TTL_MS = 10 * 60 * 1000;
export const SYNC_MAX_BUNDLE_BYTES = 512 * 1024;
export const SYNC_LINK_MAX_IDLE_MS = 180 * 24 * 60 * 60 * 1000;
const DEMOS = new Set(['wa', 'new']);
const MAX_KEYS = 300;
const LIMITS = { code: 10, redeem: 20, sync: 120, syncPerLink: 60 };

export function generateSyncCode() {
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) code += SYNC_CODE_ALPHABET[bytes[i] % SYNC_CODE_ALPHABET.length];
  return code;
}

export const linkView = link => ({
  rev: link.rev,
  savedAt: link.savedAt,
  device: link.device,
  backup: link.backup ? { savedAt: link.backup.savedAt, device: link.backup.device } : null,
});
const view = linkView;

// The conflict rule shared by /api/sync/sync and /api/save/sync (inside store.tx).
// Returns { status, conflict?, …view, blob? }.
export function applySync(store, link, { baseRev, dirty, packed, savedAt, device, nowTime }) {
  store.touchSyncLink(link.syncId, nowTime);
  if (!dirty) {
    if (link.rev <= baseRev) return { status: 'uptodate', ...view(link) };
    return { status: 'pulled', ...view(link), blob: store.syncBundle(link.syncId) };
  }
  if (baseRev >= link.rev) {
    // Nothing new on the server since this device last synced: fast-forward.
    store.setSyncCurrent(link.syncId, { rev: link.rev + 1, savedAt, device, blob: packed.blob, bytes: packed.bytes, now: nowTime });
    return { status: 'pushed', ...view(store.syncLink(link.syncId)) };
  }
  // Both sides changed since this device's last sync.
  if (savedAt > (link.savedAt ?? 0)) {
    const previous = { blob: store.syncBundle(link.syncId), rev: link.rev, savedAt: link.savedAt, device: link.device };
    store.setSyncBackup(link.syncId, previous);
    store.setSyncCurrent(link.syncId, { rev: link.rev + 1, savedAt, device, blob: packed.blob, bytes: packed.bytes, now: nowTime });
    return { status: 'pushed', conflict: true, ...view(store.syncLink(link.syncId)) };
  }
  store.setSyncBackup(link.syncId, { blob: packed.blob, rev: baseRev, savedAt, device });
  return { status: 'pulled', conflict: true, ...view(store.syncLink(link.syncId)), blob: store.syncBundle(link.syncId) };
}

// Swap the current copy and the backup (inside store.tx). Returns { link, blob }.
export function restoreLinkBackup(store, link, nowTime) {
  const backup = store.syncBackup(link.syncId);
  if (!backup) throw new HttpError(404, '没有可恢复的备份');
  const current = { blob: store.syncBundle(link.syncId), rev: link.rev, savedAt: link.savedAt, device: link.device };
  const bytes = gunzipSync(backup.blob).length;
  store.setSyncCurrent(link.syncId, { rev: link.rev + 1, savedAt: nowTime, device: backup.device, blob: backup.blob, bytes, now: nowTime });
  store.setSyncBackup(link.syncId, current);
  return { link: store.syncLink(link.syncId), blob: backup.blob };
}

export function validDemo(demo) {
  if (!DEMOS.has(demo)) throw new HttpError(400, '无效的版本');
  return demo;
}

export function validDevice(device) {
  return typeof device === 'string' ? device.slice(0, 24) : null;
}

export function validSavedAt(savedAt, nowTime) {
  if (!Number.isFinite(savedAt) || savedAt <= 0) throw new HttpError(400, '无效的保存时间');
  // A device clock far in the future must not win every conflict forever.
  return Math.min(Math.floor(savedAt), nowTime + 5 * 60 * 1000);
}

// A bundle is { v: 1, demo, keys: { storageKey: string } }. Returns the gzip blob.
export function packBundle(bundle, demo) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle) || bundle.v !== 1 || bundle.demo !== demo) {
    throw new HttpError(400, '无效的进度数据');
  }
  const keys = bundle.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new HttpError(400, '无效的进度数据');
  const names = Object.keys(keys);
  if (names.length > MAX_KEYS) throw new HttpError(400, '无效的进度数据');
  for (const name of names) {
    if (name.length < 1 || name.length > 120 || typeof keys[name] !== 'string') throw new HttpError(400, '无效的进度数据');
  }
  const json = JSON.stringify({ v: 1, demo, keys });
  const bytes = Buffer.byteLength(json);
  if (bytes > SYNC_MAX_BUNDLE_BYTES) throw new HttpError(413, '进度数据过大');
  return { blob: gzipSync(json, { level: 6 }), bytes };
}

export function unpackBundle(blob) {
  return blob ? JSON.parse(gunzipSync(blob).toString('utf8')) : null;
}

export function createSyncHandler(store, { now = () => Date.now() } = {}) {
  const limiter = new RateLimiter();
  let lastPurge = 0;
  const purge = nowTime => {
    if (nowTime - lastPurge < 10 * 60 * 1000) return;
    lastPurge = nowTime;
    try { store.purgeSync(nowTime, SYNC_LINK_MAX_IDLE_MS); } catch (err) { console.error('清理同步数据失败:', err); }
  };

  function limit(key, max) {
    if (!limiter.check(key, max)) throw new HttpError(429, '请求过于频繁');
  }

  function requireLink(body) {
    const { syncId, secret } = body;
    if (typeof syncId !== 'string' || typeof secret !== 'string' || syncId.length > 64 || secret.length > 128) {
      throw new HttpError(401, '同步凭据无效');
    }
    const link = store.syncLink(syncId);
    if (!link || !link.secretHashes.includes(sha256(secret))) throw new HttpError(401, '同步凭据无效');
    return link;
  }


  function issueCode(demo, syncId, nowTime) {
    for (let i = 0; i < 20; i++) {
      const code = generateSyncCode();
      if (store.syncCodeExists(code)) continue;
      store.clearSyncCodes(syncId); // one live code per link
      store.putSyncCode(code, demo, syncId, nowTime + SYNC_CODE_TTL_MS);
      return { code, expiresAt: nowTime + SYNC_CODE_TTL_MS };
    }
    throw new HttpError(500, '无法生成同步码');
  }

  const routes = {
    // Device A: start (or extend) a link and get a code for device B.
    code(body, ip, nowTime) {
      limit(`sync-code:${ip}`, LIMITS.code);
      const demo = validDemo(body.demo);
      if (body.syncId !== undefined) {
        return store.tx(() => {
          const link = requireLink(body);
          if (link.demo !== demo) throw new HttpError(400, '无效的版本');
          store.touchSyncLink(link.syncId, nowTime);
          return { ...issueCode(demo, link.syncId, nowTime), syncId: link.syncId, ...view(link) };
        });
      }
      const packed = packBundle(body.bundle, demo);
      const savedAt = validSavedAt(body.savedAt, nowTime);
      const syncId = randomBytes(16).toString('hex');
      const secret = randomBytes(32).toString('hex');
      return store.tx(() => {
        store.createSyncLink({ syncId, demo, secretHash: sha256(secret), rev: 1, savedAt, device: validDevice(body.device), blob: packed.blob, bytes: packed.bytes, now: nowTime });
        return { ...issueCode(demo, syncId, nowTime), syncId, secret, ...view(store.syncLink(syncId)) };
      });
    },

    // Device B: exchange the code for the link and the current progress. If B had
    // progress of its own it is kept as the link's backup (never silently dropped).
    redeem(body, ip, nowTime) {
      limit(`sync-redeem:${ip}`, LIMITS.redeem);
      const demo = validDemo(body.demo);
      const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{6}$/.test(code)) throw new HttpError(400, '同步码应为 6 位字母或数字');
      const own = body.bundle !== undefined ? packBundle(body.bundle, demo) : null;
      const ownSavedAt = own ? validSavedAt(body.savedAt, nowTime) : null;
      const result = store.tx(() => {
        const entry = store.takeSyncCode(code, nowTime);
        if (!entry || entry.demo !== demo) return null;
        const link = store.syncLink(entry.syncId);
        if (!link) return null;
        if (own) store.setSyncBackup(link.syncId, { blob: own.blob, rev: null, savedAt: ownSavedAt, device: validDevice(body.device) });
        // Each device gets its own secret; the server keeps only their sha256.
        const secret = randomBytes(32).toString('hex');
        store.addSyncSecret(link.syncId, sha256(secret));
        store.touchSyncLink(link.syncId, nowTime);
        return { link: store.syncLink(link.syncId), blob: store.syncBundle(link.syncId), secret };
      });
      if (!result) throw new HttpError(404, '同步码无效或已过期');
      return { syncId: result.link.syncId, secret: result.secret, ...view(result.link), bundle: unpackBundle(result.blob) };
    },

    // Auto-sync: push local changes and/or pull the other device's.
    sync(body, ip, nowTime) {
      limit(`sync:${ip}`, LIMITS.sync);
      if (typeof body.syncId === 'string') limit(`sync-link:${body.syncId}`, LIMITS.syncPerLink);
      const baseRev = Number.isInteger(body.rev) && body.rev >= 0 ? body.rev : 0;
      const dirty = body.dirty === true;
      let packed = null;
      let savedAt = null;
      if (dirty) {
        const link = requireLink(body); // checked again inside the transaction below
        packed = packBundle(body.bundle, link.demo);
        savedAt = validSavedAt(body.savedAt, nowTime);
      }
      const device = validDevice(body.device);
      const out = store.tx(() => {
        const link = requireLink(body);
        return applySync(store, link, { baseRev, dirty, packed, savedAt, device, nowTime });
      });
      const { blob, ...rest } = out;
      return blob ? { ...rest, bundle: unpackBundle(blob) } : rest;
    },

    // Swap the current copy and the backup; the restored copy becomes the newest revision.
    restore(body, ip, nowTime) {
      limit(`sync:${ip}`, LIMITS.sync);
      const out = store.tx(() => restoreLinkBackup(store, requireLink(body), nowTime));
      return { status: 'restored', ...view(out.link), bundle: unpackBundle(out.blob) };
    },
  };

  return async function syncHandler(req, res, url) {
    const name = url.pathname.slice('/api/sync/'.length);
    if (req.method !== 'POST' || !Object.hasOwn(routes, name)) {
      sendError(res, new HttpError(404, '接口未找到'));
      return true;
    }
    try {
      const body = await readJsonBody(req);
      const nowTime = now();
      purge(nowTime);
      const ip = clientIpOf(req);
      sendJson(res, 200, routes[name](body, ip, nowTime));
    } catch (err) {
      sendError(res, err);
    }
    return true;
  };
}
