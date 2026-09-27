// Progress sync between devices: /api/sync/* (codes, single use, expiry, size limit,
// conflicts, backup, rate limit, compression) and the client bundle helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../online/store.mjs';
import { createOnlineHandler } from '../online/api.mjs';
import { SYNC_CODE_ALPHABET, SYNC_CODE_TTL_MS, SYNC_MAX_BUNDLE_BYTES, generateSyncCode } from '../online/sync-api.mjs';
import { collectBundle, applyBundle, bundleHash, resolveSyncResponse, progressKeys, agoText } from '../shared/progress-sync.js';

let ipCounter = 0;
async function setup() {
  const store = await openStore({ filename: ':memory:' });
  const clock = { t: 1_800_000_000_000 };
  const handler = createOnlineHandler(store, { now: () => clock.t });
  const ip = `10.0.0.${++ipCounter}`;
  const call = async (name, body, from = ip) => {
    const req = {
      method: 'POST', url: `/api/sync/${name}`, headers: {}, socket: { remoteAddress: from },
      on(event, cb) { if (event === 'data') cb(Buffer.from(JSON.stringify(body))); if (event === 'end') cb(); },
    };
    const res = { statusCode: 0, body: '', writeHead(s) { this.statusCode = s; }, end(d) { this.body = d || ''; } };
    await handler(req, res, new URL(req.url, 'http://localhost'));
    return { status: res.statusCode, body: JSON.parse(res.body || 'null') };
  };
  return { store, clock, call };
}

const bundle = (demo, keys) => ({ v: 1, demo, keys });

test('同步码：6 位无歧义字符，10 分钟有效，只能用一次，按版本隔离', async () => {
  const { store, clock, call } = await setup();
  try {
    for (let i = 0; i < 200; i++) {
      const code = generateSyncCode();
      assert.match(code, /^[A-Z0-9]{6}$/);
      assert.ok([...code].every(c => SYNC_CODE_ALPHABET.includes(c)));
      assert.ok(!/[01IOL]/.test(code));
    }
    const a = await call('code', { demo: 'new', bundle: bundle('new', { run: '{"act":2}', sfx: '{"muted":true}' }), savedAt: clock.t, device: '电脑' });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.match(a.body.code, /^[A-Z0-9]{6}$/);
    assert.equal(a.body.expiresAt, clock.t + SYNC_CODE_TTL_MS);
    assert.ok(a.body.syncId && a.body.secret);
    assert.equal(a.body.rev, 1);

    // Wrong demo: the code is consumed (single use) and nothing leaks across demos.
    const wrongDemo = await call('redeem', { demo: 'wa', code: a.body.code });
    assert.equal(wrongDemo.status, 404);
    const again = await call('redeem', { demo: 'new', code: a.body.code });
    assert.equal(again.status, 404);

    // Fresh code for the existing link (device A asks again).
    const c2 = await call('code', { demo: 'new', syncId: a.body.syncId, secret: a.body.secret });
    assert.equal(c2.status, 200);
    const b = await call('redeem', { demo: 'new', code: c2.body.code.toLowerCase(), device: '手机' });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal(b.body.syncId, a.body.syncId);
    assert.notEqual(b.body.secret, a.body.secret); // each device its own secret
    assert.deepEqual(b.body.bundle, bundle('new', { run: '{"act":2}', sfx: '{"muted":true}' }));
    assert.equal((await call('redeem', { demo: 'new', code: c2.body.code })).status, 404);

    // Expiry.
    const c3 = await call('code', { demo: 'new', syncId: a.body.syncId, secret: a.body.secret });
    clock.t += SYNC_CODE_TTL_MS + 1;
    assert.equal((await call('redeem', { demo: 'new', code: c3.body.code })).status, 404);
    // Only one live code per link: asking again replaces the previous one.
    const c4 = await call('code', { demo: 'new', syncId: a.body.syncId, secret: a.body.secret });
    const c5 = await call('code', { demo: 'new', syncId: a.body.syncId, secret: a.body.secret });
    assert.equal((await call('redeem', { demo: 'new', code: c4.body.code })).status, 404);
    assert.equal((await call('redeem', { demo: 'new', code: c5.body.code })).status, 200);

    // Secrets are stored hashed, bundles compressed.
    const row = store.db.prepare('SELECT secret_hash, bundle, bundle_bytes FROM sync_links').get();
    assert.ok(!row.secret_hash.includes(a.body.secret));
    assert.equal(row.secret_hash.split(' ').length, 3);
    assert.equal(row.bundle[0], 0x1f); // gzip magic
    // Expired codes are purged.
    clock.t += 11 * 60 * 1000;
    await call('code', { demo: 'new', syncId: a.body.syncId, secret: a.body.secret });
    assert.equal(store.counts().syncCodes, 1);
  } finally {
    await store.close();
  }
});

