// Anonymous play statistics (玩家统计, docs/BACKUP-AND-MONITORING.md).
//
// Public (same-origin, rate limited per hashed IP):
//   POST /api/analytics   a batch from shared/play-analytics.js:
//     { v: visitor, s: session, page, ver, dev, br, now, events: [{ n, t, p }] }
//     ≤ 16 KB, ≤ 50 events. Unknown event names are dropped, and so is every prop that
//     is not on the event's whitelist or has the wrong type / range.
// Admin (password check done by online/report-api.mjs before adminRoute is called):
//   GET /api/admin/analytics?days=7|30|90   everything the 玩家概况 dashboard shows.
//
// Storage (same online.db, created here with IF NOT EXISTS; the store's schema version
// is untouched):
//   events          raw events except heartbeats (ts, day, visitor, session, page, name,
//                   demo, props JSON, device, account). Kept 180 days.
//   daily_visitors  the daily rollup: one row per (day, visitor, page) with the play
//                   seconds counted from heartbeats and the last activity time. This is
//                   what 每日玩家 / 在线 / 时长 / 留存 read, so the dashboard stays fast.
//                   Kept 400 days.
//   visitors        one row per visitor ever (first day, last day, device, account) for
//                   新玩家 / 累计玩家 / 留存 cohorts.
// Heartbeats only update daily_visitors (60 s of play each, at most one per 50 s per
// visitor and page), they are never stored as rows.
//
// Days are local to ANALYTICS_TZ_OFFSET minutes (default +480, China time), so 今日 on
// the dashboard is the owner's day. IPs only ever appear as a salted hash in the rate
// limiter's memory; nothing identifying is stored.
import { createHash } from 'node:crypto';
import { HttpError, sendJson, clientIpOf, checkSameOrigin } from './api.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
export const EVENTS_KEEP_DAYS = 180;
export const ROLLUP_KEEP_DAYS = 400;
export const MAX_ANALYTICS_BODY = 16 * 1024;
export const MAX_BATCH_EVENTS = 50;
export const IP_BATCH_LIMIT = 240;      // batches per IP per window (players behind one NAT)
export const VISITOR_BATCH_LIMIT = 60;  // batches per visitor per window
export const LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const HEARTBEAT_SECS = 60;
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const TZ_OFFSET_MS = (Number.isFinite(Number(process.env.ANALYTICS_TZ_OFFSET)) && process.env.ANALYTICS_TZ_OFFSET !== '' ? Number(process.env.ANALYTICS_TZ_OFFSET) : 480) * 60 * 1000;

export const PAGES = ['landing', 'wa', 'new', 'pvp'];
export const GAME_PAGES = ['wa', 'new', 'pvp'];
const DEVICES = ['phone', 'tablet', 'desktop'];
const BROWSERS = ['chrome', 'safari', 'firefox', 'edge', 'wechat', 'qq', 'samsung', 'other'];
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const int = (min, max) => ({ type: 'int', min, max });
const num = (min, max) => ({ type: 'num', min, max });
const bool = { type: 'bool' };
const oneOf = (...values) => ({ type: 'enum', values });
const ident = { type: 'id' };
const demo = oneOf('wa', 'new');

// Event names and the props each may carry. Anything else is dropped.
export const EVENT_SPEC = {
  page_view: {},
  heartbeat: {},
  run_start: { demo, team: ident, asc: int(0, 20) },
  fight_end: { demo, act: int(1, 4), floor: int(0, 30), kind: oneOf('normal', 'battle', 'elite', 'boss'), won: bool, enemy: ident, turns: int(0, 999) },
  run_end: { demo, result: oneOf('win', 'lose', 'abandon'), team: ident, asc: int(0, 20), act: int(1, 4), floor: int(0, 30), fights: int(0, 200), mins: num(0, 1440), enemy: ident },
  unlock_tier_up: { demo, team: ident, tier: int(0, 10) },
  achievement: { demo, id: ident },
  pvp_match_start: { round: int(1, 999), rematch: bool },
  pvp_match_end: { won: bool, draw: bool, turns: int(0, 999), round: int(1, 999) },
  save_code_created: { demo },
  save_code_login: { demo },
  mailbox_sent: { category: oneOf('问题', '建议', '平衡', '其他') },
};

