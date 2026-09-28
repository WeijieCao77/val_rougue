// 存档码: one permanent personal save code = account + cloud save (shared by every page;
// each demo passes its own config and saves its progress separately). Plain ES module
// with named exports and no imports: bundled into the Wa app.js by
// tools/build-browser.mjs, imported directly by the new demo and the PvP page.
//
// cfg = {
//   demo: 'wa' | 'new' | null,   // server namespace (null: account only, e.g. the PvP page)
//   metaKey,                     // localStorage key of this device's save state (never uploaded)
//   keys: [storageKey…],         // progress keys (run save, unlocks, achievements, settings…)
//   prefixes: [prefix…],         // dynamic keys, e.g. per-phase flags
//   alias: { storageKey: name }, // name used inside the bundle
//   shrink: { storageKey: value => value }, // drop bulky, UI-only data before upload
//   core: [storageKey…],         // keys that mean real progress (else only settings)
//   scope: '你的进度',           // what the code saves, in the panel text
//   reload,                      // how to reload after adopting other progress
// }
//
// The device's login lives in origin-wide localStorage (the same for every page):
// TOKEN_KEY is the account's bearer token (the PvP page uses it unchanged), CODE_KEY the
// 存档码 if this device knows it (it is shown in plain text only where it was created or
// typed; the server keeps only a hash). Pure helpers (collectBundle / applyBundle /
// bundleHash / resolveSyncResponse / normalizeSaveCodeInput / metaAfterAttach) are
// unit-tested; initProgressSync wires the auto-save loop and the 存档码 panel.

export const SYNC_MAX_BYTES = 500 * 1024;
const PUSH_EVERY_MS = 30 * 1000;
const TICK_MS = 10 * 1000;
const RECHECK_AFTER_HIDDEN_MS = 60 * 1000;
export const TOKEN_KEY = 'wa-online-token';
export const PREVIOUS_TOKEN_KEY = 'wa-online-token-previous';
export const CODE_KEY = 'save-code-v1';
export const ACCOUNT_KEY = 'save-account-v1';
export const OPTOUT_KEY = 'save-optout-v1';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

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

// Does the bundle hold real progress (not only settings)?
export function hasCoreProgress(bundle, cfg) {
  const core = (cfg.core || cfg.keys || []).map(k => cfg.alias?.[k] || k);
  return Object.keys(bundle?.keys || {}).some(k => core.includes(k));
}

// Same rules as online/save-api.mjs: 12 characters, any case, dashes / spaces allowed;
// a pasted 64-hex PvP credential is accepted as a legacy login.
export function normalizeSaveCodeInput(input) {
  const compact = String(input ?? '').replace(/[\s\-_–—·.]/g, '');
  if (/^[0-9a-f]{64}$/i.test(compact)) return { kind: 'legacy', value: compact.toLowerCase() };
  const code = compact.toUpperCase();
  if (code.length !== 12 || [...code].some(c => !CODE_ALPHABET.includes(c))) return null;
  return { kind: 'code', value: code.match(/.{4}/g).join('-') };
}

// What to do with a sync / restore answer, given the device's save meta.
// Returns { meta, apply: bundle|null, notice: string|null }.
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
      : res.status === 'redeemed' ? '已载入存档码里的进度。'
      : res.conflict ? `两台设备都有新进度：另一台设备的更新（${ago}）较新，已采用；这台设备的进度存为备份，可在「存档码」里恢复。`
      : `已载入另一台设备保存的进度（${ago}）。`;
    return { meta: next, apply: res.bundle, notice };
  }
  return { meta: next, apply: null, notice: null };
}

