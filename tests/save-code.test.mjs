// 存档码: one permanent personal save code = account + cloud save (online/save-api.mjs,
// shared/progress-sync.js). Format, login, lockouts, migrations, conflicts, replacement,
// PvP with the returned token, admin replacement and the new demo's wording.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openStore } from '../online/store.mjs';
import { createOnlineHandler } from '../online/api.mjs';
import { createReportHandler } from '../online/report-api.mjs';
import {
  generateSaveCode, formatSaveCode, normalizeSaveCode, SAVE_CODE_ALPHABET,
  LOGIN_IP_FAILS, LOGIN_IP_LOCK_MS, LOGIN_GLOBAL_FAILS,
} from '../online/save-api.mjs';
import { normalizeSaveCodeInput, metaAfterAttach, hasCoreProgress } from '../shared/progress-sync.js';

let ipCounter = 0;
async function setup() {
  const store = await openStore({ filename: ':memory:' });
  const clock = { t: 1_800_000_000_000 };
  const handler = createOnlineHandler(store, { now: () => clock.t, saveCodePepper: 'test-pepper' });
  const ip = `10.1.0.${++ipCounter}`;
  const call = async (path, body, { token, from = ip, method = 'POST' } = {}) => {
    const req = {
      method, url: path, headers: token ? { authorization: `Bearer ${token}` } : {}, socket: { remoteAddress: from },
      on(event, cb) { if (event === 'data' && body !== undefined) cb(Buffer.from(JSON.stringify(body))); if (event === 'end') cb(); },
    };
    const res = { statusCode: 0, body: '', writeHead(s) { this.statusCode = s; }, end(d) { this.body = d || ''; } };
    await handler(req, res, new URL(req.url, 'http://localhost'));
    return { status: res.statusCode, body: JSON.parse(res.body || 'null') };
  };
  const save = (name, body, opts) => call(`/api/save/${name}`, body, opts);
  return { store, clock, call, save, handler };
}

const bundle = (demo, keys) => ({ v: 1, demo, keys });

test('存档码格式：12 位无歧义字符，分组显示；输入不分大小写、可带横线和空格', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const code = generateSaveCode();
    assert.equal(code.length, 12);
    assert.ok([...code].every(c => SAVE_CODE_ALPHABET.includes(c)));
    assert.ok(!/[01IOL]/.test(code));
    seen.add(code);
  }
  assert.equal(seen.size, 300);
  assert.equal(SAVE_CODE_ALPHABET.length, 31);
  assert.equal(formatSaveCode('ABCDEFGHJKMN'), 'ABCD-EFGH-JKMN');
  for (const input of ['ABCD-EFGH-JKMN', 'abcd-efgh-jkmn', 'abcd efgh jkmn', ' AbCdEfGhJkMn ', 'ABCD—EFGH—JKMN']) {
    assert.deepEqual(normalizeSaveCode(input), { kind: 'code', code: 'ABCDEFGHJKMN' }, input);
    assert.deepEqual(normalizeSaveCodeInput(input), { kind: 'code', value: 'ABCD-EFGH-JKMN' }, input);
  }
  for (const bad of ['ABCD-EFGH-JKM', 'ABCD-EFGH-JKMNP', 'ABCD-EFGH-JKM0', 'ABCD-EFGH-JKMI', '', null, 42]) {
    assert.equal(normalizeSaveCode(bad), null, String(bad));
    assert.equal(normalizeSaveCodeInput(bad), null, String(bad));
  }
  const hex = 'AB'.repeat(32);
  assert.deepEqual(normalizeSaveCode(hex), { kind: 'legacy', token: hex.toLowerCase() });
  assert.deepEqual(normalizeSaveCodeInput(` ${hex} `), { kind: 'legacy', value: hex.toLowerCase() });
});

