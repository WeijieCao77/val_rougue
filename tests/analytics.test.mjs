// Anonymous play statistics: client module (shared/play-analytics.js), ingest
// validation / rate limits (online/analytics-api.mjs), the daily rollup and the
// dashboard metrics (DAU, new players, retention, funnel), and admin auth.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../online/store.mjs';
import { createOnlineHandler } from '../online/api.mjs';
import { createReportHandler } from '../online/report-api.mjs';
import {
  createAnalyticsHandler, cleanEvent, cleanBatch, EVENT_SPEC, dayOf, MAX_BATCH_EVENTS, IP_BATCH_LIMIT, VISITOR_BATCH_LIMIT,
} from '../online/analytics-api.mjs';
import {
  initAnalytics, track, trackOnce, flush, observeRun, abandonRun, deviceClass, browserFamily, visitorId, sessionId,
  resetAnalyticsForTests, pendingEvents,
} from '../shared/play-analytics.js';

const quiet = { log() {}, warn() {}, error() {} };
const ADMIN = 'test-admin-' + Math.random().toString(36).slice(2);
const DAY = 24 * 3600e3;
// 2026-10-10 12:00 China time.
const T0 = Date.UTC(2026, 9, 10, 4, 0);

async function setup(t, { now } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'analytics-'));
  const store = await openStore({ dataDir: dir, housekeeping: false, log: quiet });
  const clock = { t: T0 };
  const nowFn = now || (() => clock.t);
  const online = createOnlineHandler(store);
  const analytics = createAnalyticsHandler(store, { now: nowFn, log: quiet });
  const reports = createReportHandler(store, { adminToken: ADMIN, log: quiet, now: nowFn, adminRoutes: (req, res, url) => analytics.adminRoute(req, res, url) });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (await analytics(req, res, url)) return;
    if (await reports(req, res, url)) return;
    if (await online(req, res, url)) return;
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(r => server.close(r));
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const call = (p, { method = 'GET', body, token, headers = {}, raw } = {}) => fetch(base + p, {
    method,
    headers: { ...(body || raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  return { dir, store, analytics, call, clock, db: store.db };
}

const batch = (v, page, events, extra = {}) => ({ v, s: 'sess' + v.slice(0, 8), page, dev: 'phone', br: 'chrome', ver: '0.9.0', now: T0, events, ...extra });
const ev = (n, p = {}) => ({ n, t: T0, p });
// Writes a batch straight through the handler at time t.
function feed(analytics, t, v, page, events, extra) {
  analytics.ingest(cleanBatch(batch(v, page, events.map(e => ({ ...e, t })), { now: t, ...extra })), t);
}

// ---------------------------------------------------------------- validation
test('cleanEvent: whitelist of names, props and types', () => {
  assert.equal(cleanEvent({ n: 'evil', p: {} }), null);
  assert.equal(cleanEvent({ n: '__proto__' }), null);
  assert.equal(cleanEvent(null), null);
  const e = cleanEvent({ n: 'fight_end', t: 5, p: { demo: 'new', act: 1, floor: 3, kind: 'boss', won: true, enemy: 'A2_E01', turns: 7, nickname: 'x', token: 'abc', extra: 1 } });
  assert.deepEqual(e.props, { demo: 'new', act: 1, floor: 3, kind: 'boss', won: true, enemy: 'A2_E01', turns: 7 });
  // Wrong types / ranges are dropped, the event is kept.
  const bad = cleanEvent({ n: 'run_end', p: { demo: 'xx', result: 'maybe', act: 99, floor: -1, mins: 'long', enemy: '<script>', asc: 3.5 } });
  assert.deepEqual(bad.props, {});
  assert.deepEqual(cleanEvent({ n: 'run_start', p: { demo: 'wa', team: 'CN', asc: 2 } }).props, { demo: 'wa', team: 'CN', asc: 2 });
  assert.deepEqual(cleanEvent({ n: 'mailbox_sent', p: { category: '建议', text: '正文' } }).props, { category: '建议' });
});

test('cleanBatch: envelope checks', () => {
  assert.throws(() => cleanBatch({ v: 'x', page: 'wa', events: [] }), /访客/);
  assert.throws(() => cleanBatch({ v: 'abcdefgh12', page: 'nope', events: [] }), /页面/);
  assert.throws(() => cleanBatch({ v: 'abcdefgh12', page: 'wa', events: Array(MAX_BATCH_EVENTS + 1).fill({ n: 'heartbeat' }) }), /太多/);
  const b = cleanBatch({ v: 'abcdefgh12', s: 'BAD SESSION', page: 'pvp', dev: 'fridge', br: 'netscape', events: [{ n: 'page_view' }, { n: 'nope' }] });
  assert.equal(b.session, null);
  assert.equal(b.device, null);
  assert.equal(b.browser, null);
  assert.equal(b.events.length, 1);
});

test('new-demo event names and props carry no Valorant words', () => {
  const words = /无畏契约|valorant|vct|riot|masters|champions|大师赛|冠军赛|特工|选手|jett|sage|phoenix|reyna|omen|sova|viper|cypher|killjoy|raze|skye|yoru|astra|kayo|chamber|neon|fade|harbor|gekko|deadlock|iso|clove|vyse|tejo|waylay|ascent|bind|haven|split|icebreaker|lotus|pearl|fracture|sunset|abyss|美洲|太平洋|emea/i;
  const names = Object.keys(EVENT_SPEC);
  for (const n of names) assert.doesNotMatch(n, words, n);
  for (const [n, spec] of Object.entries(EVENT_SPEC)) for (const [k, s] of Object.entries(spec)) {
    assert.doesNotMatch(k, words, `${n}.${k}`);
    for (const v of s.values || []) assert.doesNotMatch(String(v), words, `${n}.${k}=${v}`);
  }
  // What the new demo actually sends: its snapshot builder (team code, enemy id, act / floor).
  const ui = readFileSync(new URL('../new-demo/ui.js', import.meta.url), 'utf8');
  const fn = ui.slice(ui.indexOf('function ndRunSnap'), ui.indexOf('\n}\n', ui.indexOf('function ndRunSnap')));
  assert.ok(fn.length > 50);
  assert.doesNotMatch(fn.replace(/\/\/.*$/gm, ''), words);
  // The client module itself is shown nowhere but is shared with the new demo.
  const mod = readFileSync(new URL('../shared/play-analytics.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(mod, /无畏契约|Valorant|VCT|选手|特工/i);
});

// ---------------------------------------------------------------- HTTP ingest
test('POST /api/analytics: stores events, drops unknown ones, 204', async t => {
  const { call, db } = await setup(t);
  const res = await call('/api/analytics', { method: 'POST', body: batch('visitor0001', 'wa', [ev('page_view'), ev('run_start', { demo: 'wa', team: 'CN', asc: 0, secret: 'x' }), ev('hack_me', { a: 1 }), ev('heartbeat')]) });
  assert.equal(res.status, 204);
  const rows = db.prepare('SELECT name, demo, props, page, device FROM events ORDER BY id').all();
  assert.deepEqual(rows.map(r => r.name), ['page_view', 'run_start']);
  assert.equal(rows[1].demo, 'wa');
  assert.deepEqual(JSON.parse(rows[1].props), { demo: 'wa', team: 'CN', asc: 0 });
  const dv = db.prepare('SELECT * FROM daily_visitors').all();
  assert.equal(dv.length, 1);
  assert.equal(dv[0].secs, 60);
  assert.equal(dv[0].day, '2026-10-10');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM visitors').get().n, 1);
  // Heartbeats never become rows; no IP is stored anywhere.
  const all = JSON.stringify(db.prepare('SELECT * FROM events').all()) + JSON.stringify(db.prepare('SELECT * FROM visitors').all());
  assert.doesNotMatch(all, /127\.0\.0\.1/);
});

test('POST /api/analytics: size, method, origin and rate limits', async t => {
  const { call } = await setup(t);
  assert.equal((await call('/api/analytics')).status, 405);
  assert.equal((await call('/api/analytics', { method: 'POST', raw: 'x'.repeat(17 * 1024) })).status, 413);
  assert.equal((await call('/api/analytics', { method: 'POST', raw: '[1]' })).status, 400);
  assert.equal((await call('/api/analytics', { method: 'POST', body: batch('visitor0002', 'wa', []), headers: { Origin: 'https://evil.example' } })).status, 403);
  let last = 0;
  for (let i = 0; i <= VISITOR_BATCH_LIMIT; i++) last = (await call('/api/analytics', { method: 'POST', body: batch('visitor0003', 'wa', [ev('page_view')]) })).status;
  assert.equal(last, 429);
  // Another visitor from the same IP is still fine (the IP limit is higher).
  assert.equal((await call('/api/analytics', { method: 'POST', body: batch('visitor0004', 'wa', [ev('page_view')]) })).status, 204);
  assert.ok(IP_BATCH_LIMIT > VISITOR_BATCH_LIMIT);
});

test('bearer token links the visitor to the account server-side; body never holds it', async t => {
  const { call, db } = await setup(t);
  const acct = await (await call('/api/account', { method: 'POST', body: {} })).json();
  assert.equal((await call('/api/analytics', { method: 'POST', token: acct.token, body: batch('visitor0005', 'pvp', [ev('page_view')]) })).status, 204);
  const accountId = db.prepare('SELECT account_id FROM accounts').get().account_id;
  assert.equal(db.prepare('SELECT account FROM visitors WHERE visitor = ?').get('visitor0005').account, accountId);
  assert.doesNotMatch(JSON.stringify(db.prepare('SELECT * FROM events').all()), new RegExp(acct.token));
});

// ---------------------------------------------------------------- rollup + metrics
test('metrics: DAU, new players, play time, online, retention, funnel, deaths', async t => {
  const { analytics, clock } = await setup(t);
  const d0 = T0 - 8 * DAY; // 2026-10-02
  // Day 0: A, B, C play the new demo; D only looks at the landing page.
  for (const v of ['visitora01', 'visitorb01', 'visitorc01']) feed(analytics, d0, v, 'new', [{ n: 'page_view' }, { n: 'heartbeat' }]);
  feed(analytics, d0 + 70e3, 'visitora01', 'new', [{ n: 'heartbeat' }]);
  feed(analytics, d0 + 80e3, 'visitora01', 'new', [{ n: 'heartbeat' }]); // < 50 s after the last one: not counted
  feed(analytics, d0, 'visitord01', 'landing', [{ n: 'page_view' }]);
  // A: full funnel to an act-1 boss win, then a 3-act win. B: dies on floor 3. C: only opens.
  const fe = p => ({ n: 'fight_end', p: { demo: 'new', ...p } });
  feed(analytics, d0 + 1000, 'visitora01', 'new', [
    { n: 'run_start', p: { demo: 'new', team: 'breach', asc: 0 } },
    fe({ act: 1, floor: 1, kind: 'normal', won: true, enemy: 'E01', turns: 3 }),
    fe({ act: 1, floor: 16, kind: 'boss', won: true, enemy: 'B01', turns: 9 }),
    { n: 'run_end', p: { demo: 'new', result: 'win', act: 3, floor: 16, fights: 30, mins: 50 } },
  ]);
  feed(analytics, d0 + 1000, 'visitorb01', 'new', [
    { n: 'run_start', p: { demo: 'new', team: 'anchor', asc: 1 } },
    fe({ act: 1, floor: 1, kind: 'normal', won: true, enemy: 'E01', turns: 3 }),
    fe({ act: 1, floor: 3, kind: 'normal', won: false, enemy: 'E02', turns: 5 }),
    { n: 'run_end', p: { demo: 'new', result: 'lose', act: 1, floor: 3, fights: 1, mins: 6, enemy: 'E02' } },
  ]);
  // Day 1: A comes back (next-day retention 1 of 4); E is new. Day 7: B comes back.
  feed(analytics, d0 + DAY, 'visitora01', 'new', [{ n: 'page_view' }]);
  feed(analytics, d0 + DAY, 'visitore01', 'wa', [{ n: 'page_view' }, { n: 'run_start', p: { demo: 'wa', team: 'CN', asc: 0 } }]);
  feed(analytics, d0 + 7 * DAY, 'visitorb01', 'pvp', [{ n: 'page_view' }, { n: 'pvp_match_start', p: { round: 1, rematch: false } }, { n: 'pvp_match_end', p: { won: true, turns: 8, round: 1 } }, { n: 'pvp_match_start', p: { round: 2, rematch: true } }]);
  // Today: F is online right now.
  clock.t = T0;
  feed(analytics, T0 - 30e3, 'visitorf01', 'wa', [{ n: 'page_view' }]);

  const m = analytics.metrics(T0, 30);
  assert.equal(m.today, '2026-10-10');
  assert.equal(m.overview.online, 1);
  assert.equal(m.overview.today, 1);
  assert.equal(m.overview.newToday, 1);
  assert.equal(m.overview.total, 6);
  assert.equal(m.overview.d30, 5); // D only saw the landing page
  const day0 = m.daily.find(d => d.day === dayOf(d0));
  assert.equal(day0.players, 3);
  assert.equal(day0.visitors, 4);
  assert.equal(day0.newPlayers, 4);
  assert.equal(day0.pages.new, 3);
  assert.equal(day0.minutes, 4); // A 2 heartbeats + B 1 + C 1 = 4 minutes
  const r0 = m.retention.find(r => r.day === dayOf(d0));
  assert.equal(r0.cohort, 4);
  assert.equal(r0.d1, 1);
  assert.equal(r0.d1Pct, 25);
  assert.equal(r0.d7, 1);
  const recent = m.retention.at(-1);
  assert.equal(recent.d1, null); // not known yet
  const f = Object.fromEntries(m.funnels.new.map(s => [s.label, s.count]));
  assert.deepEqual(f, { 打开游戏: 3, 开始一局: 2, 赢下第一场战斗: 2, 打到第一幕决战: 1, 通关第一幕: 1, 通关三幕: 1 });
  assert.equal(m.funnels.new[1].pct, 66.7);
  assert.equal(m.deaths.new.enemies[0].id, 'E02');
  assert.deepEqual(m.deaths.new.floors[0], { act: 1, floor: 3, count: 1 });
  assert.deepEqual(m.choices.new.teams.map(x => x.id).sort(), ['anchor', 'breach']);
  assert.equal(m.runs.new.started, 2);
  assert.equal(m.runs.new.won, 1);
  assert.equal(m.pvp.matches, 2);
  assert.equal(m.pvp.rematches, 1);
  assert.equal(m.pvp.players, 1);
  assert.equal(m.pvp.avgTurns, 8);
  assert.ok(m.devices.find(d => d.device === 'phone').count >= 5);
});

test('metrics: choices and deaths group by team / enemy (not by row id)', async t => {
  const { analytics } = await setup(t);
  for (const v of ['visitorg01', 'visitorg02', 'visitorg03']) feed(analytics, T0, v, 'wa', [{ n: 'run_start', p: { demo: 'wa', team: 'CN', asc: 0 } }, { n: 'run_end', p: { demo: 'wa', result: 'lose', act: 1, floor: 2, enemy: 'S_E01' } }]);
  const m = analytics.metrics(T0, 7);
  assert.deepEqual(m.choices.wa.teams.map(x => [x.id, x.count]), [['CN', 3]]);
  assert.deepEqual(m.deaths.wa.enemies.map(x => [x.id, x.count]), [['S_E01', 3]]);
  assert.deepEqual(m.deaths.wa.floors, [{ act: 1, floor: 2, count: 3 }]);
});

test('purge: raw events after 180 days, the rollup after 400', async t => {
  const { analytics, db } = await setup(t);
  feed(analytics, T0 - 200 * DAY, 'visitorold1', 'wa', [{ n: 'page_view' }]);
  feed(analytics, T0 - 500 * DAY, 'visitorold2', 'wa', [{ n: 'page_view' }]);
  feed(analytics, T0, 'visitornew1', 'wa', [{ n: 'page_view' }]);
  analytics.purge(T0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily_visitors').get().n, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM visitors').get().n, 3); // 累计 keeps everyone
});

test('admin: GET /api/admin/analytics needs the admin password', async t => {
  const { call } = await setup(t);
  assert.equal((await call('/api/admin/analytics')).status, 401);
  assert.equal((await call('/api/admin/analytics', { token: 'wrong' })).status, 401);
  const res = await call('/api/admin/analytics?days=30', { token: ADMIN });
  assert.equal(res.status, 200);
  const m = await res.json();
  assert.equal(m.days, 30);
  assert.ok(Array.isArray(m.daily) && m.daily.length === 30);
  assert.equal(m.retention.length, 14);
  assert.ok(m.backfill.since);
  // Five failures lock this IP out even with the right password.
  for (let i = 0; i < 4; i++) await call('/api/admin/analytics', { token: 'nope' });
  assert.equal((await call('/api/admin/analytics', { token: ADMIN })).status, 429);
});

test('admin: analytics endpoint is 404 without ADMIN_TOKEN', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'analytics-'));
  const store = await openStore({ dataDir: dir, housekeeping: false, log: quiet });
  const analytics = createAnalyticsHandler(store, { log: quiet });
  const reports = createReportHandler(store, { adminToken: '', log: quiet, adminRoutes: (req, res, url) => analytics.adminRoute(req, res, url) });
  const server = http.createServer(async (req, res) => { const url = new URL(req.url, 'http://localhost'); if (await analytics(req, res, url)) return; if (await reports(req, res, url)) return; res.writeHead(404); res.end(); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => server.close(r)); await store.close(); rmSync(dir, { recursive: true, force: true }); });
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/admin/analytics`, { headers: { Authorization: 'Bearer x' } })).status, 404);
});

test('error groups report how many players hit them (distinct reporters)', async t => {
  const { call } = await setup(t);
  for (let i = 0; i < 3; i++) assert.equal((await call('/api/report/error', { method: 'POST', body: { message: 'boom', stack: 'at x (a.js:1:2)', page: 'wa' } })).status, 200);
  await call('/api/report/feedback', { method: 'POST', body: { text: '你好', page: 'new' } });
  const r = await (await call('/api/admin/reports?since=7d', { token: ADMIN })).json();
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].count, 3);
  assert.equal(r.errors[0].players, 1);
  assert.equal(r.feedback.length, 1);
});

test('static route serves /shared/play-analytics.js; every page starts it', () => {
  const src = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(src, /\['\/shared\/play-analytics\.js', \['shared\/play-analytics\.js'/);
  for (const f of ['landing.html', 'new-demo/ui.js', 'online/client.js', 'ui-source.js']) assert.match(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), /initAnalytics\(/, f);
});

// ---------------------------------------------------------------- client module
function memStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
}

test('client: ids, sessions, device class, browser family', () => {
  resetAnalyticsForTests();
  const storage = memStorage();
  let now = 1_000_000;
  initAnalytics({ page: 'wa', version: '1.0', storage, timers: false, transport: () => {}, now: () => now });
  const v = visitorId();
  assert.match(v, /^[a-z0-9]{8,32}$/);
  assert.equal(visitorId(), v);
  const s1 = sessionId(now);
  now += 10 * 60e3;
  assert.equal(sessionId(now), s1);
  now += 31 * 60e3;
  assert.notEqual(sessionId(now), s1);
  assert.equal(deviceClass(390, true), 'phone');
  assert.equal(deviceClass(820, true), 'tablet');
  assert.equal(deviceClass(1440, false), 'desktop');
  assert.equal(browserFamily('Mozilla/5.0 (iPhone) AppleWebKit Version/17 Mobile Safari/604.1'), 'safari');
  assert.equal(browserFamily('Mozilla/5.0 Chrome/120 Safari/537'), 'chrome');
  assert.equal(browserFamily('Mozilla/5.0 MicroMessenger/8.0 Chrome/120'), 'wechat');
});

test('client: batching, never throws, queue cap, no token in the body', () => {
  resetAnalyticsForTests();
  const storage = memStorage();
  storage.setItem('wa-online-token', 'a'.repeat(64));
  storage.setItem('save-code-v1', 'ABCD-EFGH-JKMN');
  const sent = [];
  let now = 5_000_000;
  initAnalytics({ page: 'new', version: '1.0', storage, timers: false, transport: (url, body) => sent.push(JSON.parse(body)), now: () => now });
  assert.equal(pendingEvents()[0].n, 'page_view');
  for (let i = 0; i < 300; i++) track('heartbeat');
  assert.ok(pendingEvents().length <= 200);
  assert.equal(track('Bad Name!'), false);
  assert.doesNotThrow(() => track('run_start', { demo: 'new', nested: { a: 1 }, fn: () => 1 }));
  flush();
  assert.ok(sent.length >= 1);
  for (const b of sent) assert.ok(b.events.length <= 50);
  const text = JSON.stringify(sent);
  assert.doesNotMatch(text, /aaaaaaaa|ABCD-EFGH/);
  assert.equal(sent[0].page, 'new');
  // Broken transport / storage: still no throw.
  resetAnalyticsForTests();
  initAnalytics({ storage: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }, timers: false, transport: () => { throw new Error('net'); } });
  assert.doesNotThrow(() => { track('page_view'); flush(); trackOnce('k', 'page_view'); observeRun('wa', { key: 'r1', act: 1, floor: 0 }); });
});

test('client: observeRun derives run_start / fight_end / run_end once, across reloads', () => {
  resetAnalyticsForTests();
  const storage = memStorage();
  let got = [];
  const transport = (u, body) => got.push(...JSON.parse(body).events);
  initAnalytics({ page: 'new', storage, timers: false, transport });
  const seen = () => [...got, ...pendingEvents()].filter(e => e.n !== 'page_view');
  const names = () => seen().map(e => e.n);
  const base = { key: 'seed-1', team: 'breach', asc: 2, act: 1, floor: 0, hp: 70 };
  observeRun('new', { ...base, phase: 'map' });
  observeRun('new', { ...base, floor: 1, inCombat: true, turn: 1, fight: { enemy: 'E01', kind: 'normal', act: 1, floor: 1 } });
  observeRun('new', { ...base, floor: 1, inCombat: true, turn: 4, fight: { enemy: 'E01', kind: 'normal', act: 1, floor: 1 } });
  observeRun('new', { ...base, floor: 1, phase: 'reward' });
  // "Reload": module memory cleared, localStorage kept.
  const kept = seen();
  got = [];
  resetAnalyticsForTests();
  initAnalytics({ page: 'new', storage, timers: false, transport });
  observeRun('new', { ...base, floor: 1, phase: 'reward' });
  observeRun('new', { ...base, floor: 2, inCombat: true, turn: 2, fight: { enemy: 'E02', kind: 'normal', act: 1, floor: 2 } });
  observeRun('new', { ...base, floor: 2, hp: 0, outcome: 'lose' });
  observeRun('new', { ...base, floor: 2, hp: 0, outcome: 'lose' });
  const all = [...kept, ...seen()];
  assert.deepEqual(all.map(e => e.n), ['run_start', 'fight_end', 'fight_end', 'run_end']);
  assert.deepEqual(all[1].p, { demo: 'new', act: 1, floor: 1, kind: 'normal', won: true, enemy: 'E01', turns: 4 });
  assert.equal(all[2].p.won, false);
  assert.equal(all[3].p.result, 'lose');
  assert.equal(all[3].p.enemy, 'E02');
  assert.equal(all[0].p.team, 'breach');
  // A run loaded mid-way (e.g. from a cloud save) is not a new start; abandoning it ends it once.
  got = [];
  resetAnalyticsForTests();
  initAnalytics({ page: 'wa', storage, timers: false, transport });
  observeRun('wa', { key: 'r9', team: 'CN', act: 2, floor: 5, phase: 'map' });
  abandonRun('wa', { key: 'r9', team: 'CN', act: 2, floor: 5 });
  abandonRun('wa', { key: 'r9', team: 'CN', act: 2, floor: 5 });
  assert.deepEqual(names(), ['run_end']);
  assert.equal(seen().at(-1).p.result, 'abandon');
});

test('client: trackOnce and the pa:track DOM channel', () => {
  resetAnalyticsForTests();
  const storage = memStorage();
  initAnalytics({ page: 'pvp', storage, timers: false, transport: () => {} });
  assert.equal(trackOnce('pvp:ABC:1:s', 'pvp_match_start', { round: 1 }), true);
  assert.equal(trackOnce('pvp:ABC:1:s', 'pvp_match_start', { round: 1 }), false);
  for (const f of ['shared/feedback.js', 'shared/progress-sync.js', 'shared/achievements-core.js']) {
    assert.match(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), /pa:track/, f);
  }
  // No imports: bundled into the Wa app.js.
  const src = readFileSync(new URL('../shared/play-analytics.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /^\s*import\b/m);
  assert.match(readFileSync(new URL('../app.js', import.meta.url), 'utf8'), /initAnalytics/);
});