// Local (China) calendar day of a timestamp.
export const dayOf = t => new Date(t + TZ_OFFSET_MS).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
// Start (ms) of a local day.
const dayStart = day => Date.parse(day + 'T00:00:00Z') - TZ_OFFSET_MS;

function cleanValue(spec, v) {
  switch (spec.type) {
    case 'int': return Number.isInteger(v) && v >= spec.min && v <= spec.max ? v : undefined;
    case 'num': return typeof v === 'number' && Number.isFinite(v) && v >= spec.min && v <= spec.max ? Math.round(v * 10) / 10 : undefined;
    case 'bool': return typeof v === 'boolean' ? v : undefined;
    case 'enum': return spec.values.includes(v) ? v : undefined;
    case 'id': return typeof v === 'string' && ID_RE.test(v) ? v : undefined;
    default: return undefined;
  }
}

// One event → { name, props } or null. Pure, exported for tests.
export function cleanEvent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const name = raw.n;
  if (typeof name !== 'string' || !Object.hasOwn(EVENT_SPEC, name)) return null;
  const spec = EVENT_SPEC[name];
  const props = {};
  const p = raw.p && typeof raw.p === 'object' && !Array.isArray(raw.p) ? raw.p : {};
  for (const key of Object.keys(spec)) {
    if (!Object.hasOwn(p, key)) continue;
    const v = cleanValue(spec[key], p[key]);
    if (v !== undefined) props[key] = v;
  }
  return { name, props, t: Number.isFinite(raw.t) ? raw.t : null };
}

// The envelope → { visitor, session, page, device, browser, version, events } or throws 400.
export function cleanBatch(body) {
  const visitor = typeof body.v === 'string' && /^[a-z0-9]{8,32}$/.test(body.v) ? body.v : null;
  if (!visitor) throw new HttpError(400, '缺少访客编号');
  const session = typeof body.s === 'string' && /^[a-z0-9]{8,32}$/.test(body.s) ? body.s : null;
  const page = PAGES.includes(body.page) ? body.page : null;
  if (!page) throw new HttpError(400, '页面无效');
  if (!Array.isArray(body.events)) throw new HttpError(400, '缺少事件');
  if (body.events.length > MAX_BATCH_EVENTS) throw new HttpError(413, '事件太多');
  const events = body.events.map(cleanEvent).filter(Boolean);
  return {
    visitor, session, page,
    device: DEVICES.includes(body.dev) ? body.dev : null,
    browser: BROWSERS.includes(body.br) ? body.br : null,
    version: typeof body.ver === 'string' && /^[\w.\-]{1,24}$/.test(body.ver) ? body.ver : null,
    clientNow: Number.isFinite(body.now) ? body.now : null,
    events,
  };
}

class WindowLimiter {
  constructor(windowMs) { this.windowMs = windowMs; this.map = new Map(); }
  hit(key, limit, t) {
    const item = this.map.get(key);
    if (!item || t - item.start >= this.windowMs) {
      if (this.map.size > 50000) this.map.clear();
      this.map.set(key, { start: t, n: 1 });
      return true;
    }
    item.n++;
    return item.n <= limit;
  }
}

function readBody(req, max = MAX_ANALYTICS_BODY) {
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
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('bad');
        resolve(body);
      } catch { reject(new HttpError(400, '请求格式无效')); }
    });
    req.on('error', err => { if (!failed) { failed = true; reject(err); } });
  });
}

