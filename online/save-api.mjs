// 存档码: one permanent personal save code = account + cloud save for every page
// (登峰赛季 /wa/, 战术试炼 /new/ and 好友 PvP /pvp/). See docs/SAVE-CODE-2026-09-28.md.
//
//   POST /api/save/ensure  [Bearer]  { demo?, link?: {syncId, secret}, bundle?, savedAt?, device? }
//        Make sure this device is logged in: picks the account (owner of the device's old
//        sync link > the Bearer account > a new account), gives the account a 存档码 if it
//        has none (returned once, in plain text) and attaches this demo's progress.
//        → { accountId, token?, switched?, code?, hasCode, demo? }
//   POST /api/save/login   [Bearer]  { code, demo?, bundle?, savedAt?, device? }
//        Log in with a 存档码 (or a legacy 64-hex PvP credential).
//        → { accountId, token, code?, hasCode, demo? }
//   POST /api/save/sync     Bearer   { demo, rev, dirty, savedAt?, bundle?, device? }
//   POST /api/save/restore  Bearer   { demo }
//   POST /api/save/newcode  Bearer   {}  → { code } (the old code stops working)
//   POST /api/save/logout   Bearer   {}  → forgets this device's extra token
//
// `demo` answers carry { status, rev, savedAt, device, backup, bundle? } with status
//   linked   – the device's own old sync link became the account's (keep local state)
//   adopted  – the account already had progress: bundle = the account's copy; the
//              device's own progress (if any and different) is now the backup slot
//   pushed   – the account had nothing for this demo: the device's progress is current
//   empty    – neither side has anything yet
//
// The code is 12 characters from SYNC_CODE_ALPHABET (31 unambiguous characters, ~59
// bits), shown as XXXX-XXXX-XXXX. Only HMAC-SHA256(pepper, code) is stored; the pepper
// is SAVE_CODE_PEPPER or a random value kept in the `meta` table. Codes are never logged.
// Every device logged in with the code gets its own bearer token (account_tokens), so
// PvP keeps working unchanged. Progress per demo reuses the sync_links rows and the
// exact conflict rule of online/sync-api.mjs.
import { createHmac, randomBytes } from 'node:crypto';
import { generateToken, sha256 } from './store.mjs';
import { HttpError, sendJson, sendError, readJsonBody, clientIpOf } from './api.mjs';
import {
  SYNC_CODE_ALPHABET, packBundle, unpackBundle, applySync, restoreLinkBackup, linkView,
  validDemo, validDevice, validSavedAt,
} from './sync-api.mjs';

export const SAVE_CODE_LENGTH = 12;
export const SAVE_CODE_ALPHABET = SYNC_CODE_ALPHABET;
const DEMOS = ['wa', 'new'];

// Brute-force protection for /api/save/login (in memory, single instance).
export const LOGIN_IP_FAILS = 10;
export const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_IP_LOCK_MS = 15 * 60 * 1000;
export const LOGIN_GLOBAL_FAILS = 500;
export const LOGIN_GLOBAL_WINDOW_MS = 60 * 60 * 1000;
export const LOGIN_GLOBAL_LOCK_MS = 15 * 60 * 1000;
const CREATE_PER_IP_HOUR = 20;
const NEWCODE_PER_ACCOUNT_HOUR = 5;
const HOUR = 60 * 60 * 1000;

export function generateSaveCode() {
  // Rejection sampling: 248 = 31 * 8, so every character is equally likely.
  let code = '';
  while (code.length < SAVE_CODE_LENGTH) {
    for (const b of randomBytes(16)) {
      if (b < 248 && code.length < SAVE_CODE_LENGTH) code += SAVE_CODE_ALPHABET[b % SAVE_CODE_ALPHABET.length];
    }
  }
  return code;
}

export function formatSaveCode(code) {
  return String(code).match(/.{1,4}/g).join('-');
}

// Accepts any case, dashes, spaces and underscores. Returns
//   { kind: 'code', code } | { kind: 'legacy', token } | null (wrong format).
export function normalizeSaveCode(input) {
  if (typeof input !== 'string' || input.length > 200) return null;
  const compact = input.replace(/[\s\-_–—·.]/g, '');
  if (/^[0-9a-f]{64}$/i.test(compact)) return { kind: 'legacy', token: compact.toLowerCase() };
  const code = compact.toUpperCase();
  if (code.length !== SAVE_CODE_LENGTH || [...code].some(c => !SAVE_CODE_ALPHABET.includes(c))) return null;
  return { kind: 'code', code };
}

class Window {
  constructor() { this.map = new Map(); }
  hit(key, max, windowMs, t) {
    const list = (this.map.get(key) || []).filter(x => t - x < windowMs);
    if (list.length >= max) { this.map.set(key, list); return false; }
    list.push(t);
    this.map.set(key, list);
    if (this.map.size > 20000) this.map.clear();
    return true;
  }
}

