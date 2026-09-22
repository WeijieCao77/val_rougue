import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, sha256 } from '../online/store.mjs';
import { createOnlineHandler } from '../online/api.mjs';

const CN_SNAPSHOT = {
  version: 'wa-pvp-1',
  runId: 'test-run-1',
  act: 1,
  seed: 'test-seed',
  region: 'CN',
  deck: [
    { uid: 'c1', id: 'CN01', up: true },
    { uid: 'c2', id: 'CN07', up: false },
    { uid: 'c3', id: 'CN14', up: true },
    { uid: 'c4', id: 'CN01', up: false },
    { uid: 'c5', id: 'CN07', up: true },
    { uid: 'c6', id: 'CU01', up: false },
    { uid: 'c7', id: 'CU02', up: false },
  ],
  skins: ['SK01'],
  maxHp: 80,
  hp: 80,
  money: 0,
  actionsCount: 0,
};

function createMockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = { ...this.headers, ...headers };
    },
    end(data) {
      this.body = data || '';
    },
  };
}

async function request(handler, { method = 'GET', path = '/', token = null, body = null } = {}) {
  const req = {
    method,
    url: path,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    on(event, cb) {
      if (event === 'data' && body) cb(Buffer.from(JSON.stringify(body)));
      if (event === 'end') cb();
      if (event === 'error') {}
    },
  };
  if (token) req.headers.authorization = `Bearer ${token}`;
  const res = createMockRes();
  await handler(req, res, new URL(path, 'http://localhost'));
  let parsed = null;
  try { parsed = JSON.parse(res.body); } catch {}
  return { status: res.statusCode, body: parsed };
}

async function createAccount(handler) {
  const res = await request(handler, { method: 'POST', path: '/api/account' });
  assert.equal(res.status, 201);
  return res.body.token;
}

async function addArchive(store, token, archiveId, snapshot = CN_SNAPSHOT) {
  const tokenHash = sha256(token);
  await store.transaction(async (data) => {
    const account = Object.values(data.accounts).find(a => a.tokenHash === tokenHash);
    account.archives.push({
      id: archiveId,
      name: '测试存档',
      createdAt: Date.now(),
      snapshot,
    });
  });
}

async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), 'wa-test-'));
  const store = await openStore({ dataDir: dir });
  const handler = createOnlineHandler(store);
  return { dir, store, handler };
}

async function teardown({ dir, store }) {
  await store.close();
  await rm(dir, { recursive: true, force: true });
}

test('账户创建和获取，缺失认证401', async () => {
  const { store, handler, dir } = await setup();
  try {
    const token = await createAccount(handler);
    const res = await request(handler, { method: 'GET', path: '/api/account', token });
    assert.equal(res.status, 200);
    assert.ok(res.body.accountId);
    assert.deepEqual(res.body.archives, []);

    const noToken = await request(handler, { method: 'GET', path: '/api/account' });
    assert.equal(noToken.status, 401);
    assert.ok(noToken.body.error);
  } finally {
    await teardown({ dir, store });
  }
});

test('创建房间返回实际code，join使用相同act成功，不同act拒绝', async () => {
  const { store, handler, dir } = await setup();
  try {
    const token1 = await createAccount(handler);
    const token2 = await createAccount(handler);
    await addArchive(store, token1, 'arc1');
    await addArchive(store, token2, 'arc2');

    const createRes = await request(handler, { method: 'POST', path: '/api/rooms', token: token1, body: { archiveId: 'arc1' } });
    assert.equal(createRes.status, 201);
    const code = createRes.body.room.code;
    assert.ok(code);

    const joinRes = await request(handler, { method: 'POST', path: '/api/rooms/join', token: token2, body: { code, archiveId: 'arc2' } });
    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.body.room.code, code);

    const token3 = await createAccount(handler);
    const otherActSnapshot = { ...CN_SNAPSHOT, act: 2 };
    await addArchive(store, token3, 'arc3', otherActSnapshot);
    const joinDifferent = await request(handler, { method: 'POST', path: '/api/rooms/join', token: token3, body: { code, archiveId: 'arc3' } });
    assert.equal(joinDifferent.status, 409);
  } finally {
    await teardown({ dir, store });
  }
});

