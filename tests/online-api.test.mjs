import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, sha256 } from '../online/store.mjs';
import { createOnlineHandler } from '../online/api.mjs';
import { createWaSeason, waAct } from '../wa-season.js';

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

test('写失败原子性：交易回滚且数据不变', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wa-test-'));
  const store = await openStore({ dataDir: dir });
  const handler = createOnlineHandler(store);
  let token;
  try {
    token = await createAccount(handler);
    await addArchive(store, token, 'arc1');
    const beforeData = JSON.stringify(store.loadAll());

    // The commit itself fails after every row was written: nothing may stick.
    store._testHooks.beforeCommit = () => {
      store._testHooks.beforeCommit = null;
      throw new Error('simulated write failure');
    };
    await assert.rejects(
      store.transaction(async (data) => {
        const account = Object.values(data.accounts)[0];
        account.createdAt = 1;
        account.archives = [];
        account.roomCode = 'ZZZZZZZZ';
      }),
      /simulated write failure/
    );
    // A request unit of work that throws half way leaves no trace either.
    const tokenHash = sha256(token);
    const accountId = store.getAccountByTokenHash(tokenHash).accountId;
    assert.throws(() => store.tx(t => {
      t.account(accountId).archives.push({ id: 'x' });
      t.setCheckpoint(accountId, 'cp', 'saved', 1);
      throw new Error('boom');
    }), /boom/);

    assert.equal(JSON.stringify(store.loadAll()), beforeData);

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

test('规则1 爬塔记录：服务端按 rules/ascension 重放核验，快照只带原皮肤；去掉 rules 则重放失败', async () => {
  const { store, handler, dir } = await setup();
  try {
    const run = JSON.parse(await readFile(new URL('./fixtures/rules1-claim.json', import.meta.url), 'utf8'));
    const token = await createAccount(handler);
    const legacy = { ...run }; delete legacy.rules; delete legacy.ascension;
    const bad = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run: legacy, act: 1 } });
    assert.equal(bad.status, 400);
    const badAsc = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run: { ...run, ascension: 11 }, act: 1 } });
    assert.equal(badAsc.status, 400);
    // The fixture predates 15-floor acts (no mapVersion): it replays on the 12-step
    // map. An unknown map version is refused with a clear message, and claiming the
    // old actions as a version-2 run diverges.
    const badMap = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run: { ...run, mapVersion: 3 }, act: 1 } });
    assert.equal(badMap.status, 400);
    assert.match(JSON.stringify(badMap.body), /地图版本/);
    const wrongMap = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run: { ...run, mapVersion: 2 }, act: 1 } });
    assert.equal(wrongMap.status, 400);
    const res = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run, act: 1 } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const account = await request(handler, { method: 'GET', path: '/api/account', token });
    const snap = account.body.archives[0].snapshot;
    assert.equal(snap.region, run.region);
    assert.equal(snap.ascension, run.ascension);
    assert.ok(snap.skins.every(id => /^SK0[123]$/.test(id)));
    assert.equal(snap.hp, snap.maxHp);
  } finally {
    await teardown({ dir, store });
  }
});

test('规则 3（多敌人战斗、遭遇池、Boss 候选、关键词牌）的爬塔记录按 rules 3 重放；按规则 1 重放则失败', async () => {
  const { store, handler, dir } = await setup();
  try {
    const run = JSON.parse(await readFile(new URL('./fixtures/rules3-claim.json', import.meta.url), 'utf8'));
    assert.equal(run.rules, 3);
    // The record contains a group fight (targeted plays) so it cannot pass as a rules-1 run.
    assert.ok(run.actions.some(a => a.type === 'play' && a.target !== undefined));
    const token = await createAccount(handler);
    const asRules1 = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run: { ...run, rules: 1 }, act: 1 } });
    assert.equal(asRules1.status, 400);
    const badRules = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run: { ...run, rules: 2 }, act: 1 } });
    assert.equal(badRules.status, 400);
    const res = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run, act: 1 } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const account = await request(handler, { method: 'GET', path: '/api/account', token });
    assert.equal(account.body.archives[0].snapshot.region, run.region);
  } finally {
    await teardown({ dir, store });
  }
});