test('同步：大小上限、无效凭据、无效数据', async () => {
  const { store, clock, call } = await setup();
  try {
    const big = 'x'.repeat(SYNC_MAX_BUNDLE_BYTES);
    const tooBig = await call('code', { demo: 'wa', bundle: bundle('wa', { save: big }), savedAt: clock.t });
    assert.equal(tooBig.status, 413);
    const ok = await call('code', { demo: 'wa', bundle: bundle('wa', { save: 'x'.repeat(200 * 1024) }), savedAt: clock.t });
    assert.equal(ok.status, 200);
    assert.ok(store.db.prepare('SELECT length(bundle) AS n FROM sync_links').get().n < 10 * 1024);
    assert.equal((await call('sync', { syncId: ok.body.syncId, secret: 'nope', rev: 1 })).status, 401);
    assert.equal((await call('sync', { syncId: 'missing', secret: ok.body.secret, rev: 1 })).status, 401);
    assert.equal((await call('code', { demo: 'x', bundle: bundle('x', {}), savedAt: 1 })).status, 400);
    assert.equal((await call('code', { demo: 'wa', bundle: bundle('new', {}), savedAt: 1 })).status, 400);
    assert.equal((await call('code', { demo: 'wa', bundle: { v: 1, demo: 'wa', keys: { a: 5 } }, savedAt: 1 })).status, 400);
    assert.equal((await call('sync', { syncId: ok.body.syncId, secret: ok.body.secret, rev: 1, dirty: true, savedAt: clock.t, bundle: bundle('wa', { save: big }) })).status, 413);
    assert.equal((await call('redeem', { demo: 'wa', code: 'bad' })).status, 400);
    const unknownRoute = await call('nope', {});
    assert.equal(unknownRoute.status, 404);
  } finally {
    await store.close();
  }
});

