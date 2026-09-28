// Error reports, player feedback and the admin endpoints (docs/BACKUP-AND-MONITORING.md).
//
// Public (same-origin, rate limited per IP):
//   POST /api/report/error     client error (shared/error-report.js)
//   POST /api/report/feedback  a letter from the 信箱 (shared/feedback.js); answers with an
//                              unguessable receipt (only its sha256 is stored)
//   POST /api/report/letters/status  {receipts} → the author's status of those letters only
// Admin (only when ADMIN_TOKEN is set; otherwise every /api/admin/* answers 404):
//   GET   /api/admin/stats           counts for 24 h / 7 d, backup status
//   GET   /api/admin/reports?kind=&page=&since=&resolved=
//   PATCH /api/admin/reports         {fingerprint | id, resolved} or {id, status} for letters
//   GET   /api/admin/backup/latest   newest snapshot, gzip stream
//   POST  /api/admin/backup/run      take a snapshot now
//
// Storage: table `reports` in the same online.db (created here with IF NOT EXISTS, so
// the store's schema version is untouched). Errors are grouped server-side: one row per
// (kind, fingerprint, UTC day) with a running count. IPs are only kept as a salted
// sha256 (salt in the `meta` table, or REPORT_SALT). Rows older than 90 days are purged.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream';
import { HttpError, sendJson, clientIpOf, checkSameOrigin } from './api.mjs';
import { readLatest, newestSnapshot, listSnapshots, backupDirOf, createSnapshot } from './backup.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
export const REPORT_KEEP_MS = 90 * DAY_MS;
export const ERROR_LIMIT = 30;       // per IP per window
export const FEEDBACK_LIMIT = 5;     // per IP per window
export const LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const FEEDBACK_MAX = 1000;
export const SUBJECT_MAX = 60;
export const STATUS_LIMIT = 60;    // letter status lookups per IP per window
// Letter states set in /admin/: 未读 / 已读 / 采纳 / 已修复 / 忽略.
export const LETTER_STATUSES = ['new', 'read', 'adopted', 'fixed', 'ignored'];
// ADMIN_TOKEN may be a short human-chosen password, so guessing is throttled hard:
// 5 failures from one IP within 15 min lock that IP out for 15 min; 50 failures from
// anywhere within an hour lock every admin endpoint for an hour (a success does not
// reset the global count). The submitted value is never logged or stored.
export const ADMIN_IP_FAILS = 5;
export const ADMIN_IP_WINDOW_MS = 15 * 60 * 1000;
export const ADMIN_IP_LOCK_MS = 15 * 60 * 1000;
export const ADMIN_GLOBAL_FAILS = 50;
export const ADMIN_GLOBAL_WINDOW_MS = 60 * 60 * 1000;
export const ADMIN_GLOBAL_LOCK_MS = 60 * 60 * 1000;
const MAX_REPORT_BODY = 16 * 1024;
const PAGES = new Set(['wa', 'new', 'pvp', 'landing', 'admin', 'server']);
const CATEGORIES = new Set(['问题', '建议', '平衡', '其他']);
const CONTEXT_DENY = /token|secret|pass|key|name|nick|mail|phone|auth|cookie|storage/i;

const sha = v => createHash('sha256').update(v).digest('hex');
const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/\u0000/g, '').slice(0, max);
const utcDay = t => new Date(t).toISOString().slice(0, 10);

// Coarse context only: flat primitives, short strings, no identifying keys.
export function cleanContext(value, { maxKeys = 16 } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const [k, v] of Object.entries(value).slice(0, 40)) {
    if (Object.keys(out).length >= maxKeys) break;
    const key = str(k, 32);
    if (!key || CONTEXT_DENY.test(key)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (typeof v === 'boolean') out[key] = v;
    else if (typeof v === 'string') out[key] = str(v, 80);
  }
  return Object.keys(out).length ? out : null;
}

function firstStackLine(stack) {
  return (stack || '').split('\n').map(s => s.trim()).find(s => s.startsWith('at ') || s.includes('@')) || '';
}

export function fingerprintOf(kind, page, message, stack) {
  // Strip volatile bits (numbers in messages, query strings / columns in stack lines)
  // so the same bug groups together across players and builds.
  const msg = str(message, 300).replace(/\d+/g, '#');
  const line = firstStackLine(stack).replace(/\?[^:)\s]*/g, '').replace(/:\d+(:\d+)?\)?$/, '');
  return sha(`${kind}|${page}|${msg}|${line}`).slice(0, 16);
}