test('规则 4（第一幕减压）的爬塔记录在规则 5 上线后仍按 rules 4 重放：对手数值不变，服务端核验通过', async () => {
  const run = JSON.parse(await readFile(new URL('./fixtures/rules4-claim.json', import.meta.url), 'utf8'));
  assert.equal(run.rules, 4);
  assert.equal(run.econ, 1);
  // Opponent max HP of every fight, replaying the recorded actions under a ruleset.
  const trace = rules => {
    let s = createWaSeason(run.seed, false, run.region, run.runId, { rules, ascension: run.ascension, mapVersion: run.mapVersion, econ: run.econ, unlockTier: run.unlockTier, gearTier: run.gearTier });
    const seen = [];
    for (const a of run.actions) {
      const r = waAct(s, a);
      assert.equal(r.error, null, JSON.stringify(a));
      s = r.state;
      const key = s.battle?.enemyMaxHp && `${s.battle.enemy}:${s.battle.enemyMaxHp}`;
      if (key && seen.at(-1) !== key) seen.push(key);
    }
    return seen;
  };
  const four = trace(4), five = trace(5);
  // Recorded under rules 4 before rules 5 existed: these numbers must never move.
  assert.deepEqual(four.slice(0, 4), ['S_E03:50', 'S_E01:43', 'S_E05:48', 'S_EL01:79']);
  // Rules 5 plays the same act with sturdier act-1 opponents.
  assert.notDeepEqual(five, four);
  assert.ok(five.every((k, i) => Number(k.split(':')[1]) >= Number(four[i].split(':')[1])));
  const { store, handler, dir } = await setup();
  try {
    const token = await createAccount(handler);
    const bad = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run: { ...run, rules: 6 }, act: 1 } });
    assert.equal(bad.status, 400);
    const res = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run, act: 1 } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const account = await request(handler, { method: 'GET', path: '/api/account', token });
    assert.equal(account.body.archives[0].snapshot.region, run.region);
  } finally {
    await teardown({ dir, store });
  }
});

test('15 层地图（mapVersion 2）的爬塔记录按新地图重放核验；去掉 mapVersion 则按旧 12 站地图重放并失败', async () => {
  const { store, handler, dir } = await setup();
  try {
    const run = JSON.parse(await readFile(new URL('./fixtures/rules1-claim-map2.json', import.meta.url), 'utf8'));
    assert.equal(run.mapVersion, 2);
    const token = await createAccount(handler);
    const legacy = { ...run }; delete legacy.mapVersion;
    const bad = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run: legacy, act: 1 } });
    assert.equal(bad.status, 400);
    const res = await request(handler, { method: 'POST', path: '/api/archive/claim', token, body: { run, act: 1 } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const account = await request(handler, { method: 'GET', path: '/api/account', token });
    assert.equal(account.body.archives[0].snapshot.region, run.region);
  } finally {
    await teardown({ dir, store });
  }
});