test('全新设备：首次保存时静默创建账号和存档码；在另一台设备输入存档码取回进度，PvP 用返回的令牌照常工作', async () => {
  const { store, save, call } = await setup();
  try {
    // Nothing to save yet: an account + code still come back when the panel is opened.
    const phone = await save('ensure', { demo: 'wa', device: '手机', bundle: bundle('wa', { 'wa-season-v1': '{"act":2}', sfx: '{}' }), savedAt: 1_800_000_000_000 });
    assert.equal(phone.status, 200, JSON.stringify(phone.body));
    assert.match(phone.body.token, /^[0-9a-f]{64}$/);
    assert.match(phone.body.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(phone.body.demo.status, 'pushed');
    assert.equal(phone.body.demo.rev, 1);
    // Only a hash is stored, never the code.
    const dump = JSON.stringify(store.db.prepare('SELECT * FROM save_codes').all());
    assert.ok(!dump.includes(phone.body.code.replace(/-/g, '')));

    // The new demo is saved under the same account.
    const nd = await save('sync', { demo: 'new', rev: 0, dirty: true, savedAt: 1_800_000_000_000, bundle: bundle('new', { 'new-demo-unlocks-v1': '{"xp":5}' }) }, { token: phone.body.token });
    assert.equal(nd.body.status, 'pushed');

    // PvP: the token works for /api/account.
    const acctPhone = await call('/api/account', undefined, { token: phone.body.token, method: 'GET' });
    assert.equal(acctPhone.status, 200);
    assert.equal(acctPhone.body.accountId, phone.body.accountId);

    // Desktop: type the code in lower case with spaces.
    const typed = phone.body.code.toLowerCase().replace(/-/g, ' ');
    const pc = await save('login', { code: typed, demo: 'wa', device: '电脑' }, { from: '10.9.9.9' });
    assert.equal(pc.status, 200, JSON.stringify(pc.body));
    assert.equal(pc.body.accountId, phone.body.accountId);
    assert.notEqual(pc.body.token, phone.body.token); // each device its own token
    assert.equal(pc.body.code, phone.body.code);
    assert.equal(pc.body.demo.status, 'adopted');
    assert.equal(pc.body.demo.keptBackup, false);
    assert.deepEqual(pc.body.demo.bundle.keys, { 'wa-season-v1': '{"act":2}', sfx: '{}' });
    const pcNew = await save('sync', { demo: 'new', rev: 0, dirty: false }, { token: pc.body.token });
    assert.equal(pcNew.body.status, 'pulled');
    assert.deepEqual(pcNew.body.bundle.keys, { 'new-demo-unlocks-v1': '{"xp":5}' });
    const acctPc = await call('/api/account', undefined, { token: pc.body.token, method: 'GET' });
    assert.equal(acctPc.body.accountId, phone.body.accountId);
    // PvP room with the new token.
    const room = await call('/api/rooms', {}, { token: pc.body.token });
    assert.notEqual(room.status, 401);

    // Phone storage cleared: log in again, progress back (no local progress → no backup).
    const again = await save('login', { code: phone.body.code, demo: 'wa' });
    assert.equal(again.body.demo.status, 'adopted');
    assert.equal(again.body.demo.backup, null);

    // Logout forgets that device's token only.
    assert.equal((await save('logout', {}, { token: again.body.token })).status, 200);
    assert.equal((await call('/api/account', undefined, { token: again.body.token, method: 'GET' })).status, 401);
    assert.equal((await call('/api/account', undefined, { token: pc.body.token, method: 'GET' })).status, 200);
  } finally { store.close(); }
});

test('登录时本机已有不同进度：采用存档码里的进度，本机进度存为备份，可以恢复', async () => {
  const { store, save } = await setup();
  try {
    const a = await save('ensure', { demo: 'new', bundle: bundle('new', { 'new-demo-unlocks-v1': '{"xp":90}' }), savedAt: 1_700_000_000_000 });
    const b = await save('login', { code: a.body.code, demo: 'new', device: '电脑', bundle: bundle('new', { 'new-demo-unlocks-v1': '{"xp":3}' }), savedAt: 1_800_000_000_000 });
    assert.equal(b.body.demo.status, 'adopted');
    assert.equal(b.body.demo.keptBackup, true);
    assert.deepEqual(b.body.demo.bundle.keys, { 'new-demo-unlocks-v1': '{"xp":90}' });
    assert.equal(b.body.demo.backup.device, '电脑');
    const meta = metaAfterAttach({}, b.body.demo, b.body.accountId, null);
    assert.equal(meta.meta.mode, 'account');
    assert.equal(meta.meta.rebase, true);
    assert.match(meta.notice, /备份/);
    const restored = await save('restore', { demo: 'new' }, { token: b.body.token });
    assert.equal(restored.body.status, 'restored');
    assert.deepEqual(restored.body.bundle.keys, { 'new-demo-unlocks-v1': '{"xp":3}' });
    // Same progress logged in again: the backup slot is not overwritten by a copy.
    const c = await save('login', { code: a.body.code, demo: 'new', bundle: bundle('new', { 'new-demo-unlocks-v1': '{"xp":3}' }), savedAt: 1_800_000_000_000 });
    assert.equal(c.body.demo.keptBackup, false);

    // Both devices changed: newer wins, the other is the backup (same rule as before).
    const s1 = await save('sync', { demo: 'new', rev: restored.body.rev, dirty: true, savedAt: 1_800_000_100_000, bundle: bundle('new', { 'new-demo-unlocks-v1': '{"xp":10}' }) }, { token: a.body.token });
    assert.equal(s1.body.status, 'pushed');
    const s2 = await save('sync', { demo: 'new', rev: restored.body.rev, dirty: true, savedAt: 1_800_000_050_000, bundle: bundle('new', { 'new-demo-unlocks-v1': '{"xp":11}' }) }, { token: b.body.token });
    assert.equal(s2.body.status, 'pulled');
    assert.equal(s2.body.conflict, true);
    assert.deepEqual(s2.body.bundle.keys, { 'new-demo-unlocks-v1': '{"xp":10}' });
  } finally { store.close(); }
});

test('错误的存档码：只提示“存档码不正确”；同一 IP 连错 10 次锁 15 分钟，锁定期间输对也不行', async () => {
  const { store, save, clock } = await setup();
  try {
    const a = await save('ensure', {});
    const wrong = await save('login', { code: 'ABCD-EFGH-JKMN' }, { from: '10.7.0.1' });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error, '存档码不正确');
    const format = await save('login', { code: '1234' }, { from: '10.7.0.1' });
    assert.equal(format.status, 400);
    for (let i = 1; i < LOGIN_IP_FAILS; i++) await save('login', { code: 'ABCD-EFGH-JKMP' }, { from: '10.7.0.1' });
    const locked = await save('login', { code: a.body.code }, { from: '10.7.0.1' });
    assert.equal(locked.status, 429);
    assert.match(locked.body.error, /15 分钟/);
    // Another IP is not affected.
    assert.equal((await save('login', { code: a.body.code }, { from: '10.7.0.2' })).status, 200);
    clock.t += LOGIN_IP_LOCK_MS + 1000;
    assert.equal((await save('login', { code: a.body.code }, { from: '10.7.0.1' })).status, 200);
    // Wrong legacy credentials count as failures too.
    const legacyWrong = await save('login', { code: 'ab'.repeat(32) }, { from: '10.7.0.3' });
    assert.equal(legacyWrong.status, 401);
    assert.equal(legacyWrong.body.error, '存档码不正确');
  } finally { store.close(); }
});