export function ensureAnalyticsSchema(db, t = Date.now()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      ts INTEGER NOT NULL,
      day TEXT NOT NULL,
      visitor TEXT NOT NULL,
      session TEXT,
      page TEXT NOT NULL,
      name TEXT NOT NULL,
      demo TEXT,
      props TEXT,
      device TEXT,
      account TEXT
    );
    CREATE INDEX IF NOT EXISTS events_day ON events(day);
    CREATE INDEX IF NOT EXISTS events_visitor_day ON events(visitor, day);
    CREATE INDEX IF NOT EXISTS events_name_day ON events(name, day);
    CREATE TABLE IF NOT EXISTS daily_visitors (
      day TEXT NOT NULL,
      visitor TEXT NOT NULL,
      page TEXT NOT NULL,
      secs INTEGER NOT NULL DEFAULT 0,
      first_ts INTEGER NOT NULL,
      last_ts INTEGER NOT NULL,
      last_hb INTEGER NOT NULL DEFAULT 0,
      device TEXT,
      PRIMARY KEY (day, visitor, page)
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS daily_visitors_last ON daily_visitors(last_ts);
    CREATE INDEX IF NOT EXISTS daily_visitors_visitor ON daily_visitors(visitor, day);
    CREATE TABLE IF NOT EXISTS visitors (
      visitor TEXT PRIMARY KEY,
      first_day TEXT NOT NULL,
      first_ts INTEGER NOT NULL,
      first_page TEXT,
      last_day TEXT NOT NULL,
      device TEXT,
      browser TEXT,
      account TEXT
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS visitors_first_day ON visitors(first_day);
  `);
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('analytics_since', ?)").run(dayOf(t));
}

export function createAnalyticsHandler(store, { now = () => Date.now(), salt = process.env.REPORT_SALT || '', log = console } = {}) {
  const db = store.db;
  ensureAnalyticsSchema(db, now());
  if (!salt) salt = db.prepare("SELECT value FROM meta WHERE key = 'report_salt'").get()?.value || 'analytics';
  const limiter = new WindowLimiter(LIMIT_WINDOW_MS);
  const ipHash = ip => createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 24);
  const accountCache = new Map(); // token hash -> { id, at }
  const q = {
    insert: db.prepare('INSERT INTO events (ts, day, visitor, session, page, name, demo, props, device, account) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    dvGet: db.prepare('SELECT secs, last_hb FROM daily_visitors WHERE day = ? AND visitor = ? AND page = ?'),
    dvInsert: db.prepare('INSERT INTO daily_visitors (day, visitor, page, secs, first_ts, last_ts, last_hb, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    dvUpdate: db.prepare('UPDATE daily_visitors SET secs = ?, last_ts = MAX(last_ts, ?), last_hb = ?, device = COALESCE(?, device) WHERE day = ? AND visitor = ? AND page = ?'),
    vUpsert: db.prepare(`INSERT INTO visitors (visitor, first_day, first_ts, first_page, last_day, device, browser, account) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(visitor) DO UPDATE SET last_day = MAX(last_day, excluded.last_day), device = COALESCE(excluded.device, device), browser = COALESCE(excluded.browser, browser), account = COALESCE(excluded.account, account)`),
    purgeEvents: db.prepare('DELETE FROM events WHERE day < ?'),
    purgeDaily: db.prepare('DELETE FROM daily_visitors WHERE day < ?'),
  };

  function accountOf(req, t) {
    const auth = req.headers.authorization || '';
    const tok = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!/^[a-f0-9]{64}$/i.test(tok)) return null;
    const h = createHash('sha256').update(tok).digest('hex');
    const hit = accountCache.get(h);
    if (hit && t - hit.at < 10 * 60 * 1000) return hit.id;
    let id = null;
    try { id = store.getAccountByTokenHash?.(h)?.accountId || null; } catch {}
    if (accountCache.size > 5000) accountCache.clear();
    accountCache.set(h, { id, at: t });
    return id;
  }

  // Writes one cleaned batch. Exported through the handler for tests and the load check.
  function ingest(batch, t, account = null) {
    const { visitor, session, page, device, browser } = batch;
    // Client clocks are not trusted: an event's time is the server time minus how long
    // it waited in the queue (at most an hour).
    const offset = e => (batch.clientNow && e.t ? Math.max(0, Math.min(3600e3, batch.clientNow - e.t)) : 0);
    const rows = batch.events.map(e => ({ ...e, ts: t - offset(e) })).sort((a, b) => a.ts - b.ts);
    if (!rows.length) rows.push({ name: null, props: {}, ts: t }); // still counts as activity
    db.exec('BEGIN');
    try {
      let firstDay = null;
      for (const e of rows) {
        const day = dayOf(e.ts);
        firstDay = firstDay || day;
        const cur = q.dvGet.get(day, visitor, page);
        const hb = e.name === 'heartbeat';
        if (!cur) {
          q.dvInsert.run(day, visitor, page, hb ? HEARTBEAT_SECS : 0, e.ts, e.ts, hb ? e.ts : 0, device);
        } else {
          const count = hb && e.ts - cur.last_hb >= 50 * 1000;
          q.dvUpdate.run(count ? Math.min(86400, cur.secs + HEARTBEAT_SECS) : cur.secs, e.ts, count ? e.ts : cur.last_hb, device, day, visitor, page);
        }
        if (e.name && !hb) {
          const props = Object.keys(e.props).length ? JSON.stringify(e.props) : null;
          q.insert.run(e.ts, day, visitor, session, page, e.name, e.props.demo || (page === 'wa' || page === 'new' ? page : null), props, device, account);
        }
      }
      q.vUpsert.run(visitor, firstDay, rows[0].ts, page, dayOf(rows.at(-1).ts), device, browser, account);
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      throw err;
    }
  }

  let lastPurge = 0;
  function maybePurge(t) {
    if (t - lastPurge < 6 * 60 * 60 * 1000) return;
    lastPurge = t;
    try {
      q.purgeEvents.run(addDays(dayOf(t), -EVENTS_KEEP_DAYS));
      q.purgeDaily.run(addDays(dayOf(t), -ROLLUP_KEEP_DAYS));
    } catch (err) { log.error?.('清理统计数据失败:', err?.message || err); }
  }
  maybePurge(now());

  // ------------------------------------------------------------ dashboard
  let names = null;
  async function loadNames() {
    if (names) return names;
    names = { wa: { teams: {}, enemies: {} }, new: { teams: {}, enemies: {} } };
    try {
      const wa = await import('../content.js');
      for (const [k, v] of Object.entries(wa.REGIONS || {})) names.wa.teams[k] = v.name;
      for (const [k, v] of Object.entries(wa.ENEMIES || {})) names.wa.enemies[k] = v.name;
      const map = await import('../season-map.js');
      for (const [k, v] of Object.entries(map.WA_GROUPS || {})) if (v?.name) names.wa.enemies[k] = v.name;
    } catch {}
    try {
      const nd = await import('../new-demo/content.js');
      for (const [k, v] of Object.entries(nd.TEAMS || {})) names.new.teams[k] = String(v.name).split(' · ')[0];
      for (const [k, v] of Object.entries(nd.ENEMIES || {})) names.new.enemies[k] = v.name;
      const map = await import('../new-demo/season-map.js');
      for (const [k, v] of Object.entries(map.EXTRA_ENEMIES || {})) names.new.enemies[k] = v.name;
    } catch {}
    return names;
  }

  function metrics(t, days = 7, nm = { wa: { teams: {}, enemies: {} }, new: { teams: {}, enemies: {} } }) {
    return computeMetrics(db, t, days, nm);
  }

  async function adminRoute(req, res, url) {
    if (url.pathname !== '/api/admin/analytics') return false;
    if (req.method !== 'GET') throw new HttpError(405, '只接受 GET', { Allow: 'GET' });
    const d = Number(url.searchParams.get('days'));
    const days = [7, 30, 90].includes(d) ? d : 7;
    sendJson(res, 200, metrics(now(), days, await loadNames()));
    return true;
  }

  async function handler(req, res, url) {
    if (url.pathname !== '/api/analytics') return false;
    const t = now();
    try {
      if (req.method !== 'POST') throw new HttpError(405, '只接受 POST', { Allow: 'POST' });
      if (!checkSameOrigin(req)) throw new HttpError(403, '跨源请求被禁止');
      const ip = ipHash(clientIpOf(req));
      if (!limiter.hit(`ip:${ip}`, IP_BATCH_LIMIT, t)) throw new HttpError(429, '请求过于频繁');
      const batch = cleanBatch(await readBody(req));
      if (!limiter.hit(`v:${batch.visitor}`, VISITOR_BATCH_LIMIT, t)) throw new HttpError(429, '请求过于频繁');
      maybePurge(t);
      ingest(batch, t, accountOf(req, t));
      res.writeHead(204, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end();
    } catch (err) {
      if (!(err instanceof HttpError)) {
        log.error?.('统计写入失败:', err?.message || err);
        err = new HttpError(500, '服务器内部错误');
      }
      sendJson(res, err.status, { error: err.message }, err.headers);
    }
    return true;
  }

  handler.adminRoute = adminRoute;
  handler.ingest = ingest;
  handler.metrics = metrics;
  handler.purge = t => { lastPurge = 0; maybePurge(t); };
  return handler;
}

// ---------------------------------------------------------------- metrics
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

export function computeMetrics(db, t, days = 7, nm = { wa: { teams: {}, enemies: {} }, new: { teams: {}, enemies: {} } }) {
  const today = dayOf(t);
  const from = addDays(today, -(days - 1));
  const gamePages = `page IN ('wa','new','pvp')`;
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const all = (sql, ...a) => db.prepare(sql).all(...a);
  const players = (d0, d1) => one(`SELECT COUNT(DISTINCT visitor) AS n FROM daily_visitors WHERE day >= ? AND day <= ? AND ${gamePages}`, d0, d1).n;
  const since = db.prepare("SELECT value FROM meta WHERE key = 'analytics_since'").get()?.value || today;
  const count = sql => { try { return one(sql).n; } catch { return 0; } };

  const overview = {
    online: one(`SELECT COUNT(DISTINCT visitor) AS n FROM daily_visitors WHERE day >= ? AND last_ts >= ?`, addDays(today, -1), t - ONLINE_WINDOW_MS).n,
    onlinePlaying: one(`SELECT COUNT(DISTINCT visitor) AS n FROM daily_visitors WHERE day >= ? AND last_ts >= ? AND ${gamePages}`, addDays(today, -1), t - ONLINE_WINDOW_MS).n,
    today: players(today, today),
    todayVisitors: one('SELECT COUNT(DISTINCT visitor) AS n FROM daily_visitors WHERE day = ?', today).n,
    yesterday: players(addDays(today, -1), addDays(today, -1)),
    d7: players(addDays(today, -6), today),
    d30: players(addDays(today, -29), today),
    newToday: one('SELECT COUNT(*) AS n FROM visitors WHERE first_day = ?', today).n,
    total: one('SELECT COUNT(*) AS n FROM visitors').n,
    accounts: count('SELECT COUNT(*) AS n FROM accounts'),
    saveCodes: count('SELECT COUNT(*) AS n FROM save_codes'),
  };
  const pd = one(`SELECT SUM(secs) AS s, COUNT(*) AS n FROM (SELECT day, visitor, SUM(secs) AS secs FROM daily_visitors WHERE day >= ? AND ${gamePages} GROUP BY day, visitor)`, addDays(today, -6));
  overview.avgMinutes = pd.n ? Math.round((pd.s || 0) / pd.n / 6) / 10 : 0;
  const runsToday = demo => ({
    started: one("SELECT COUNT(*) AS n FROM events WHERE name = 'run_start' AND day = ? AND demo = ?", today, demo).n,
    ended: one("SELECT COUNT(*) AS n FROM events WHERE name = 'run_end' AND day = ? AND demo = ?", today, demo).n,
    won: one("SELECT COUNT(*) AS n FROM events WHERE name = 'run_end' AND day = ? AND demo = ? AND json_extract(props, '$.result') = 'win'", today, demo).n,
  });
  overview.runsToday = { wa: runsToday('wa'), new: runsToday('new') };

  // Daily series (last max(30, days) days).
  const span = Math.max(30, days);
  const d0 = addDays(today, -(span - 1));
  const byDay = new Map();
  for (let i = 0; i < span; i++) byDay.set(addDays(d0, i), { day: addDays(d0, i), players: 0, visitors: 0, newPlayers: 0, minutes: 0, pages: { wa: 0, new: 0, pvp: 0, landing: 0 }, runs: 0, accounts: 0 });
  for (const r of all(`SELECT day, COUNT(DISTINCT visitor) AS n, SUM(secs) AS s FROM daily_visitors WHERE day >= ? AND ${gamePages} GROUP BY day`, d0)) if (byDay.has(r.day)) Object.assign(byDay.get(r.day), { players: r.n, minutes: Math.round((r.s || 0) / 60) });
  for (const r of all('SELECT day, COUNT(DISTINCT visitor) AS n FROM daily_visitors WHERE day >= ? GROUP BY day', d0)) if (byDay.has(r.day)) byDay.get(r.day).visitors = r.n;
  for (const r of all('SELECT day, page, COUNT(*) AS n FROM daily_visitors WHERE day >= ? GROUP BY day, page', d0)) if (byDay.has(r.day) && r.page in byDay.get(r.day).pages) byDay.get(r.day).pages[r.page] = r.n;
  for (const r of all('SELECT first_day AS day, COUNT(*) AS n FROM visitors WHERE first_day >= ? GROUP BY first_day', d0)) if (byDay.has(r.day)) byDay.get(r.day).newPlayers = r.n;
  for (const r of all("SELECT day, COUNT(*) AS n FROM events WHERE name = 'run_start' AND day >= ? GROUP BY day", d0)) if (byDay.has(r.day)) byDay.get(r.day).runs = r.n;
  try {
    for (const r of all('SELECT created_at FROM accounts WHERE created_at >= ?', dayStart(d0))) { const d = byDay.get(dayOf(r.created_at)); if (d) d.accounts++; }
  } catch {}

  // Retention by cohort (first day), last 14 cohorts.
  const retention = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i);
    const cohort = one('SELECT COUNT(*) AS n FROM visitors WHERE first_day = ?', day).n;
    const back = n => one('SELECT COUNT(DISTINCT v.visitor) AS n FROM visitors v JOIN daily_visitors d ON d.visitor = v.visitor AND d.day = ? WHERE v.first_day = ?', addDays(day, n), day).n;
    const r1 = addDays(day, 1) <= today ? back(1) : null;
    const r7 = addDays(day, 7) <= today ? back(7) : null;
    retention.push({ day, cohort, d1: r1, d1Pct: r1 == null ? null : pct(r1, cohort), d7: r7, d7Pct: r7 == null ? null : pct(r7, cohort) });
  }

  // Funnels per demo, distinct visitors in the window.
  const distinct = (where, ...a) => one(`SELECT COUNT(DISTINCT visitor) AS n FROM events WHERE day >= ? AND ${where}`, from, ...a).n;
  const funnel = demo => {
    const opened = one('SELECT COUNT(DISTINCT visitor) AS n FROM daily_visitors WHERE day >= ? AND page = ?', from, demo).n;
    const steps = [
      ['打开游戏', opened],
      ['开始一局', distinct("name = 'run_start' AND demo = ?", demo)],
      ['赢下第一场战斗', distinct("name = 'fight_end' AND demo = ? AND json_extract(props, '$.won') = 1", demo)],
      ['打到第一幕决战', distinct("name = 'fight_end' AND demo = ? AND json_extract(props, '$.kind') = 'boss' AND json_extract(props, '$.act') = 1", demo)],
      ['通关第一幕', distinct("name = 'fight_end' AND demo = ? AND json_extract(props, '$.kind') = 'boss' AND json_extract(props, '$.act') = 1 AND json_extract(props, '$.won') = 1", demo)],
      ['通关三幕', distinct("name = 'run_end' AND demo = ? AND json_extract(props, '$.result') = 'win'", demo)],
    ];
    return steps.map(([label, n]) => ({ label, count: n, pct: pct(n, opened) }));
  };

  const deaths = demo => {
    const names = nm[demo] || { enemies: {} };
    const enemies = all(`SELECT json_extract(props, '$.enemy') AS k, COUNT(*) AS n FROM events WHERE name = 'run_end' AND day >= ? AND demo = ? AND json_extract(props, '$.result') = 'lose' GROUP BY k ORDER BY n DESC LIMIT 10`, from, demo)
      .map(r => ({ id: r.k || null, name: r.k ? names.enemies[r.k] || r.k : '战斗以外', count: r.n }));
    const floors = all(`SELECT json_extract(props, '$.act') AS act, json_extract(props, '$.floor') AS floor, COUNT(*) AS n FROM events WHERE name = 'run_end' AND day >= ? AND demo = ? AND json_extract(props, '$.result') = 'lose' GROUP BY act, floor ORDER BY n DESC LIMIT 10`, from, demo)
      .map(r => ({ act: r.act, floor: r.floor, count: r.n }));
    const fights = all(`SELECT json_extract(props, '$.enemy') AS k, COUNT(*) AS n, SUM(json_extract(props, '$.won') = 0) AS lost FROM events WHERE name = 'fight_end' AND day >= ? AND demo = ? GROUP BY k ORDER BY lost DESC, n DESC LIMIT 10`, from, demo)
      .map(r => ({ id: r.k, name: r.k ? names.enemies[r.k] || r.k : '—', fights: r.n, lost: r.lost || 0 }));
    return { enemies, floors, fights };
  };
  const choices = demo => {
    const names = nm[demo] || { teams: {} };
    return {
      teams: all(`SELECT json_extract(props, '$.team') AS k, COUNT(*) AS n FROM events WHERE name = 'run_start' AND day >= ? AND demo = ? GROUP BY k ORDER BY n DESC`, from, demo).map(r => ({ id: r.k, name: names.teams[r.k] || r.k || '未知', count: r.n })),
      asc: all(`SELECT COALESCE(json_extract(props, '$.asc'), 0) AS level, COUNT(*) AS n FROM events WHERE name = 'run_start' AND day >= ? AND demo = ? GROUP BY level ORDER BY level`, from, demo).map(r => ({ level: r.level, count: r.n })),
    };
  };
  const runs = demo => {
    const r = one(`SELECT SUM(name = 'run_start') AS started, SUM(name = 'run_end') AS ended, SUM(name = 'run_end' AND json_extract(props, '$.result') = 'win') AS won, SUM(name = 'run_end' AND json_extract(props, '$.result') = 'abandon') AS abandoned, AVG(CASE WHEN name = 'run_end' THEN json_extract(props, '$.mins') END) AS mins FROM events WHERE day >= ? AND demo = ? AND name IN ('run_start', 'run_end')`, from, demo);
    return { started: r.started || 0, ended: r.ended || 0, won: r.won || 0, abandoned: r.abandoned || 0, avgMinutes: r.mins == null ? null : Math.round(r.mins * 10) / 10 };
  };

  // One device per person (the latest one seen) among those active in the window.
  const devices = all(`SELECT COALESCE(device, 'unknown') AS device, COUNT(*) AS n FROM visitors WHERE last_day >= ? GROUP BY device ORDER BY n DESC`, from).map(r => ({ device: r.device, count: r.n }));
  const browsers = all(`SELECT COALESCE(v.browser, 'other') AS browser, COUNT(DISTINCT v.visitor) AS n FROM visitors v WHERE v.last_day >= ? GROUP BY browser ORDER BY n DESC`, from).map(r => ({ browser: r.browser, count: r.n }));

  const pv = one(`SELECT SUM(name = 'pvp_match_start') AS matches, COUNT(DISTINCT CASE WHEN name = 'pvp_match_start' THEN visitor END) AS players, SUM(name = 'pvp_match_start' AND json_extract(props, '$.rematch') = 1) AS rematches, SUM(name = 'pvp_match_end') AS finished, AVG(CASE WHEN name = 'pvp_match_end' THEN json_extract(props, '$.turns') END) AS turns FROM events WHERE day >= ? AND name IN ('pvp_match_start', 'pvp_match_end')`, from);
  const pvp = { matches: pv.matches || 0, players: pv.players || 0, rematches: pv.rematches || 0, finished: pv.finished || 0, avgTurns: pv.turns == null ? null : Math.round(pv.turns * 10) / 10, rooms: count('SELECT COUNT(*) AS n FROM rooms') };

  const other = {};
  for (const r of all(`SELECT name, COUNT(*) AS n, COUNT(DISTINCT visitor) AS v FROM events WHERE day >= ? AND name IN ('achievement', 'unlock_tier_up', 'save_code_created', 'save_code_login', 'mailbox_sent') GROUP BY name`, from)) other[r.name] = { count: r.n, visitors: r.v };

  let backfill = {};
  try {
    const before = dayStart(since);
    backfill = {
      since,
      accounts: overview.accounts,
      accountsBefore: count(`SELECT COUNT(*) AS n FROM accounts WHERE created_at < ${Number(before)}`),
      saveCodes: overview.saveCodes,
      archives: count('SELECT COUNT(DISTINCT account_id) AS n FROM archives'),
      rooms: count('SELECT COUNT(*) AS n FROM rooms'),
      syncLinks: count('SELECT COUNT(*) AS n FROM sync_links'),
    };
  } catch { backfill = { since }; }

  return {
    now: t, today, from, days, since, tzOffsetMinutes: TZ_OFFSET_MS / 60000,
    overview, daily: [...byDay.values()], retention,
    funnels: { wa: funnel('wa'), new: funnel('new') },
    runs: { wa: runs('wa'), new: runs('new') },
    deaths: { wa: deaths('wa'), new: deaths('new') },
    choices: { wa: choices('wa'), new: choices('new') },
    devices, browsers, pvp, other, backfill,
  };
}
