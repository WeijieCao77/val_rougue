// Update-log button + slide-out panel for a demo's cover screen (shared by both
// demos). Plain ES module with named exports and no imports (bundled into the
// Wa app.js by tools/build-browser.mjs, imported directly by the new demo).
//
// changelogButtonHtml(log)  → the cover button (a dot until the newest version is opened)
// initChangelog(log)        → once per page: styles + click handling for [data-changelog]
// log = { key, entries: [{version, date, title, items: [[tag, text]]}], labels: {tag: label} }

const CSS = `
.cl-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border:1px solid #d9b67799;border-radius:6px;background:#0d151ccc;color:#f4ead7;font:600 14px system-ui,"Microsoft YaHei",sans-serif;letter-spacing:.06em;cursor:pointer;position:relative}
.cl-btn small{color:#d6c6a8;font-weight:400}
.cl-btn.unseen:after{content:"";position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:#ff6b3d;box-shadow:0 0 8px #ff6b3d}
.cl-wrap{position:fixed;inset:0;z-index:5000;background:#03070bb3;opacity:0;pointer-events:none;transition:opacity .2s}
.cl-wrap.open{opacity:1;pointer-events:auto}
.cl{position:absolute;top:0;right:0;bottom:0;width:min(460px,100%);display:flex;flex-direction:column;background:linear-gradient(#141f28,#0b1219);border-left:1px solid #d9b67755;box-shadow:-20px 0 60px #000a;transform:translateX(100%);transition:transform .25s ease;color:#f4ead7;font-family:system-ui,"Microsoft YaHei",sans-serif;text-align:left}
.cl-wrap.open .cl{transform:none}
.cl header{display:flex;justify-content:space-between;align-items:center;padding:max(16px,env(safe-area-inset-top)) 18px 12px;border-bottom:1px solid #ffffff14}
.cl header h2{margin:0;font-family:Georgia,"SimSun",serif;font-size:22px;letter-spacing:.12em;color:#f3dfa6}
.cl-close{min-width:44px;min-height:44px;border:1px solid #6d6146;border-radius:6px;background:#17252a;color:#e8d8ae;font-size:18px;cursor:pointer}
.cl-body{overflow-y:auto;padding:6px 18px max(24px,env(safe-area-inset-bottom));overscroll-behavior:contain}
.cl-rel{padding:16px 0;border-bottom:1px solid #ffffff10}
.cl-rel h3{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 10px;font-size:17px;color:#fff3d2}
.cl-rel h3 b{font-size:13px;padding:2px 8px;border-radius:10px;background:#d9b677;color:#1a1408}
.cl-rel h3 time{font-size:13px;color:#98a8a4;font-weight:400}
.cl-rel ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.cl-rel li{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:baseline;font-size:14px;line-height:1.6;color:#dfe6e3}
.cl-rel li.no-tag{grid-template-columns:1fr}
.cl-tag{font-size:12px;padding:1px 7px;border-radius:4px;white-space:nowrap;border:1px solid #c8d2cf55;color:#c8d2cf}
.cl-tag-pvp{color:#ff9b7a;border-color:#ff9b7a66}
@media(prefers-reduced-motion:reduce){.cl,.cl-wrap{transition:none}}
`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const seenVersion = key => { try { return localStorage.getItem(key); } catch { return null; } };

export function changelogButtonHtml(log) {
  const latest = log.entries[0]?.version || '';
  return `<button type="button" class="cl-btn${seenVersion(log.key) !== latest ? ' unseen' : ''}" data-changelog aria-haspopup="dialog">更新日志 <small>${esc(latest)}</small></button>`;
}

let active = null;
export function initChangelog(log) {
  active = log;
  if (document.getElementById('cl-style')) return;
  const style = document.createElement('style');
  style.id = 'cl-style';
  style.textContent = CSS;
  document.head.append(style);
  const wrap = document.createElement('div');
  wrap.className = 'cl-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<aside class="cl" role="dialog" aria-modal="true" aria-label="更新日志"><header><h2>更新日志</h2><button type="button" class="cl-close" aria-label="关闭">✕</button></header><div class="cl-body"></div></aside>';
  document.body.append(wrap);
  const fmt = d => { const [, m, day] = d.split('-'); return `${+m} 月 ${+day} 日`; };
  let opener = null;
  const close = () => { wrap.classList.remove('open'); wrap.setAttribute('aria-hidden', 'true'); opener?.focus?.(); };
  const open = btn => {
    const { entries, labels = {}, key } = active;
    wrap.querySelector('.cl-body').innerHTML = entries.map(r => `<section class="cl-rel"><h3><b>${esc(r.version)}</b>${esc(r.title)}<time datetime="${r.date}">${fmt(r.date)}</time></h3><ul>${r.items.map(([t, text]) => labels[t] ? `<li><span class="cl-tag cl-tag-${t}">${esc(labels[t])}</span><span>${esc(text)}</span></li>` : `<li class="no-tag"><span>${esc(text)}</span></li>`).join('')}</ul></section>`).join('');
    opener = btn;
    btn.classList.remove('unseen');
    try { localStorage.setItem(key, entries[0]?.version || ''); } catch {}
    wrap.classList.add('open');
    wrap.setAttribute('aria-hidden', 'false');
    wrap.querySelector('.cl-close').focus();
  };
  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-changelog]');
    if (btn && active) { e.preventDefault(); open(btn); }
  });
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('.cl-close')) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && wrap.classList.contains('open')) close(); });
}
