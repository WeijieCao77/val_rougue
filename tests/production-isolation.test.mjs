import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.mjs'], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        reject(new Error('Server start timeout'));
        child.kill();
      }
    }, 10000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const parts = stdout.split('http://0.0.0.0:');
      if (parts.length > 1 && !resolved) {
        const port = parseInt(parts[1], 10);
        if (!isNaN(port)) {
          resolved = true;
          clearTimeout(timer);
          resolve({ child, port, stderr });
        }
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('exit', (code) => {
      if (!resolved) {
        clearTimeout(timer);
        reject(new Error(`Server exited early: ${code} stderr=${stderr}`));
      }
    });
    child.on('error', (err) => {
      if (!resolved) {
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

async function stopServer({ child }) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    child.on('exit', resolve);
    child.kill('SIGTERM');
  });
}

function safeRm(dir) {
  const resolved = path.resolve(dir);
  const tmp = path.resolve(tmpdir());
  if (!resolved.startsWith(tmp + path.sep) || !path.basename(resolved).startsWith('wa-demo-test-')) {
    throw new Error(`Unsafe delete path: ${resolved}`);
  }
  return rm(resolved, { recursive: true, force: true });
}

test('production isolation for new demo', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wa-demo-test-'));
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      !key.startsWith('RAILWAY_') && key !== 'DATABASE_URL' && key !== 'ENABLE_NEW_DEMO'
    )
  );

  const cases = [
    {
      name: 'local',
      env: { NODE_ENV: 'test', PORT: '0', DATA_DIR: path.join(root, 'local') },
      expectEnabled: true,
    },
    {
      name: 'local-disable-flag',
      env: { NODE_ENV: 'test', PORT: '0', DATA_DIR: path.join(root, 'local-disable-flag'), ENABLE_NEW_DEMO: 'false' },
      expectEnabled: false,
    },
    {
      name: 'prod-node-env',
      env: { NODE_ENV: 'production', PORT: '0', DATA_DIR: path.join(root, 'prod-node'), ENABLE_NEW_DEMO: 'true' },
      expectEnabled: false,
    },
    {
      name: 'railway-env-id',
      env: { NODE_ENV: 'test', PORT: '0', DATA_DIR: path.join(root, 'railway-env-id'), RAILWAY_ENVIRONMENT_ID: 'abc' },
      expectEnabled: false,
    },
    {
      name: 'railway-project-id',
      env: { NODE_ENV: 'test', PORT: '0', DATA_DIR: path.join(root, 'railway-project-id'), RAILWAY_PROJECT_ID: 'abc' },
      expectEnabled: false,
    },
    {
      name: 'railway-service-name',
      env: { NODE_ENV: 'test', PORT: '0', DATA_DIR: path.join(root, 'railway-service-name'), RAILWAY_SERVICE_NAME: 'abc' },
      expectEnabled: false,
    },
  ];

  try {
    for (const c of cases) {
      const serverEnv = { ...cleanEnv, ...c.env };
      const server = await startServer(serverEnv);
      const port = server.port;
      try {
        // runtime config check
        const configRes = await fetch(`http://127.0.0.1:${port}/runtime-config.js`);
        assert.equal(configRes.status, 200);
        const configBody = await configRes.text();
        if (c.expectEnabled) {
          assert.ok(configBody.includes('newDemoEnabled: true'), `Config should enable new demo for ${c.name}`);
        } else {
          assert.ok(configBody.includes('newDemoEnabled: false'), `Config should disable new demo for ${c.name}`);
        }

        // static path tests for all new demo assets
        const paths = [
          '/new/',
          '/new/engine.js',
          '/new/content.js',
          '/new/ui.js',
          '/new/art.js',
          '/new/fx.js',
          '/new/presentation.css',
          '/new/style.css',
          '/new/season-map.js',
        ];
        for (const p of paths) {
          const getRes = await fetch(`http://127.0.0.1:${port}${p}`);
          assert.equal(getRes.status, c.expectEnabled ? 200 : 404, `GET ${p} status for ${c.name}`);
          const headRes = await fetch(`http://127.0.0.1:${port}${p}`, { method: 'HEAD' });
          assert.equal(headRes.status, c.expectEnabled ? 200 : 404, `HEAD ${p} status for ${c.name}`);
        }

        // additional checks when disabled
        if (!c.expectEnabled) {
          const noSlashRes = await fetch(`http://127.0.0.1:${port}/new`);
          assert.equal(noSlashRes.status, 404, `GET /new (without slash) should 404 for ${c.name}`);
          const encodedRes = await fetch(`http://127.0.0.1:${port}/%6eew/engine.js`);
          assert.equal(encodedRes.status, 404, `GET /%6eew/engine.js should 404 for ${c.name}`);
        }

        // encoded path should be 404 in all test cases
        const encPath = '/new/%E4%B8%AD';
        const encRes = await fetch(`http://127.0.0.1:${port}${encPath}`);
        assert.equal(encRes.status, 404, `Encoded path should 404 for ${c.name}`);

        // root and /pvp/ should always be 200
        const rootRes = await fetch(`http://127.0.0.1:${port}/`);
        assert.equal(rootRes.status, 200);
        const pvpRes = await fetch(`http://127.0.0.1:${port}/pvp/`);
        assert.equal(pvpRes.status, 200);
      } finally {
        await stopServer(server);
      }
    }
  } finally {
    await safeRm(root);
  }
});