test('自动同步：快进上传、拉取、两边都改时较新的一份胜出、另一份成为备份并可恢复', async () => {
  const { store, clock, call } = await setup();
  try {
    const A = await call('code', { demo: 'new', bundle: bundle('new', { run: 'A0' }), savedAt: clock.t, device: '电脑' });
    const B = await call('redeem', { demo: 'new', code: A.body.code, device: '手机', bundle: bundle('new', { run: 'B-own' }), savedAt: clock.t - 1000 });
    // B's own earlier progress is kept as the backup, not dropped.
    assert.equal(B.body.backup.device, '手机');
    const credA = { syncId: A.body.syncId, secret: A.body.secret };
    const credB = { syncId: B.body.syncId, secret: B.body.secret };

    // Nothing new.
    assert.equal((await call('sync', { ...credB, rev: 1 })).body.status, 'uptodate');
    // A changes and uploads (fast-forward).
    clock.t += 60_000;
    const pushA = await call('sync', { ...credA, rev: 1, dirty: true, savedAt: clock.t, bundle: bundle('new', { run: 'A1' }), device: '电脑' });
    assert.equal(pushA.body.status, 'pushed');
    assert.equal(pushA.body.rev, 2);
    // B loads: newer server copy → pulled.
    const pullB = await call('sync', { ...credB, rev: 1 });
    assert.equal(pullB.body.status, 'pulled');
    assert.deepEqual(pullB.body.bundle.keys, { run: 'A1' });
    assert.equal(pullB.body.savedAt, clock.t);

    // Both change since rev 2. B saved later → B wins, A's copy becomes the backup.
    clock.t += 60_000;
    const pushA2 = await call('sync', { ...credA, rev: 2, dirty: true, savedAt: clock.t - 30_000, bundle: bundle('new', { run: 'A2' }), device: '电脑' });
    assert.equal(pushA2.body.status, 'pushed');
    const pushB = await call('sync', { ...credB, rev: 2, dirty: true, savedAt: clock.t - 10_000, bundle: bundle('new', { run: 'B2' }), device: '手机' });
    assert.equal(pushB.body.status, 'pushed');
    assert.equal(pushB.body.conflict, true);
    assert.equal(pushB.body.rev, 4);
    assert.equal(pushB.body.backup.device, '电脑');

    // Both change again; this time the server copy (A) is newer → B is told to pull,
    // and B's local copy is kept as the backup.
    clock.t += 60_000;
    await call('sync', { ...credA, rev: 4, dirty: true, savedAt: clock.t, bundle: bundle('new', { run: 'A5' }), device: '电脑' });
    const staleB = await call('sync', { ...credB, rev: 4, dirty: true, savedAt: clock.t - 50_000, bundle: bundle('new', { run: 'B5' }), device: '手机' });
    assert.equal(staleB.body.status, 'pulled');
    assert.equal(staleB.body.conflict, true);
    assert.deepEqual(staleB.body.bundle.keys, { run: 'A5' });
    assert.equal(staleB.body.backup.device, '手机');

    // Restore: the backup becomes the newest revision; the replaced copy the backup.
    const restored = await call('restore', credB);
    assert.equal(restored.body.status, 'restored');
    assert.deepEqual(restored.body.bundle.keys, { run: 'B5' });
    assert.equal(restored.body.rev, 6);
    const pullA = await call('sync', { ...credA, rev: 5 });
    assert.deepEqual(pullA.body.bundle.keys, { run: 'B5' });
    const swapBack = await call('restore', credA);
    assert.deepEqual(swapBack.body.bundle.keys, { run: 'A5' });
    // Revisions only grow; data survives in the store.
    assert.equal(store.syncLink(credA.syncId).rev, 7);
  } finally {
    await store.close();
  }
});

test('同步限流：按 IP 限制生成与兑换同步码', async () => {
  const { store, clock, call } = await setup();
  try {
    const statuses = [];
    for (let i = 0; i < 12; i++) statuses.push((await call('code', { demo: 'wa', bundle: bundle('wa', { k: String(i) }), savedAt: clock.t }, '10.9.9.9')).status);
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
    assert.deepEqual(statuses.slice(10), [429, 429]);
    // Another IP is unaffected.
    assert.equal((await call('code', { demo: 'wa', bundle: bundle('wa', {}), savedAt: clock.t }, '10.9.9.10')).status, 200);
    const guesses = [];
    for (let i = 0; i < 22; i++) guesses.push((await call('redeem', { demo: 'wa', code: 'AAAAAA' }, '10.9.9.11')).status);
    assert.equal(guesses.filter(s => s === 404).length, 20);
    assert.equal(guesses.filter(s => s === 429).length, 2);
  } finally {
    await store.close();
  }
});

