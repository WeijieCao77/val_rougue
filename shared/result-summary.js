// Result summary popup, both demos. The engines record every effect the
// player did not pick (random upgrade, transform, curse, card, equipment…) in
// state.lastResult = {title, entries:[{kind, text, random}]}; the UI calls
// showResultSummary after the action resolves so the player sees exactly what
// happened ("已训练：XXX（伤害 7 → 10）").
const ICONS = { upgrade: '▲', transform: '⇄', curse: '✖', card: '＋', equip: '◆', money: '¤', hp: '♥', maxHp: '♥', remove: '－', duplicate: '⧉', gamble: '?' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Only actions with at least one random (unpicked) effect deserve a popup.
// Entries marked `inline` are already shown on the room screen (补给箱 loot).
export function resultWorthShowing(result) {
  return !!result?.entries?.some(e => e.random && !e.inline);
}

export function resultSummaryHtml(result) {
  const rows = result.entries.filter(e => !e.inline).map(e => `<li class="rs-entry rs-${esc(e.kind)}${e.random ? ' is-random' : ''}"><span class="rs-icon" aria-hidden="true">${ICONS[e.kind] || '•'}</span><span class="rs-text">${esc(e.text)}</span>${e.random ? '<em class="rs-tag">随机</em>' : ''}</li>`).join('');
  return `<div class="rs-panel" role="dialog" aria-modal="true" aria-labelledby="rs-title"><p class="rs-eyebrow">结果</p><h2 id="rs-title">${esc(result.title || '结果')}</h2><ul class="rs-list">${rows}</ul><button type="button" class="rs-ok">知道了</button></div>`;
}

let open = null;
export function closeResultSummary() {
  if (!open) return;
  const { el, onClose } = open;
  open = null;
  el.remove();
  document.removeEventListener('keydown', onKey, true);
  onClose?.();
}
function onKey(e) {
  if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); closeResultSummary(); }
}

// Shows the popup (replacing an open one). Closes on the button, Esc/Enter or a
// click outside the panel.
export function showResultSummary(result, { onClose } = {}) {
  if (!resultWorthShowing(result) || typeof document === 'undefined') return false;
  closeResultSummary();
  const el = document.createElement('div');
  el.className = 'rs-overlay';
  el.innerHTML = resultSummaryHtml(result);
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('.rs-ok')) closeResultSummary(); });
  document.body.append(el);
  open = { el, onClose };
  document.addEventListener('keydown', onKey, true);
  el.querySelector('.rs-ok').focus({ preventScroll: true });
  return true;
}
