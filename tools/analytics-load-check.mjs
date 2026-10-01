// Quick local load check for the play statistics (online/analytics-api.mjs).
//   node tools/analytics-load-check.mjs [--visitors 300] [--minutes 10] [--players 1000]
// 1. HTTP: <visitors> browsers each send a batch every 30 s (page_view + heartbeats)
//    for <minutes> simulated minutes, as fast as possible against a local server on a
//    temp database; prints batches per second and latency.
// 2. Growth: simulates one day of <players> players (20 min of play, one run with
//    ~8 fights, a few extra events) and prints the database growth.
import http from 'node:http';
import { mkdtempSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../online/store.mjs';
import { createAnalyticsHandler, cleanBatch } from '../online/analytics-api.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? Number(process.argv[i + 1]) : def; };
const VISITORS = arg('visitors', 300);
const MINUTES = arg('minutes', 10);
const PLAYERS = arg('players', 1000);
const quiet = { log() {}, warn() {}, error() {} };
const vid = i => 'load' + String(i).padStart(8, '0');

const dir = mkdtempSync(path.join(tmpdir(), 'analytics-load-'));
const store = await openStore({ dataDir: dir, housekeeping: false, log: quiet });
const analytics = createAnalyticsHandler(store, { log: quiet });
const server = http.createServer(async (req, res) => { if (!(await analytics(req, res, new URL(req.url, 'http://x')))) { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const agent = new http.Agent({ keepAlive: true, maxSockets: 32 });
function post(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(base + '/api/analytics', { method: 'POST', agent, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'X-Real-IP': body.v } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end(data);
  });
}

// ---- 1. heartbeat load over HTTP
const rounds = MINUTES * 2; // one batch per visitor every 30 s
const lat = [];
const statuses = {};
const t0 = performance.now();
for (let r = 0; r < rounds; r++) {
  await Promise.all(Array.from({ length: VISITORS }, async (_, i) => {
    const t = Date.now();
    const events = r === 0 ? [{ n: 'page_view', t }] : r % 2 === 0 ? [{ n: 'heartbeat', t }] : [];
    const s = performance.now();
    const code = await post({ v: vid(i), s: 'sess' + i, page: i % 3 ? 'wa' : 'new', dev: i % 4 ? 'phone' : 'desktop', br: 'chrome', now: t, events });
    lat.push(performance.now() - s);
    statuses[code] = (statuses[code] || 0) + 1;
  }));
}
const secs = (performance.now() - t0) / 1000;
lat.sort((a, b) => a - b);
const q = p => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))].toFixed(1);
console.log(`HTTP：${VISITORS} 位访客 × ${rounds} 批（模拟 ${MINUTES} 分钟）= ${lat.length} 次请求，用时 ${secs.toFixed(1)} 秒，约 ${(lat.length / secs).toFixed(0)} 批/秒`);
console.log(`  延迟 p50 ${q(0.5)} ms · p95 ${q(0.95)} ms · p99 ${q(0.99)} ms；状态 ${JSON.stringify(statuses)}`);
console.log(`  真实负载：${VISITORS} 人同时在线每 30 秒最多 ${VISITORS} 批，即 ${(VISITORS / 30).toFixed(0)} 批/秒`);

// ---- 2. DB growth per day of players
const dbFile = path.join(dir, 'online.db');
const size = () => statSync(dbFile).size + (existsSync(dbFile + '-wal') ? statSync(dbFile + '-wal').size : 0);
store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const before = size();
const rowsBefore = store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
const day = Date.now() + 3 * 24 * 3600e3;
for (let i = 0; i < PLAYERS; i++) {
  const v = 'grow' + String(i).padStart(8, '0');
  const page = i % 2 ? 'wa' : 'new';
  const demo = page;
  let t = day + i * 50;
  const send = events => { analytics.ingest(cleanBatch({ v, s: 'sess' + i, page, dev: 'phone', br: 'safari', now: t, events: events.map(e => ({ ...e, t })) }), t); };
  send([{ n: 'page_view' }, { n: 'run_start', p: { demo, team: demo === 'wa' ? 'CN' : 'breach', asc: 0 } }]);
  for (let m = 1; m <= 20; m++) {
    t += 60e3;
    const ev = [{ n: 'heartbeat' }];
    if (m % 2 === 0 && m <= 16) ev.push({ n: 'fight_end', p: { demo, act: 1, floor: m / 2, kind: 'normal', won: true, enemy: 'E01', turns: 4 } });
    send(ev);
  }
  send([{ n: 'run_end', p: { demo, result: 'lose', act: 1, floor: 9, fights: 8, mins: 20, enemy: 'E02' } }, { n: 'achievement', p: { demo, id: 'first_win' } }]);
}
store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const grown = size() - before;
const rows = store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n - rowsBefore;
console.log(`增长：${PLAYERS} 位玩家一天（每人约 20 分钟、1 局、8 场战斗）→ 事件 ${rows} 行，汇总 ${store.db.prepare('SELECT COUNT(*) AS n FROM daily_visitors').get().n} 行，数据库 +${(grown / 1024).toFixed(0)} KB`);
console.log(`  按 1000 名每日玩家折算：约 ${((grown / PLAYERS) * 1000 / 1048576).toFixed(2)} MB/天，原始事件保留 180 天约 ${((grown / PLAYERS) * 1000 * 180 / 1048576).toFixed(0)} MB`);

await new Promise(r => server.close(r));
agent.destroy();
await store.close();
rmSync(dir, { recursive: true, force: true });