// ------------------------------------------------------------------ client helpers
function memoryStorage(init = {}) {
  const map = new Map(Object.entries(init));
  return {
    get length() { return map.size; },
    key: i => [...map.keys()][i] ?? null,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

const CFG = {
  demo: 'new',
  metaKey: 'new-demo-sync-v1',
  keys: ['new-demo-run-route-v5', 'new-demo-unlocks-v1', 'val-sfx-v1'],
  prefixes: ['new-demo-guide-v2-'],
  alias: { 'val-sfx-v1': 'sfx' },
  shrink: { 'new-demo-run-route-v5': v => { const s = JSON.parse(v); s.logs = []; return JSON.stringify(s); } },
};

test('客户端：收集只取本版本的进度键，去掉日志，别名隐藏共享键名；应用时替换并删除多余键', () => {
  const local = memoryStorage({
    'new-demo-run-route-v5': JSON.stringify({ act: 2, logs: [{ event: 'play_card' }, { event: 'end_turn' }] }),
    'new-demo-unlocks-v1': '{"xp":40}',
    'new-demo-guide-v2-map': '1',
    'val-sfx-v1': '{"muted":true}',
    'new-demo-sync-v1': '{"syncId":"x"}',
    'wa-online-token': 'secret-token',
    'other-app': 'x',
  });
  const b = collectBundle(local, CFG);
  assert.deepEqual(Object.keys(b.keys).sort(), ['new-demo-guide-v2-map', 'new-demo-run-route-v5', 'new-demo-unlocks-v1', 'sfx']);
  assert.deepEqual(JSON.parse(b.keys['new-demo-run-route-v5']).logs, []);
  assert.ok(!JSON.stringify(b).includes('wa-') && !JSON.stringify(b).includes('val-'));
  assert.deepEqual(progressKeys(local, CFG), ['new-demo-guide-v2-map', 'new-demo-run-route-v5', 'new-demo-unlocks-v1', 'val-sfx-v1']);

  const other = memoryStorage({ 'new-demo-run-route-v5': '{"act":1}', 'new-demo-guide-v2-shop': '1', 'new-demo-sync-v1': 'mine', 'unrelated': 'keep' });
  applyBundle(other, CFG, b);
  const after = other.dump();
  assert.equal(after['new-demo-guide-v2-shop'], undefined); // not in the bundle → removed
  assert.equal(after['val-sfx-v1'], '{"muted":true}'); // alias mapped back
  assert.equal(after['new-demo-sync-v1'], 'mine'); // sync meta never touched
  assert.equal(after.unrelated, 'keep');
  assert.equal(JSON.parse(after['new-demo-run-route-v5']).act, 2);
  assert.equal(bundleHash(collectBundle(other, CFG)), bundleHash(b));
  // Foreign keys in a bundle are ignored.
  applyBundle(other, CFG, { v: 1, demo: 'new', keys: { 'wa-online-token': 'x', 'new-demo-unlocks-v1': '{"xp":1}' } });
  assert.equal(other.dump()['wa-online-token'], undefined);
  assert.throws(() => applyBundle(other, CFG, { v: 1, demo: 'wa', keys: {} }));
});

test('客户端：响应处理（上传成功记下哈希、拉取时标记重算、冲突提示）', () => {
  const meta = { syncId: 's', secret: 'k', rev: 3, hash: 'old', dirty: true };
  const pushed = resolveSyncResponse(meta, { status: 'pushed', rev: 4, backup: null }, 'h4', 1000);
  assert.equal(pushed.meta.hash, 'h4');
  assert.equal(pushed.meta.rev, 4);
  assert.equal(pushed.apply, null);
  const pulled = resolveSyncResponse(meta, { status: 'pulled', rev: 5, savedAt: 1000 - 3 * 60000, bundle: { v: 1 }, backup: null }, null, 1000);
  assert.equal(pulled.meta.rebase, true);
  assert.equal(pulled.meta.dirty, false);
  assert.deepEqual(pulled.apply, { v: 1 });
  assert.equal(pulled.notice, '已同步另一台设备的进度（3 分钟前）。');
  const conflict = resolveSyncResponse(meta, { status: 'pulled', conflict: true, rev: 5, savedAt: 0, bundle: {}, backup: { device: '手机' } }, null, 1000);
  assert.match(conflict.notice, /备份/);
  assert.equal(agoText(0, 3 * 3600_000), '3 小时前');
});
