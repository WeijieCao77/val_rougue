// Local load test for the online API (accounts, verified archive claims, PvP polling and
// actions, progress sync). NEVER point it at production: it always starts its own
// server on localhost with a throw-away DATA_DIR.
//
//   node tools/loadtest.mjs [--players 1000] [--claims 300] [--matches 100]
//                           [--syncers 300] [--duration 120] [--port 4196]
//                           [--server server.mjs] [--label new] [--out report.json]
//
// --server may point at another server entry (e.g. a pre-SQLite build) that prints
// "http://0.0.0.0:<port>" when listening; routes it does not know are skipped with
// --syncers 0. The server runs with TRUST_PROXY=1 and every simulated player sends its
// own X-Real-IP, so per-IP limits behave as they do behind the Railway proxy.
// Server RSS / CPU are sampled inside the server process (a --import probe reporting
// over IPC once per second).
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const opt = {
  players: Number(args.players ?? 1000),
  claims: Number(args.claims ?? 300),
  matches: Number(args.matches ?? 100),
  syncers: Number(args.syncers ?? 300),
  duration: Number(args.duration ?? 120),
  port: Number(args.port ?? 4196),
  server: path.resolve(ROOT, args.server ?? 'server.mjs'),
  label: args.label ?? 'sqlite',
  out: args.out,
  syncMin: Number(args['sync-min-kb'] ?? 100) * 1024,
  syncMax: Number(args['sync-max-kb'] ?? 250) * 1024,
};
if (opt.claims < opt.matches * 2) throw new Error('--claims must be at least 2 × --matches (every duelist needs a verified archive)');
if (opt.players < opt.claims || opt.players < opt.syncers) throw new Error('--players must cover --claims and --syncers');

const BASE = `http://127.0.0.1:${opt.port}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PROBE = 'data:text/javascript,' + encodeURIComponent(
  "if(process.send){let c=process.cpuUsage(),t=performance.now();setInterval(()=>{const u=process.cpuUsage(c),w=performance.now()-t;c=process.cpuUsage();t=performance.now();const m=process.memoryUsage();process.send({rss:m.rss,heap:m.heapUsed,cpu:(u.user+u.system)/1000/w});},1000).unref();}"
);

// ------------------------------------------------------------------ server
const dataDir = mkdtempSync(path.join(tmpdir(), 'loadtest-'));
const samples = [];
let phase = 'boot';
const server = spawn(process.execPath, ['--import', PROBE, opt.server], {
  cwd: ROOT,
  env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('RAILWAY_') && k !== 'DATABASE_URL')), DATA_DIR: dataDir, PORT: String(opt.port), TRUST_PROXY: '1', NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
});
server.on('message', m => samples.push({ ...m, phase, at: Date.now() }));
let serverErr = '';
server.stderr.on('data', d => { serverErr += d; if (serverErr.length > 20000) serverErr = serverErr.slice(-10000); });
await new Promise((resolve, reject) => {
  let out = '';
  const timer = setTimeout(() => reject(new Error('server start timeout')), 15000);
  server.stdout.on('data', d => { out += d; if (out.includes('http://0.0.0.0:')) { clearTimeout(timer); resolve(); } });
  server.on('exit', code => reject(new Error(`server exited ${code}: ${serverErr}`)));
});
const stopServer = () => new Promise(r => { if (server.exitCode !== null) return r(); server.once('exit', r); server.kill('SIGTERM'); setTimeout(() => server.kill('SIGKILL'), 5000).unref(); });

// ------------------------------------------------------------------ http + metrics
const stats = new Map();
function record(route, ms, status, expected) {
  let s = stats.get(route);
  if (!s) stats.set(route, s = { lat: [], ok: 0, expected: 0, err: 0, codes: {} });
  s.lat.push(ms);
  if (status >= 200 && status < 300) s.ok++;
  else if (expected?.includes(status)) s.expected++;
  else { s.err++; s.codes[status] = (s.codes[status] || 0) + 1; }
}
async function call(route, method, url, { token, ip, body, expected } = {}) {
  const headers = { 'content-type': 'application/json', 'x-real-ip': ip || '10.0.0.1' };
  if (token) headers.authorization = `Bearer ${token}`;
  const t = performance.now();
  let status = 0, json = null;
  try {
    const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    status = res.status;
    json = await res.json().catch(() => null);
  } catch { status = 599; }
  record(route, performance.now() - t, status, expected);
  return { status, json };
}
async function pool(items, concurrency, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  }));
}
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const ipOf = i => `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;

// ------------------------------------------------------------------ scenario
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
const T0 = Date.now();
const phaseTimes = {};
const players = Array.from({ length: opt.players }, (_, i) => ({ i, ip: ipOf(i + 1) }));

