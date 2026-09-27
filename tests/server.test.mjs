import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync, brotliDecompressSync} from 'node:zlib';

test('Railway server uses PORT and serves only public build assets', async t => {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('../', import.meta.url), env: {...process.env, PORT: '0'}, windowsHide: true,
  });
  const exited = new Promise(resolve => child.once('exit', resolve));
  t.after(async () => { child.kill(); await exited; });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Server startup timed out')), 10000);
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/0\.0\.0\.0:(\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    child.once('error', err => { clearTimeout(timer); reject(err); });
    child.once('exit', code => { clearTimeout(timer); reject(Error(`Early server exit ${code}`)); });
  });
  const request = (path, options) => fetch(`http://127.0.0.1:${port}${path}`, options);
  for (const [path, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/style.css', 'text/css'], ['/character-stage.js', 'text/javascript'], ['/shared-stage-controller.js', 'text/javascript'], ['/shared/card-feel.css', 'text/css'], ['/shared/character-stage.css', 'text/css'], ['/art-gallery.html','text/html'], ['/assets/players/CN06.png','image/png'], ['/assets/special/CU01.svg','image/svg+xml'], ['/healthz?probe=1', 'application/json']]) {
    const response = await request(path); assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').startsWith(type));
    assert.ok((await response.text()).length > 0);
    const head = await request(path, {method: 'HEAD'}); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  }
  for (const path of ['/engine.js', '/ui-source.js', '/package.json', '/.git/config', '/.env', '/tests/fixtures/legacy.json', '/tools/build-browser.mjs', '/reports/test.json', '/missing', '/assets/players/missing.png', '/assets/players/../../reports/test.json', '/assets/player-sources.json', '/assets/players/test.html']) {
    assert.equal((await request(path)).status, 404, path);
  }
  assert.equal((await request('/%ZZ')).status, 400);
  const post = await request('/', {method: 'POST'}); assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD');
});

// Raw HTTP (no transparent decompression) so the test sees exactly what is on the wire.
function raw(port, path, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port, path, method, headers}, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks)}));
    });
    req.on('error', reject);
    req.end();
  });
}

