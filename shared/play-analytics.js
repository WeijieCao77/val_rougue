// Anonymous play statistics for every page (landing, 登峰赛季, 战术试炼, 好友 PvP).
// Plain ES module with named exports and no imports: bundled into the Wa app.js by
// tools/build-browser.mjs, imported directly by the other pages.
// Server side: online/analytics-api.mjs; what is collected: docs/BACKUP-AND-MONITORING.md
// (「玩家统计」).
//
// initAnalytics({ page, version }) — once per page: page_view, a heartbeat every 60 s
//   while the page is visible, batching (sent at most every 30 s, and on page hide with
//   keepalive). Other modules without imports can emit through a DOM event:
//   dispatchEvent(new CustomEvent('pa:track', { detail: { name, props } })).
// track(name, props)       — queue one event (flat numbers / booleans / short strings).
// trackOnce(key, name, p)  — at most once per key on this browser (last 60 keys).
// observeRun(demo, snap)   — fed with the run state after every change; derives
//   run_start / fight_end / run_end from transitions (survives reloads).
// abandonRun(demo, snap)   — the player gave up or started over on top of a run.
//
// Identity: a random visitor id per browser (localStorage, shared by every page) and a
// session id that is renewed after 30 minutes without activity. Never sent: save codes,
// tokens, nicknames, storage contents. When this browser is logged in with a 存档码, the
// account's bearer token goes in the Authorization header only, so the server can link
// the visitor to the account id; it never appears in the event body.
// Nothing here may throw.

const VISITOR_KEY = 'pa-visitor-v1';
const SESSION_KEY = 'pa-session-v1';
const RUN_KEY = 'pa-run-v1';
const ONCE_KEY = 'pa-once-v1';
const TOKEN_KEY = 'wa-online-token';
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SEND_EVERY_MS = 30 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const QUEUE_MAX = 200;
const BATCH_MAX = 50;

let cfg = { page: 'unknown', version: '', endpoint: '/api/analytics', transport: null, storage: undefined, now: () => Date.now() };
let installed = false;
let queue = [];
let lastSend = 0;
let sending = false;
let sendingAt = 0;
let mem = null; // per-demo run memory (mirrors RUN_KEY)
let device = ''; // measured once at start (the viewport can read 0 while a page unloads)

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
const now = () => { try { return cfg.now(); } catch { return Date.now(); } };
function store() {
  if (cfg.storage !== undefined) return cfg.storage;
  try { return globalThis.localStorage || null; } catch { return null; }
}
function get(key) { try { return store()?.getItem(key) ?? null; } catch { return null; } }
function set(key, value) { try { store()?.setItem(key, value); } catch {} }
function getJson(key) { try { const v = JSON.parse(get(key) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } }

function randomId() {
  try {
    const a = new Uint8Array(10);
    globalThis.crypto.getRandomValues(a);
    return [...a].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
  } catch {
    return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 16);
  }
}

export function visitorId() {
  let v = get(VISITOR_KEY);
  if (!v || !/^[a-z0-9]{8,32}$/.test(v)) { v = randomId(); set(VISITOR_KEY, v); }
  return v;
}

// A new session after 30 minutes without any event on any page.
export function sessionId(t = now()) {
  const s = getJson(SESSION_KEY);
  const id = s && typeof s.id === 'string' && /^[a-z0-9]{8,32}$/.test(s.id) && t - (Number(s.last) || 0) < SESSION_IDLE_MS ? s.id : randomId();
  set(SESSION_KEY, JSON.stringify({ id, last: t }));
  return id;
}

// phone / tablet / desktop from the viewport and touch support (no user agent needed).
export function deviceClass(w, touch) {
  try {
    if (w == null) w = Math.min(globalThis.innerWidth || 0, globalThis.screen?.width || globalThis.innerWidth || 0);
    if (touch == null) touch = (globalThis.navigator?.maxTouchPoints || 0) > 0 || !!globalThis.matchMedia?.('(pointer: coarse)')?.matches;
  } catch {}
  if (!touch) return 'desktop';
  return !w || w < 600 ? 'phone' : w && w < 1100 ? 'tablet' : 'desktop';
}

