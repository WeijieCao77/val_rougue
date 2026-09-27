// Static file responses for server.mjs: ETag / Last-Modified revalidation (304),
// Cache-Control per file type, and gzip / brotli for text files, compressed once per
// file version (path + mtime + size) and kept in memory. Server-only module: it is not in
// the static whitelist and is never served.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);

// Text formats worth compressing. Images (png/jpg/webp), fonts (woff2) and .glb models
// are already compressed or binary and are sent as they are.
const COMPRESSIBLE = /^(text\/|application\/(javascript|json)|image\/svg\+xml|model\/gltf\+json)/;
const MIN_COMPRESS_BYTES = 1024;

// Entry pages and ES modules are fetched by fixed URLs, so they must be revalidated on
// every load (a new deploy shows at once; unchanged files cost a 304). Media change
// rarely and may be cached for a week.
const WEEK = 'public, max-age=604800';
export function cacheControlFor(type) {
  if (/^(image\/(png|jpeg|webp|svg\+xml)|font\/|model\/gltf-binary)/.test(type)) return WEEK;
  return 'no-cache';
}

export function isCompressible(type) {
  return COMPRESSIBLE.test(type);
}

// Accept-Encoding → { br, gzip } (q=0 excluded).
export function acceptedEncodings(header) {
  if (!header) return { br: false, gzip: false };
  const accepted = new Map();
  for (const part of String(header).split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    const q = params.map(p => p.trim()).find(p => p.startsWith('q='));
    accepted.set(name, q ? Number(q.slice(2)) : 1);
  }
  const ok = name => (accepted.get(name) ?? accepted.get('*') ?? 0) > 0;
  return { br: ok('br'), gzip: ok('gzip') };
}

// If-None-Match (weak comparison) takes precedence over If-Modified-Since (RFC 9110).
export function isNotModified(req, etag, mtimeMs) {
  const inm = req.headers['if-none-match'];
  if (inm) {
    const bare = etag.replace(/^W\//, '');
    return inm.split(',').some(tag => { const t = tag.trim(); return t === '*' || t.replace(/^W\//, '') === bare; });
  }
  const ims = Date.parse(req.headers['if-modified-since'] || '');
  return Number.isFinite(ims) && Math.floor(mtimeMs / 1000) * 1000 <= ims;
}

export function createStaticCache() {
  // absolute file path → { key, etag, lastModified, mtimeMs, size, raw?, gzip?, br? }
  const entries = new Map();
  const loading = new Map();

  async function load(file, type) {
    const info = await stat(file);
    const key = `${info.mtimeMs}:${info.size}`;
    const cached = entries.get(file);
    if (cached?.key === key) return cached;
    const pendingKey = `${file}|${key}`;
    if (loading.has(pendingKey)) return loading.get(pendingKey);
    const promise = (async () => {
      const raw = await readFile(file);
      const entry = {
        key,
        // Content hash: a redeploy that leaves a file unchanged keeps its ETag, so
        // returning players still get 304s after a deploy.
        etag: `W/"${createHash('sha1').update(raw).digest('base64url').slice(0, 22)}"`,
        lastModified: new Date(info.mtimeMs).toUTCString(),
        mtimeMs: info.mtimeMs,
        size: raw.length,
      };
      if (isCompressible(type)) {
        entry.raw = raw;
        if (raw.length >= MIN_COMPRESS_BYTES) {
          const [gz, br] = await Promise.all([
            gzip(raw, { level: 9 }),
            brotli(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } }),
          ]);
          if (gz.length < raw.length) entry.gzip = gz;
          if (br.length < raw.length) entry.br = br;
        }
      }
      entries.set(file, entry);
      return entry;
    })().finally(() => loading.delete(pendingKey));
    loading.set(pendingKey, promise);
    return promise;
  }

  // Writes the full response (200 / 304). Throws fs errors (ENOENT …) to the caller.
  async function serve(req, res, file, type, securityHeaders) {
    const entry = await load(file, type);
    const compressible = isCompressible(type);
    const headers = {
      ...securityHeaders,
      'Cache-Control': cacheControlFor(type),
      ETag: entry.etag,
      'Last-Modified': entry.lastModified,
      ...(compressible ? { Vary: 'Accept-Encoding' } : {}),
    };
    if (isNotModified(req, entry.etag, entry.mtimeMs)) {
      res.writeHead(304, headers);
      res.end();
      return 304;
    }
    let body = entry.raw ?? await readFile(file);
    const accepts = acceptedEncodings(compressible ? req.headers['accept-encoding'] : '');
    if (accepts.br && entry.br) { body = entry.br; headers['Content-Encoding'] = 'br'; }
    else if (accepts.gzip && entry.gzip) { body = entry.gzip; headers['Content-Encoding'] = 'gzip'; }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length, ...headers });
    res.end(req.method === 'HEAD' ? undefined : body);
    return 200;
  }

  // Compress every text file ahead of the first request (runs on the libuv pool).
  async function warm(files) {
    for (const [file, type] of files) {
      try { await load(file, type); } catch { /* missing optional file: served as 404/500 later */ }
    }
  }

  return { serve, warm, entries };
}
