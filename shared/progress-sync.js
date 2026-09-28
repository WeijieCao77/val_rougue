// Progress sync between devices (shared by both demos; each passes its own config and
// syncs separately). Plain ES module with named exports and no imports: bundled into
// the Wa app.js by tools/build-browser.mjs, imported directly by the new demo.
//
// cfg = {
//   demo: 'wa' | 'new',          // server namespace
//   metaKey,                     // localStorage key of this device's sync state (never synced)
//   keys: [storageKey…],         // progress keys (run save, unlocks, achievements, settings…)
//   prefixes: [prefix…],         // dynamic keys, e.g. per-phase flags
//   alias: { storageKey: name }, // name used inside the bundle
//   shrink: { storageKey: value => value }, // drop bulky, UI-only data before upload
//   core: [storageKey…],         // keys that mean real progress (else only settings)
// }
//
// Pure helpers (collectBundle / applyBundle / bundleHash / resolveSyncResponse) are
// unit-tested; initProgressSync wires the auto-sync loop and the cover panel.

export const SYNC_MAX_BYTES = 500 * 1024;
const PUSH_EVERY_MS = 30 * 1000;
const TICK_MS = 10 * 1000;
const RECHECK_AFTER_HIDDEN_MS = 60 * 1000;

export function progressKeys(storage, cfg) {
  const out = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key == null || key === cfg.metaKey) continue;
    if ((cfg.keys || []).includes(key) || (cfg.prefixes || []).some(p => key.startsWith(p))) out.push(key);
  }
  return out.sort();
}

export function collectBundle(storage, cfg) {
  const keys = {};
  for (const key of progressKeys(storage, cfg)) {
    let value = storage.getItem(key);
    if (value == null) continue;
    const shrink = cfg.shrink?.[key];
    if (shrink) { try { value = shrink(value); } catch {} }
    keys[cfg.alias?.[key] || key] = value;
  }
  return { v: 1, demo: cfg.demo, keys };
}

// Replace this demo's progress with the bundle's: keys missing from the bundle are
// removed (e.g. a run that ended on the other device), everything else is written.
export function applyBundle(storage, cfg, bundle) {
  if (!bundle || bundle.v !== 1 || bundle.demo !== cfg.demo || !bundle.keys) throw new Error('bad bundle');
  const reverse = Object.fromEntries(Object.entries(cfg.alias || {}).map(([k, v]) => [v, k]));
  const wanted = new Map();
  for (const [name, value] of Object.entries(bundle.keys)) {
    const key = reverse[name] || name;
    const allowed = (cfg.keys || []).includes(key) || (cfg.prefixes || []).some(p => key.startsWith(p));
    if (allowed && key !== cfg.metaKey && typeof value === 'string') wanted.set(key, value);
  }
  for (const key of progressKeys(storage, cfg)) if (!wanted.has(key)) storage.removeItem(key);
  for (const [key, value] of wanted) storage.setItem(key, value);
}

// FNV-1a over the canonical JSON (keys sorted by progressKeys) – change detection only.
export function bundleHash(bundle) {
  const text = JSON.stringify(bundle.keys);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}.${text.length}`;
}

export function bundleBytes(bundle) {
  return new TextEncoder().encode(JSON.stringify(bundle)).length;
}

// What to do with a /api/sync/sync (or redeem / restore) answer, given the device's
// sync meta. Returns { meta, apply: bundle|null, notice: string|null }.
export function resolveSyncResponse(meta, res, sentHash, nowTime = Date.now()) {
  const next = { ...meta, rev: res.rev, backup: res.backup ?? null, lastSyncAt: nowTime };
  if (res.status === 'pushed') {
    next.hash = sentHash;
    return { meta: next, apply: null, notice: res.conflict ? '两台设备都有新进度：已保留较新的这一份，另一份存为备份。' : null };
  }
  if (res.status === 'pulled' || res.status === 'restored' || res.status === 'redeemed') {
    next.rebase = true; // re-read the hash after the game has booted on the new data
    next.dirty = false;
    const ago = agoText(res.savedAt, nowTime);
    const notice = res.status === 'restored' ? '已恢复备份的进度。'
      : res.status === 'redeemed' ? '已连接另一台设备，进度已同步。'
      : res.conflict ? `两台设备都有新进度：另一台设备的更新（${ago}）较新，已采用；这台设备的进度存为备份，可在“进度同步”里恢复。`
      : `已同步另一台设备的进度（${ago}）。`;
    return { meta: next, apply: res.bundle, notice };
  }
  return { meta: next, apply: null, notice: null };
}

export function agoText(time, nowTime = Date.now()) {
  if (!Number.isFinite(time)) return '刚刚';
  const min = Math.max(0, Math.round((nowTime - time) / 60000));
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} 小时前` : `${Math.round(h / 24)} 天前`;
}

