// First-fight coach marks: a few short tips over the first two turns of the
// player's first combat (shared by both demos). It only explains controls and
// what the screen shows — never how to build a deck.
// Plain ES module with named exports and no imports (bundled into the Wa app.js
// by tools/build-browser.mjs, imported directly by the new demo).
//
// startCoach({ key, getTurn, steps })
//   key      localStorage flag; once set the coach never shows again
//   getTurn  () => current combat turn number, or null outside combat
//   steps    [{ turn, sel, text }] — sel is a CSS selector to point at (the
//            first visible match); text may be a function returning a string

const CSS = `
.coach-ring{position:fixed;z-index:2400;pointer-events:none;border:2px solid #f2b233;border-radius:8px;box-shadow:0 0 0 3px rgba(242,178,51,.22),0 0 18px rgba(242,178,51,.45);transition:all .18s ease;animation:coach-pulse 1.6s ease-in-out infinite}
@keyframes coach-pulse{50%{box-shadow:0 0 0 6px rgba(242,178,51,.12),0 0 24px rgba(242,178,51,.55)}}
.coach-tip{position:fixed;z-index:2401;width:min(300px,calc(100vw - 24px));background:#0c1117;color:#e3eaf2;border:1px solid #f2b233;border-left-width:4px;border-radius:6px;padding:10px 12px 8px;font-size:14px;line-height:1.5;box-shadow:0 10px 28px rgba(0,0,0,.55)}
.coach-tip header{display:flex;justify-content:space-between;align-items:center;font-size:12px;letter-spacing:.08em;color:#f2b233;margin-bottom:4px}
.coach-tip p{margin:0 0 8px}
.coach-tip footer{display:flex;justify-content:space-between;gap:8px}
.coach-tip button{font:inherit;font-size:13px;min-height:34px;padding:4px 12px;border-radius:4px;cursor:pointer;border:1px solid #3e4d62;background:#161d27;color:#c9d4df}
.coach-tip button.coach-next{border-color:#f2b233;background:#f2b233;color:#12161c;font-weight:700}
@media (prefers-reduced-motion: reduce){.coach-ring{animation:none;transition:none}}
`;

function visible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
}
function find(sel) {
  for (const s of sel.split('|')) {
    const el = [...document.querySelectorAll(s)].find(visible);
    if (el) return el;
  }
  return null;
}

export function coachDone(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return true; }
}

export function startCoach({ key, getTurn, steps }) {
  if (coachDone(key)) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const ring = document.createElement('div');
  ring.className = 'coach-ring';
  ring.hidden = true;
  const tip = document.createElement('aside');
  tip.className = 'coach-tip';
  tip.setAttribute('role', 'status');
  tip.hidden = true;
  document.body.append(ring, tip);

  let started = false;   // saw turn 1 of a fight
  let index = 0;         // next step to show
  let finished = false;
  let raf = 0;

  const finish = () => {
    finished = true;
    try { localStorage.setItem(key, '1'); } catch {}
    ring.remove(); tip.remove(); style.remove();
    observer.disconnect();
    removeEventListener('resize', schedule);
    removeEventListener('scroll', schedule, true);
  };

  tip.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.coach === 'skip') return finish();
    index++;
    if (index >= steps.length) return finish();
    update();
  });

  function place(el) {
    const r = el.getBoundingClientRect();
    const pad = 4;
    Object.assign(ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    ring.hidden = false;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight, m = 12;
    // Prefer above the target, then below; never cover the target itself.
    let top = r.top - h - 14;
    if (top < m) top = r.bottom + 14;
    if (top + h > innerHeight - m) top = Math.max(m, Math.min(innerHeight - h - m, r.top - h - 14));
    const left = Math.max(m, Math.min(innerWidth - w - m, r.left + r.width / 2 - w / 2));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function hide() { ring.hidden = true; tip.hidden = true; }

  function update() {
    raf = 0;
    if (finished) return;
    const turn = getTurn();
    if (turn == null) {
      hide();
      // Left the first fight (won, lost or quit) after it began: done for good.
      if (started) finish();
      return;
    }
    if (turn === 1) started = true;
    if (!started) return hide(); // joined mid-fight (e.g. reload on turn 3)
    // Skip the steps of turns already over (player ended turn early).
    while (index < steps.length && steps[index].turn < turn) index++;
    if (index >= steps.length) return finish();
    const step = steps[index];
    if (step.turn > turn) return hide();
    const el = find(step.sel);
    if (!el) return hide();
    const text = typeof step.text === 'function' ? step.text() : step.text;
    const last = index === steps.length - 1 || steps[index + 1].turn > step.turn;
    const html = `<header><span>新手指引 · 第 ${step.turn} 回合</span><span>${index + 1}/${steps.length}</span></header><p>${text}</p><footer><button type="button" data-coach="skip">跳过指引</button><button type="button" class="coach-next" data-coach="next">${index === steps.length - 1 ? '明白了' : last ? '知道了' : '下一条'}</button></footer>`;
    if (tip.dataset.html !== html) { tip.innerHTML = html; tip.dataset.html = html; }
    place(el);
  }

  function schedule() { if (!raf && !finished) raf = requestAnimationFrame(update); }
  const observer = new MutationObserver(m => { if (m.some(r => !tip.contains(r.target) && r.target !== ring)) schedule(); });
  observer.observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', schedule);
  addEventListener('scroll', schedule, true);
  schedule();
}