test('全站错误过多时暂时锁定所有存档码登录', async () => {
  const { store, save } = await setup();
  try {
    const a = await save('ensure', {});
    for (let i = 0; i < LOGIN_GLOBAL_FAILS; i++) {
      const r = await save('login', { code: 'ABCD-EFGH-JKMN' }, { from: `10.${(i >> 8) & 255}.${i & 255}.${Math.floor(i / 9)}` });
      assert.ok(r.status === 401 || r.status === 429);
    }
    const locked = await save('login', { code: a.body.code }, { from: '10.200.0.1' });
    assert.equal(locked.status, 429);
  } finally { store.close(); }
});

test('迁移：只有 PvP 令牌的设备，账号补上存档码，令牌不变', async () => {
  const { store, save, call } = await setup();
  try {
    const pvp = await call('/api/account', {});
    const token = pvp.body.token;
    const acct = (await call('/api/account', undefined, { token, method: 'GET' })).body;
    const e1 = await save('ensure', { demo: 'wa', bundle: bundle('wa', { 'wa-unlocks-v1': '{"xp":1}' }), savedAt: 1 }, { token });
    assert.equal(e1.status, 200);
    assert.equal(e1.body.accountId, acct.accountId);
    assert.equal(e1.body.token, undefined); // keeps its token
    assert.equal(e1.body.switched, false);
    assert.ok(e1.body.code);
    const e2 = await save('ensure', { demo: 'new' }, { token });
    assert.equal(e2.body.code, undefined); // the code is shown only once
    assert.equal(e2.body.hasCode, true);
    assert.equal(e2.body.demo.status, 'empty');
    // A pasted legacy 64-hex credential logs another device into the same account.
    const legacy = await save('login', { code: token.toUpperCase(), demo: 'wa' }, { from: '10.8.0.1' });
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.accountId, acct.accountId);
    assert.equal(legacy.body.token, token);
    assert.equal(legacy.body.code, undefined); // the account already has a code (not known here)
    assert.deepEqual(legacy.body.demo.bundle.keys, { 'wa-unlocks-v1': '{"xp":1}' });
    // Legacy credential of an account without a code: a code is created and shown.
    const other = (await call('/api/account', {}, { from: '10.8.0.2' })).body.token;
    const l2 = await save('login', { code: other }, { from: '10.8.0.2' });
    assert.equal(l2.body.freshCode, true);
    assert.match(l2.body.code, /^[A-Z2-9]{4}-/);
  } finally { store.close(); }
});