test('static files: gzip / brotli for text, ETag + 304, Cache-Control per type; API stays no-store', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'server-static-'));
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('../', import.meta.url), env: {...process.env, PORT: '0', DATA_DIR: dataDir}, windowsHide: true,
  });
  const exited = new Promise(resolve => child.once('exit', resolve));
  t.after(async () => { child.kill(); await exited; rmSync(dataDir, {recursive: true, force: true}); });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Server startup timed out')), 10000);
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/0\.0\.0\.0:(\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.once('exit', code => { clearTimeout(timer); reject(Error(`Early server exit ${code}`)); });
  });
  const root = new URL('../', import.meta.url);

  for (const [path, file] of [['/app.js', 'app.js'], ['/style.css', 'style.css'], ['/', 'landing.html'], ['/new/ui.js', 'new-demo/ui.js']]) {
    const original = readFileSync(new URL(file, root));
    const gz = await raw(port, path, {'accept-encoding': 'gzip'});
    assert.equal(gz.status, 200, path);
    assert.equal(gz.headers['content-encoding'], 'gzip', path);
    assert.equal(gz.headers.vary, 'Accept-Encoding', path);
    assert.equal(gz.headers['cache-control'], 'no-cache', path);
    assert.equal(gz.headers['x-content-type-options'], 'nosniff', path);
    assert.equal(Number(gz.headers['content-length']), gz.body.length, path);
    assert.ok(gunzipSync(gz.body).equals(original), path);
    const br = await raw(port, path, {'accept-encoding': 'gzip, deflate, br'});
    assert.equal(br.headers['content-encoding'], 'br', path);
    assert.ok(brotliDecompressSync(br.body).equals(original), path);
    assert.ok(br.body.length < gz.body.length && gz.body.length < original.length / 2, path);
    const plain = await raw(port, path);
    assert.equal(plain.headers['content-encoding'], undefined, path);
    assert.ok(plain.body.equals(original), path);
    // Same ETag for every encoding; 304 with no body on revalidation (also for HEAD).
    assert.ok(plain.headers.etag && plain.headers.etag === gz.headers.etag && plain.headers['last-modified'], path);
    const revalidated = await raw(port, path, {'if-none-match': plain.headers.etag, 'accept-encoding': 'gzip'});
    assert.equal(revalidated.status, 304, path);
    assert.equal(revalidated.body.length, 0, path);
    assert.equal(revalidated.headers.etag, plain.headers.etag, path);
    assert.equal((await raw(port, path, {'if-none-match': plain.headers.etag}, 'HEAD')).status, 304, path);
    assert.equal((await raw(port, path, {'if-modified-since': plain.headers['last-modified']})).status, 304, path);
    assert.equal((await raw(port, path, {'if-none-match': 'W/"stale"'})).status, 200, path);
    const head = await raw(port, path, {'accept-encoding': 'gzip'}, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    assert.equal(head.headers['content-length'], gz.headers['content-length']);
  }

  // Tiny files (< 1 KB, e.g. the 900-byte /wa/ entry page) are not worth compressing.
  const tiny = await raw(port, '/wa/', {'accept-encoding': 'gzip, br'});
  assert.equal(tiny.status, 200);
  assert.equal(tiny.headers['content-encoding'], undefined);
  assert.equal(tiny.headers['cache-control'], 'no-cache');
  assert.equal((await raw(port, '/wa/', {'if-none-match': tiny.headers.etag})).status, 304);

  // Images: never re-compressed, cached for a week, still revalidated by ETag.
  for (const path of ['/assets/players/CN06.png', '/cover-wa.webp', '/new/cover.webp']) {
    const img = await raw(port, path, {'accept-encoding': 'gzip, br'});
    assert.equal(img.status, 200, path);
    assert.equal(img.headers['content-encoding'], undefined, path);
    assert.equal(img.headers['cache-control'], 'public, max-age=604800', path);
    assert.equal((await raw(port, path, {'if-none-match': img.headers.etag})).status, 304, path);
  }
  const svg = await raw(port, '/assets/special/CU01.svg', {'accept-encoding': 'gzip'});
  assert.equal(svg.headers['cache-control'], 'public, max-age=604800');

  // API, health and runtime config stay no-store and uncompressed.
  for (const path of ['/api/account', '/healthz', '/runtime-config.js']) {
    const r = await raw(port, path, {'accept-encoding': 'gzip, br'});
    assert.equal(r.headers['cache-control'], 'no-store', path);
    assert.equal(r.headers.etag, undefined, path);
    assert.equal(r.headers['content-encoding'], undefined, path);
  }
  // Whitelist unchanged: server-only modules (replay workers, static cache) are never served.
  for (const path of ['/online/replay-worker.mjs', '/online/replay-pool.mjs', '/online/claim-verify.mjs', '/online/http-error.mjs', '/static-cache.mjs', '/online/api.mjs', '/missing']) {
    const r = await raw(port, path);
    assert.equal(r.status, 404, path);
    assert.equal(r.headers['cache-control'], 'no-store', path);
  }

  // A claim through the real server goes through the worker pool and answers as before.
  const base = `http://127.0.0.1:${port}`;
  const account = await (await fetch(`${base}/api/account`, {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'})).json();
  const claim = body => fetch(`${base}/api/archive/claim`, {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${account.token}`}, body: JSON.stringify(body)});
  const run = JSON.parse(readFileSync(new URL('tests/fixtures/rules4-claim.json', root), 'utf8'));
  const saved = await claim({run, act: 1});
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), {status: 'saved'});
  const bad = await claim({run: {...run, rules: 99}, act: 1});
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), {error: '无效的规则版本'});
});
