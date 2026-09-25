// Phones play cards by tapping instead of dragging (shared by both demos).
// Plain ES module with named exports and no imports (bundled into the Wa app.js
// by tools/build-browser.mjs, imported directly by the new demo).
//
// Tap-play rules:
//   tap a card            → select it (it rises; its full text shows in a bar)
//   tap the same card     → play it (or, if it needs a target, ask for one)
//   tap an enemy          → play the selected card on that enemy
//   tap elsewhere / 取消  → deselect
// Desktop mouse keeps drag-to-play and click-to-select unchanged.

export const TAP_PLAY_MAX_WIDTH = 820;

// Pure decision: is this a phone-like device that should use tap-play?
// A finger as the primary pointer always is. A narrow screen counts only when
// it has no hover-capable primary pointer, so a narrow desktop window keeps drag.
export function isTapPlayDevice({ coarse = false, anyCoarse = false, hoverNone = false, width = Infinity } = {}) {
  if (coarse) return true;
  return width <= TAP_PLAY_MAX_WIDTH && (anyCoarse || hoverNone);
}

export function tapPlayMode() {
  if (typeof matchMedia !== 'function' || typeof innerWidth !== 'number') return false;
  return isTapPlayDevice({
    coarse: matchMedia('(pointer: coarse)').matches,
    anyCoarse: matchMedia('(any-pointer: coarse)').matches,
    hoverNone: matchMedia('(hover: none)').matches,
    width: innerWidth,
  });
}

// Touch and pen never drag cards in tap-play mode; a mouse always may.
export function allowCardDrag(pointerType) {
  return pointerType === 'mouse' || !tapPlayMode();
}

// Pure decision for a tap on a hand card in tap-play mode.
//   selected:    uid of the currently selected card (or null)
//   tapped:      uid of the tapped card
//   playable:    the tapped card can be played now
//   needsTarget: the tapped card still needs an enemy chosen (2+ enemies alive)
// Returns 'select' | 'play' | 'need-target' | 'deselect'.
export function tapCardAction({ selected = null, tapped, playable = false, needsTarget = false } = {}) {
  if (!tapped || selected !== tapped) return 'select';
  if (!playable) return 'deselect';
  return needsTarget ? 'need-target' : 'play';
}

// ---------- Phone text floor ----------
// Same breakpoints as the phone stylesheets: portrait ≤720px or a short landscape.
export const PHONE_QUERY = '(max-width: 720px), (orientation: landscape) and (max-height: 500px)';
export const MIN_TEXT_PX = 12;

// Pure: the size to force for text rendered at `px`, or null when it is fine.
export function floorFontSize(px, min = MIN_TEXT_PX) {
  return Number.isFinite(px) && px > 0 && px < min - 0.25 ? min : null;
}

// On phones, any text the stylesheets leave under 12px is raised to 12px as it
// is rendered, so no screen needs a hand-kept list of small-font selectors.
export function enforceTextFloor({ min = MIN_TEXT_PX, skip = '[aria-hidden="true"], .card-flight, svg' } = {}) {
  if (typeof document === 'undefined' || typeof MutationObserver !== 'function' || typeof matchMedia !== 'function') return;
  const mq = matchMedia(PHONE_QUERY);
  const fix = root => {
    if (!mq.matches || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.nodeValue.trim()) continue;
      seen.add(el);
      if (skip && el.closest(skip)) continue;
      const size = floorFontSize(parseFloat(getComputedStyle(el).fontSize), min);
      if (size) { el.style.fontSize = `${size}px`; el.dataset.fontFloor = ''; }
    }
  };
  new MutationObserver(records => {
    if (!mq.matches) return;
    for (const r of records) for (const node of r.addedNodes) {
      if (node.nodeType === 1) fix(node);
      else if (node.nodeType === 3 && node.parentElement) fix(node.parentElement);
    }
  }).observe(document.body, { childList: true, subtree: true });
  fix(document.body);
  mq.addEventListener?.('change', () => {
    if (mq.matches) fix(document.body);
    else document.querySelectorAll('[data-font-floor]').forEach(el => { el.style.fontSize = ''; delete el.dataset.fontFloor; });
  });
}

// Keeps <html class="tap-play"> in sync so CSS can hide drag hints and show tap UI.
export function watchTapPlay(onChange) {
  if (typeof document === 'undefined' || typeof matchMedia !== 'function') return;
  let last = null;
  const sync = () => {
    const on = tapPlayMode();
    document.documentElement.classList.toggle('tap-play', on);
    if (on !== last) { const first = last === null; last = on; if (!first) onChange?.(on); }
  };
  sync();
  for (const q of ['(pointer: coarse)', '(any-pointer: coarse)', '(hover: none)']) {
    try { matchMedia(q).addEventListener('change', sync); } catch {}
  }
  addEventListener('resize', sync);
}
