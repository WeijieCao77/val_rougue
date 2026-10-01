// 信箱: a private letter box to the author (Wa demo, new demo, PvP). Plain ES module with
// named exports and no imports (bundled into the Wa app.js, imported directly elsewhere).
//
// Private only: letters go to the author's /admin/ view; nothing is shown to other
// players (no public board, votes or ranking).
//
// feedbackButtonHtml(cls) → the 「信箱」 button (envelope icon); any element with
//   [data-feedback] opens the mailbox.
// initFeedback({ page, version, theme, getContext, recentErrors }) — once per page.
//   getContext() → coarse game state (same filtering as error reports);
//   recentErrors() → last captured error messages (up to 3 are attached).
//
// Two tabs: 「写信给作者」 (subject optional, body ≤ 1000 chars, category chips, attach
// state checkbox, 寄出) and 「我寄出的信」 — the letters sent from this browser, kept only
// in localStorage (per page). Each letter carries an unguessable receipt returned by the
// server; the list asks POST /api/report/letters/status for the author's status of those
// receipts only (已读 / 已采纳 / 已修复). The dialog is a <dialog> opened with showModal(),
// so it sits above the demos' own dialogs (e.g. the Wa in-game menu).

const CSS = `
.fb-btn-ico{width:1.15em;height:1.15em;vertical-align:-.2em;margin-right:.3em;flex:none}
.fb-dialog{--fb-accent:#d9b677;--fb-accent-ink:#1a1408;--fb-bg:#111b22;--fb-paper:#f4ecdc;--fb-paper-ink:#2a2418;--fb-line:#d9b67755;--fb-ink:#f4ead7;--fb-muted:#b9b3a3;border:1px solid var(--fb-line);border-radius:10px;padding:0;width:min(460px,calc(100vw - 20px));max-height:calc(100dvh - 20px);background:var(--fb-bg);color:var(--fb-ink);font:15px/1.5 system-ui,"Microsoft YaHei",sans-serif;box-shadow:0 24px 70px #000c;overflow:auto}
.fb-dialog::backdrop{background:#03070bb8}
.fb-dialog button{box-shadow:none;text-shadow:none;transform:none;-webkit-tap-highlight-color:transparent;letter-spacing:normal;outline-offset:2px}
.fb-dialog .fb-chip[aria-pressed="true"],.fb-dialog .fb-chip[aria-pressed="true"]:active{background:var(--fb-accent);border-color:var(--fb-accent);color:var(--fb-accent-ink);font-weight:700}
.fb-dialog.fb-new{--fb-accent:#81e1d1;--fb-accent-ink:#06201c;--fb-bg:#0e171a;--fb-paper:#e9f3f0;--fb-paper-ink:#132421;--fb-line:#81e1d155;--fb-ink:#e6f4f1;--fb-muted:#9fb5b0}
.fb-dialog.fb-pvp{--fb-accent:#ff9b7a;--fb-accent-ink:#2a0f06;--fb-bg:#121a20;--fb-paper:#f5ebe4;--fb-paper-ink:#2b1d16;--fb-line:#ff9b7a55;--fb-ink:#f3ece4;--fb-muted:#b6ada4}
.fb-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 12px 0 16px}
.fb-top h2{margin:0;font-size:19px;letter-spacing:.1em;color:var(--fb-accent);display:flex;align-items:center;gap:8px}
.fb-x{min-width:44px;min-height:44px;border:1px solid var(--fb-line);border-radius:8px;background:transparent;color:var(--fb-ink);font-size:18px;cursor:pointer}
.fb-tabs{display:flex;gap:4px;padding:10px 12px 0;border-bottom:1px solid var(--fb-line)}
.fb-tab{flex:1;min-height:44px;border:0;border-bottom:3px solid transparent;background:transparent;color:var(--fb-muted);font:600 15px system-ui,"Microsoft YaHei",sans-serif;cursor:pointer}
.fb-tab[aria-selected="true"]{color:var(--fb-ink);border-bottom-color:var(--fb-accent)}
.fb-form{display:grid;gap:12px;padding:14px 14px max(16px,env(safe-area-inset-bottom))}
.fb-letter{display:grid;gap:0;background:var(--fb-paper);color:var(--fb-paper-ink);border-radius:6px;padding:12px 14px 10px;box-shadow:inset 0 0 0 1px #0000001a;background-image:repeating-linear-gradient(transparent 0 31px,#00000014 31px 32px);background-position:0 12px}
.fb-to{font-size:13px;opacity:.75;padding-bottom:4px}
.fb-subject,.fb-text{width:100%;box-sizing:border-box;border:0;background:transparent;color:inherit;font:16px/32px system-ui,"Microsoft YaHei",sans-serif;padding:0;outline:none}
.fb-subject{font-weight:700;border-bottom:1px dashed #00000033}
.fb-text{min-height:160px;resize:vertical}
.fb-subject::placeholder,.fb-text::placeholder{color:inherit;opacity:.45}
.fb-letter:focus-within{box-shadow:inset 0 0 0 2px var(--fb-accent)}
.fb-count{justify-self:end;font-size:12px;opacity:.6}
.fb-chips{display:flex;flex-wrap:wrap;gap:8px;border:0;margin:0;padding:0}
.fb-chips legend{font-size:13px;color:var(--fb-muted);padding:0;margin-bottom:6px}
.fb-chip{min-height:44px;min-width:64px;padding:0 14px;border:1px solid var(--fb-line);border-radius:22px;background:transparent;color:var(--fb-ink);font:14px system-ui,"Microsoft YaHei",sans-serif;cursor:pointer}
.fb-chip[aria-pressed="true"]{background:var(--fb-accent);border-color:var(--fb-accent);color:var(--fb-accent-ink);font-weight:700}
.fb-attach{display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px;cursor:pointer}
.fb-attach input{width:22px;height:22px;accent-color:var(--fb-accent);flex:none}
.fb-note{margin:0;font-size:12px;color:var(--fb-muted)}
.fb-status{min-height:20px;font-size:14px;color:var(--fb-muted)}
.fb-status.err{color:#ff8a7a}
.fb-actions{display:flex;gap:10px;justify-content:flex-end}
.fb-actions button,.fb-done button{min-height:44px;min-width:96px;padding:0 18px;border-radius:8px;font:600 15px system-ui,"Microsoft YaHei",sans-serif;cursor:pointer}
.fb-cancel,.fb-done button{border:1px solid var(--fb-line);background:transparent;color:var(--fb-ink)}
.fb-send{border:1px solid var(--fb-accent);background:var(--fb-accent);color:var(--fb-accent-ink)}
.fb-send:disabled{opacity:.6;cursor:wait}
.fb-done{display:grid;gap:14px;justify-items:center;padding:36px 18px;text-align:center}
.fb-done svg{width:48px;height:48px;color:var(--fb-accent)}
.fb-done b{font-size:18px;color:var(--fb-ink)}
.fb-sent{display:grid;gap:0;padding:6px 14px max(16px,env(safe-area-inset-bottom))}
.fb-sent-item{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:12px 2px;border-bottom:1px solid var(--fb-line)}
.fb-sent-item b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fb-sent-item small{font-size:12px;color:var(--fb-muted)}
.fb-state{grid-row:span 2;align-self:center;font-size:12px;padding:3px 9px;border-radius:12px;border:1px solid var(--fb-line);color:var(--fb-muted);white-space:nowrap}
.fb-state.read{color:var(--fb-ink)}
.fb-state.adopted,.fb-state.fixed{background:var(--fb-accent);border-color:var(--fb-accent);color:var(--fb-accent-ink);font-weight:700}
.fb-empty{padding:28px 6px;text-align:center;color:var(--fb-muted);font-size:14px}
`;