test('ready启动对局，私有视图，双方行动', async () => {
  const { store, handler, dir } = await setup();
  try {
    const token1 = await createAccount(handler);
    const token2 = await createAccount(handler);
    await addArchive(store, token1, 'arc1');
    await addArchive(store, token2, 'arc2');

    const createRes = await request(handler, { method: 'POST', path: '/api/rooms', token: token1, body: { archiveId: 'arc1' } });
    const code = createRes.body.room.code;
    await request(handler, { method: 'POST', path: '/api/rooms/join', token: token2, body: { code, archiveId: 'arc2' } });

    await request(handler, { method: 'POST', path: `/api/rooms/${code}/ready`, token: token1, body: { ready: true } });
    await request(handler, { method: 'POST', path: `/api/rooms/${code}/ready`, token: token2, body: { ready: true } });

    const room1 = await request(handler, { method: 'GET', path: `/api/rooms/${code}`, token: token1 });
    assert.equal(room1.status, 200);
    assert.equal(room1.body.room.status, 'active');
    assert.ok(room1.body.room.match);
    const seat1 = room1.body.room.seat;
    const seat2 = 1 - seat1;

    const room2 = await request(handler, { method: 'GET', path: `/api/rooms/${code}`, token: token2 });
    assert.equal(room2.status, 200);
    assert.equal(room2.body.room.seat, seat2);

    assert.ok(Array.isArray(room1.body.room.match.you.hand));
    assert.ok(Array.isArray(room2.body.room.match.you.hand));
    assert.equal(room1.body.room.match.you.hand.length, room2.body.room.match.opponent.handCount);
    assert.equal(room2.body.room.match.you.hand.length, room1.body.room.match.opponent.handCount);
    assert.ok(!('hand' in room1.body.room.match.opponent));
    assert.ok(!('hand' in room2.body.room.match.opponent));

    const rev0 = room1.body.room.match.rev;
    const activeSeat = room1.body.room.match.active;
    const activeToken = activeSeat === seat1 ? token1 : token2;
    const inactiveToken = activeSeat === seat1 ? token2 : token1;

    const end1 = await request(handler, { method: 'POST', path: `/api/rooms/${code}/action`, token: activeToken, body: { requestId: 'end1', expectedRev: rev0, command: { type: 'end' } } });
    assert.equal(end1.status, 200);
    assert.equal(end1.body.room.match.rev, rev0 + 1);
    const rev1 = end1.body.room.match.rev;
    assert.equal(end1.body.room.match.active, 1 - activeSeat);

    const end2 = await request(handler, { method: 'POST', path: `/api/rooms/${code}/action`, token: inactiveToken, body: { requestId: 'end2', expectedRev: rev1, command: { type: 'end' } } });
    assert.equal(end2.status, 200);
    assert.equal(end2.body.room.match.rev, rev1 + 1);
  } finally {
    await teardown({ dir, store });
  }
});

test('满10存档时pending替换/丢弃持久化', async () => {
  const { store, handler, dir } = await setup();
  try {
    const token = await createAccount(handler);
    await store.transaction(async (data) => {
      const account = Object.values(data.accounts)[0];
      for (let i = 0; i < 10; i++) {
        account.archives.push({
          id: `arc${i}`,
          name: `存档${i}`,
          createdAt: Date.now(),
          snapshot: CN_SNAPSHOT,
        });
      }
    });

    await store.transaction(async (data) => {
      const account = Object.values(data.accounts)[0];
      account.pending = {
        id: 'pending1',
        name: '待处理',
        createdAt: Date.now(),
        snapshot: CN_SNAPSHOT,
      };
    });

    const discardRes = await request(handler, { method: 'POST', path: '/api/archive/resolve', token, body: { decision: 'discard', expectedPendingId: 'pending1' } });
    assert.equal(discardRes.status, 200);
    let accountState;
    await store.transaction(async (data) => {
      accountState = Object.values(data.accounts)[0];
    });
    assert.equal(accountState.pending, null);
    assert.equal(accountState.archives.length, 10);

    await store.transaction(async (data) => {
      const account = Object.values(data.accounts)[0];
      account.pending = {
        id: 'pending2',
        name: '待处理2',
        createdAt: Date.now(),
        snapshot: CN_SNAPSHOT,
      };
    });
    const replaceRes = await request(handler, { method: 'POST', path: '/api/archive/resolve', token, body: { decision: 'replace', archiveId: 'arc0', expectedPendingId: 'pending2' } });
    assert.equal(replaceRes.status, 200);
    await store.transaction(async (data) => {
      const account = Object.values(data.accounts)[0];
      assert.equal(account.pending, null);
      assert.equal(account.archives.length, 10);
      assert.equal(account.archives.find(a => a.id === 'pending2').id, 'pending2');
    });
  } finally {
    await teardown({ dir, store });
  }
});