test('迁移：已用旧同步码连接的两台设备，先要存档码的那台决定账号，另一台并入并记住旧令牌', async () => {
  const { store, save, call } = await setup();
  try {
    const A = (await call('/api/account', {}, { from: '10.5.0.1' })).body.token;
    const B = (await call('/api/account', {}, { from: '10.5.0.2' })).body.token;
    const accountA = (await call('/api/account', undefined, { token: A, method: 'GET' })).body.accountId;
    const linkA = await call('/api/sync/code', { demo: 'wa', bundle: bundle('wa', { 'wa-unlocks-v1': '{"xp":40}' }), savedAt: 1_800_000_000_000, device: '电脑' });
    const linkB = await call('/api/sync/redeem', { demo: 'wa', code: linkA.body.code, device: '手机' });
    assert.equal(linkB.status, 200);

    const eA = await save('ensure', { demo: 'wa', link: { syncId: linkA.body.syncId, secret: linkA.body.secret } }, { token: A });
    assert.equal(eA.body.accountId, accountA);
    assert.equal(eA.body.demo.status, 'linked');
    assert.equal(eA.body.demo.rev, 1);
    const kept = metaAfterAttach({ syncId: 'x', secret: 'y', rev: 1, hash: 'h', dirty: true }, eA.body.demo, accountA, null);
    assert.equal(kept.meta.syncId, undefined);
    assert.equal(kept.meta.rev, 1);
    assert.equal(kept.meta.dirty, true); // unsent local changes stay dirty

    const eB = await save('ensure', { demo: 'wa', link: { syncId: linkB.body.syncId, secret: linkB.body.secret }, bundle: bundle('wa', { 'wa-unlocks-v1': '{"xp":40}' }), savedAt: 1 }, { token: B });
    assert.equal(eB.body.accountId, accountA); // the link's account wins
    assert.equal(eB.body.switched, true); // the client keeps B as the previous token
    assert.match(eB.body.token, /^[0-9a-f]{64}$/);
    assert.equal(eB.body.demo.status, 'linked');
    assert.equal((await call('/api/account', undefined, { token: eB.body.token, method: 'GET' })).body.accountId, accountA);
    // B's old account still exists (restorable with its old credential).
    assert.equal((await call('/api/account', undefined, { token: B, method: 'GET' })).status, 200);

    // Saves now go through the account; old /api/sync clients (cached pages) still work.
    const push = await save('sync', { demo: 'wa', rev: 1, dirty: true, savedAt: 1_800_000_100_000, bundle: bundle('wa', { 'wa-unlocks-v1': '{"xp":50}' }) }, { token: A });
    assert.equal(push.body.status, 'pushed');
    const old = await call('/api/sync/sync', { syncId: linkB.body.syncId, secret: linkB.body.secret, rev: 1, dirty: false });
    assert.equal(old.body.status, 'pulled');
    // Account-owned progress is never purged as an idle sync link.
    store.purgeSync(Date.now() + 10 * 365 * 86400_000, 1);
    assert.ok(store.syncLink(linkA.body.syncId));
  } finally { store.close(); }
});

