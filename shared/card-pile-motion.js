// Rendered card faces travel above scrolling hand containers, then reveal the real cards.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const center = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

function cloneCard(card, layer) {
  const rect = card.getBoundingClientRect();
  const clone = card.cloneNode(true);
  clone.removeAttribute('id');
  clone.removeAttribute('tabindex');
  clone.removeAttribute('data-select');
  clone.removeAttribute('data-uid');
  clone.setAttribute('aria-hidden', 'true');
  clone.classList.remove('selected', 'dragging-card');
  Object.assign(clone.style, {
    position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
    bottom: 'auto', width: `${rect.width}px`, minWidth: `${rect.width}px`,
    height: `${rect.height}px`, margin: '0', transform: 'none',
    transition: 'none', pointerEvents: 'none', opacity: '1',
  });
  layer.appendChild(clone);
  return { clone, rect };
}

function layer() {
  const el = document.createElement('div');
  el.className = 'card-pile-motion-layer';
  Object.assign(el.style, { position: 'fixed', inset: '0', zIndex: '10000', pointerEvents: 'none' });
  document.body.appendChild(el);
  return el;
}

export function flyCardsToPile(cards, pile, { stagger = 95, duration = 440, keepHidden = false } = {}) {
  if (!cards.length || !pile || reduced()) return Promise.resolve();
  const overlay = layer();
  const destination = center(pile.getBoundingClientRect());
  const jobs = cards.map((card, index) => {
    const { clone, rect } = cloneCard(card, overlay);
    card.style.visibility = 'hidden';
    const start = center(rect);
    const dx = destination.x - start.x;
    const dy = destination.y - start.y;
    const animation = clone.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * .54}px, ${dy * .54 - 38}px) scale(.78)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.16)`, opacity: 0 },
    ], { duration, delay: index * stagger, easing: 'ease-in-out', fill: 'forwards' });
    return animation.finished.catch(() => {}).then(() => { clone.remove(); if (!keepHidden) card.style.visibility = ''; });
  });
  return Promise.all(jobs).finally(() => overlay.remove());
}

export function flyCardsFromPile(cards, pile, { stagger = 125, duration = 430 } = {}) {
  if (!cards.length || !pile || reduced()) return Promise.resolve();
  const overlay = layer();
  const source = center(pile.getBoundingClientRect());
  const jobs = cards.map((card, index) => {
    const { clone, rect } = cloneCard(card, overlay);
    card.style.visibility = 'hidden';
    const end = center(rect);
    const dx = source.x - end.x;
    const dy = source.y - end.y;
    const animation = clone.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.18)`, opacity: .65 },
      { transform: `translate(${dx * .48}px, ${dy * .48 - 42}px) scale(.82)`, opacity: 1, offset: .53 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ], { duration, delay: index * stagger, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
    return animation.finished.catch(() => {}).then(() => { clone.remove(); card.style.visibility = ''; });
  });
  return Promise.all(jobs).finally(() => overlay.remove());
}
