// Shared pointer gesture for both games. Rules and legal targets stay with each game.
export function attachCardGesture(container, callbacks) {
  let drag = null;
  let swallowClick = false;
  const cardAt = target => target instanceof Element ? target.closest('.hand-card.shared-card') : null;

  function moveProxy(x, y) {
    if (!drag?.proxy) return;
    drag.proxy.style.left = `${x}px`;
    drag.proxy.style.top = `${y}px`;
  }

  container.addEventListener('pointerdown', event => {
    const element = cardAt(event.target);
    if (!element || !container.contains(element) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const card = callbacks.getCard(element);
    if (!card || !callbacks.canDrag(card, element)) return;
    drag = { element, card, id: event.pointerId, x: event.clientX, y: event.clientY, active: false, proxy: null };
    element.setPointerCapture(event.pointerId);
  });

  container.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    if (!drag.active) {
      drag.active = true;
      const rect = drag.element.getBoundingClientRect();
      const proxy = drag.element.cloneNode(true);
      proxy.classList.remove('selected');
      proxy.classList.add('card-drag-proxy');
      proxy.removeAttribute('id');
      proxy.setAttribute('aria-hidden', 'true');
      proxy.style.width = `${rect.width}px`;
      proxy.style.height = `${rect.height}px`;
      drag.proxy = proxy;
      document.body.append(proxy);
      drag.element.classList.add('card-drag-origin');
      callbacks.onStart?.(drag.card, drag.element);
    }
    moveProxy(event.clientX, event.clientY);
    callbacks.onMove?.(drag.card, { x: event.clientX, y: event.clientY, startX: drag.x, startY: drag.y });
    event.preventDefault();
  });

  function finish(event, cancelled = false) {
    if (!drag || drag.id !== event.pointerId) return;
    const current = drag;
    drag = null;
    if (current.element.hasPointerCapture(event.pointerId)) current.element.releasePointerCapture(event.pointerId);
    if (!current.active) return;
    current.element.classList.remove('card-drag-origin');
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    const point = { x: event.clientX, y: event.clientY, startX: current.x, startY: current.y };
    const landed = !cancelled && callbacks.onDrop?.(current.card, point) === true;
    callbacks.onEnd?.(current.card, point, landed);
    if (landed || !current.proxy) { current.proxy?.remove(); return; }
    const rect = current.element.getBoundingClientRect();
    const proxy = current.proxy;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { proxy.remove(); return; }
    const animation = proxy.animate([
      { left: `${event.clientX}px`, top: `${event.clientY}px`, opacity: .95 },
      { left: `${rect.left + rect.width / 2}px`, top: `${rect.top + rect.height / 2}px`, opacity: .45 },
    ], { duration: 190, easing: 'cubic-bezier(.22,.8,.3,1)' });
    animation.finished.finally(() => proxy.remove()).catch(() => proxy.remove());
  }

  container.addEventListener('pointerup', event => finish(event));
  container.addEventListener('pointercancel', event => finish(event, true));
  container.addEventListener('lostpointercapture', event => finish(event, true));
  container.addEventListener('click', event => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}