test('更换存档码：旧码立即失效，已登录设备不受影响；后台也能补发', async () => {
  const { store, save, handler } = await setup();
  try {
    const a = await save('ensure', {});
    const fresh = await save('newcode', {}, { token: a.body.token });
    assert.equal(fresh.status, 200);
    assert.notEqual(fresh.body.code, a.body.code);
    assert.equal((await save('login', { code: a.body.code })).status, 401);
    assert.equal((await save('login', { code: fresh.body.code })).status, 200);
    assert.equal((await save('sync', { demo: 'wa', rev: 0, dirty: false }, { token: a.body.token })).status, 200);

    const reports = createReportHandler(store, { adminToken: 'local-admin', adminRoutes: (req, res, url) => handler.saveAdmin(req, res, url) });
    const admin = async (path, method, body) => {
      const req = {
        method, url: path, headers: { authorization: 'Bearer local-admin' }, socket: { remoteAddress: '10.3.3.3' },
        on(event, cb) { if (event === 'data' && body) cb(Buffer.from(JSON.stringify(body))); if (event === 'end') cb(); },
      };
      const res = { statusCode: 0, body: '', setHeader() {}, writeHead(s) { this.statusCode = s; }, end(d) { this.body = d || ''; } };
      await reports(req, res, new URL(path, 'http://localhost'));
      return { status: res.statusCode, body: JSON.parse(res.body || 'null') };
    };
    const look = await admin(`/api/admin/save?account=${a.body.accountId}`, 'GET');
    assert.equal(look.status, 200, JSON.stringify(look.body));
    assert.ok(look.body.saveCode);
    assert.ok(!JSON.stringify(look.body).includes(fresh.body.code));
    const replaced = await admin('/api/admin/save/replace', 'POST', { accountId: a.body.accountId });
    assert.equal(replaced.status, 200);
    assert.equal((await save('login', { code: fresh.body.code })).status, 401);
    assert.equal((await save('login', { code: replaced.body.code })).status, 200);
    reports.close?.();
  } finally { store.close(); }
});

test('客户端：只有真实进度才算需要备份', () => {
  const cfg = { demo: 'new', keys: ['a', 'b', 'sfx-key'], alias: { 'sfx-key': 'sfx' }, core: ['a'] };
  assert.equal(hasCoreProgress({ keys: { sfx: '{}' } }, cfg), false);
  assert.equal(hasCoreProgress({ keys: { a: '{}' } }, cfg), true);
});

test('存档码文字：共享模块与战术试炼的配置不出现无畏契约、PvP、登峰赛季、选手等字样', () => {
  const strip = src => src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const shared = strip(readFileSync(new URL('../shared/progress-sync.js', import.meta.url), 'utf8'));
  assert.doesNotMatch(shared, /无畏契约|Valorant|VCT|PvP|选手|特工|登峰赛季/i);
  assert.match(shared, /存档码/);
  const nd = readFileSync(new URL('../new-demo/ui.js', import.meta.url), 'utf8');
  const cfg = nd.slice(nd.indexOf('const ND_SYNC'), nd.indexOf('};', nd.indexOf('const ND_SYNC')));
  assert.doesNotMatch(cfg, /无畏契约|Valorant|VCT|PvP|选手|特工|登峰赛季/i);
  // The PvP token never travels inside a progress bundle.
  const ui = readFileSync(new URL('../ui-source.js', import.meta.url), 'utf8');
  const wa = ui.slice(ui.indexOf('const WA_SYNC'), ui.indexOf('\n', ui.indexOf('const WA_SYNC')));
  assert.doesNotMatch(wa, /wa-online-token/);
});
