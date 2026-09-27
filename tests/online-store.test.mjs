// SQLite store: one-time migration of the legacy online-data.json, row-level units of
// work, concurrency of room actions, read-only polls that do not write, reopen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openStore, sha256 } from '../online/store.mjs';
import { createOnlineHandler } from '../online/api.mjs';

const FIXTURE = new URL('./fixtures/legacy-online-data.json', import.meta.url);
const TOKENS = JSON.parse(await readFile(new URL('./fixtures/legacy-online-tokens.json', import.meta.url), 'utf8'));
const quiet = { log() {}, warn() {} };

async function request(handler, { method = 'GET', path: p = '/', token = null, body = null } = {}) {
  const req = {
    method, url: p, headers: {}, socket: { remoteAddress: '127.0.0.1' },
    on(event, cb) {
      if (event === 'data' && body) cb(Buffer.from(JSON.stringify(body)));
      if (event === 'end') cb();
    },
  };
  if (token) req.headers.authorization = `Bearer ${token}`;
  const res = { statusCode: 0, body: '', writeHead(s) { this.statusCode = s; }, end(d) { this.body = d || ''; } };
  await handler(req, res, new URL(p, 'http://localhost'));
  let parsed = null;
  try { parsed = JSON.parse(res.body); } catch {}
  return { status: res.statusCode, body: parsed };
}

const plain = value => JSON.parse(JSON.stringify(value));
function normalizeLegacy(data) {
  const out = plain({ accounts: data.accounts, rooms: data.rooms });
  for (const room of Object.values(out.rooms)) room.requests ||= {};
  for (const acct of Object.values(out.accounts)) acct.processedCheckpoints ||= {};
  return out;
}
const totalChanges = store => store.db.prepare('SELECT total_changes() AS n').get().n;

