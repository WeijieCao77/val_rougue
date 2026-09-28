// Client error capture for every page (Wa, new demo, PvP, landing). Plain ES module
// with named exports and no imports (bundled into the Wa app.js by
// tools/build-browser.mjs, imported directly by the other pages).
//
// initErrorReport({ page, version, getContext }) — once per page: listens to window
//   'error' and 'unhandledrejection'. getContext() returns a coarse game context
//   (screen / phase, act / floor, turn…); only flat numbers, booleans and short strings
//   are sent, and keys that look like identities or secrets are dropped.
// reportError(err, context) — manual report.
// recentErrorMessages(n) — the last captured messages (attached to feedback).
//
// Sent to POST /api/report/error with keepalive. Never tokens, storage dumps or
// nicknames. The same error (message + first stack line) is sent at most once per
// 10 minutes, at most 10 reports per page load. Nothing here may throw or recurse.

const DEDUPE_MS = 10 * 60 * 1000;
const MAX_REPORTS = 10;
const STACK_MAX = 4096;
const DENY_KEY = /token|secret|pass|key|name|nick|mail|phone|auth|cookie|storage/i;
// Browser / extension noise that says nothing about the game.
const IGNORE = /^(Script error\.?|ResizeObserver loop|Non-Error promise rejection captured)/i;

let cfg = { page: 'unknown', version: '', getContext: null, endpoint: '/api/report/error', transport: null };
let installed = false;
let busy = false;
let sentCount = 0;
const lastSent = new Map();
const recent = [];

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

function safeContext(extra) {
  const out = {};
  const add = obj => {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj).slice(0, 30)) {
      if (Object.keys(out).length >= 14 || DENY_KEY.test(k)) continue;
      const v = obj[k];
      if (typeof v === 'number' && isFinite(v)) out[k] = v;
      else if (typeof v === 'boolean') out[k] = v;
      else if (typeof v === 'string') out[k] = clip(v, 60);
    }
  };
  try { add(cfg.getContext ? cfg.getContext() : null); } catch {}
  try { add(extra); } catch {}
  return out;
}

// Coarse state for the feedback modal (same filtering as error reports).
export function gameContext() {
  return safeContext(null);
}

export function clientInfo() {
  const info = { page: cfg.page, version: cfg.version };
  try { info.path = location.pathname; } catch {}
  try { info.viewport = `${Math.round(innerWidth)}x${Math.round(innerHeight)}`; } catch {}
  return info;
}

export function recentErrorMessages(n = 3) {
  return recent.slice(-n).map(e => e.message);
}

function send(payload) {
  const body = JSON.stringify(payload);
  if (cfg.transport) { cfg.transport(cfg.endpoint, body); return; }
  if (typeof fetch !== 'function') return;
  const p = fetch(cfg.endpoint, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body });
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

export function reportError(err, context) {
  if (busy) return false;
  busy = true;
  try {
    const isErr = err && typeof err === 'object';
    const message = clip(isErr ? (err.message || err.name || String(err)) : err, 500).trim() || 'Unknown error';
    if (IGNORE.test(message)) return false;
    const stack = clip(isErr && typeof err.stack === 'string' ? err.stack : '', STACK_MAX);
    const firstLine = stack.split('\n').map(s => s.trim()).find(s => /^at |@/.test(s)) || '';
    const key = `${message}|${firstLine}`;
    recent.push({ message: clip(message, 200), at: Date.now() });
    if (recent.length > 10) recent.shift();
    const now = Date.now();
    const last = lastSent.get(key);
    if (last && now - last < DEDUPE_MS) return false;
    if (sentCount >= MAX_REPORTS) return false;
    lastSent.set(key, now);
    sentCount++;
    let ua = '';
    try { ua = clip(navigator.userAgent, 300); } catch {}
    send({ ...clientInfo(), ua, message, stack, context: safeContext(context) });
    return true;
  } catch {
    return false;
  } finally {
    busy = false;
  }
}

export function initErrorReport(options = {}) {
  try {
    cfg = {
      ...cfg,
      page: clip(options.page || cfg.page, 20),
      version: clip(options.version || cfg.version, 24),
      getContext: typeof options.getContext === 'function' ? options.getContext : cfg.getContext,
      endpoint: options.endpoint || cfg.endpoint,
      transport: typeof options.transport === 'function' ? options.transport : cfg.transport,
    };
    if (installed || typeof addEventListener !== 'function') return;
    installed = true;
    addEventListener('error', e => {
      try {
        // Resource load errors (img/script 404) have no .error and no message.
        if (!e || (!e.error && !e.message)) return;
        reportError(e.error || { message: e.message, stack: e.filename ? `at ${e.filename}:${e.lineno}:${e.colno}` : '' }, { source: 'error' });
      } catch {}
    });
    addEventListener('unhandledrejection', e => {
      try {
        const r = e && e.reason;
        reportError(r && typeof r === 'object' ? r : { message: `Unhandled rejection: ${clip(r, 300)}` }, { source: 'rejection' });
      } catch {}
    });
  } catch {}
}

// Registers / replaces the context callback after init (e.g. once state exists).
export function registerGameContext(fn) {
  if (typeof fn === 'function') cfg.getContext = fn;
}

// Tests only.
export function resetErrorReportForTests() {
  sentCount = 0;
  lastSent.clear();
  recent.length = 0;
  busy = false;
}