// New save meta after /api/save/ensure or /login attached this demo to the account.
// `old` is the previous meta (may be a legacy { syncId, secret } link), `sent` the
// bundle hash this device uploaded (if any). Returns { meta, apply, notice }.
export function metaAfterAttach(old, d, accountId, sent, nowTime = Date.now()) {
  const base = { mode: 'account', accountId, backup: d.backup ?? null, lastSyncAt: nowTime };
  if (d.status === 'linked') {
    const { syncId, secret, ...rest } = old || {};
    return { meta: { ...rest, ...base, rev: Number.isInteger(rest.rev) ? rest.rev : d.rev }, apply: null, notice: null };
  }
  if (d.status === 'pushed') {
    return { meta: { ...base, rev: d.rev, hash: sent?.hash ?? null, localHash: sent?.hash ?? null, savedAt: sent?.savedAt ?? nowTime, dirty: false }, apply: null, notice: null };
  }
  if (d.status === 'adopted') {
    return {
      meta: { ...base, rev: d.rev, rebase: true, dirty: false },
      apply: d.bundle,
      notice: d.keptBackup ? '已载入存档码里的进度；这台设备原来的进度存为备份，可在「存档码」里恢复。' : '已载入存档码里的进度。',
    };
  }
  return { meta: { ...base, rev: 0, dirty: false }, apply: null, notice: null };
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
.ps-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border:1px solid #8fc6c299;border-radius:6px;background:#0d151ccc;color:#e6f1ee;font:600 14px system-ui,"Microsoft YaHei",sans-serif;letter-spacing:.06em;cursor:pointer;position:relative}
.ps-btn i{width:8px;height:8px;border-radius:50%;background:#5b6b6f}
.ps-btn.on i{background:#58d68d;box-shadow:0 0 6px #58d68d}
.ps-btn b{display:none;padding:1px 6px;border-radius:9px;background:#ff6b3d;color:#fff;font-size:12px;letter-spacing:0}
.ps-btn.unseen b{display:inline}
.ps-wrap{position:fixed;inset:0;z-index:5001;display:grid;place-items:center;padding:16px;background:#03070bc4;opacity:0;pointer-events:none;transition:opacity .2s}
.ps-wrap.open{opacity:1;pointer-events:auto}
.ps{width:min(440px,100%);max-height:calc(100dvh - 32px);overflow-y:auto;border:1px solid #8fc6c255;border-radius:10px;background:linear-gradient(#141f28,#0b1219);box-shadow:0 20px 60px #000b;color:#e6f1ee;font-family:system-ui,"Microsoft YaHei",sans-serif;text-align:left}
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
.ps-code{display:block;width:100%;min-height:64px;font:700 clamp(22px,7vw,32px)/1.1 ui-monospace,Consolas,monospace;letter-spacing:.12em;text-align:center;padding:14px 4px 10px;color:#fff;background:#0a1116;border:1px dashed #58c4b4;border-radius:8px;cursor:pointer;word-break:break-all}
.ps-code small{display:block;margin-top:6px;font:500 12px system-ui,"Microsoft YaHei",sans-serif;letter-spacing:.04em;color:#8fc6c2}
.ps-shot{margin:0;padding:10px 12px;border-radius:6px;background:#ff6b3d22;border:1px solid #ff6b3d88;font-size:14px;line-height:1.6;color:#ffe2d6}
.ps-note{margin:0;font-size:13px;line-height:1.6;color:#aebfbd}
.ps-row{display:flex;gap:8px}
.ps-in{flex:1;min-width:0;min-height:48px;padding:0 10px;border:1px solid #58c4b4;border-radius:6px;background:#0a1116;color:#fff;font:700 18px ui-monospace,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}
.ps-row .ps-b{width:auto;flex:none}
.ps-h{margin:6px 0 0;font-size:14px;color:#bfe7e1;letter-spacing:.08em}
.ps-err{margin:0;font-size:13px;color:#ff9b7a}
.ps-id{margin:0;font-size:12px;color:#7d9391}
.ps-toast{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:5002;width:min(92vw,440px);padding:12px 16px;border:1px solid #58c4b4;border-radius:8px;background:#0d1a1fef;color:#e6f1ee;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif;box-shadow:0 10px 30px #000a;transition:opacity .3s}
@media(prefers-reduced-motion:reduce){.ps-wrap{transition:none}}
`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const safeGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const safeDel = key => { try { localStorage.removeItem(key); } catch {} };

function readMeta(cfg) {
  if (!cfg.metaKey) return {};
  try { return JSON.parse(safeGet(cfg.metaKey) || 'null') || {}; } catch { return {}; }
}
function writeMeta(cfg, meta) {
  if (!cfg.metaKey) return;
  if (!meta || !(meta.syncId || meta.mode === 'account')) { safeDel(cfg.metaKey); return; }
  safeSet(cfg.metaKey, JSON.stringify(meta));
}
const readToken = () => { const t = (safeGet(TOKEN_KEY) || '').trim(); return /^[a-f0-9]{64}$/i.test(t) ? t : null; };
function readAccount() {
  try { return JSON.parse(safeGet(ACCOUNT_KEY) || 'null'); } catch { return null; }
}

export function syncButtonHtml(cfg) {
  const acct = readAccount();
  const on = !!(readToken() && acct?.accountId);
  return `<button type="button" class="ps-btn${on ? ' on' : ''}${acct?.unseen ? ' unseen' : ''}" data-progress-sync aria-haspopup="dialog"><i></i>存档码<b>新</b></button>`;
}

async function post(name, body, { keepalive = false, token = readToken() } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/save/${name}`, { method: 'POST', headers, body: JSON.stringify(body), keepalive });
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

// Start auto-save for this page (idempotent) and handle [data-progress-sync] clicks.
export function initProgressSync(cfg) {
  if (ctl) return ctl;
  const state = { busy: false, lastPushAt: 0, hiddenAt: 0, error: null, timer: null, copied: false };
  const reload = cfg.reload || (() => location.reload());
  const scope = cfg.scope || '你的进度';
  const hasDemo = !!cfg.demo;

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
  const loggedIn = () => !!(readToken() && readAccount()?.accountId);
  // This demo's meta belongs to the account this device is logged in with.
  const attached = meta => meta.mode === 'account' && !!meta.accountId && meta.accountId === readAccount()?.accountId && !!readToken();

  // Mark local changes: `savedAt` is when this device's progress last changed.
  const observe = () => {
    const meta = readMeta(cfg);
    if (!hasDemo || !attached(meta)) return { meta, bundle: null, hash: null };
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

  const adopt = result => {
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

  // Remember the login an answer handed out (token / account / freshly shown code).
  const rememberLogin = (res, typedCode = null) => {
    const current = readToken();
    if (res.token && res.token !== current) {
      if (current) safeSet(PREVIOUS_TOKEN_KEY, current);
      safeSet(TOKEN_KEY, res.token);
    }
    const acct = readAccount() || {};
    const sameAccount = acct.accountId === res.accountId;
    const next = { accountId: res.accountId, unseen: sameAccount ? !!acct.unseen : false };
    if (res.code) {
      safeSet(CODE_KEY, res.code);
      if (!typedCode || res.freshCode) next.unseen = true; // a new code: ask the player to write it down
    } else if (!sameAccount) {
      safeDel(CODE_KEY); // this device does not know the other account's code
    }
    safeSet(ACCOUNT_KEY, JSON.stringify(next));
    safeDel(OPTOUT_KEY);
  };

  // Log this device in (creating the account and code if needed) and attach this demo.
  const ensure = async () => {
    const meta = readMeta(cfg);
    const body = { device: deviceLabel() };
    let sent = null;
    if (hasDemo) {
      body.demo = cfg.demo;
      if (meta.syncId && meta.secret) body.link = { syncId: meta.syncId, secret: meta.secret };
      const bundle = collect();
      if (hasCoreProgress(bundle, cfg) && bundleBytes(bundle) <= SYNC_MAX_BYTES) {
        sent = { hash: bundleHash(bundle), savedAt: Date.now() };
        Object.assign(body, { bundle, savedAt: sent.savedAt });
      }
    }
    const res = await post('ensure', body);
    const hadCode = !!safeGet(CODE_KEY);
    rememberLogin(res);
    if (res.code && !hadCode && !wrap?.classList.contains('open')) toast('已为你生成存档码，点「存档码」查看，并截图或抄下保存。');
    if (res.demo) {
      const r = metaAfterAttach(readMeta(cfg), res.demo, res.accountId, sent);
      adopt(r);
    }
    state.error = null;
  };

  const shouldEnsure = () => {
    if (state.ensureFailedAt && Date.now() - state.ensureFailedAt < 60 * 1000) return false;
    const meta = readMeta(cfg);
    if (readToken()) return hasDemo ? !attached(meta) : !readAccount()?.accountId;
    if (!hasDemo) return false;
    if (meta.syncId) return true; // an old device-to-device sync link: migrate it
    if (safeGet(OPTOUT_KEY)) return false;
    return hasCoreProgress(collect(), cfg); // first real progress: back it up from now on
  };

  // One round trip: push when dirty, otherwise ask for a newer copy.
  const syncNow = async ({ keepalive = false, force = false } = {}) => {
    if (state.busy) return;
    if (shouldEnsure()) {
      state.busy = true;
      try { await ensure(); } catch (err) {
        state.ensureFailedAt = Date.now();
        state.error = err.status === 429 ? err.message : '网络不可用，稍后自动重试';
      } finally { state.busy = false; paint(); }
      return;
    }
    if (!hasDemo) return;
    const { meta, bundle, hash } = observe();
    if (!attached(meta)) return;
    const push = !!meta.dirty;
    if (push && !force && Date.now() - state.lastPushAt < PUSH_EVERY_MS) return;
    if (push && bundleBytes(bundle) > SYNC_MAX_BYTES) { state.error = '进度数据过大，暂时无法自动保存'; paint(); return; }
    state.busy = true;
    try {
      if (push) state.lastPushAt = Date.now();
      const res = await post('sync', {
        demo: cfg.demo, rev: meta.rev || 0, dirty: push, device: deviceLabel(),
        ...(push ? { savedAt: meta.savedAt || Date.now(), bundle } : {}),
      }, { keepalive: keepalive && push && bundleBytes(bundle) < 60000 });
      state.error = null;
      const current = readMeta(cfg);
      // Local progress changed again while the request was in flight: keep it dirty.
      const result = resolveSyncResponse(current, res, hash);
      if (push && res.status === 'pushed') result.meta.dirty = current.localHash !== hash;
      adopt(result);
    } catch (err) {
      if (err.status === 401) state.error = '存档码登录已失效，请重新输入存档码';
      else state.error = err.status === 429 ? '保存请求过于频繁，稍后自动重试' : '网络不可用，稍后自动重试';
    } finally {
      state.busy = false;
      paint();
    }
  };

  // ------------------------------------------------------------------ panel
  let wrap = null;
  const paint = () => {
    const acct = readAccount();
    document.querySelectorAll('[data-progress-sync]').forEach(b => {
      b.classList.toggle('on', loggedIn());
      b.classList.toggle('unseen', !!acct?.unseen);
    });
    if (!wrap?.classList.contains('open')) return;
    const body = wrap.querySelector('.ps-body');
    const typed = body.querySelector('.ps-in')?.value || '';
    const err = state.error ? `<p class="ps-err" role="alert">${esc(state.error)}</p>` : '';
    const loginHtml = (title) => `<p class="ps-h">${title}</p>
      <div class="ps-row"><input class="ps-in" value="${esc(typed)}" maxlength="80" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" placeholder="XXXX-XXXX-XXXX" aria-label="输入存档码"><button type="button" class="ps-b ps-main" data-ps="login" ${state.busy ? 'disabled' : ''}>登录</button></div>`;
    if (!loggedIn()) {
      body.innerHTML = `<div class="ps-status"><i></i><span>这台设备还没有登录存档码</span></div>${err}
        ${loginHtml('已有存档码？在这里输入')}
        <p class="ps-note">登录后会载入存档码里的进度；这台设备原来的进度存为备份，可以恢复。</p>
        <p class="ps-h">还没有存档码</p>
        <button type="button" class="ps-b" data-ps="create" ${state.busy ? 'disabled' : ''}>生成我的存档码</button>
        <p class="ps-note">存档码会自动保存${esc(scope)}。换手机、换电脑或清除浏览器数据后，输入存档码即可继续。</p>`;
      return;
    }
    const meta = readMeta(cfg);
    const code = safeGet(CODE_KEY);
    const codeHtml = code
      ? `<button type="button" class="ps-code" data-ps="copy" aria-label="存档码 ${esc(code)}，点击复制">${esc(code)}<small>${state.copied ? '已复制' : '点击复制'}</small></button>
        ${acct?.unseen ? '<p class="ps-shot">请截图或抄下保存。这是找回进度的唯一凭据，丢了无法找回。</p>' : ''}
        <p class="ps-note">在其他设备打开游戏，点「存档码」输入它，就能继续${esc(scope)}。不要发给别人。</p>`
      : `<p class="ps-note">这台设备已登录，但存档码是在另一台设备上生成的，这里无法显示（服务器不保存存档码原文）。忘记了可以换一个新的：旧码作废，已登录的设备不受影响。</p>
        <button type="button" class="ps-b" data-ps="newcode" ${state.busy ? 'disabled' : ''}>生成新的存档码</button>`;
    let status = '已登录存档码';
    if (hasDemo && attached(meta)) {
      status = meta.dirty ? '有新进度，稍后自动保存' : meta.lastSyncAt ? `已自动保存 · ${agoText(meta.lastSyncAt)}` : '已登录，等待第一次保存';
    }
    const backup = hasDemo && attached(meta) && meta.backup
      ? `<button type="button" class="ps-b" data-ps="restore" ${state.busy ? 'disabled' : ''}>恢复备份（${esc(meta.backup.device || '设备')} · ${esc(agoText(meta.backup.savedAt))}）</button>` : '';
    body.innerHTML = `<div class="ps-status on"><i></i><span>${esc(status)}</span></div>${err}
      ${codeHtml}
      ${hasDemo ? `<button type="button" class="ps-b" data-ps="now" ${state.busy ? 'disabled' : ''}>立即保存</button>` : ''}
      ${backup}
      ${loginHtml('换成另一个存档码')}
      <button type="button" class="ps-b ghost" data-ps="off">退出这个存档码</button>
      ${hasDemo ? '<p class="ps-note">每 30 秒最多自动保存一次，每幕结束、每局结束和切到后台时立即保存。</p>' : ''}
      <p class="ps-id">账号 ID：${esc(acct?.accountId || '')}</p>`;
  };

  const run = async fn => {
    if (state.busy) return;
    state.busy = true; state.error = null; paint();
    try { await fn(); } catch (err) { state.error = err.message || '操作失败'; } finally { state.busy = false; paint(); }
  };

  const markSeen = () => {
    const acct = readAccount();
    if (acct?.unseen && safeGet(CODE_KEY)) { acct.unseen = false; safeSet(ACCOUNT_KEY, JSON.stringify(acct)); }
  };

  const actions = {
    now: () => syncNow({ force: true }),
    create: () => run(async () => { safeDel(OPTOUT_KEY); await ensure(); }),
    copy: () => {
      const code = safeGet(CODE_KEY);
      if (!code) return;
      const done = () => { state.copied = true; paint(); setTimeout(() => { state.copied = false; paint(); }, 2000); };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done, () => {});
      else {
        const ta = document.createElement('textarea');
        ta.value = code; document.body.append(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch {}
        ta.remove();
      }
    },
    login: () => {
      const raw = wrap.querySelector('.ps-in')?.value || '';
      return run(async () => {
        const parsed = normalizeSaveCodeInput(raw);
        if (!parsed) throw new Error('存档码是 12 位字母和数字，例如 ABCD-EFGH-JKMN');
        const body = { code: parsed.value, device: deviceLabel() };
        let sent = null;
        if (hasDemo) {
          body.demo = cfg.demo;
          const own = collect();
          if (hasCoreProgress(own, cfg) && bundleBytes(own) <= SYNC_MAX_BYTES) {
            sent = { hash: bundleHash(own), savedAt: Date.now() };
            Object.assign(body, { bundle: own, savedAt: sent.savedAt });
          }
        }
        const res = await post('login', body);
        rememberLogin(res, parsed.kind === 'code' ? parsed.value : null);
        wrap.querySelector('.ps-in').value = '';
        if (hasDemo && res.demo) {
          const r = metaAfterAttach(readMeta(cfg), res.demo, res.accountId, sent);
          if (!r.apply) r.notice = '已登录存档码。';
          adopt(r);
        } else {
          try { sessionStorage.setItem(`${cfg.metaKey || 'save'}-notice`, '已登录存档码。'); } catch {}
          reload();
        }
      });
    },
    newcode: () => {
      if (!confirm('生成新的存档码？旧存档码会立即作废，已登录的设备不受影响。')) return;
      return run(async () => {
        const res = await post('newcode', {});
        safeSet(CODE_KEY, res.code);
        const acct = readAccount() || {};
        safeSet(ACCOUNT_KEY, JSON.stringify({ ...acct, unseen: true }));
      });
    },
    restore: () => {
      if (!confirm('用备份替换这台设备当前的进度？当前进度会成为新的备份。')) return;
      return run(async () => {
        const res = await post('restore', { demo: cfg.demo });
        adopt(resolveSyncResponse(readMeta(cfg), res, null));
      });
    },
    off: () => {
      if (!confirm('退出这个存档码？这台设备上的进度会保留，但不再自动保存到云端。之后可以随时重新输入存档码登录。')) return;
      const token = readToken();
      if (token) post('logout', {}, { token }).catch(() => {});
      safeDel(TOKEN_KEY); safeDel(CODE_KEY); safeDel(ACCOUNT_KEY);
      safeSet(OPTOUT_KEY, '1');
      if (hasDemo) writeMeta(cfg, null);
      state.error = null;
      paint();
    },
  };

  const addStyle = () => {
    if (document.getElementById('ps-style')) return;
    const style = document.createElement('style');
    style.id = 'ps-style';
    style.textContent = CSS;
    document.head.append(style);
  };

  const open = () => {
    if (!wrap) {
      addStyle();
      wrap = document.createElement('div');
      wrap.className = 'ps-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = '<section class="ps" role="dialog" aria-modal="true" aria-label="存档码"><header><h2>存档码</h2><button type="button" class="ps-x" aria-label="关闭">✕</button></header><div class="ps-body"></div></section>';
      document.body.append(wrap);
      wrap.addEventListener('click', e => {
        if (e.target === wrap || e.target.closest('.ps-x')) { close(); return; }
        const act = e.target.closest('[data-ps]')?.dataset.ps;
        if (act && actions[act]) actions[act]();
      });
      wrap.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.ps-in')) actions.login(); });
    }
    wrap.classList.add('open');
    wrap.setAttribute('aria-hidden', 'false');
    paint();
    wrap.querySelector('.ps-x').focus();
    // First open: an existing login or real local progress gets its code right away (a
    // device without either shows the login box first: the player may have a code).
    if (!loggedIn() && (readToken() || (hasDemo && !safeGet(OPTOUT_KEY) && hasCoreProgress(collect(), cfg)))) {
      run(ensure);
    }
  };
  const close = () => {
    if (wrap?.classList.contains('open')) markSeen();
    wrap?.classList.remove('open');
    wrap?.setAttribute('aria-hidden', 'true');
    paint();
  };

  addStyle();
  document.addEventListener('click', e => {
    if (e.target.closest?.('[data-progress-sync]')) { e.preventDefault(); open(); }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && wrap?.classList.contains('open')) close(); });

  // ------------------------------------------------------------------ auto loop
  try {
    const key = `${cfg.metaKey || 'save'}-notice`;
    const notice = sessionStorage.getItem(key);
    if (notice) { sessionStorage.removeItem(key); setTimeout(() => toast(notice), 300); }
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