phase = 'accounts'; let t = Date.now();
await pool(players, 50, async p => {
  const r = await call('POST /api/account', 'POST', '/api/account', { ip: p.ip, body: {} });
  p.token = r.json?.token;
});
phaseTimes.accounts = Date.now() - t;
log(`accounts: ${players.filter(p => p.token).length}/${opt.players} in ${phaseTimes.accounts} ms`);

// Verified archive claims: the server replays the whole act (CPU heavy).
const claimRun = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/rules4-claim.json'), 'utf8'));
phase = 'claims'; t = Date.now();
const claimers = players.slice(0, opt.claims);
await pool(claimers, 16, async p => {
  const r = await call('POST /api/archive/claim', 'POST', '/api/archive/claim', { token: p.token, ip: p.ip, body: { run: claimRun, act: 1 } });
  if (r.json?.status === 'saved') {
    const acc = await call('GET /api/account', 'GET', '/api/account', { token: p.token, ip: p.ip });
    p.archiveId = acc.json?.archives?.[0]?.id;
  }
});
phaseTimes.claims = Date.now() - t;
log(`claims: ${claimers.filter(p => p.archiveId).length}/${opt.claims} in ${phaseTimes.claims} ms (${(opt.claims / (phaseTimes.claims / 1000)).toFixed(2)}/s)`);

// PvP rooms.
phase = 'rooms'; t = Date.now();
const duelists = claimers.filter(p => p.archiveId).slice(0, opt.matches * 2);
const rooms = [];
await pool(Array.from({ length: Math.floor(duelists.length / 2) }, (_, k) => k), 20, async k => {
  const [a, b] = [duelists[2 * k], duelists[2 * k + 1]];
  const created = await call('POST /api/rooms', 'POST', '/api/rooms', { token: a.token, ip: a.ip, body: { archiveId: a.archiveId } });
  const code = created.json?.room?.code;
  if (!code) return;
  await call('POST /api/rooms/join', 'POST', '/api/rooms/join', { token: b.token, ip: b.ip, body: { code, archiveId: b.archiveId } });
  await call('POST /api/rooms/:code/ready', 'POST', `/api/rooms/${code}/ready`, { token: a.token, ip: a.ip, body: { ready: true } });
  await call('POST /api/rooms/:code/ready', 'POST', `/api/rooms/${code}/ready`, { token: b.token, ip: b.ip, body: { ready: true } });
  rooms.push({ code, players: [a, b] });
});
phaseTimes.rooms = Date.now() - t;
log(`rooms: ${rooms.length}/${opt.matches} active`);

// Realistic sync bundles: a real Wa season save (actions + log) padded with more of
// the same kind of JSON, so gzip sees production-like redundancy.
const { createWaSeason, waAct, waLegalActions } = await import(pathToFileURL(path.join(ROOT, 'wa-season.js')).href);
const { RULES_VERSION, ECON_VERSION } = await import(pathToFileURL(path.join(ROOT, 'wa-rules.js')).href);
let season = createWaSeason('loadtest', false, 'CN', 'loadtest-run', { rules: RULES_VERSION, ascension: 0, mapVersion: 2, econ: ECON_VERSION, unlockTier: 0, gearTier: 0 });
for (let k = 0; k < 150; k++) {
  const acts = waLegalActions(season);
  const a = acts.find(x => x.type === 'play') || acts.find(x => x.type !== 'abandon') || acts[0];
  const r = waAct(season, a); if (r.error) break; season = r.state;
}
function makeBundle(bytes, salt) {
  const s = structuredClone(season);
  s.salt = salt;
  const history = [];
  let text = JSON.stringify(s);
  while (text.length + JSON.stringify(history).length < bytes) {
    history.push({ seed: `run-${salt}-${history.length}`, deck: season.deck.map(c => c.id), score: history.length * 37, logs: season.logs.slice(0, 20) });
  }
  return { v: 1, demo: 'wa', keys: { 'peak-season-D0.2-save-route-v6': text, 'wa-run-history-v1': JSON.stringify(history), 'wa-unlocks-v1': JSON.stringify({ xp: salt }) } };
}