// Coarse browser family only.
export function browserFamily(ua) {
  try { if (ua == null) ua = globalThis.navigator?.userAgent || ''; } catch { ua = ''; }
  if (/MicroMessenger/i.test(ua)) return 'wechat';
  if (/\bQQ\//i.test(ua) || /MQQBrowser/i.test(ua)) return 'qq';
  if (/Edg\//i.test(ua)) return 'edge';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  if (/Chrome|CriOS|Chromium/i.test(ua)) return 'chrome';
  if (/Safari/i.test(ua)) return 'safari';
  return 'other';
}

function cleanProps(props) {
  const out = {};
  if (!props || typeof props !== 'object') return out;
  for (const k of Object.keys(props).slice(0, 16)) {
    const v = props[k];
    if (typeof v === 'number' && isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && v) out[k] = clip(v, 40);
  }
  return out;
}

export function track(name, props) {
  try {
    if (typeof name !== 'string' || !/^[a-z_]{2,32}$/.test(name)) return false;
    const t = now();
    queue.push({ n: name, t, p: cleanProps(props) });
    if (queue.length > QUEUE_MAX) {
      // Drop heartbeats first, then the oldest events.
      const hb = queue.findIndex(e => e.n === 'heartbeat');
      queue.splice(hb >= 0 ? hb : 0, 1);
    }
    sessionId(t);
    if (name !== 'heartbeat' && name !== 'page_view' && t - lastSend >= SEND_EVERY_MS) flush();
    return true;
  } catch { return false; }
}

export function trackOnce(key, name, props) {
  try {
    key = clip(key, 80);
    const list = Array.isArray(getJson(ONCE_KEY)?.k) ? getJson(ONCE_KEY).k : [];
    if (list.includes(key)) return false;
    set(ONCE_KEY, JSON.stringify({ k: [...list, key].slice(-60) }));
    return track(name, props);
  } catch { return false; }
}

function bearer() {
  const t = clip(get(TOKEN_KEY), 80).trim();
  return /^[a-f0-9]{64}$/i.test(t) ? t : null;
}

export function flush({ keepalive = false } = {}) {
  try {
    if (!queue.length || (sending && !keepalive && now() - sendingAt < 60000)) return false;
    const events = queue.splice(0, BATCH_MAX);
    const t = now();
    lastSend = t;
    const body = JSON.stringify({ v: visitorId(), s: sessionId(t), page: cfg.page, ver: cfg.version, dev: (device = device || deviceClass()), br: browserFamily(), now: t, events });
    if (cfg.transport) { cfg.transport(cfg.endpoint, body, { keepalive }); return true; }
    if (typeof fetch !== 'function') return false;
    const headers = { 'Content-Type': 'application/json' };
    const tok = bearer();
    if (tok) headers.Authorization = `Bearer ${tok}`;
    sending = true;
    sendingAt = t;
    const p = fetch(cfg.endpoint, { method: 'POST', keepalive, headers, body });
    const done = () => { sending = false; };
    if (p && typeof p.then === 'function') p.then(done, done); else done();
    if (queue.length && !keepalive) setTimeout(() => flush(), 1000);
    return true;
  } catch { sending = false; return false; }
}

const visible = () => { try { return typeof document === 'undefined' || document.visibilityState !== 'hidden'; } catch { return true; } };

export function initAnalytics(options = {}) {
  try {
    cfg = {
      ...cfg,
      page: clip(options.page || cfg.page, 20),
      version: clip(options.version || cfg.version, 24),
      endpoint: options.endpoint || cfg.endpoint,
      transport: typeof options.transport === 'function' ? options.transport : cfg.transport,
      storage: 'storage' in options ? options.storage : cfg.storage,
      now: typeof options.now === 'function' ? options.now : cfg.now,
    };
    if (installed) return;
    installed = true;
    device = deviceClass();
    track('page_view');
    if (options.timers === false || typeof setInterval !== 'function') return;
    setInterval(() => { if (visible()) track('heartbeat'); }, HEARTBEAT_MS);
    setInterval(() => { if (queue.length && now() - lastSend >= SEND_EVERY_MS) flush(); }, 5000);
    // The first page_view goes out quickly so 「现在在线」 sees short visits too.
    setTimeout(() => flush(), 3000);
    if (typeof addEventListener === 'function') {
      addEventListener('pa:track', e => { try { track(e.detail?.name, e.detail?.props); } catch {} });
      addEventListener('pagehide', () => flush({ keepalive: true }));
      try {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') flush({ keepalive: true });
          else track('heartbeat');
        });
      } catch {}
    }
  } catch {}
}

