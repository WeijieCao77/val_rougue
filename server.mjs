import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { openStore } from './online/store.mjs';
import { createOnlineHandler } from './online/api.mjs';

const assets = new Map([
  ['/', ['landing.html', 'text/html; charset=utf-8']],
  ['/index.html', ['landing.html', 'text/html; charset=utf-8']],
  ['/wa/', ['index.html', 'text/html; charset=utf-8']],
  ['/wa/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/character-stage.js', ['character-stage.js', 'text/javascript; charset=utf-8']],
  ['/shared-stage-controller.js', ['shared/character-controller.js', 'text/javascript; charset=utf-8']],
  ['/shared/card-feel.css', ['shared/card-feel.css', 'text/css; charset=utf-8']],
  ['/shared/card-gesture.js', ['shared/card-gesture.js', 'text/javascript; charset=utf-8']],
  ['/shared/touch-feel.js', ['shared/touch-feel.js', 'text/javascript; charset=utf-8']],
  ['/shared/tap-play.js', ['shared/tap-play.js', 'text/javascript; charset=utf-8']],
  ['/shared/coach.js', ['shared/coach.js', 'text/javascript; charset=utf-8']],
  ['/shared/touch-feel.css', ['shared/touch-feel.css', 'text/css; charset=utf-8']],
  ['/shared/card-pile-motion.js', ['shared/card-pile-motion.js', 'text/javascript; charset=utf-8']],
  ['/shared/character-stage.css', ['shared/character-stage.css', 'text/css; charset=utf-8']],
  ['/shared/status-icons.js', ['shared/status-icons.js', 'text/javascript; charset=utf-8']],
  ['/shared/status-icons.css', ['shared/status-icons.css', 'text/css; charset=utf-8']],
  ['/shared/shop-scene.css', ['shared/shop-scene.css', 'text/css; charset=utf-8']],
  ['/shared/sfx.js', ['shared/sfx.js', 'text/javascript; charset=utf-8']],
  ['/shared/juice.js', ['shared/juice.js', 'text/javascript; charset=utf-8']],
  ['/shared/juice.css', ['shared/juice.css', 'text/css; charset=utf-8']],
  ['/shared/run-meta.js', ['shared/run-meta.js', 'text/javascript; charset=utf-8']],
  ['/shared/result-summary.js', ['shared/result-summary.js', 'text/javascript; charset=utf-8']],
  ['/shared/run-meta.css', ['shared/run-meta.css', 'text/css; charset=utf-8']],
  ['/shared/achievements-core.js', ['shared/achievements-core.js', 'text/javascript; charset=utf-8']],
  ['/shared/achievements.css', ['shared/achievements.css', 'text/css; charset=utf-8']],
  ['/shared/models/soldier.glb', ['shared/models/soldier.glb', 'model/gltf-binary']],
  ['/shared/models/hazmat.glb', ['shared/models/hazmat.glb', 'model/gltf-binary']],
  ['/shared/models/enemy.glb', ['shared/models/enemy.glb', 'model/gltf-binary']],
  ['/shared/models/operative-swat.gltf', ['shared/models/operative-swat.gltf', 'model/gltf+json']],
  ['/shared/models/operative-adventurer.gltf', ['shared/models/operative-adventurer.gltf', 'model/gltf+json']],
  ['/shared/models/operative-punk.gltf', ['shared/models/operative-punk.gltf', 'model/gltf+json']],
  ['/shared/models/operative-spacesuit.gltf', ['shared/models/operative-spacesuit.gltf', 'model/gltf+json']],
  ['/cover-wa.webp', ['cover-wa.webp', 'image/webp']],
  ['/art-gallery.html', ['art-gallery.html', 'text/html; charset=utf-8']],
  ['/pvp/', ['online/index.html', 'text/html; charset=utf-8']],
  ['/pvp/client.js', ['online/client.js', 'text/javascript; charset=utf-8']],
  ['/pvp/style.css', ['online/style.css', 'text/css; charset=utf-8']],
  ['/pvp/content.js', ['content.js', 'text/javascript; charset=utf-8']],
  ['/pvp/helper.js', ['wa-online.js', 'text/javascript; charset=utf-8']],
  ['/pvp/regions.js', ['regions.js', 'text/javascript; charset=utf-8']],
  ['/pvp/season-map.js', ['season-map.js', 'text/javascript; charset=utf-8']],
  // content.js / season-map.js import these; without them the PvP page cannot load its modules.
  ['/pvp/regional-expansion.js', ['regional-expansion.js', 'text/javascript; charset=utf-8']],
  ['/pvp/afflictions.js', ['afflictions.js', 'text/javascript; charset=utf-8']],
  ['/pvp/shared-route-generator.js', ['shared-route-generator.js', 'text/javascript; charset=utf-8']],
  ['/new/', ['new-demo/index.html', 'text/html; charset=utf-8']],
  ['/new/engine.js', ['new-demo/engine.js', 'text/javascript; charset=utf-8']],
  ['/new/content.js', ['new-demo/content.js', 'text/javascript; charset=utf-8']],
  ['/new/regional-cards.js', ['new-demo/regional-cards.js', 'text/javascript; charset=utf-8']],
  ['/afflictions.js', ['afflictions.js', 'text/javascript; charset=utf-8']],
  ['/shared-route-generator.js', ['shared-route-generator.js', 'text/javascript; charset=utf-8']],
  ['/shared-unknown-room.js', ['shared-unknown-room.js', 'text/javascript; charset=utf-8']],
  ['/shared-event-core.js', ['shared-event-core.js', 'text/javascript; charset=utf-8']],
  ['/shared-unlock.js', ['shared-unlock.js', 'text/javascript; charset=utf-8']],
  ['/new/events.js', ['new-demo/events.js', 'text/javascript; charset=utf-8']],
  ['/new/rooms.css', ['new-demo/rooms.css', 'text/css; charset=utf-8']],
  ['/new/ui.js', ['new-demo/ui.js', 'text/javascript; charset=utf-8']],
  ['/new/art.js', ['new-demo/art.js', 'text/javascript; charset=utf-8']],
  ['/new/fx.js', ['new-demo/fx.js', 'text/javascript; charset=utf-8']],
  ['/new/juice-hooks.js', ['new-demo/juice-hooks.js', 'text/javascript; charset=utf-8']],
  ['/new/presentation.css', ['new-demo/presentation.css', 'text/css; charset=utf-8']],
  ['/new/cover.css', ['new-demo/cover.css', 'text/css; charset=utf-8']],
  ['/new/battle-redesign.css', ['new-demo/battle-redesign.css', 'text/css; charset=utf-8']],
  ['/new/battle-fx.css', ['new-demo/battle-fx.css', 'text/css; charset=utf-8']],
  ['/new/map-redesign.css', ['new-demo/map-redesign.css', 'text/css; charset=utf-8']],
  ['/new/battle-polish.css', ['new-demo/battle-polish.css', 'text/css; charset=utf-8']],
  ['/new/tactical-theme.css', ['new-demo/tactical-theme.css', 'text/css; charset=utf-8']],
  ['/new/arena.css', ['new-demo/arena.css', 'text/css; charset=utf-8']],
  ['/new/tactical-card.js', ['new-demo/tactical-card.js', 'text/javascript; charset=utf-8']],
  ['/new/cover.webp', ['new-demo/cover.webp', 'image/webp']],
  ['/new/style.css', ['new-demo/style.css', 'text/css; charset=utf-8']],
  ['/new/season-map.js', ['new-demo/season-map.js', 'text/javascript; charset=utf-8']],
  ['/new/run-extras.js', ['new-demo/run-extras.js', 'text/javascript; charset=utf-8']],
  ['/new/run-extras.css', ['new-demo/run-extras.css', 'text/css; charset=utf-8']],
  ['/new/economy.js', ['new-demo/economy.js', 'text/javascript; charset=utf-8']],
  ['/new/economy.css', ['new-demo/economy.css', 'text/css; charset=utf-8']],
  ['/new/phone.css', ['new-demo/phone.css', 'text/css; charset=utf-8']],
  ['/new/run-screens.js', ['new-demo/run-screens.js', 'text/javascript; charset=utf-8']],
  ['/new/achievements.js', ['new-demo/achievements.js', 'text/javascript; charset=utf-8']],
]);