const ENVELOPE = '<svg class="fb-btn-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const CATEGORIES = ['问题', '建议', '平衡', '其他'];
const MAX = 1000;
const SUBJECT_MAX = 60;
const KEEP_SENT = 30;
// Player-facing status of a letter (the author's 忽略 shows as 作者已读).
const STATE_LABEL = { new: '已寄出', read: '作者已读', ignored: '作者已读', adopted: '已采纳', fixed: '已修复' };
let opts = { page: 'unknown', version: '', theme: 'wa', getContext: null, recentErrors: null, endpoint: '/api/report/feedback', statusEndpoint: '/api/report/letters/status' };
let dialog = null;
let bound = false;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sentKey = () => `mailbox-sent-${opts.page}`;
function loadSent() {
  try { const list = JSON.parse(localStorage.getItem(sentKey()) || '[]'); return Array.isArray(list) ? list.filter(x => x && typeof x === 'object') : []; } catch { return []; }
}
function saveSent(list) {
  try { localStorage.setItem(sentKey(), JSON.stringify(list.slice(0, KEEP_SENT))); } catch {}
}

export function feedbackButtonHtml(cls = 'fb-btn', label = '信箱') {
  return `<button type="button" class="${cls}" data-feedback aria-haspopup="dialog" aria-label="${label}（写信给作者）">${ENVELOPE}${label}</button>`;
}