phase = 'steady'; t = Date.now();
const until = Date.now() + opt.duration * 1000;
let actions = 0, syncPushes = 0;
async function duelist(room, seat) {
  const p = room.players[seat];
  let lastAct = 0;
  await sleep(Math.random() * 1000);
  while (Date.now() < until) {
    const started = Date.now();
    const r = await call('GET /api/rooms/:code', 'GET', `/api/rooms/${room.code}`, { token: p.token, ip: p.ip });
    const v = r.json?.room;
    if (v?.status === 'active' && v.match.active === v.seat && Date.now() - lastAct > 2500) {
      lastAct = Date.now();
      await call('POST /api/rooms/:code/action', 'POST', `/api/rooms/${room.code}/action`, {
        token: p.token, ip: p.ip, expected: [409],
        body: { requestId: `lt-${seat}-${v.match.rev}-${Math.random().toString(36).slice(2)}`, expectedRev: v.match.rev, command: { type: 'end' } },
      });
      actions++;
    }
    await sleep(Math.max(0, 1000 - (Date.now() - started)));
  }
}
async function syncer(p, k) {
  const size = opt.syncMin + Math.floor(Math.random() * (opt.syncMax - opt.syncMin));
  await sleep(Math.random() * 30000);
  const created = await call('POST /api/sync/code', 'POST', '/api/sync/code', { ip: p.ip, body: { demo: 'wa', bundle: makeBundle(size, k), savedAt: Date.now(), device: '电脑' } });
  if (!created.json?.syncId) return;
  let rev = created.json.rev;
  let n = 0;
  while (Date.now() + 30000 < until) {
    await sleep(30000);
    const r = await call('POST /api/sync/sync', 'POST', '/api/sync/sync', {
      ip: p.ip, body: { syncId: created.json.syncId, secret: created.json.secret, rev, dirty: true, savedAt: Date.now(), device: '电脑', bundle: makeBundle(size, k * 1000 + ++n) },
    });
    if (r.json?.rev) rev = r.json.rev;
    syncPushes++;
  }
}
await Promise.all([
  ...rooms.flatMap(room => [duelist(room, 0), duelist(room, 1)]),
  ...players.slice(opt.players - opt.syncers).map((p, k) => syncer(p, k)),
]);
phaseTimes.steady = Date.now() - t;
log(`steady: ${actions} actions, ${syncPushes} sync pushes`);
phase = 'done';
await sleep(1200);

// ------------------------------------------------------------------ report
const dbFiles = ['online.db', 'online.db-wal', 'online-data.json'].map(f => path.join(dataDir, f)).filter(existsSync);
const dbBytes = dbFiles.reduce((n, f) => n + statSync(f).size, 0);
const inPhase = ph => samples.filter(s => s.phase === ph);
const summary = arr => arr.length ? {
  rssMaxMB: +(Math.max(...arr.map(s => s.rss)) / 2 ** 20).toFixed(1),
  rssAvgMB: +(arr.reduce((n, s) => n + s.rss, 0) / arr.length / 2 ** 20).toFixed(1),
  cpuAvgPct: +(arr.reduce((n, s) => n + s.cpu, 0) / arr.length * 100).toFixed(1),
  cpuMaxPct: +(Math.max(...arr.map(s => s.cpu)) * 100).toFixed(1),
} : null;
const routes = [...stats].map(([route, s]) => ({
  route, n: s.lat.length, p50: +pct(s.lat, 50).toFixed(1), p95: +pct(s.lat, 95).toFixed(1), p99: +pct(s.lat, 99).toFixed(1),
  max: +Math.max(...s.lat).toFixed(1), errors: s.err, errorRate: +(s.err / s.lat.length * 100).toFixed(2), expected409: s.expected, codes: s.codes,
}));
const steadyReqs = routes.filter(r => /rooms\/:code$|action|sync\/sync|sync\/code/.test(r.route)).reduce((n, r) => n + r.n, 0);
const report = {
  label: opt.label, options: { ...opt, server: path.relative(ROOT, opt.server) || opt.server }, phaseTimes,
  claimsPerSecond: +(opt.claims / (phaseTimes.claims / 1000)).toFixed(2),
  steadyRequestsPerSecond: +(steadyReqs / (phaseTimes.steady / 1000)).toFixed(1),
  activeRooms: rooms.length, pvpActions: actions, syncPushes,
  server: { all: summary(samples), claims: summary(inPhase('claims')), steady: summary(inPhase('steady')) },
  dbBytes, dbMB: +(dbBytes / 2 ** 20).toFixed(2), routes,
  serverStderr: serverErr.split('\n').filter(l => l && !/ExperimentalWarning|trace-warnings/.test(l)).slice(-5),
};
console.log('\n' + opt.label + ' — per route (ms)');
console.table(routes.map(({ codes, ...r }) => r));
console.log(JSON.stringify({ phaseTimes: report.phaseTimes, claimsPerSecond: report.claimsPerSecond, steadyRequestsPerSecond: report.steadyRequestsPerSecond, server: report.server, dbMB: report.dbMB }, null, 2));
if (opt.out) writeFileSync(opt.out, JSON.stringify(report, null, 2));
await stopServer();
rmSync(dataDir, { recursive: true, force: true });