class WindowLimiter {
  constructor(windowMs) { this.windowMs = windowMs; this.map = new Map(); }
  hit(key, limit, t) {
    const item = this.map.get(key);
    if (!item || t - item.start >= this.windowMs) {
      if (this.map.size > 20000) this.map.clear();
      this.map.set(key, { start: t, n: 1 });
      return true;
    }
    item.n++;
    return item.n <= limit;
  }
  count(key, t) {
    const item = this.map.get(key);
    return item && t - item.start < this.windowMs ? item.n : 0;
  }
}

export class AdminGuard {
  constructor() {
    this.ipFails = new Map();   // ipHash -> [failure times]
    this.ipLocked = new Map();  // ipHash -> locked until
    this.globalFails = [];
    this.globalLockedUntil = 0;
  }
  // Throws 429 while this IP or the whole admin area is locked.
  check(ip, t) {
    if (this.globalLockedUntil > t) throw new HttpError(429, '后台因多次密码错误已暂时锁定，请 1 小时后再试', { 'Retry-After': String(Math.ceil((this.globalLockedUntil - t) / 1000)) });
    const until = this.ipLocked.get(ip) || 0;
    if (until > t) throw new HttpError(429, '密码错误次数过多，请 15 分钟后再试', { 'Retry-After': String(Math.ceil((until - t) / 1000)) });
    if (until) this.ipLocked.delete(ip);
  }
  fail(ip, t) {
    const list = (this.ipFails.get(ip) || []).filter(x => t - x < ADMIN_IP_WINDOW_MS);
    list.push(t);
    if (list.length >= ADMIN_IP_FAILS) {
      this.ipLocked.set(ip, t + ADMIN_IP_LOCK_MS);
      this.ipFails.delete(ip);
    } else {
      this.ipFails.set(ip, list);
    }
    if (this.ipFails.size > 10000) this.ipFails.clear();
    this.globalFails = this.globalFails.filter(x => t - x < ADMIN_GLOBAL_WINDOW_MS);
    this.globalFails.push(t);
    if (this.globalFails.length >= ADMIN_GLOBAL_FAILS) {
      this.globalLockedUntil = t + ADMIN_GLOBAL_LOCK_MS;
      this.globalFails = [];
    }
  }
}

function readSmallJson(req, max = MAX_REPORT_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > max) { failed = true; reject(new HttpError(413, '内容过长')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) { resolve({}); return; }
      try {
        const body = JSON.parse(text);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('bad');
        resolve(body);
      } catch { reject(new HttpError(400, '请求格式无效')); }
    });
    req.on('error', err => { if (!failed) { failed = true; reject(err); } });
  });
}

