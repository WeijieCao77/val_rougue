// Claim verification on worker threads (online/replay-pool.mjs) must answer exactly as
// the in-process path does, and stay bounded: queue full → 503, timeout → 503 with the
// worker replaced, crash → clean failure, close() terminates everything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../online/store.mjs';
import { createOnlineHandler, HttpError } from '../online/api.mjs';
import { verifyClaim } from '../online/claim-verify.mjs';
import { createReplayPool, defaultPoolSize, BUSY_MESSAGE } from '../online/replay-pool.mjs';

const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

async function outcome(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (err) {
    return err instanceof HttpError ? { ok: false, status: err.status, message: err.message, headers: err.headers } : { ok: false, internal: true, message: err.message };
  }
}

test('pool size is min(CPUs - 1, 4) and at least 1', () => {
  const n = defaultPoolSize();
  assert.ok(n >= 1 && n <= 4);
});

test('worker pool verifies claims exactly like the in-process path (every rules / econ fixture)', async t => {
  const pool = createReplayPool({ size: 2 });
  t.after(() => pool.close());
  const cases = [];
  for (const name of ['rules1-claim.json', 'rules1-claim-map2.json', 'rules3-claim.json', 'rules4-claim.json', 'econ-claim.json', 'econ-claim-rules4.json']) {
    const run = await fixture(name);
    cases.push([name, run, 1]);
    cases.push([`${name} act 2`, run, 2]); // no act-2 checkpoint → same 400
    const tampered = structuredClone(run);
    tampered.actions.splice(5, 0, { type: 'play', index: 99 });
    cases.push([`${name} tampered`, tampered, 1]);
  }
  cases.push(['bad rules', { ...(await fixture('rules4-claim.json')), rules: 99 }, 1]);
  cases.push(['tutorial', { runId: 'r', seed: 's', region: 'CN', actions: [{ type: 'tutorial' }] }, 1]);
  cases.push(['not an object', 'x', 1]);
  const results = await Promise.all(cases.map(async ([name, run, act]) => [name, await outcome(verifyClaim(run, act)), await outcome(pool.verify(run, act))]));
  let valid = 0;
  for (const [name, local, worker] of results) {
    assert.deepEqual(worker, local, name);
    // Byte-for-byte: the snapshot keeps the same key order after crossing the thread.
    if (local.ok) { valid++; assert.equal(JSON.stringify(worker.value), JSON.stringify(local.value), name); }
    else assert.equal(local.status, 400, name);
  }
  assert.equal(valid, 6);
  assert.ok(pool.workers <= 2);
});