function injectStyle() {
  if (document.getElementById('fb-style')) return;
  const style = document.createElement('style');
  style.id = 'fb-style';
  style.textContent = CSS;
  document.head.append(style);
}

function build() {
  dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', '信箱');
  document.body.append(dialog);
  dialog.addEventListener('click', e => {
    if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); }
  });
}

function close() {
  try { if (dialog?.open) dialog.close(); } catch { dialog?.removeAttribute('open'); }
}

function shell(tab) {
  dialog.className = `fb-dialog fb-${opts.theme}`;
  dialog.innerHTML = `<div class="fb-top"><h2>${ENVELOPE.replace('fb-btn-ico', 'fb-btn-ico fb-h-ico')}信箱</h2><button type="button" class="fb-x" aria-label="关闭">✕</button></div>
    <div class="fb-tabs" role="tablist"><button type="button" class="fb-tab" role="tab" data-tab="write" aria-selected="${tab === 'write'}">写信给作者</button><button type="button" class="fb-tab" role="tab" data-tab="sent" aria-selected="${tab === 'sent'}">我寄出的信</button></div>
    <div class="fb-pane"></div>`;
  dialog.querySelector('.fb-x').addEventListener('click', close);
  dialog.querySelectorAll('.fb-tab').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  return dialog.querySelector('.fb-pane');
}

function show(tab) {
  const pane = shell(tab);
  if (tab === 'sent') renderSent(pane);
  else return renderForm(pane);
}

function renderSent(pane) {
  const list = loadSent();
  const fmt = t => { try { return new Date(t).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return ''; } };
  const draw = () => {
    pane.innerHTML = list.length ? `<div class="fb-sent">${list.map(l => `<div class="fb-sent-item"><b>${esc(l.subject || l.first || '（无标题）')}</b><span class="fb-state ${esc(l.status || 'new')}">${esc(STATE_LABEL[l.status] || STATE_LABEL.new)}</span><small>${esc(l.category || '未分类')} · ${esc(fmt(l.at))}</small></div>`).join('')}<p class="fb-note" style="padding-top:10px">只保存在这台设备的浏览器里，其他玩家看不到。</p></div>`
      : '<div class="fb-empty">还没有寄出过信。</div>';
  };
  draw();
  const receipts = list.map(l => l.receipt).filter(r => typeof r === 'string' && /^[0-9a-f]{32}$/.test(r));
  if (!receipts.length || typeof fetch !== 'function') return;
  fetch(opts.statusEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receipts }) })
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (!data?.statuses) return;
      let changed = false;
      for (const l of list) {
        const s = data.statuses[l.receipt];
        if (s && s !== l.status) { l.status = s; changed = true; }
      }
      if (changed) saveSent(list);
      if (pane.isConnected) draw();
    })
    .catch(() => {});
}