test('match快照独立，修改原存档不影响房间', async () => {
  const { store, handler, dir } = await setup();
  try {
    const token = await createAccount(handler);
    await addArchive(store, token, 'arc1');
    const createRes = await request(handler, { method: 'POST', path: '/api/rooms', token, body: { archiveId: 'arc1' } });
    const code = createRes.body.room.code;
    await store.transaction(async (data) => {
      const account = Object.values(data.accounts).find(a => a.roomCode === code);
      account.archives[0].snapshot.deck[0].up = !account.archives[0].snapshot.deck[0].up;
    });
    const roomRes = await request(handler, { method: 'GET', path: `/api/rooms/${code}`, token });
    assert.equal(roomRes.status, 200);
    assert.equal(roomRes.body.room.members[0].deckCount, CN_SNAPSHOT.deck.length);
  } finally {
    await teardown({ dir, store });
  }
});

test('服务器重启恢复active房间和账户', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wa-test-'));
  let store = await openStore({ dataDir: dir });
  let handler = createOnlineHandler(store);
  try {
    const token1 = await createAccount(handler);
    const token2 = await createAccount(handler);
    await addArchive(store, token1, 'arc1');
    await addArchive(store, token2, 'arc2');
    const createRes = await request(handler, { method: 'POST', path: '/api/rooms', token: token1, body: { archiveId: 'arc1' } });
    const code = createRes.body.room.code;
    await request(handler, { method: 'POST', path: '/api/rooms/join', token: token2, body: { code, archiveId: 'arc2' } });
    await request(handler, { method: 'POST', path: `/api/rooms/${code}/ready`, token: token1, body: { ready: true } });
    await request(handler, { method: 'POST', path: `/api/rooms/${code}/ready`, token: token2, body: { ready: true } });

    await store.close();
    store = await openStore({ dataDir: dir });
    handler = createOnlineHandler(store);

    const roomRes = await request(handler, { method: 'GET', path: `/api/rooms/${code}`, token: token1 });
    assert.equal(roomRes.status, 200);
    assert.equal(roomRes.body.room.status, 'active');
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('写失败原子性：交易回滚且文件不变', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wa-test-'));
  const store = await openStore({ dataDir: dir });
  const handler = createOnlineHandler(store);
  let token;
  try {
    token = await createAccount(handler);
    const filePath = path.join(dir, 'online-data.json');
    const beforeData = await readFile(filePath, 'utf8');

    const originalWrite = store._fileStore._writeFile;
    let failNextWrite = true;
    store._fileStore._writeFile = async (filePath, data, options) => {
      if (failNextWrite) {
        failNextWrite = false;
        throw new Error('simulated write failure');
      }
      return originalWrite(filePath, data, options);
    };

    await assert.rejects(
      store.transaction(async (data) => {
        const account = Object.values(data.accounts)[0];
        account.createdAt = Date.now();
      }),
      /simulated write failure/
    );

    const afterData = await readFile(filePath, 'utf8');
    assert.equal(afterData, beforeData);

    const accountRes = await request(handler, { method: 'GET', path: '/api/account', token });
    assert.equal(accountRes.status, 200);

    await store.close();
    const reopenedStore = await openStore({ dataDir: dir });
    const reopenedHandler = createOnlineHandler(reopenedStore);
    const reopenedRes = await request(reopenedHandler, { method: 'GET', path: '/api/account', token });
    assert.equal(reopenedRes.status, 200);
    await reopenedStore.close();
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