test('迁移：旧 online-data.json 一次性导入 SQLite，数据逐项一致，原文件改名保留', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wa-migrate-'));
  try {
    const legacy = JSON.parse(await readFile(FIXTURE, 'utf8'));
    await copyFile(FIXTURE, path.join(dir, 'online-data.json'));
    let store = await openStore({ dataDir: dir, log: quiet, housekeeping: false });
    assert.equal(store.migration.status, 'migrated');
    assert.deepEqual(store.migration.counts, { accounts: 4, archives: 9, checkpoints: 1, rooms: 2, roomRequests: 2 });
    const files = await readdir(dir);
    assert.ok(!files.includes('online-data.json'));
    const kept = files.find(f => /^online-data\.migrated-.+\.json$/.test(f));
    assert.ok(kept, files.join(','));
    assert.equal(await readFile(path.join(dir, kept), 'utf8'), await readFile(FIXTURE, 'utf8'));
    assert.deepEqual(plain(store.loadAll().accounts), normalizeLegacy(legacy).accounts);
    assert.deepEqual(plain(store.loadAll().rooms), normalizeLegacy(legacy).rooms);

    // Server time frozen just after the fixture was recorded, so its turn timers hold.
    const recordedAt = Math.max(...Object.values(legacy.rooms).map(r => r.lastActionAt));
    const handler = createOnlineHandler(store, { now: () => recordedAt + 1000 });
    const acctA = await request(handler, { path: '/api/account', token: TOKENS.A });
    assert.equal(acctA.status, 200);
    assert.equal(acctA.body.archives.length, 3);
    assert.equal(acctA.body.roomCode, TOKENS.activeRoom);
    // The verified claim is remembered: claiming the same checkpoint again is a no-op.
    const run = JSON.parse(await readFile(new URL('./fixtures/rules1-claim.json', import.meta.url), 'utf8'));
    const again = await request(handler, { method: 'POST', path: '/api/archive/claim', token: TOKENS.A, body: { run, act: 1 } });
    assert.equal(again.body.status, 'saved');
    assert.equal((await request(handler, { path: '/api/account', token: TOKENS.A })).body.archives.length, 3);

    const active = await request(handler, { path: `/api/rooms/${TOKENS.activeRoom}`, token: TOKENS.A });
    assert.equal(active.status, 200);
    assert.equal(active.body.room.status, 'active');
    const rev = active.body.room.match.rev;
    // The idempotency record of the action sent before the migration survived.
    const replays = await Promise.all([TOKENS.A, TOKENS.B].map(token => request(handler, {
      method: 'POST', path: `/api/rooms/${TOKENS.activeRoom}/action`, token,
      body: { requestId: 'legacy-end-1', expectedRev: rev - 1, command: { type: 'end' } },
    })));
    assert.deepEqual(replays.map(r => r.status).sort(), [200, 409]);
    assert.equal(replays.find(r => r.status === 200).body.room.match.rev, rev);
    const finished = await request(handler, { path: `/api/rooms/${TOKENS.finishedRoom}`, token: TOKENS.C });
    assert.equal(finished.body.room.status, 'finished');
    assert.equal(finished.body.room.match.winner, 0);

    // Reopen: nothing to migrate, same data.
    const countsBefore = store.counts();
    await store.close();
    store = await openStore({ dataDir: dir, log: quiet, housekeeping: false });
    assert.equal(store.migration.status, 'none');
    assert.deepEqual(store.counts(), countsBefore);

    // Crash between commit and rename: the same file again is only renamed, not re-imported.
    await store.close();
    await copyFile(FIXTURE, path.join(dir, 'online-data.json'));
    store = await openStore({ dataDir: dir, log: quiet, housekeeping: false });
    assert.equal(store.migration.status, 'renamed');
    assert.deepEqual(store.counts(), countsBefore);
    assert.ok(!(await readdir(dir)).includes('online-data.json'));

    // A different legacy file after the migration is never merged over newer data.
    await store.close();
    const other = structuredClone(legacy);
    other.accounts = {};
    await writeFile(path.join(dir, 'online-data.json'), JSON.stringify(other));
    store = await openStore({ dataDir: dir, log: quiet, housekeeping: false });
    assert.equal(store.migration.status, 'skipped');
    assert.deepEqual(store.counts(), countsBefore);
    assert.ok((await readdir(dir)).includes('online-data.json'));
    await store.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('迁移失败（文件损坏）不留下半个数据库，原文件不动', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wa-migrate-bad-'));
  try {
    await writeFile(path.join(dir, 'online-data.json'), '{"accounts": {"x": ');
    await assert.rejects(openStore({ dataDir: dir, log: quiet }));
    assert.ok((await readdir(dir)).includes('online-data.json'));
    const store = await openStore({ filename: path.join(dir, 'probe.db'), dataDir: path.join(dir, 'empty'), log: quiet });
    assert.equal(store.counts().accounts, 0);
    await store.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function activeRoom(store, handler) {
  const SNAP = JSON.parse(await readFile(FIXTURE, 'utf8')).accounts;
  const snapshot = Object.values(SNAP)[0].archives[0].snapshot;
  const tokens = [];
  for (let i = 0; i < 2; i++) {
    const token = (await request(handler, { method: 'POST', path: '/api/account' })).body.token;
    await store.transaction(async data => {
      Object.values(data.accounts).find(a => a.tokenHash === sha256(token)).archives.push({ id: `arc${i}`, name: 'x', createdAt: 1, snapshot });
    });
    tokens.push(token);
  }
  const code = (await request(handler, { method: 'POST', path: '/api/rooms', token: tokens[0], body: { archiveId: 'arc0' } })).body.room.code;
  await request(handler, { method: 'POST', path: '/api/rooms/join', token: tokens[1], body: { code, archiveId: 'arc1' } });
  await request(handler, { method: 'POST', path: `/api/rooms/${code}/ready`, token: tokens[0], body: { ready: true } });
  const room = (await request(handler, { method: 'POST', path: `/api/rooms/${code}/ready`, token: tokens[1], body: { ready: true } })).body.room;
  return { code, tokens, room };
}

test('并发：同一修订号的多个行动只有一个生效；同一请求 ID 重放幂等；数据重开后仍在', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wa-conc-'));
  let store = await openStore({ dataDir: dir, log: quiet });
  try {
    let handler = createOnlineHandler(store);
    const { code, tokens, room } = await activeRoom(store, handler);
    const activeToken = tokens[room.match.active === room.seat ? 1 : 0];
    const rev = room.match.rev;
    const racers = await Promise.all(Array.from({ length: 12 }, (_, i) => request(handler, {
      method: 'POST', path: `/api/rooms/${code}/action`, token: activeToken,
      body: { requestId: `race-${i}`, expectedRev: rev, command: { type: 'end' } },
    })));
    assert.equal(racers.filter(r => r.status === 200).length, 1);
    assert.equal(racers.filter(r => r.status === 409).length, 11);
    const winner = racers.findIndex(r => r.status === 200);
    const dupes = await Promise.all(Array.from({ length: 6 }, () => request(handler, {
      method: 'POST', path: `/api/rooms/${code}/action`, token: activeToken,
      body: { requestId: `race-${winner}`, expectedRev: rev, command: { type: 'end' } },
    })));
    assert.ok(dupes.every(r => r.status === 200 && r.body.room.match.rev === rev + 1));
    const misuse = await request(handler, { method: 'POST', path: `/api/rooms/${code}/action`, token: activeToken,
      body: { requestId: `race-${winner}`, expectedRev: rev, command: { type: 'concede' } } });
    assert.equal(misuse.status, 409);

    await store.close();
    store = await openStore({ dataDir: dir, log: quiet });
    handler = createOnlineHandler(store);
    const after = await request(handler, { path: `/api/rooms/${code}`, token: tokens[0] });
    assert.equal(after.body.room.match.rev, rev + 1);
    const replay = await request(handler, { method: 'POST', path: `/api/rooms/${code}/action`, token: activeToken,
      body: { requestId: `race-${winner}`, expectedRev: rev, command: { type: 'end' } } });
    assert.equal(replay.status, 200);
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('只读请求不写库：轮询房间和读取账户不产生任何写入；计时到期才写', async () => {
  const store = await openStore({ filename: ':memory:' });
  const clock = { t: 1_800_000_000_000 };
  try {
    const handler = createOnlineHandler(store, { now: () => clock.t, turnMs: 60_000 });
    const { code, tokens } = await activeRoom(store, handler);
    const before = totalChanges(store);
    for (let i = 0; i < 5; i++) {
      assert.equal((await request(handler, { path: `/api/rooms/${code}`, token: tokens[i % 2] })).status, 200);
      assert.equal((await request(handler, { path: '/api/account', token: tokens[0] })).status, 200);
    }
    assert.equal(totalChanges(store), before);
    clock.t += 61_000;
    const expired = await request(handler, { path: `/api/rooms/${code}`, token: tokens[0] });
    assert.equal(expired.body.room.match.turn, 2);
    assert.ok(totalChanges(store) > before);
    assert.equal((await store.transaction(async d => d.rooms[code].match.turn)), 2);
  } finally {
    await store.close();
  }
});

test('清理：一周前结束的房间和两天无人动的房间被删除，账户随之释放', async () => {
  const store = await openStore({ filename: ':memory:' });
  try {
    const now = Date.now();
    await store.transaction(async data => {
      data.accounts.a1 = { accountId: 'a1', tokenHash: 'h1', archives: [], pending: null, roomCode: 'OLDDONE1', createdAt: now };
      data.accounts.a2 = { accountId: 'a2', tokenHash: 'h2', archives: [], pending: null, roomCode: 'FRESH001', createdAt: now };
      data.rooms.OLDDONE1 = { code: 'OLDDONE1', status: 'finished', createdAt: now - 9e8, lastActionAt: now - 8 * 864e5, members: [] };
      data.rooms.IDLEWAIT = { code: 'IDLEWAIT', status: 'waiting', createdAt: now - 3 * 864e5, lastActionAt: now - 3 * 864e5, members: [] };
      data.rooms.FRESH001 = { code: 'FRESH001', status: 'finished', createdAt: now, lastActionAt: now, members: [] };
    });
    assert.equal(store.purgeRooms(now), 2);
    const data = store.loadAll();
    assert.deepEqual(Object.keys(data.rooms), ['FRESH001']);
    assert.equal(data.accounts.a1.roomCode, null);
    assert.equal(data.accounts.a2.roomCode, 'FRESH001');
  } finally {
    await store.close();
  }
});

test('回滚导出：tools/export-online-json.mjs 把 SQLite 导回旧 JSON，再导入得到同样的数据', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wa-export-'));
  try {
    const legacy = JSON.parse(await readFile(FIXTURE, 'utf8'));
    await copyFile(FIXTURE, path.join(dir, 'online-data.json'));
    const store = await openStore({ dataDir: dir, log: quiet, housekeeping: false });
    const counts = store.counts();
    const out = path.join(dir, 'exported.json');
    const ran = spawnSync(process.execPath, ['tools/export-online-json.mjs', dir, out], { encoding: 'utf8' });
    assert.equal(ran.status, 0, ran.stderr);
    await store.close();
    const exported = JSON.parse(await readFile(out, 'utf8'));
    assert.deepEqual(normalizeLegacy(exported), normalizeLegacy(legacy));
    const dir2 = path.join(dir, 'again');
    await import('node:fs/promises').then(fs => fs.mkdir(dir2));
    await copyFile(out, path.join(dir2, 'online-data.json'));
    const store2 = await openStore({ dataDir: dir2, log: quiet, housekeeping: false });
    assert.deepEqual(store2.counts(), counts);
    await store2.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});