export class LoginGuard {
  constructor() {
    this.ipFails = new Map();
    this.ipLocked = new Map();
    this.globalFails = [];
    this.globalLockedUntil = 0;
  }
  check(ip, t) {
    if (this.globalLockedUntil > t) throw new HttpError(429, '登录尝试过多，请 15 分钟后再试', { 'Retry-After': String(Math.ceil((this.globalLockedUntil - t) / 1000)) });
    const until = this.ipLocked.get(ip) || 0;
    if (until > t) throw new HttpError(429, '存档码输错次数过多，请 15 分钟后再试', { 'Retry-After': String(Math.ceil((until - t) / 1000)) });
    if (until) this.ipLocked.delete(ip);
  }
  fail(ip, t) {
    const list = (this.ipFails.get(ip) || []).filter(x => t - x < LOGIN_IP_WINDOW_MS);
    list.push(t);
    if (list.length >= LOGIN_IP_FAILS) { this.ipLocked.set(ip, t + LOGIN_IP_LOCK_MS); this.ipFails.delete(ip); }
    else this.ipFails.set(ip, list);
    if (this.ipFails.size > 20000) this.ipFails.clear();
    this.globalFails = this.globalFails.filter(x => t - x < LOGIN_GLOBAL_WINDOW_MS);
    this.globalFails.push(t);
    if (this.globalFails.length >= LOGIN_GLOBAL_FAILS) { this.globalLockedUntil = t + LOGIN_GLOBAL_LOCK_MS; this.globalFails = []; }
  }
}

function bearerOf(req) {
  const auth = req.headers?.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return /^[0-9a-f]{64}$/i.test(token) ? token.toLowerCase() : null;
}

