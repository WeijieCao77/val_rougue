// Phone feel shared by both demos: long-press card details and the drag hint.
// Plain ES module with named exports and no imports (bundled into the Wa app.js
// by tools/build-browser.mjs, imported directly by the new demo).

// ---------- Back button closes the top overlay ----------
// Every open overlay (card sheet, dialogs, modals) owns one browser-history
// entry, so the phone's back button or gesture closes the top one instead of
// leaving the game. Closing it any other way removes its entry again.
const layers = [];
let skipPops = 0;
let popWired = false;

function wirePop() {
  if (popWired || typeof addEventListener !== 'function') return;
  popWired = true;
  addEventListener('popstate', () => {
    if (skipPops > 0) { skipPops--; return; }
    const top = layers.pop();
    if (top) top.close();
  });
}

export function pushLayer(close) {
  wirePop();
  const layer = { close };
  layers.push(layer);
  try { history.pushState({ ...(history.state || {}), uiLayer: layers.length }, ''); } catch {}
  return layer;
}

export function dropLayer(layer) {
  const i = layers.indexOf(layer);
  if (i < 0) return;
  layers.splice(i, 1);
  try { if (history.state?.uiLayer) { skipPops++; history.back(); } } catch {}
}

// Watches `root` for an overlay opening/closing: `isOpen()` says whether one is
// open now, `close()` closes it (used by the back button).
export function trackLayer(root, isOpen, close) {
  if (!root || typeof MutationObserver !== 'function') return;
  let layer = null;
  const sync = () => {
    const open = !!isOpen();
    // If close() declines (a forced choice), the next sync re-arms the back button.
    if (open && !layer) layer = pushLayer(() => { layer = null; close(); setTimeout(sync, 0); });
    else if (!open && layer) { const done = layer; layer = null; dropLayer(done); }
  };
  new MutationObserver(sync).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden'] });
  sync();
}

// ---------- Long-press card sheet ----------
let sheet = null;
let sheetOnClose = null;
let sheetLayer = null;

export function cardSheetOpen() {
  return !!(sheet && sheet.open);
}

export function closeCardSheet() {
  if (sheet?.open) sheet.close();
}

// A <dialog> opened with showModal() sits above every other layer, including an
// already open deck/library dialog, so one sheet works everywhere. It closes by
// the 关闭 button (top right, outside the scrolling area so it never scrolls
// away), a tap outside the panel, Escape, or the back button; once closed it is
// removed from the page, so nothing is left to block taps.
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
      if (sheet.open) return; // reopened with new content before this event ran
      const done = sheetOnClose;
      sheetOnClose = null;
      sheet.innerHTML = '';
      sheet.remove();
      if (sheetLayer) { const layer = sheetLayer; sheetLayer = null; dropLayer(layer); }
      done?.();
    });
  }
  if (sheet.open) {
    const done = sheetOnClose;
    sheetOnClose = null;
    if (sheetLayer) { dropLayer(sheetLayer); sheetLayer = null; }
    sheet.close();
    done?.();
  }
  document.body.append(sheet);
  sheetOnClose = onClose || null;
  sheet.innerHTML = `<div class="card-sheet-panel" role="document">
    <div class="card-sheet-bar"><button type="button" class="card-sheet-close" data-sheet-close aria-label="关闭卡牌详情">✕ 关闭</button></div>
    <div class="card-sheet-scroll">
    ${html}
    <p class="card-sheet-foot">点空白处、按返回键或「关闭」均可关闭</p>
    </div>
  </div>`;
  try { sheet.showModal(); } catch { sheet.setAttribute('open', ''); }
  sheetLayer = pushLayer(() => { sheetLayer = null; if (sheet?.open) sheet.close(); });
  sheet.querySelector('.card-sheet-scroll').scrollTop = 0;
  sheet.querySelector('.card-sheet-close').focus({ preventScroll: true });
}

// Long press (500 ms by finger or mouse, or right click) on any element
// matching `selector` opens `render(el)` in the sheet. The press never counts
// as a click, so it cannot pick, buy or play the card underneath. Half a second
// keeps a slow tap from ever opening it.
export function attachCardDetail({ selector, render, delay = 500 }) {
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
    const wait = Math.max(delay, 500);
    press = { el, id: event.pointerId, x: event.clientX, y: event.clientY };
    press.timer = setTimeout(() => {
      const current = press;
      press = null;
      if (current?.el.isConnected) open(current.el);
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
