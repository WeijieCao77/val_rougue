import http from 'node:http';
import {readFile} from 'node:fs/promises';

// Only browser build artifacts are public; source, fixtures and tools stay private.
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/art-gallery.html', ['art-gallery.html', 'text/html; charset=utf-8']],
]);
const imageTypes={png:'image/png',jpg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'};
const port = Number(process.env.PORT || 4177);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid PORT');

const server = http.createServer(async (req, res) => {
  const send = (status, body, type = 'text/plain; charset=utf-8', headers = {}) => {
    res.writeHead(status, {
      'Content-Type': type, 'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  if (!['GET', 'HEAD'].includes(req.method)) {
    send(405, 'Method not allowed', undefined, {Allow: 'GET, HEAD'}); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { send(400, 'Bad request'); return; }
  if (pathname === '/healthz') { send(200, '{"status":"ok"}', 'application/json'); return; }
  const imagePath=pathname.match(/^\/assets\/(players|special|opponents)\/[A-Za-z0-9_-]+\.(png|jpg|webp|svg)$/);
  const asset = assets.get(pathname) || (imagePath ? [pathname.slice(1),imageTypes[imagePath[2]]] : null);
  if (!asset) { send(404, 'Not found'); return; }
  try {
    send(200, await readFile(new URL(asset[0], import.meta.url)), asset[1]);
  } catch (error) { send(imagePath&&error.code==='ENOENT'?404:500, 'Unable to read game file'); }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`登峰赛季: http://0.0.0.0:${server.address().port}`);
});