export function createSaveHandler(store, { now = () => Date.now(), pepper = process.env.SAVE_CODE_PEPPER || '' } = {}) {
  if (!pepper) {
    pepper = store.getMeta('save_code_pepper');
    if (!pepper) { pepper = randomBytes(32).toString('hex'); store.setMeta('save_code_pepper', pepper); }
  }
  const codeHash = code => createHmac('sha256', pepper).update(`save:${code}`).digest('hex');
  const ipHash = ip => createHmac('sha256', pepper).update(`ip:${ip}`).digest('hex').slice(0, 24);
  const guard = new LoginGuard();
  const windows = new Window();
  const limit = (key, max, windowMs, t, message = '请求过于频繁，请稍后再试') => {
    if (!windows.hit(key, max, windowMs, t)) throw new HttpError(429, message);
  };

  const accountOfToken = token => (token ? store.getAccountByTokenHash(sha256(token)) : null);
  const requireBearer = req => {
    const account = accountOfToken(bearerOf(req));
    if (!account) throw new HttpError(401, '存档码登录已失效，请重新输入存档码');
    return account;
  };

  // New code for the account (inside a tx); the previous one stops working.
  function issueCode(accountId, t) {
    for (let i = 0; i < 10; i++) {
      const code = generateSaveCode();
      const hash = codeHash(code);
      if (store.accountIdBySaveCodeHash(hash)) continue;
      store.setSaveCode(accountId, hash, t);
      return code;
    }
    throw new HttpError(500, '无法生成存档码');
  }

  function issueDeviceToken(accountId, t) {
    const token = generateToken();
    store.addAccountToken(accountId, sha256(token), t);
    return token;
  }

  function createAccount(unit, t) {
    const token = generateToken();
    const tokenHash = sha256(token);
    const accountId = sha256(tokenHash).slice(0, 16);
    unit.createAccount({ accountId, tokenHash, archives: [], pending: null, roomCode: null, createdAt: t });
    return { accountId, token };
  }

  // The device's old /api/sync link, if its credentials are valid for this demo.
  function deviceLink(demo, link) {
    if (!demo || !link || typeof link.syncId !== 'string' || typeof link.secret !== 'string' || link.syncId.length > 64 || link.secret.length > 128) return null;
    const row = store.syncLink(link.syncId);
    if (!row || row.demo !== demo || !row.secretHashes.includes(sha256(link.secret))) return null;
    return row;
  }

  const sameBundle = (a, b) => {
    try { return JSON.stringify(unpackBundle(a)?.keys) === JSON.stringify(unpackBundle(b)?.keys); } catch { return false; }
  };

  // Attach this device's progress for `demo` to the account (inside a tx).
  function attachDemo(accountId, demo, own, packed, savedAt, device, t) {
    const existing = store.accountSyncId(accountId, demo);
    if (existing) {
      const link = store.syncLink(existing);
      store.touchSyncLink(existing, t);
      if (own && own.syncId === existing) return { status: 'linked', ...linkView(link) };
      const blob = store.syncBundle(existing);
      let keptBackup = false;
      if (packed && !sameBundle(packed.blob, blob)) {
        store.setSyncBackup(existing, { blob: packed.blob, rev: null, savedAt, device });
        keptBackup = true;
      }
      return { status: 'adopted', keptBackup, ...linkView(store.syncLink(existing)), blob };
    }
    if (own && !store.syncLinkOwner(own.syncId)) {
      store.setAccountSync(accountId, demo, own.syncId);
      store.touchSyncLink(own.syncId, t);
      return { status: 'linked', ...linkView(own) };
    }
    if (packed) {
      const syncId = randomBytes(16).toString('hex');
      store.createSyncLink({ syncId, demo, secretHash: '', rev: 1, savedAt, device, blob: packed.blob, bytes: packed.bytes, now: t });
      store.setAccountSync(accountId, demo, syncId);
      return { status: 'pushed', ...linkView(store.syncLink(syncId)) };
    }
    return { status: 'empty', rev: 0, savedAt: null, device: null, backup: null };
  }

  const demoOut = out => {
    if (!out) return undefined;
    const { blob, ...rest } = out;
    return blob ? { ...rest, bundle: unpackBundle(blob) } : rest;
  };

  // Optional demo payload shared by ensure / login.
  function demoPayload(body, t) {
    if (body.demo === undefined || body.demo === null) return { demo: null };
    const demo = validDemo(body.demo);
    const packed = body.bundle !== undefined ? packBundle(body.bundle, demo) : null;
    const savedAt = packed ? validSavedAt(body.savedAt, t) : null;
    return { demo, packed, savedAt, device: validDevice(body.device) };
  }

  const routes = {
    ensure(body, req, ip, t) {
      limit(`ensure:${ip}`, 60, 60 * 1000, t);
      const bearer = bearerOf(req);
      const bearerAccount = accountOfToken(bearer);
      const p = demoPayload(body, t);
      const out = store.tx(unit => {
        const own = deviceLink(p.demo, body.link);
        const owner = own ? store.syncLinkOwner(own.syncId) : null;
        let accountId;
        let token = null;
        // An old sync link already claimed by an account wins: the first device of a
        // linked pair to ask for a 存档码 decides the account (docs: migration).
        if (owner) accountId = owner.accountId;
        else if (bearerAccount) accountId = bearerAccount.accountId;
        else {
          limit(`create:${ip}`, CREATE_PER_IP_HOUR, HOUR, t, '创建存档码过于频繁，请稍后再试');
          ({ accountId, token } = createAccount(unit, t));
        }
        if (!token && (!bearerAccount || bearerAccount.accountId !== accountId)) token = issueDeviceToken(accountId, t);
        const code = store.saveCodeInfo(accountId) ? null : issueCode(accountId, t);
        const demo = p.demo ? attachDemo(accountId, p.demo, own, p.packed, p.savedAt, p.device, t) : null;
        return { accountId, token, switched: !!(bearerAccount && bearerAccount.accountId !== accountId), code, demo };
      });
      return {
        accountId: out.accountId,
        ...(out.token ? { token: out.token } : {}),
        switched: out.switched,
        ...(out.code ? { code: formatSaveCode(out.code) } : {}),
        hasCode: true,
        ...(out.demo ? { demo: demoOut(out.demo) } : {}),
      };
    },

    login(body, req, ip, t) {
      guard.check(ip, t);
      const parsed = normalizeSaveCode(body.code);
      if (!parsed) throw new HttpError(400, '存档码是 12 位字母和数字（例如 ABCD-EFGH-JKMN）');
      const p = demoPayload(body, t);
      const out = store.tx(() => {
        let accountId = null;
        let token = null;
        if (parsed.kind === 'legacy') {
          const account = store.getAccountByTokenHash(sha256(parsed.token));
          if (account) { accountId = account.accountId; token = parsed.token; }
        } else {
          accountId = store.accountIdBySaveCodeHash(codeHash(parsed.code));
        }
        if (!accountId) return null;
        const bearerAccount = accountOfToken(bearerOf(req));
        if (!token) token = bearerAccount?.accountId === accountId ? bearerOf(req) : issueDeviceToken(accountId, t);
        const fresh = store.saveCodeInfo(accountId) ? null : issueCode(accountId, t);
        const demo = p.demo ? attachDemo(accountId, p.demo, null, p.packed, p.savedAt, p.device, t) : null;
        return { accountId, token, code: fresh || (parsed.kind === 'code' ? parsed.code : null), fresh: !!fresh, demo };
      });
      if (!out) {
        guard.fail(ip, t);
        throw new HttpError(401, '存档码不正确');
      }
      return {
        accountId: out.accountId, token: out.token,
        ...(out.code ? { code: formatSaveCode(out.code) } : {}),
        freshCode: out.fresh, hasCode: true,
        ...(out.demo ? { demo: demoOut(out.demo) } : {}),
      };
    },

    sync(body, req, ip, t) {
      limit(`sync:${ip}`, 120, 60 * 1000, t);
      const account = requireBearer(req);
      limit(`sync-acct:${account.accountId}`, 60, 60 * 1000, t);
      const demo = validDemo(body.demo);
      const baseRev = Number.isInteger(body.rev) && body.rev >= 0 ? body.rev : 0;
      const dirty = body.dirty === true;
      const packed = dirty ? packBundle(body.bundle, demo) : null;
      const savedAt = dirty ? validSavedAt(body.savedAt, t) : null;
      const device = validDevice(body.device);
      const out = store.tx(() => {
        const syncId = store.accountSyncId(account.accountId, demo);
        if (!syncId) {
          if (!dirty) return { status: 'uptodate', rev: 0, savedAt: null, device: null, backup: null };
          return attachDemo(account.accountId, demo, null, packed, savedAt, device, t);
        }
        return applySync(store, store.syncLink(syncId), { baseRev, dirty, packed, savedAt, device, nowTime: t });
      });
      return demoOut(out);
    },

    restore(body, req, ip, t) {
      limit(`sync:${ip}`, 120, 60 * 1000, t);
      const account = requireBearer(req);
      const demo = validDemo(body.demo);
      const out = store.tx(() => {
        const syncId = store.accountSyncId(account.accountId, demo);
        if (!syncId) throw new HttpError(404, '没有可恢复的备份');
        return restoreLinkBackup(store, store.syncLink(syncId), t);
      });
      return { status: 'restored', ...linkView(out.link), bundle: unpackBundle(out.blob) };
    },

    newcode(body, req, ip, t) {
      const account = requireBearer(req);
      limit(`newcode:${account.accountId}`, NEWCODE_PER_ACCOUNT_HOUR, HOUR, t, '更换存档码过于频繁，请 1 小时后再试');
      const code = store.tx(() => issueCode(account.accountId, t));
      return { code: formatSaveCode(code) };
    },

    logout(body, req) {
      const token = bearerOf(req);
      if (token) store.tx(() => store.removeAccountToken(sha256(token)));
      return { ok: true };
    },
  };

  async function handler(req, res, url) {
    const name = url.pathname.slice('/api/save/'.length);
    if (req.method !== 'POST' || !Object.hasOwn(routes, name)) {
      sendError(res, new HttpError(404, '接口未找到'));
      return true;
    }
    try {
      const body = await readJsonBody(req);
      const t = now();
      sendJson(res, 200, routes[name](body, req, ipHash(clientIpOf(req)), t));
    } catch (err) {
      sendError(res, err);
    }
    return true;
  }

  // Admin (called by the report handler after the admin password was checked).
  //   GET  /api/admin/save?account=<id>   → account summary (no code: only its hash exists)
  //   POST /api/admin/save/replace {accountId} → a new 存档码 for the account (old one stops working)
  handler.admin = async function saveAdmin(req, res, url) {
    if (url.pathname === '/api/admin/save' && req.method === 'GET') {
      const id = String(url.searchParams.get('account') || '').trim().toLowerCase();
      if (!/^[0-9a-f]{16}$/.test(id)) throw new HttpError(400, '账号 ID 应为 16 位十六进制');
      const row = store.db.prepare('SELECT account_id, name, created_at FROM accounts WHERE account_id = ?').get(id);
      if (!row) throw new HttpError(404, '没有这个账号');
      const demos = {};
      for (const [demo, syncId] of Object.entries(store.accountSyncIds(id))) {
        const link = store.syncLink(syncId);
        if (link) demos[demo] = { rev: link.rev, savedAt: link.savedAt, device: link.device, bytes: link.bytes ?? null, backup: !!link.backup };
      }
      const devices = store.db.prepare('SELECT COUNT(*) AS n FROM account_tokens WHERE account_id = ?').get(id).n;
      sendJson(res, 200, { accountId: id, name: row.name, createdAt: row.created_at, saveCode: store.saveCodeInfo(id), devices: devices + 1, demos });
      return true;
    }
    if (url.pathname === '/api/admin/save/replace' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const id = String(body.accountId || '').trim().toLowerCase();
      if (!/^[0-9a-f]{16}$/.test(id)) throw new HttpError(400, '账号 ID 应为 16 位十六进制');
      const code = store.tx(() => {
        if (!store.db.prepare('SELECT 1 AS x FROM accounts WHERE account_id = ?').get(id)) throw new HttpError(404, '没有这个账号');
        return issueCode(id, now());
      });
      sendJson(res, 200, { accountId: id, code: formatSaveCode(code) });
      return true;
    }
    return false;
  };

  handler.normalize = normalizeSaveCode;
  return handler;
}

export { DEMOS as SAVE_DEMOS };