test('handler with the worker pool answers claims byte-for-byte like the in-process handler', async t => {
  const run = await fixture('rules4-claim.json');
  const pool = createReplayPool({ size: 1 });
  t.after(() => pool.close());
  const bodies = [];
  for (const verify of [undefined, pool.verify]) {
    const dir = await mkdtemp(path.join(tmpdir(), 'wa-pool-'));
    const store = await openStore({ dataDir: dir });
    try {
      const handler = createOnlineHandler(store, verify ? { verifyClaim: verify } : {});
      const call = async (method, p, token, body) => {
        const req = { method, url: p, headers: token ? { authorization: `Bearer ${token}` } : {}, socket: { remoteAddress: '127.0.0.1' },
          on(ev, cb) { if (ev === 'data' && body) cb(Buffer.from(JSON.stringify(body))); if (ev === 'end') cb(); } };
        const res = { headers: {}, writeHead(s, h) { this.status = s; this.headers = h; }, end(b) { this.body = String(b ?? ''); } };
        await handler(req, res, new URL(p, 'http://localhost'));
        return res;
      };
      const token = JSON.parse((await call('POST', '/api/account', null, {})).body).token;
      const out = [];
      for (const body of [{ run, act: 1 }, { run, act: 1 }, { run: { ...run, actions: [{ type: 'play', index: 42 }, ...run.actions] }, act: 1 }, { run, act: 3 }]) {
        const r = await call('POST', '/api/archive/claim', token, body);
        out.push([r.status, r.headers['Cache-Control'], r.body]);
      }
      const account = JSON.parse((await call('GET', '/api/account', token)).body);
      out.push(account.archives.map(a => [a.id, a.name, JSON.stringify(a.snapshot)]));
      bodies.push(out);
    } finally {
      await store.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
  assert.deepEqual(bodies[1], bodies[0]);
  assert.deepEqual(bodies[0].slice(0, 4).map(r => r[0]), [200, 200, 400, 400]);
  assert.equal(bodies[0][0][2], '{"status":"saved"}');
});

test('queue full → 503 服务器繁忙 with Retry-After; queued jobs still finish', async t => {
  const run = await fixture('rules4-claim.json');
  const pool = createReplayPool({ size: 1, maxQueue: 1, retryAfterSec: 7 });
  t.after(() => pool.close());
  const running = pool.verify(run, 1);
  const queued = pool.verify(run, 1);
  const rejected = await outcome(pool.verify(run, 1));
  assert.deepEqual(rejected, { ok: false, status: 503, message: BUSY_MESSAGE, headers: { 'Retry-After': '7' } });
  assert.equal(pool.stats.rejectedBusy, 1);
  assert.equal((await running).act, 1);
  assert.equal((await queued).act, 1);
});

test('timeout → 503 and the worker is replaced; the next claim still verifies', async t => {
  const run = await fixture('rules4-claim.json');
  const pool = createReplayPool({ size: 1, timeoutMs: 5 });
  t.after(() => pool.close());
  const timedOut = await outcome(pool.verify(run, 1));
  assert.equal(timedOut.status, 503);
  assert.equal(timedOut.message, BUSY_MESSAGE);
  assert.equal(pool.stats.timeouts, 1);
  // The same pool keeps working: the next job runs on a fresh worker (and times out too).
  assert.equal((await outcome(pool.verify(run, 1))).status, 503);
  assert.equal(pool.stats.timeouts, 2);
  // With a realistic timeout the replay completes.
  const pool2 = createReplayPool({ size: 1, timeoutMs: 30000 });
  t.after(() => pool2.close());
  assert.equal((await pool2.verify(run, 1)).act, 1);
  assert.equal(pool.workers, 0); // the timed-out worker is gone
});

test('a crashing worker fails its job cleanly (plain Error → 500) and is replaced', async t => {
  // A worker that dies on its first message.
  const crashing = new URL('data:text/javascript,' + encodeURIComponent("import { parentPort } from 'node:worker_threads'; parentPort.on('message', () => process.exit(3));"));
  const pool = createReplayPool({ size: 1, workerUrl: crashing });
  t.after(() => pool.close());
  const first = await outcome(pool.verify({}, 1));
  assert.equal(first.internal, true);
  assert.match(first.message, /died/);
  const second = await outcome(pool.verify({}, 1));
  assert.equal(second.internal, true);
  assert.equal(pool.stats.crashes, 2);
});

test('idle workers are terminated after idleMs and restarted on demand', async t => {
  const run = await fixture('rules4-claim.json');
  const pool = createReplayPool({ size: 1, idleMs: 50 });
  t.after(() => pool.close());
  assert.equal((await pool.verify(run, 1)).act, 1);
  assert.equal(pool.workers, 1);
  await new Promise(r => setTimeout(r, 300));
  assert.equal(pool.workers, 0);
  assert.equal((await pool.verify(run, 1)).act, 1);
});

test('close() rejects waiting jobs with 503 and terminates the workers', async () => {
  const run = await fixture('rules4-claim.json');
  const pool = createReplayPool({ size: 1 });
  const first = outcome(pool.verify(run, 1));
  const waiting = outcome(pool.verify(run, 1));
  await pool.close();
  assert.equal((await waiting).status, 503);
  await first; // terminated mid-job: fails, never hangs
  assert.equal(pool.workers, 0);
  assert.equal((await outcome(pool.verify(run, 1))).status, 503);
});