export function ensureReportSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      fingerprint TEXT,
      day TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_at INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      page TEXT,
      version TEXT,
      versions TEXT,
      category TEXT,
      subject TEXT,
      status TEXT,
      receipt_hash TEXT,
      message TEXT,
      stack TEXT,
      context TEXT,
      path TEXT,
      viewport TEXT,
      ua TEXT,
      ip_hash TEXT,
      resolved INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS reports_group ON reports(kind, fingerprint, day);
    CREATE INDEX IF NOT EXISTS reports_last ON reports(last_at);
    CREATE INDEX IF NOT EXISTS reports_receipt ON reports(receipt_hash) WHERE receipt_hash IS NOT NULL;
  `);
}

export function createReportHandler(store, {
  adminToken = process.env.ADMIN_TOKEN || '',
  dataDir = store?.dataDir || null,
  now = () => Date.now(),
  salt = process.env.REPORT_SALT || '',
  log = console,
  backupNow = null,
  adminRoutes = null, // extra admin endpoints (e.g. 存档码 lookup), called after the password check
} = {}) {
  const db = store.db;
  ensureReportSchema(db);
  if (!salt) {
    db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('report_salt', ?)").run(randomBytes(16).toString('hex'));
    salt = db.prepare("SELECT value FROM meta WHERE key = 'report_salt'").get().value;
  }
  const adminDigest = adminToken ? createHash('sha256').update(adminToken).digest() : null;
  const limiter = new WindowLimiter(LIMIT_WINDOW_MS);
  const guard = new AdminGuard();
  const q = {
    findGroup: db.prepare('SELECT id, versions FROM reports WHERE kind = ? AND fingerprint = ? AND day = ?'),
    bump: db.prepare('UPDATE reports SET count = count + 1, last_at = ?, versions = ?, resolved = 0, context = COALESCE(?, context) WHERE id = ?'),
    insert: db.prepare(`INSERT INTO reports (kind, fingerprint, day, created_at, last_at, count, page, version, versions, category, message, stack, context, path, viewport, ua, ip_hash)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    purge: db.prepare('DELETE FROM reports WHERE last_at < ?'),
    letterExtra: db.prepare('UPDATE reports SET subject = ?, status = ?, receipt_hash = ? WHERE id = ?'),
    letterStatus: db.prepare("SELECT status FROM reports WHERE kind = 'feedback' AND receipt_hash = ?"),
  };
  const ipHash = ip => sha(`${salt}|${ip}`).slice(0, 24);

  function store1(kind, r, t) {
    const day = utcDay(t);
    const context = r.context ? JSON.stringify(r.context) : null;
    if (kind !== 'feedback') {
      const fp = fingerprintOf(kind, r.page, r.message, r.stack);
      const row = q.findGroup.get(kind, fp, day);
      if (row) {
        let versions = [];
        try { versions = JSON.parse(row.versions || '[]'); } catch {}
        if (r.version && !versions.includes(r.version)) versions = [...versions, r.version].slice(-10);
        q.bump.run(t, JSON.stringify(versions), context, row.id);
        return { id: row.id, fingerprint: fp, grouped: true };
      }
      const info = q.insert.run(kind, fp, day, t, t, r.page || null, r.version || null, JSON.stringify(r.version ? [r.version] : []), null,
        r.message || null, r.stack || null, context, r.path || null, r.viewport || null, r.ua || null, r.ipHash || null);
      return { id: Number(info.lastInsertRowid), fingerprint: fp, grouped: false };
    }
    const info = q.insert.run('feedback', null, day, t, t, r.page || null, r.version || null, JSON.stringify(r.version ? [r.version] : []), r.category || null,
      r.message, null, context, r.path || null, r.viewport || null, r.ua || null, r.ipHash || null);
    const id = Number(info.lastInsertRowid);
    const receipt = randomBytes(16).toString('hex');
    q.letterExtra.run(r.subject || null, 'new', sha(receipt), id);
    return { id, receipt };
  }

  let lastPurge = 0;
  function maybePurge(t) {
    if (t - lastPurge < 6 * 60 * 60 * 1000) return;
    lastPurge = t;
    try { q.purge.run(t - REPORT_KEEP_MS); } catch (err) { log.error?.('清理报告失败:', err?.message || err); }
  }
  maybePurge(now());

  // Server-side failures (hooked through online/server-errors.mjs). Never throws.
  function recordServerError(err, context = {}) {
    try {
      const t = now();
      const message = str(err?.message || err, 500) || '未知错误';
      store1('server-error', {
        page: 'server', version: null, message, stack: str(err?.stack, 4096),
        context: cleanContext({ status: context.status, method: context.method, route: context.route }),
        path: str(context.route, 200),
      }, t);
    } catch (e) {
      try { log.error?.('记录服务器错误失败:', e?.message || e); } catch {}
    }
  }

  const commonFields = (body, req) => ({
    page: PAGES.has(body.page) ? body.page : 'unknown',
    version: str(body.version, 24) || null,
    path: str(body.path, 200).split('?')[0].split('#')[0] || null,
    viewport: /^\d{2,5}x\d{2,5}$/.test(body.viewport || '') ? body.viewport : null,
    ua: str(req.headers['user-agent'] || body.ua, 300) || null,
  });

  function adminAuth(req, t) {
    const ip = ipHash(clientIpOf(req));
    guard.check(ip, t);
    const auth = req.headers.authorization || '';
    const given = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const ok = given && timingSafeEqual(createHash('sha256').update(given).digest(), adminDigest);
    if (!ok) {
      guard.fail(ip, t);
      throw new HttpError(401, '管理密码错误', { 'WWW-Authenticate': 'Bearer' });
    }
  }

  function parseSince(value, t) {
    if (!value) return t - 7 * DAY_MS;
    const m = /^(\d+)([hd])$/.exec(value);
    if (m) return t - Number(m[1]) * (m[2] === 'h' ? 3600e3 : DAY_MS);
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
    const d = Date.parse(value);
    return Number.isFinite(d) ? d : t - 7 * DAY_MS;
  }

  const parseJson = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

  function listReports(params, t) {
    const since = parseSince(params.get('since'), t);
    const kind = params.get('kind') || '';
    const page = params.get('page') || '';
    const resolved = params.get('resolved');
    const where = ['last_at >= ?'];
    const args = [since];
    if (kind) { where.push('kind = ?'); args.push(kind); }
    if (page) { where.push('page = ?'); args.push(page); }
    if (resolved === '0' || resolved === '1') { where.push('resolved = ?'); args.push(Number(resolved)); }
    const rows = db.prepare(`SELECT * FROM reports WHERE ${where.join(' AND ')} ORDER BY last_at DESC LIMIT 2000`).all(...args);
    const groups = new Map();
    const feedback = [];
    for (const r of rows) {
      if (r.kind === 'feedback') {
        if (feedback.length < 300) feedback.push({ id: r.id, at: r.created_at, page: r.page, version: r.version, category: r.category, subject: r.subject, status: r.status || 'new', text: r.message, context: parseJson(r.context), path: r.path, viewport: r.viewport, ua: r.ua, resolved: !!r.resolved });
        continue;
      }
      let g = groups.get(r.fingerprint);
      if (!g) {
        g = { fingerprint: r.fingerprint, kind: r.kind, page: r.page, message: r.message, count: 0, firstAt: r.created_at, lastAt: r.last_at, versions: [], days: 0, resolved: true, sample: { stack: r.stack, context: parseJson(r.context), path: r.path, viewport: r.viewport, ua: r.ua } };
        groups.set(r.fingerprint, g);
      }
      g.count += r.count;
      g.days++;
      g.firstAt = Math.min(g.firstAt, r.created_at);
      g.lastAt = Math.max(g.lastAt, r.last_at);
      g.resolved = g.resolved && !!r.resolved;
      for (const v of parseJson(r.versions) || []) if (!g.versions.includes(v)) g.versions.push(v);
    }
    return { since, errors: [...groups.values()].sort((a, b) => b.lastAt - a.lastAt), feedback };
  }

  function stats(t) {
    const window = since => {
      const byKind = {};
      const byPage = {};
      for (const r of db.prepare('SELECT kind, page, SUM(count) AS n FROM reports WHERE last_at >= ? GROUP BY kind, page').all(since)) {
        byKind[r.kind] = (byKind[r.kind] || 0) + r.n;
        byPage[r.page || 'unknown'] = (byPage[r.page || 'unknown'] || 0) + r.n;
      }
      return { byKind, byPage };
    };
    const unresolved = db.prepare("SELECT COUNT(DISTINCT fingerprint) AS n FROM reports WHERE kind != 'feedback' AND resolved = 0 AND last_at >= ?").get(t - 7 * DAY_MS).n;
    const backup = dataDir ? readLatest(dataDir) : null;
    const onDisk = dataDir ? listSnapshots(backupDirOf(dataDir)) : [];
    const letters = {};
    for (const r of db.prepare("SELECT COALESCE(status, 'new') AS s, COUNT(*) AS n FROM reports WHERE kind = 'feedback' GROUP BY s").all()) letters[r.s] = r.n;
    return { now: t, last24h: window(t - DAY_MS), last7d: window(t - 7 * DAY_MS), unresolvedGroups7d: unresolved, letters, backup, backups: onDisk };
  }

  function streamLatestBackup(req, res) {
    const newest = dataDir ? newestSnapshot(dataDir) : null;
    if (!newest) throw new HttpError(404, '暂无备份');
    res.writeHead(200, {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${newest.name}.gz"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Backup-File': newest.name,
    });
    if (req.method === 'HEAD') { res.end(); return; }
    pipeline(createReadStream(newest.path), createGzip({ level: 6 }), res, err => {
      if (err) { log.error?.('备份下载中断:', err.message); res.destroy(err); }
    });
  }

  const fail = (res, err) => {
    if (!(err instanceof HttpError)) {
      recordServerError(err, { status: 500, route: 'report-api' });
      err = new HttpError(500, '服务器内部错误');
    }
    sendJson(res, err.status, { error: err.message }, err.headers);
  };

  async function handler(req, res, url) {
    const pathname = url.pathname;
    const isReport = pathname.startsWith('/api/report/');
    const isAdmin = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
    if (!isReport && !isAdmin) return false;
    const t = now();
    try {
      if (isAdmin) {
        if (!adminDigest) throw new HttpError(404, '接口未找到');
        adminAuth(req, t);
        if (pathname === '/api/admin/stats' && req.method === 'GET') { sendJson(res, 200, stats(t)); return true; }
        if (pathname === '/api/admin/reports' && req.method === 'GET') { sendJson(res, 200, listReports(url.searchParams, t)); return true; }
        if (pathname === '/api/admin/reports' && req.method === 'PATCH') {
          const body = await readSmallJson(req);
          if (body.status !== undefined) {
            if (!LETTER_STATUSES.includes(body.status) || !Number.isInteger(body.id)) throw new HttpError(400, '状态或 id 无效');
            const changes = Number(db.prepare("UPDATE reports SET status = ?, resolved = ? WHERE id = ? AND kind = 'feedback'").run(body.status, ['new', 'read'].includes(body.status) ? 0 : 1, body.id).changes);
            sendJson(res, 200, { changes });
            return true;
          }
          const resolved = body.resolved === false ? 0 : 1;
          let changes = 0;
          if (typeof body.fingerprint === 'string' && body.fingerprint) changes = Number(db.prepare('UPDATE reports SET resolved = ? WHERE fingerprint = ?').run(resolved, body.fingerprint).changes);
          else if (Number.isInteger(body.id)) changes = Number(db.prepare('UPDATE reports SET resolved = ? WHERE id = ?').run(resolved, body.id).changes);
          else throw new HttpError(400, '缺少 fingerprint 或 id');
          sendJson(res, 200, { changes });
          return true;
        }
        if (pathname === '/api/admin/backup/latest' && (req.method === 'GET' || req.method === 'HEAD')) { streamLatestBackup(req, res); return true; }
        if (pathname === '/api/admin/backup/run' && req.method === 'POST') {
          if (!dataDir) throw new HttpError(404, '未配置数据目录');
          const result = backupNow ? await backupNow() : await createSnapshot(db, dataDir, { now: t, log });
          if (!result) throw new HttpError(503, '备份正在进行或失败，请查看日志');
          const { path: _p, ...pub } = result;
          sendJson(res, 200, pub);
          return true;
        }
        if (adminRoutes && await adminRoutes(req, res, url)) return true;
        throw new HttpError(404, '接口未找到');
      }

      // Public report endpoints.
      if (req.method !== 'POST') throw new HttpError(405, '只接受 POST', { Allow: 'POST' });
      if (!checkSameOrigin(req)) throw new HttpError(403, '跨源请求被禁止');
      maybePurge(t);
      const ipH = ipHash(clientIpOf(req));
      if (pathname === '/api/report/error') {
        if (!limiter.hit(`err:${ipH}`, ERROR_LIMIT, t)) throw new HttpError(429, '报告过于频繁');
        const body = await readSmallJson(req);
        const message = str(body.message, 500).trim();
        if (!message) throw new HttpError(400, '缺少错误信息');
        const saved = store1('error', {
          ...commonFields(body, req), message, stack: str(body.stack, 4096) || null,
          context: cleanContext(body.context), ipHash: ipH,
        }, t);
        sendJson(res, 200, { ok: true, grouped: saved.grouped });
        return true;
      }
      if (pathname === '/api/report/feedback') {
        if (!limiter.hit(`fb:${ipH}`, FEEDBACK_LIMIT, t)) throw new HttpError(429, '发送太频繁，请稍后再试');
        const body = await readSmallJson(req);
        const text = typeof body.text === 'string' ? body.text.replace(/\u0000/g, '').trim() : '';
        const subject = str(body.subject, SUBJECT_MAX).replace(/[\r\n]+/g, ' ').trim() || null;
        if (!text) throw new HttpError(400, '请先写点内容');
        if (text.length > FEEDBACK_MAX) throw new HttpError(413, `内容不能超过 ${FEEDBACK_MAX} 字`);
        let context = cleanContext(body.context);
        const recent = Array.isArray(body.recentErrors) ? body.recentErrors.filter(s => typeof s === 'string' && s.trim()).slice(0, 3).map(s => str(s, 200)) : [];
        if (recent.length) context = { ...(context || {}), recentErrors: recent.join(' | ').slice(0, 620) };
        const saved = store1('feedback', {
          ...commonFields(body, req), message: text, subject,
          category: CATEGORIES.has(body.category) ? body.category : null,
          context, ipHash: ipH,
        }, t);
        sendJson(res, 200, { ok: true, receipt: saved.receipt });
        return true;
      }
      if (pathname === '/api/report/letters/status') {
        if (!limiter.hit(`st:${ipH}`, STATUS_LIMIT, t)) throw new HttpError(429, '请求过于频繁');
        const body = await readSmallJson(req);
        const receipts = Array.isArray(body.receipts) ? body.receipts.filter(r => typeof r === 'string' && /^[0-9a-f]{32}$/.test(r)).slice(0, 30) : [];
        const statuses = {};
        for (const r of receipts) {
          const row = q.letterStatus.get(sha(r));
          if (row) statuses[r] = row.status || 'new';
        }
        sendJson(res, 200, { statuses });
        return true;
      }
      throw new HttpError(404, '接口未找到');
    } catch (err) {
      fail(res, err);
      return true;
    }
  }

  handler.recordServerError = recordServerError;
  handler.adminEnabled = !!adminDigest;
  handler.adminGuard = guard;
  return handler;
}
