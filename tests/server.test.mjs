import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

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
  for (const [path, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/style.css', 'text/css'], ['/art-gallery.html','text/html'], ['/assets/players/CN06.png','image/png'], ['/assets/special/CU01.svg','image/svg+xml'], ['/healthz?probe=1', 'application/json']]) {
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