export function deviceLabel(ua = globalThis.navigator?.userAgent || '') {
  if (/iPad|Tablet/i.test(ua)) return '平板';
  return /Mobi|Android|iPhone/i.test(ua) ? '手机' : '电脑';
}

// ---------------------------------------------------------------------------- UI

const CSS = `
.ps-links{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.ps-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border:1px solid #8fc6c299;border-radius:6px;background:#0d151ccc;color:#e6f1ee;font:600 14px system-ui,"Microsoft YaHei",sans-serif;letter-spacing:.06em;cursor:pointer;position:relative}
.ps-btn i{width:8px;height:8px;border-radius:50%;background:#5b6b6f}
.ps-btn.on i{background:#58d68d;box-shadow:0 0 6px #58d68d}
.ps-wrap{position:fixed;inset:0;z-index:5001;display:grid;place-items:center;padding:16px;background:#03070bc4;opacity:0;pointer-events:none;transition:opacity .2s}
.ps-wrap.open{opacity:1;pointer-events:auto}
.ps{width:min(420px,100%);max-height:calc(100dvh - 32px);overflow-y:auto;border:1px solid #8fc6c255;border-radius:10px;background:linear-gradient(#141f28,#0b1219);box-shadow:0 20px 60px #000b;color:#e6f1ee;font-family:system-ui,"Microsoft YaHei",sans-serif;text-align:left}
.ps header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 10px;border-bottom:1px solid #ffffff14}
.ps header h2{margin:0;font-size:19px;letter-spacing:.14em;color:#bfe7e1}
.ps-x{min-width:44px;min-height:44px;border:1px solid #3f5a5c;border-radius:6px;background:#17252a;color:#d5ece8;font-size:18px;cursor:pointer}
.ps-body{display:grid;gap:12px;padding:14px 16px 18px}
.ps-status{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:6px;background:#ffffff0a;font-size:14px;line-height:1.5}
.ps-status i{flex:none;width:10px;height:10px;border-radius:50%;background:#5b6b6f}
.ps-status.on i{background:#58d68d;box-shadow:0 0 8px #58d68d}
.ps-status.err i{background:#ff6b3d}
.ps-b{min-height:48px;width:100%;padding:0 14px;border:1px solid #8fc6c266;border-radius:6px;background:#15262b;color:#e6f1ee;font:600 15px system-ui,"Microsoft YaHei",sans-serif;letter-spacing:.04em;cursor:pointer}
.ps-b.ps-main{background:#2c7d74;border-color:#58c4b4;color:#fff}
.ps-b.ghost{background:transparent;color:#aebfbd}
.ps-b:disabled{opacity:.5;cursor:default}
.ps-code{font:700 34px/1.1 ui-monospace,Consolas,monospace;letter-spacing:.3em;text-align:center;padding:14px 0 10px;color:#fff;background:#0a1116;border:1px dashed #58c4b4;border-radius:8px}
.ps-note{margin:0;font-size:13px;line-height:1.6;color:#aebfbd}
.ps-row{display:flex;gap:8px}
.ps-in{flex:1;min-width:0;min-height:48px;padding:0 12px;border:1px solid #58c4b4;border-radius:6px;background:#0a1116;color:#fff;font:700 22px ui-monospace,Consolas,monospace;letter-spacing:.25em;text-transform:uppercase}
.ps-row .ps-b{width:auto}
.ps-err{margin:0;font-size:13px;color:#ff9b7a}
.ps-toast{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:5002;width:min(92vw,440px);padding:12px 16px;border:1px solid #58c4b4;border-radius:8px;background:#0d1a1fef;color:#e6f1ee;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif;box-shadow:0 10px 30px #000a;transition:opacity .3s}
@media(prefers-reduced-motion:reduce){.ps-wrap{transition:none}}
`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const safeGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