// ---------------------------------------------------------------- runs
// snap = { key, team, asc, act, floor, phase, inCombat, hp, turn,
//          fight: { enemy, kind: 'normal'|'elite'|'boss', act, floor }, outcome: 'win'|'lose'|'abandon'|null }
function loadMem() {
  if (!mem) mem = getJson(RUN_KEY) || {};
  return mem;
}
function saveMem() { set(RUN_KEY, JSON.stringify(mem)); }

export function observeRun(demo, snap) {
  try {
    if (!snap || !snap.key) return;
    const m = loadMem();
    const key = clip(snap.key, 60);
    let r = m[demo];
    const t = now();
    if (!r || r.key !== key) {
      // Fresh runs only: a run loaded from a cloud save on another device is not a new start.
      const fresh = !snap.outcome && (snap.act || 1) === 1 && (snap.floor || 0) <= 1;
      r = { key, start: fresh ? t : null, fights: 0, ended: !!snap.outcome, inCombat: false, fight: null, turn: 0 };
      if (fresh) track('run_start', { demo, team: snap.team, asc: snap.asc || 0 });
    }
    if (snap.inCombat) {
      if (!r.inCombat || !r.fight) r.fight = { enemy: snap.fight?.enemy || '', kind: snap.fight?.kind || 'normal', act: snap.fight?.act ?? snap.act, floor: snap.fight?.floor ?? snap.floor };
      r.turn = Number(snap.turn) || r.turn || 0;
    } else if (r.inCombat && r.fight) {
      const won = (!snap.outcome || snap.outcome === 'win') && !(snap.hp <= 0);
      if (won) r.fights++;
      track('fight_end', { demo, act: r.fight.act, floor: r.fight.floor, kind: r.fight.kind, won, enemy: r.fight.enemy, turns: r.turn });
      r.last = { enemy: r.fight.enemy, won };
      r.fight = null;
    }
    r.inCombat = !!snap.inCombat;
    if (snap.outcome && !r.ended) {
      r.ended = true;
      const lostTo = snap.outcome === 'lose' && r.last && !r.last.won ? r.last.enemy : '';
      track('run_end', { demo, result: snap.outcome, team: snap.team, asc: snap.asc || 0, act: snap.act, floor: snap.floor, fights: r.fights, mins: r.start ? Math.min(1440, (t - r.start) / 60000) : undefined, enemy: lostTo || undefined });
    }
    m[demo] = r;
    saveMem();
  } catch {}
}

export function abandonRun(demo, snap) {
  try {
    if (!snap || !snap.key || snap.outcome) return;
    observeRun(demo, { ...snap, inCombat: false, outcome: 'abandon' });
  } catch {}
}

// Tests only.
export function resetAnalyticsForTests() {
  queue = [];
  lastSend = 0;
  sending = false;
  mem = null;
  installed = false;
}
export function pendingEvents() { return queue.slice(); }