const imageTypes = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' };
const newDemoEnabled = true;
const port = Number(process.env.PORT || 4177);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid PORT');

let store;
let onlineHandler;

try {
  store = await openStore();
  onlineHandler = createOnlineHandler(store);
} catch (err) {
  console.error('存储初始化失败:', err.message);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const send = (status, body, type = 'text/plain; charset=utf-8', headers = {}) => {
    res.writeHead(status, {
      'Content-Type': type,
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  };

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    send(400, 'Bad request');
    return;
  }

  if (pathname === '/healthz') {
    send(200, '{"status":"ok"}', 'application/json');
    return;
  }

  if (pathname === '/runtime-config.js') {
    send(200, `globalThis.DEMO_CONFIG = { newDemoEnabled: ${newDemoEnabled} };`, 'application/javascript; charset=utf-8');
    return;
  }

  if (pathname === '/new' || pathname.startsWith('/new/')) {
    if (!newDemoEnabled) {
      send(404, 'Not found');
      return;
    }
  }

  const url = new URL(req.url, 'http://localhost');
  const handled = await onlineHandler(req, res, url);
  if (handled) return;

  if (!['GET', 'HEAD'].includes(req.method)) {
    send(405, 'Method not allowed', undefined, { Allow: 'GET, HEAD' });
    return;
  }

  const imagePath = pathname.match(/^\/assets\/(players|special|opponents)\/[A-Za-z0-9_-]+\.(png|jpg|webp|svg)$/);
  const asset = assets.get(pathname) || (imagePath ? [pathname.slice(1), imageTypes[imagePath[2]]] : null);
  if (!asset) {
    send(404, 'Not found');
    return;
  }

  try {
    send(200, await readFile(new URL(asset[0], import.meta.url)), asset[1]);
  } catch (error) {
    send(imagePath && error.code === 'ENOENT' ? 404 : 500, 'Unable to read game file');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`登峰赛季: http://0.0.0.0:${server.address().port}`);
});

async function shutdown() {
  console.log('正在关闭服务器...');
  server.close(async () => {
    if (store) {
      try {
        await store.close();
      } catch (err) {
        console.error('存储关闭失败:', err);
      }
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