test('玩家昵称与默认头像：认证、房间同步、持久保存、不泄露凭据', async () => {
  const ctx = await setup();
  const {store,handler}=ctx;
  try {
    const a=await createAccount(handler), b=await createAccount(handler);
    assert.equal((await request(handler,{method:'PATCH',path:'/api/account/profile',body:{name:'队长',avatar:'pig-scout'}})).status,401);
    const saved=await request(handler,{method:'PATCH',path:'/api/account/profile',token:a,body:{name:' 猪之家队长 ',avatar:'pig-guard'}});
    assert.equal(saved.status,200);assert.equal(saved.body.name,'猪之家队长');assert.equal(saved.body.avatar,'pig-guard');assert.equal(saved.body.profileComplete,true);
    assert.equal(saved.body.tokenHash,undefined);assert.equal(saved.body.avatarData,undefined);
    await addArchive(store,a,'profile-a');await addArchive(store,b,'profile-b');
    const host=await request(handler,{method:'POST',path:'/api/rooms',token:a,body:{archiveId:'profile-a'}});
    assert.equal(host.status,201);const code=host.body.room.code;
    await request(handler,{method:'PATCH',path:'/api/account/profile',token:b,body:{name:'朋友队长',avatar:'pig-rush'}});
    const joined=await request(handler,{method:'POST',path:'/api/rooms/join',token:b,body:{code,archiveId:'profile-b'}});
    assert.equal(joined.status,200);assert.equal(joined.body.room.members[0].name,'猪之家队长');assert.equal(joined.body.room.members[1].avatar,'pig-rush');
    await request(handler,{method:'PATCH',path:'/api/account/profile',token:a,body:{name:'换名队长',avatar:'pig-night'}});
    const view=await request(handler,{path:`/api/rooms/${code}`,token:b});
    assert.equal(view.body.room.members[0].name,'换名队长');assert.equal(view.body.room.members[0].avatar,'pig-night');
    await store.close();ctx.store=await openStore({dataDir:ctx.dir});const reopened=createOnlineHandler(ctx.store);
    const restored=await request(reopened,{path:'/api/account',token:a});assert.equal(restored.body.name,'换名队长');assert.equal(restored.body.avatar,'pig-night');
  } finally {await teardown(ctx);}
});

test('资料校验：昵称、远程 URL、SVG、假图片和越权字段不能写入', async () => {
  const ctx=await setup();try {
    const token=await createAccount(ctx.handler);
    for(const body of [{name:'a'},{name:'x'.repeat(17)},{name:'<script>'},{name:'队长\u0000'},{name:'队长',avatar:'https://evil.test/a.png'},{name:'队长',avatar:'data:image/svg+xml;base64,PHN2Zz4='},{name:'队长',avatar:'data:image/png;base64,aGVsbG8='},{name:'队长',tokenHash:'fake'}]){
      const r=await request(ctx.handler,{method:'PATCH',path:'/api/account/profile',token,body});assert.equal(r.status,400,JSON.stringify(body));
    }
    assert.equal((await request(ctx.handler,{path:'/api/account',token})).body.profileComplete,false);
  }finally{await teardown(ctx);}
});

test('上传头像经过服务器解码、方形压缩和去元数据，公开图片不泄露账号资料', async () => {
  const ctx=await setup();try {
    const sharp=(await import('sharp')).default;
    const token=await createAccount(ctx.handler);
    const source=await sharp({create:{width:240,height:120,channels:3,background:'#ec8899'}}).png().toBuffer();
    const r=await request(ctx.handler,{method:'PATCH',path:'/api/account/profile',token,body:{name:'头像队长',avatar:'data:image/png;base64,'+source.toString('base64')}});
    assert.equal(r.status,200);assert.match(r.body.avatar,/^\/api\/avatars\/[a-f0-9]{16}\?v=/);assert.equal(r.body.avatarData,undefined);
    const pic=await request(ctx.handler,{path:r.body.avatar});assert.equal(pic.status,200);
    // request() JSON helper deliberately cannot parse binary; inspect persisted normalized bytes instead.
    const stored=ctx.store.tx(t=>t.account(r.body.accountId));
    const normalized=await sharp(Buffer.from(stored.avatarData,'base64')).metadata();assert.equal(normalized.width,128);assert.equal(normalized.height,128);assert.equal(normalized.format,'jpeg');assert.equal(normalized.exif,undefined);
    await request(ctx.handler,{method:'PATCH',path:'/api/account/profile',token,body:{name:'头像队长',avatar:'pig-scout'}});
    assert.equal((await request(ctx.handler,{path:r.body.avatar})).status,404);
  }finally{await teardown(ctx);}
});
