// Backups (VACUUM INTO snapshots, rotation, latest.json, admin download) and the
// report API (client errors, feedback, admin views, server-error hook).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { openStore } from '../online/store.mjs';
import { createOnlineHandler, sendError } from '../online/api.mjs';
import { createReportHandler, ERROR_LIMIT, FEEDBACK_LIMIT, fingerprintOf, AdminGuard, ADMIN_IP_FAILS, ADMIN_GLOBAL_FAILS } from '../online/report-api.mjs';
import { setServerErrorSink } from '../online/server-errors.mjs';
import {
  createSnapshot, inspectSnapshot, planRotation, rotateSnapshots, snapshotName, listSnapshots,
  backupDirOf, readLatest, startBackupScheduler, loadSqlite,
} from '../online/backup.mjs';
import { pullBackup } from '../tools/pull-backup.mjs';

const quiet = { log() {}, warn() {}, error() {} };
const ADMIN = 'test-admin-' + Math.random().toString(36).slice(2);

async function setup(t, { adminToken = ADMIN, now } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'backup-reports-'));
  const store = await openStore({ dataDir: dir, housekeeping: false, log: quiet });
  const online = createOnlineHandler(store);
  const reports = createReportHandler(store, { adminToken, log: quiet, ...(now ? { now } : {}) });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (await reports(req, res, url)) return;
    if (await online(req, res, url)) return;
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    setServerErrorSink(null);
    await new Promise(r => server.close(r));
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const call = (p, { method = 'GET', body, token, headers = {} } = {}) => fetch(base + p, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { dir, store, reports, base, call };
}

function liveCounts(db) {
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
  return Object.fromEntries(names.map(n => [n, db.prepare(`SELECT COUNT(*) AS n FROM "${n}"`).get().n]));
}

async function seedAccounts(call, n = 3) {
  for (let i = 0; i < n; i++) assert.equal((await call('/api/account', { method: 'POST', body: {} })).status, 201);
}

test('snapshot: consistent copy with the same row counts, latest.json written', async t => {
  const { dir, store, call } = await setup(t);
  await seedAccounts(call, 4);
  await call('/api/report/feedback', { method: 'POST', body: { text: '测试反馈', page: 'wa' } });
  const when = Date.UTC(2026, 8, 28, 3, 7);
  const snap = await createSnapshot(store.db, dir, { now: when, log: quiet });
  assert.equal(snap.file, 'online-20260928-0307.db');
  assert.ok(existsSync(path.join(backupDirOf(dir), snap.file)));
  const live = liveCounts(store.db);
  assert.equal(live.accounts, 4);
  assert.equal(live.reports, 1);
  const { tables, check } = await inspectSnapshot(snap.path);
  assert.equal(check, 'ok');
  assert.deepEqual(tables, live);
  const latest = readLatest(dir);
  assert.equal(latest.file, snap.file);
  assert.equal(latest.time, new Date(when).toISOString());
  assert.equal(latest.bytes, snap.bytes);
  assert.deepEqual(latest.tables, live);
  // No temp file left behind.
  assert.deepEqual(readdirSync(backupDirOf(dir)).sort(), ['latest.json', snap.file]);
});