function renderForm(pane) {
  pane.innerHTML = `<form class="fb-form" method="dialog" novalidate>
    <div class="fb-letter">
      <span class="fb-to">致 作者：</span>
      <input class="fb-subject" name="subject" maxlength="${SUBJECT_MAX}" placeholder="标题（可不填）" aria-label="标题（可不填）" autocomplete="off">
      <textarea class="fb-text" name="text" maxlength="${MAX}" rows="5" placeholder="遇到的问题或建议…" aria-label="信的内容"></textarea>
      <span class="fb-count" aria-live="polite">0 / ${MAX}</span>
    </div>
    <fieldset class="fb-chips"><legend>类别（可选）</legend>${CATEGORIES.map(c => `<button type="button" class="fb-chip" data-cat="${c}" aria-pressed="false">${c}</button>`).join('')}</fieldset>
    <label class="fb-attach"><input type="checkbox" name="attach" checked>附带当前游戏状态（不含账号信息）</label>
    <p class="fb-note">信只有作者能看到，不会公开。</p>
    <div class="fb-status" role="status"></div>
    <div class="fb-actions"><button type="button" class="fb-cancel">取消</button><button type="submit" class="fb-send">寄出</button></div>
  </form>`;
  const form = pane.querySelector('form');
  const subject = form.querySelector('.fb-subject');
  const text = form.querySelector('.fb-text');
  const count = form.querySelector('.fb-count');
  const status = form.querySelector('.fb-status');
  const send = form.querySelector('.fb-send');
  let category = null;
  text.addEventListener('input', () => { count.textContent = `${text.value.length} / ${MAX}`; });
  form.querySelectorAll('.fb-chip').forEach(chip => chip.addEventListener('click', () => {
    category = category === chip.dataset.cat ? null : chip.dataset.cat;
    form.querySelectorAll('.fb-chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.cat === category)));
  }));
  form.querySelector('.fb-cancel').addEventListener('click', close);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const value = text.value.trim();
    const title = subject.value.trim().slice(0, SUBJECT_MAX);
    status.className = 'fb-status';
    if (!value) { status.textContent = '请先写点内容。'; status.classList.add('err'); text.focus(); return; }
    const payload = { subject: title, text: value.slice(0, MAX), category, page: opts.page, version: opts.version };
    try { payload.path = location.pathname; payload.viewport = `${Math.round(innerWidth)}x${Math.round(innerHeight)}`; } catch {}
    if (form.querySelector('[name="attach"]').checked) {
      try { payload.context = opts.getContext ? opts.getContext() : null; } catch {}
      try { payload.recentErrors = (opts.recentErrors ? opts.recentErrors() : []).slice(-3); } catch {}
    }
    send.disabled = true;
    status.textContent = '正在寄出…';
    try {
      const res = await fetch(opts.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(res.status === 429 ? '寄得太频繁了，请稍后再试。' : data?.error || '寄出失败，请稍后再试。');
      const list = loadSent();
      list.unshift({ receipt: typeof data?.receipt === 'string' ? data.receipt : null, subject: title, first: value.slice(0, 40), category, at: Date.now(), status: 'new' });
      saveSent(list);
      // Anonymous play statistics (shared/play-analytics.js listens): only that a letter was sent.
      try { if (typeof dispatchEvent === 'function') dispatchEvent(new CustomEvent('pa:track', { detail: { name: 'mailbox_sent', props: { category } } })); } catch {}
      pane.innerHTML = `<div class="fb-done" role="status">${ENVELOPE.replace('fb-btn-ico', '')}<b>信已寄出，作者会认真看。</b><button type="button" class="fb-close">好的</button></div>`;
      pane.querySelector('.fb-close').addEventListener('click', close);
      pane.querySelector('.fb-close').focus();
    } catch (err) {
      send.disabled = false;
      status.textContent = err?.message && !/fetch|network/i.test(err.message) ? err.message : '网络异常，寄出失败，请稍后再试。';
      status.classList.add('err');
    }
  });
  return text;
}

export function openFeedback(tab = 'write') {
  try {
    injectStyle();
    if (!dialog) build();
    const text = show(tab);
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
    // Phones: do not pop the keyboard over the letter before the player reads it.
    if (text && !matchMedia('(pointer: coarse)').matches) text.focus();
  } catch {}
}

export function initFeedback(options = {}) {
  opts = { ...opts, ...options };
  if (typeof document === 'undefined') return;
  injectStyle();
  if (bound) return;
  bound = true;
  document.addEventListener('click', e => {
    const btn = e.target?.closest?.('[data-feedback]');
    if (!btn) return;
    e.preventDefault();
    openFeedback();
  });
}
