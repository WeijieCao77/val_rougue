// Phone feel shared by both demos: long-press card details and the drag hint.
// Plain ES module with named exports and no imports (bundled into the Wa app.js
// by tools/build-browser.mjs, imported directly by the new demo).

let sheet = null;
let sheetOnClose = null;

export function cardSheetOpen() {
  return !!(sheet && sheet.open);
}

export function closeCardSheet() {
  if (sheet?.open) sheet.close();
}

// A <dialog> opened with showModal() sits above every other layer, including an
// already open deck/library dialog, so one sheet works everywhere.
export function openCardSheet(html, { onClose } = {}) {
  if (typeof document === 'undefined') return;
  if (!sheet) {
    sheet = document.createElement('dialog');
    sheet.className = 'card-sheet';
    sheet.setAttribute('aria-label', '卡牌详情');
    // Tap outside the panel (on the backdrop) closes it.
    sheet.addEventListener('click', event => {
      if (event.target === sheet || event.target.closest('[data-sheet-close]')) sheet.close();
    });
    sheet.addEventListener('close', () => {
      const done = sheetOnClose;
      sheetOnClose = null;
      sheet.innerHTML = '';
      done?.();
    });
  }
  if (sheet.open) sheet.close();
  document.body.append(sheet);
  sheetOnClose = onClose || null;
  sheet.innerHTML = `<div class="card-sheet-panel" role="document">
    <button type="button" class="card-sheet-close" data-sheet-close aria-label="关闭卡牌详情">关闭</button>
    ${html}
    <p class="card-sheet-foot">点击空白处关闭</p>
  </div>`;
  try { sheet.showModal(); } catch { sheet.setAttribute('open', ''); }
  sheet.querySelector('.card-sheet-panel').scrollTop = 0;
}

// Long press (touch ≈350 ms, mouse 500 ms, or right click) on any element
// matching `selector` opens `render(el)` in the sheet. The press never counts
// as a click, so it cannot pick, buy or play the card underneath.
export function attachCardDetail({ selector, render, delay = 350 }) {
  if (typeof document === 'undefined') return;
  let press = null;
  let swallowClick = false;

  const clear = () => {
    if (press) clearTimeout(press.timer);
    press = null;
  };
  const open = el => {
    const html = render(el);
    if (!html) return false;
    swallowClick = true;
    openCardSheet(html);
    return true;
  };

  document.addEventListener('pointerdown', event => {
    swallowClick = false;
    clear();
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!event.isPrimary) return;
    const el = event.target instanceof Element ? event.target.closest(selector) : null;
    if (!el || el.closest('.card-sheet')) return;
    const wait = event.pointerType === 'mouse' ? Math.max(delay, 500) : delay;
    press = { el, id: event.pointerId, x: event.clientX, y: event.clientY };
    press.timer = setTimeout(() => {
      const current = press;
      press = null;
      if (current?.el.isConnected && open(current.el)) {
        try { navigator.vibrate?.(8); } catch {}
      }
    }, wait);
  }, true);
  document.addEventListener('pointermove', event => {
    if (press && press.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 7) clear();
  }, true);
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, event => { if (press && press.id === event.pointerId) clear(); }, true);
  window.addEventListener('scroll', clear, true);

  document.addEventListener('click', event => {
    if (!swallowClick) return;
    swallowClick = false;
    if (event.target instanceof Element && event.target.closest('.card-sheet')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  // Android fires contextmenu on a long press; desktop uses right click.
  document.addEventListener('contextmenu', event => {
    const el = event.target instanceof Element ? event.target.closest(selector) : null;
    if (!el || el.closest('.card-sheet')) return;
    event.preventDefault();
    if (!cardSheetOpen()) { clear(); open(el); }
  }, true);
}

// Floating instruction shown above a dragged card.
let hint = null;
export function showDragHint(text, { ready = false, x, y, lift = 0 } = {}) {
  if (typeof document === 'undefined') return;
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'drag-hint';
    hint.setAttribute('aria-live', 'polite');
  }
  if (!hint.isConnected) document.body.append(hint);
  if (hint.textContent !== text) hint.textContent = text;
  hint.classList.toggle('is-ready', ready);
  const w = hint.offsetWidth || 120;
  const left = Math.max(8 + w / 2, Math.min(innerWidth - 8 - w / 2, x));
  // Above the lifted card; when it touches the top edge, just below the finger.
  const above = y - lift - 44;
  const top = above >= 8 ? above : Math.min(innerHeight - 44, y + 34);
  hint.style.left = `${left}px`;
  hint.style.top = `${top}px`;
}

export function hideDragHint() {
  hint?.remove();
}

// How far the enlarged (1.3×) card's top edge sits above the finger: fully
// clear of the thumb, but never pushed off the top of the screen.
export function touchLift(element, y) {
  const h = element.offsetHeight * 1.3;
  return Math.round(Math.max(Math.min(h + 22, y - 6), h * 0.45));
}