test('rotation keeps the newest per day for 7 days plus 4 Sundays', () => {
  const names = [];
  // 40 days back from Mon 2026-09-28, two snapshots a day.
  for (let d = 0; d < 40; d++) {
    const day = Date.UTC(2026, 8, 28) - d * 86400e3;
    names.push(snapshotName(day + 3 * 3600e3), snapshotName(day + 15 * 3600e3));
  }
  const { keep, remove } = planRotation(names);
  const daily = ['20260928', '20260927', '20260926', '20260925', '20260924', '20260923', '20260922'].map(d => `online-${d}-1500.db`);
  // Sundays: 09-27 (already daily), 09-20, 09-13, 09-06.
  const weekly = ['20260920', '20260913', '20260906'].map(d => `online-${d}-1500.db`);
  assert.deepEqual(keep, [...daily, ...weekly].sort().reverse());
  assert.equal(keep.length + remove.length, names.length);

  const dir = mkdtempSync(path.join(tmpdir(), 'rotate-'));
  try {
    for (const n of names) writeFileSync(path.join(dir, n), 'x');
    writeFileSync(path.join(dir, 'unrelated.txt'), 'keep me');
    rotateSnapshots(dir);
    assert.deepEqual(listSnapshots(dir), keep);
    assert.ok(existsSync(path.join(dir, 'unrelated.txt')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('scheduler takes a snapshot after boot only when none is recent', async t => {
  const { dir, store } = await setup(t);
  const sched = startBackupScheduler(store, dir, { log: quiet, bootDelayMs: 5, checkEveryMs: 60000 });
  t.after(() => sched.stop());
  for (let i = 0; i < 100 && !listSnapshots(backupDirOf(dir)).length; i++) await new Promise(r => setTimeout(r, 20));
  assert.equal(listSnapshots(backupDirOf(dir)).length, 1);
  assert.equal(sched.due(), false);
  const later = startBackupScheduler(store, dir, { log: quiet, bootDelayMs: 60000, now: () => Date.now() + 25 * 3600e3 });
  t.after(() => later.stop());
  assert.equal(later.due(), true);
});

test('admin endpoints: 404 without ADMIN_TOKEN, 401 wrong token, 200 gzip with the right one', async t => {
  const off = await setup(t, { adminToken: '' });
  for (const p of ['/api/admin/stats', '/api/admin/reports', '/api/admin/backup/latest']) {
    assert.equal((await off.call(p, { token: 'anything' })).status, 404, p);
  }
  assert.equal(off.reports.adminEnabled, false);

  const { dir, store, call } = await setup(t);
  await seedAccounts(call, 2);
  assert.equal((await call('/api/admin/stats')).status, 401);
  assert.equal((await call('/api/admin/stats', { token: ADMIN + 'x' })).status, 401);
  assert.equal((await call('/api/admin/backup/latest', { token: 'short' })).status, 401);
  assert.equal((await call('/api/admin/backup/latest', { token: ADMIN })).status, 404); // no snapshot yet
  const snap = await createSnapshot(store.db, dir, { log: quiet });
  const res = await call('/api/admin/backup/latest', { token: ADMIN });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/gzip');
  assert.equal(res.headers.get('x-backup-file'), snap.file);
  const raw = gunzipSync(Buffer.from(await res.arrayBuffer()));
  assert.equal(raw.subarray(0, 16).toString('latin1'), 'SQLite format 3\u0000');
  const copy = path.join(dir, 'downloaded.db');
  writeFileSync(copy, raw);
  assert.deepEqual((await inspectSnapshot(copy)).tables, snap.tables);

  const stats = await (await call('/api/admin/stats', { token: ADMIN })).json();
  assert.equal(stats.backup.file, snap.file);
  assert.deepEqual(stats.backups, [snap.file]);

});

test('admin lockout: 5 wrong passwords from one IP lock it for 15 minutes', async t => {
  let clock = Date.UTC(2026, 8, 28, 12);
  const { call } = await setup(t, { now: () => clock });
  for (let i = 0; i < ADMIN_IP_FAILS; i++) assert.equal((await call('/api/admin/stats', { token: 'guess' + i })).status, 401);
  // Locked: even the right password is refused, with a Chinese message.
  const locked = await call('/api/admin/stats', { token: ADMIN });
  assert.equal(locked.status, 429);
  assert.match((await locked.json()).error, /15 分钟/);
  assert.ok(Number(locked.headers.get('retry-after')) > 0);
  clock += 14 * 60 * 1000;
  assert.equal((await call('/api/admin/stats', { token: ADMIN })).status, 429);
  clock += 2 * 60 * 1000;
  assert.equal((await call('/api/admin/stats', { token: ADMIN })).status, 200);
  // Failures spread wider than the 15-minute window never lock.
  for (let i = 0; i < 8; i++) {
    assert.equal((await call('/api/admin/stats', { token: 'slow' + i })).status, 401);
    clock += 4 * 60 * 1000;
  }
  assert.equal((await call('/api/admin/stats', { token: ADMIN })).status, 200);
});

test('admin lockout: 50 failures from anywhere within an hour lock all admin endpoints for an hour', () => {
  const guard = new AdminGuard();
  let t = 1_000_000;
  // Many IPs, 2 failures each: no per-IP lock, but the global counter fills up.
  for (let i = 0; i < ADMIN_GLOBAL_FAILS - 1; i++) {
    guard.check('ip' + Math.floor(i / 2), t);
    guard.fail('ip' + Math.floor(i / 2), t);
    t += 1000;
  }
  guard.check('fresh-ip', t); // still open
  guard.fail('another', t);
  assert.throws(() => guard.check('fresh-ip', t), e => e.status === 429 && /1 小时/.test(e.message));
  assert.throws(() => guard.check('fresh-ip', t + 59 * 60 * 1000), e => e.status === 429);
  guard.check('fresh-ip', t + 61 * 60 * 1000);
  // Failures older than an hour fall out of the global window.
  const g2 = new AdminGuard();
  for (let i = 0; i < ADMIN_GLOBAL_FAILS - 1; i++) g2.fail('ip' + (i % 20) + 'x' + i, 0);
  g2.fail('late', 61 * 60 * 1000);
  g2.check('any', 61 * 60 * 1000);
});

test('admin lockout over HTTP: global lock applies to correct passwords too', async t => {
  const { call, reports } = await setup(t);
  const now = Date.now();
  for (let i = 0; i < ADMIN_GLOBAL_FAILS; i++) reports.adminGuard.fail('elsewhere' + i, now);
  const res = await call('/api/admin/backup/latest', { token: ADMIN });
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /锁定/);
});

test('pull-backup saves a verified .db.gz, keeps the newest N and fails non-zero on a bad token', async t => {
  const { dir, store, base } = await setup(t);
  await createSnapshot(store.db, dir, { log: quiet });
  const dest = path.join(dir, 'offsite');
  for (let d = 1; d <= 4; d++) {
    const r = await pullBackup({ url: base, dest, token: ADMIN, keep: 3, now: new Date(2026, 8, d), log: quiet });
    assert.ok(r.rawBytes > 0);
  }
  assert.deepEqual(readdirSync(dest).sort(), ['online-20260902.db.gz', 'online-20260903.db.gz', 'online-20260904.db.gz']);
  await assert.rejects(pullBackup({ url: base, dest, token: 'wrong', log: quiet }), /401/);
  assert.equal(readdirSync(dest).filter(f => f.endsWith('.part')).length, 0);
});

test('error reports: stored, grouped by fingerprint, rate limited, same-origin only', async t => {
  const { store, call } = await setup(t);
  const err = { page: 'wa', version: 'v0.9.7', path: '/wa/?x=secret', viewport: '390x844', message: 'Cannot read properties of undefined (reading \'hp\')', stack: 'TypeError: x\n    at render (https://h/app.js:10:5)', context: { screen: 'map', act: 2, turn: 3, token: 'abc', nickname: 'me' } };
  assert.equal((await call('/api/report/error', { method: 'POST', body: err })).status, 200);
  const second = await (await call('/api/report/error', { method: 'POST', body: err })).json();
  assert.equal(second.grouped, true);
  const rows = store.db.prepare("SELECT * FROM reports WHERE kind = 'error'").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 2);
  assert.equal(rows[0].path, '/wa/');
  const ctx = JSON.parse(rows[0].context);
  assert.deepEqual(ctx, { screen: 'map', act: 2, turn: 3 });
  assert.match(rows[0].ip_hash, /^[0-9a-f]{24}$/);
  assert.notEqual(rows[0].ip_hash, '127.0.0.1');
  assert.equal(rows[0].fingerprint, fingerprintOf('error', 'wa', err.message, err.stack));
  assert.equal((await call('/api/report/error', { method: 'POST', body: { page: 'wa' } })).status, 400);
  assert.equal((await call('/api/report/error', { method: 'POST', body: err, headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await call('/api/report/error')).status, 405);
  assert.equal((await call('/api/report/error', { method: 'POST', body: { message: 'x'.repeat(20000) } })).status, 413);
  let limited = 0;
  for (let i = 0; i < ERROR_LIMIT + 2; i++) if ((await call('/api/report/error', { method: 'POST', body: { ...err, message: 'm' + i } })).status === 429) limited++;
  assert.ok(limited >= 2);
});

test('feedback: stored with category and coarse context, length and rate limits', async t => {
  const { store, call } = await setup(t);
  const ok = await call('/api/report/feedback', { method: 'POST', body: { text: '  第二幕 Boss 太难  ', category: '平衡', page: 'new', version: 'v0.9.7', context: { phase: 'combat', act: 2, secretKey: 'x' }, recentErrors: ['a', 'b', 'c', 'd'] } });
  assert.equal(ok.status, 200);
  const row = store.db.prepare("SELECT * FROM reports WHERE kind = 'feedback'").get();
  assert.equal(row.message, '第二幕 Boss 太难');
  assert.equal(row.category, '平衡');
  assert.equal(row.page, 'new');
  assert.deepEqual(JSON.parse(row.context), { phase: 'combat', act: 2, recentErrors: 'a | b | c' });
  assert.equal((await call('/api/report/feedback', { method: 'POST', body: { text: '   ' } })).status, 400);
  assert.equal((await call('/api/report/feedback', { method: 'POST', body: { text: '字'.repeat(1001) } })).status, 413);
  const bad = await call('/api/report/feedback', { method: 'POST', body: { text: 'x', category: 'hack' } });
  assert.equal(bad.status, 200);
  assert.equal(store.db.prepare("SELECT category FROM reports WHERE message = 'x'").get().category, null);
  let status = 0;
  for (let i = 0; i < FEEDBACK_LIMIT; i++) status = (await call('/api/report/feedback', { method: 'POST', body: { text: 'more ' + i } })).status;
  assert.equal(status, 429);
});

test('信箱 letters: subject, receipt only reveals its own status, admin marks 已读 / 采纳 / 已修复 / 忽略', async t => {
  const { store, call } = await setup(t);
  const a = await (await call('/api/report/feedback', { method: 'POST', body: { subject: '关于\n商店', text: '价格偏高', category: '平衡', page: 'wa' } })).json();
  const b = await (await call('/api/report/feedback', { method: 'POST', body: { text: '第二封', page: 'new' } })).json();
  assert.match(a.receipt, /^[0-9a-f]{32}$/);
  assert.notEqual(a.receipt, b.receipt);
  const row = store.db.prepare("SELECT * FROM reports WHERE kind = 'feedback' ORDER BY id").get();
  assert.equal(row.subject, '关于 商店');
  assert.equal(row.status, 'new');
  assert.notEqual(row.receipt_hash, a.receipt); // only the hash is stored
  const status = async receipts => (await (await call('/api/report/letters/status', { method: 'POST', body: { receipts } })).json()).statuses;
  assert.deepEqual(await status([a.receipt]), { [a.receipt]: 'new' });
  assert.deepEqual(await status(['0'.repeat(32), 'not-hex', 42]), {});
  const list = await (await call('/api/admin/reports', { token: ADMIN })).json();
  const letterA = list.feedback.find(f => f.text === '价格偏高');
  assert.equal(letterA.subject, '关于 商店');
  for (const s of ['read', 'adopted', 'fixed', 'ignored']) {
    const r = await call('/api/admin/reports', { method: 'PATCH', token: ADMIN, body: { id: letterA.id, status: s } });
    assert.equal((await r.json()).changes, 1);
    assert.deepEqual(await status([a.receipt, b.receipt]), { [a.receipt]: s, [b.receipt]: 'new' });
  }
  assert.equal((await call('/api/admin/reports', { method: 'PATCH', token: ADMIN, body: { id: letterA.id, status: 'public' } })).status, 400);
  const stats = await (await call('/api/admin/stats', { token: ADMIN })).json();
  assert.deepEqual(stats.letters, { ignored: 1, new: 1 });
});

test('admin reports: grouped errors, feedback list, resolve by fingerprint', async t => {
  const { call } = await setup(t);
  for (const v of ['v0.9.6', 'v0.9.7']) await call('/api/report/error', { method: 'POST', body: { page: 'pvp', version: v, message: 'Boom 42', stack: 'Error\n at x (/pvp/client.js:1:2)' } });
  await call('/api/report/error', { method: 'POST', body: { page: 'pvp', version: 'v0.9.7', message: 'Boom 43', stack: 'Error\n at x (/pvp/client.js:1:9)' } });
  await call('/api/report/feedback', { method: 'POST', body: { text: '好玩', category: '建议', page: 'wa' } });
  const list = await (await call('/api/admin/reports?since=24h', { token: ADMIN })).json();
  assert.equal(list.errors.length, 1); // numbers and columns are normalised away
  assert.equal(list.errors[0].count, 3);
  assert.deepEqual(list.errors[0].versions.sort(), ['v0.9.6', 'v0.9.7']);
  assert.equal(list.feedback.length, 1);
  assert.equal(list.feedback[0].category, '建议');
  const onlyWa = await (await call('/api/admin/reports?page=wa', { token: ADMIN })).json();
  assert.equal(onlyWa.errors.length, 0);
  const patch = await call('/api/admin/reports', { method: 'PATCH', token: ADMIN, body: { fingerprint: list.errors[0].fingerprint, resolved: true } });
  assert.equal((await patch.json()).changes, 1);
  const stats = await (await call('/api/admin/stats', { token: ADMIN })).json();
  assert.equal(stats.last24h.byKind.error, 3);
  assert.equal(stats.last24h.byKind.feedback, 1);
  assert.equal(stats.unresolvedGroups7d, 0);
});

test('server-error hook records an error thrown inside an API handler', async t => {
  const { store, reports } = await setup(t);
  setServerErrorSink(reports.recordServerError);
  const broken = Object.create(store);
  broken.getAccountByTokenHash = () => { throw new Error('database exploded'); };
  const handler = createOnlineHandler(broken);
  const server = http.createServer((req, res) => handler(req, res, new URL(req.url, 'http://localhost')));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const origError = console.error;
  console.error = () => {};
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/account`, { headers: { Authorization: 'Bearer ' + 'a'.repeat(64) } });
    assert.equal(res.status, 500);
    // Direct sendError path as well (the replay worker failures end here too).
    const fake = { req: { method: 'POST', url: '/api/archive/claim?x=1' }, writeHead() {}, end() {} };
    sendError(fake, new Error('replay worker died: boom'));
  } finally { console.error = origError; }
  const rows = store.db.prepare("SELECT * FROM reports WHERE kind = 'server-error' ORDER BY id").all();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].message, 'database exploded');
  assert.equal(JSON.parse(rows[0].context).route, '/api/account');
  assert.equal(JSON.parse(rows[1].context).route, '/api/archive/claim');
  assert.ok(rows[0].stack.includes('database exploded'));
});

test('reports older than 90 days are purged', async t => {
  const { store } = await setup(t);
  store.db.prepare("INSERT INTO reports (kind, day, created_at, last_at, message) VALUES ('feedback', '2026-01-01', 1, 1, 'old')").run();
  store.db.prepare("INSERT INTO reports (kind, day, created_at, last_at, message) VALUES ('feedback', '2026-09-27', ?, ?, 'new')").run(Date.now(), Date.now());
  createReportHandler(store, { adminToken: '', log: quiet });
  assert.deepEqual(store.db.prepare('SELECT message FROM reports').all().map(r => r.message), ['new']);
});

test('server: /admin/ page only exists when ADMIN_TOKEN is set', async t => {
  await loadSqlite();
  for (const token of ['', ADMIN]) {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'admin-page-'));
    const child = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ADMIN_TOKEN: token, BACKUPS: 'off' }, windowsHide: true,
    });
    const exited = new Promise(r => child.once('exit', r));
    try {
      const port = await new Promise((resolve, reject) => {
        let out = '';
        const timer = setTimeout(() => reject(Error('startup timeout')), 10000);
        child.stdout.on('data', c => { out += c; const m = out.match(/0\.0\.0\.0:(\d+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
        child.once('exit', code => { clearTimeout(timer); reject(Error('exit ' + code)); });
      });
      const page = await fetch(`http://127.0.0.1:${port}/admin/`);
      const api = await fetch(`http://127.0.0.1:${port}/api/admin/stats`);
      if (token) {
        assert.equal(page.status, 200);
        assert.match(await page.text(), /管理员登录/);
        assert.equal(page.headers.get('x-robots-tag'), 'noindex');
        assert.equal(api.status, 401);
      } else {
        assert.equal(page.status, 404);
        assert.equal(api.status, 404);
      }
      const js = await fetch(`http://127.0.0.1:${port}/shared/error-report.js`);
      assert.equal(js.status, 200);
      const report = await fetch(`http://127.0.0.1:${port}/api/report/error`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'landing', message: 'smoke' }) });
      assert.equal(report.status, 200);
    } finally {
      child.kill();
      await exited;
      rmSync(dataDir, { recursive: true, force: true });
    }
  }
});