function readMeta(cfg) {
  try { return JSON.parse(safeGet(cfg.metaKey) || 'null') || {}; } catch { return {}; }
}
function writeMeta(cfg, meta) {
  if (!meta || !meta.syncId) { try { localStorage.removeItem(cfg.metaKey); } catch {} return; }
  safeSet(cfg.metaKey, JSON.stringify(meta));
}

export function syncButtonHtml(cfg) {
  const on = !!readMeta(cfg).syncId;
  return `<button type="button" class="ps-btn${on ? ' on' : ''}" data-progress-sync aria-haspopup="dialog"><i></i>进度同步</button>`;
}

async function post(name, body, { keepalive = false } = {}) {
  const res = await fetch(`/api/sync/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

let ctl = null;

// Start auto-sync for this page (idempotent) and handle [data-progress-sync] clicks.
export function initProgressSync(cfg) {
  if (ctl) return ctl;
  const state = { busy: false, lastPushAt: 0, hiddenAt: 0, error: null, code: null, timer: null };
  const reload = cfg.reload || (() => location.reload());

  const toast = text => {
    if (!text) return;
    const el = document.createElement('div');
    el.className = 'ps-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.append(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 5200);
  };

  const collect = () => collectBundle(localStorage, cfg);

  // Mark local changes: `savedAt` is when this device's progress last changed.
  const observe = () => {
    const meta = readMeta(cfg);
    if (!meta.syncId) return { meta, bundle: null, hash: null };
    const bundle = collect();
    const hash = bundleHash(bundle);
    if (meta.rebase) {
      meta.rebase = false;
      meta.hash = hash;
      meta.localHash = hash;
      meta.dirty = false;
      writeMeta(cfg, meta);
    } else if (hash !== meta.localHash) {
      meta.localHash = hash;
      meta.savedAt = Date.now();
      meta.dirty = hash !== meta.hash;
      writeMeta(cfg, meta);
    }
    return { meta, bundle, hash };
  };

  const adopt = (result) => {
    writeMeta(cfg, result.meta);
    if (result.apply) {
      applyBundle(localStorage, cfg, result.apply);
      if (result.notice) { try { sessionStorage.setItem(`${cfg.metaKey}-notice`, result.notice); } catch {} }
      reload();
      return true;
    }
    if (result.notice) toast(result.notice);
    return false;
  };

  // One round trip: push when dirty, otherwise ask for a newer copy.
  const syncNow = async ({ keepalive = false, force = false } = {}) => {
    if (state.busy) return;
    const { meta, bundle, hash } = observe();
    if (!meta.syncId) return;
    const push = !!meta.dirty;
    if (push && !force && Date.now() - state.lastPushAt < PUSH_EVERY_MS) return;
    if (push && bundleBytes(bundle) > SYNC_MAX_BYTES) { state.error = '进度数据过大，暂时无法同步'; paint(); return; }
    state.busy = true;
    try {
      if (push) state.lastPushAt = Date.now();
      const res = await post('sync', {
        syncId: meta.syncId, secret: meta.secret, rev: meta.rev || 0, dirty: push, device: deviceLabel(),
        ...(push ? { savedAt: meta.savedAt || Date.now(), bundle } : {}),
      }, { keepalive: keepalive && push && bundleBytes(bundle) < 60000 });
      state.error = null;
      const current = readMeta(cfg);
      // Local progress changed again while the request was in flight: keep it dirty.
      const result = resolveSyncResponse(current, res, hash);
      if (push && res.status === 'pushed') result.meta.dirty = current.localHash !== hash;
      adopt(result);
    } catch (err) {
      if (err.status === 401) { writeMeta(cfg, null); state.error = '同步已失效，请重新连接设备'; }
      else state.error = err.status === 429 ? '同步请求过于频繁，稍后自动重试' : '网络不可用，稍后自动重试';
    } finally {
      state.busy = false;
      paint();
    }
  };

  // ------------------------------------------------------------------ panel
  let wrap = null;
  const paint = () => {
    document.querySelectorAll('[data-progress-sync]').forEach(b => b.classList.toggle('on', !!readMeta(cfg).syncId));
    if (!wrap?.classList.contains('open')) return;
    const meta = readMeta(cfg);
    const body = wrap.querySelector('.ps-body');
    const typed = body.querySelector('.ps-in')?.value || '';
    const code = state.code && state.code.expiresAt > Date.now() ? state.code : null;
    const codeHtml = code ? `<div class="ps-code" aria-label="同步码">${esc(code.code)}</div>
      <p class="ps-note">在另一台设备打开同一版本，点“进度同步”→“输入同步码”。同步码 ${Math.max(1, Math.ceil((code.expiresAt - Date.now()) / 60000))} 分钟内有效，只能使用一次。</p>` : '';
    const err = state.error ? `<p class="ps-err">${esc(state.error)}</p>` : '';
    if (meta.syncId) {
      const backup = meta.backup ? `<button type="button" class="ps-b" data-ps="restore">恢复备份（${esc(meta.backup.device || '设备')} · ${esc(agoText(meta.backup.savedAt))}）</button>` : '';
      body.innerHTML = `<div class="ps-status on"><i></i><span>自动同步已开启 · 上次同步 ${esc(meta.lastSyncAt ? agoText(meta.lastSyncAt) : '尚未')}${meta.dirty ? ' · 有新进度待上传' : ''}</span></div>${err}
        ${codeHtml}
        <button type="button" class="ps-b ps-main" data-ps="now" ${state.busy ? 'disabled' : ''}>立即同步</button>
        <button type="button" class="ps-b" data-ps="code">再连接一台设备（生成同步码）</button>
        ${backup}
        <button type="button" class="ps-b ghost" data-ps="off">关闭同步</button>
        <p class="ps-note">开启后，这台设备每 30 秒最多上传一次进度，打开游戏时检查另一台设备的更新。</p>`;
    } else {
      body.innerHTML = `<div class="ps-status"><i></i><span>未开启同步</span></div>${err}
        ${codeHtml || '<button type="button" class="ps-b ps-main" data-ps="code">在这台设备生成同步码</button>'}
        <div class="ps-row"><input class="ps-in" value="${esc(typed)}" maxlength="80" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" placeholder="同步码" aria-label="输入同步码"><button type="button" class="ps-b" data-ps="redeem">连接</button></div>
        <p class="ps-note">输入另一台设备生成的同步码后，这台设备会换成那台设备的进度；这台设备原来的进度存为备份，可以在这里恢复。之后两台设备自动同步。</p>`;
    }
  };

  const run = async (fn) => {
    if (state.busy) return;
    state.busy = true; state.error = null; paint();
    try { await fn(); } catch (err) { state.error = err.message || '操作失败'; } finally { state.busy = false; paint(); }
  };

  const actions = {
    now: () => syncNow({ force: true }),
    code: () => run(async () => {
      const meta = readMeta(cfg);
      if (meta.syncId) {
        const res = await post('code', { demo: cfg.demo, syncId: meta.syncId, secret: meta.secret });
        state.code = res;
        return;
      }
      const bundle = collect();
      if (bundleBytes(bundle) > SYNC_MAX_BYTES) throw new Error('进度数据过大，无法同步');
      const savedAt = Date.now();
      const res = await post('code', { demo: cfg.demo, bundle, savedAt, device: deviceLabel() });
      const hash = bundleHash(bundle);
      writeMeta(cfg, { syncId: res.syncId, secret: res.secret, rev: res.rev, hash, localHash: hash, savedAt, dirty: false, lastSyncAt: Date.now(), backup: res.backup });
      state.code = res;
    }),
    redeem: () => { const code = wrap.querySelector('.ps-in')?.value.trim().toUpperCase() || ''; return run(async () => {
      // A pasted 64-character account credential is not a sync code (it used to be cut to 6 characters).
      if (/^[0-9A-F]{32,}$/.test(code)) throw new Error(cfg.demo === 'wa' ? '这是好友 PvP 的账号凭证，不是同步码。请在另一台设备点「在这台设备生成同步码」，再输入显示的 6 位码。' : '这不是同步码。请在另一台设备点「在这台设备生成同步码」，再输入显示的 6 位码。');
      if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('请输入 6 位同步码（在另一台设备点「在这台设备生成同步码」获得）');
      const own = collect();
      // Keep this device's progress as the backup only if it has any (not just settings).
      const core = (cfg.core || cfg.keys || []).map(k => cfg.alias?.[k] || k);
      const hasOwn = Object.keys(own.keys).some(k => core.includes(k)) && bundleBytes(own) <= SYNC_MAX_BYTES;
      const res = await post('redeem', { demo: cfg.demo, code, device: deviceLabel(), ...(hasOwn ? { bundle: own, savedAt: Date.now() } : {}) });
      const result = resolveSyncResponse({ syncId: res.syncId, secret: res.secret }, { ...res, status: 'redeemed' }, null);
      adopt(result);
    }); },
    restore: () => {
      if (!confirm('用备份替换这台设备当前的进度？当前进度会成为新的备份。')) return;
      return run(async () => {
        const meta = readMeta(cfg);
        const res = await post('restore', { syncId: meta.syncId, secret: meta.secret });
        adopt(resolveSyncResponse(meta, res, null));
      });
    },
    off: () => {
      if (!confirm('关闭这台设备的进度同步？本机进度保留，之后不再自动同步。')) return;
      writeMeta(cfg, null);
      state.code = null;
      paint();
    },
  };

  const open = () => {
    if (!wrap) {
      if (!document.getElementById('ps-style')) {
        const style = document.createElement('style');
        style.id = 'ps-style';
        style.textContent = CSS;
        document.head.append(style);
      }
      wrap = document.createElement('div');
      wrap.className = 'ps-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = '<section class="ps" role="dialog" aria-modal="true" aria-label="进度同步"><header><h2>进度同步</h2><button type="button" class="ps-x" aria-label="关闭">✕</button></header><div class="ps-body"></div></section>';
      document.body.append(wrap);
      wrap.addEventListener('click', e => {
        if (e.target === wrap || e.target.closest('.ps-x')) { close(); return; }
        const act = e.target.closest('[data-ps]')?.dataset.ps;
        if (act && actions[act]) actions[act]();
      });
      wrap.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.ps-in')) actions.redeem(); });
    }
    wrap.classList.add('open');
    wrap.setAttribute('aria-hidden', 'false');
    paint();
    wrap.querySelector('.ps-x').focus();
  };
  const close = () => { wrap?.classList.remove('open'); wrap?.setAttribute('aria-hidden', 'true'); };

  if (!document.getElementById('ps-style')) {
    const style = document.createElement('style');
    style.id = 'ps-style';
    style.textContent = CSS;
    document.head.append(style);
  }
  document.addEventListener('click', e => {
    if (e.target.closest?.('[data-progress-sync]')) { e.preventDefault(); open(); }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && wrap?.classList.contains('open')) close(); });

  // ------------------------------------------------------------------ auto loop
  try {
    const notice = sessionStorage.getItem(`${cfg.metaKey}-notice`);
    if (notice) { sessionStorage.removeItem(`${cfg.metaKey}-notice`); setTimeout(() => toast(notice), 300); }
  } catch {}
  const tick = () => { if (document.visibilityState !== 'hidden') syncNow(); };
  state.timer = setInterval(tick, TICK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      state.hiddenAt = Date.now();
      syncNow({ keepalive: true, force: true });
    } else if (state.hiddenAt && Date.now() - state.hiddenAt > RECHECK_AFTER_HIDDEN_MS) {
      syncNow({ force: true });
    }
  });
  addEventListener('pagehide', () => syncNow({ keepalive: true, force: true }));
  // Boot: after the game has read its saves, check the server copy.
  setTimeout(() => syncNow({ force: true }), cfg.bootDelayMs ?? 1500);

  ctl = { syncNow: () => syncNow({ force: true }), open, close, state };
  return ctl;
}

// For the game to call at natural save points (act end, run end): upload soon.
export function progressSyncNow() {
  ctl?.syncNow();
}
