// Lift the actual card, as in the Wa demo. Rules and targets stay game-specific.
export function attachCardGesture(container, callbacks) {
  let drag = null;
  let suppressClick = false;

  container.addEventListener('pointerdown', event => {
    const element = event.target instanceof Element ? event.target.closest('.hand-card') : null;
    if (!element || !container.contains(element) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const card = callbacks.getCard(element);
    if (!card || !callbacks.canDrag(card, element)) return;
    drag = { element, card, id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
    element.setPointerCapture(event.pointerId);
  });

  container.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    if (!drag.active) {
      drag.active = true;
      drag.element.classList.add('dragging-card');
      callbacks.onStart?.(drag.card, drag.element);
    }
    drag.element.style.setProperty('--drag-x', `${event.clientX}px`);
    drag.element.style.setProperty('--drag-y', `${event.clientY}px`);
    callbacks.onMove?.(drag.card, { x: event.clientX, y: event.clientY, startX: drag.x, startY: drag.y });
    event.preventDefault();
  });

  function finish(event, cancelled = false) {
    if (!drag || drag.id !== event.pointerId) return;
    const current = drag;
    drag = null;
    if (current.element.hasPointerCapture(event.pointerId)) current.element.releasePointerCapture(event.pointerId);
    if (!current.active) return;
    current.element.classList.remove('dragging-card');
    current.element.style.removeProperty('--drag-x');
    current.element.style.removeProperty('--drag-y');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const point = { x: event.clientX, y: event.clientY, startX: current.x, startY: current.y };
    const landed = !cancelled && callbacks.onDrop?.(current.card, point) === true;
    callbacks.onEnd?.(current.card, point, landed);
    if (!landed && current.element.isConnected && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.element.animate([{ filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }], { duration: 220 });
    }
  }

  container.addEventListener('pointerup', event => finish(event));
  container.addEventListener('pointercancel', event => finish(event, true));
  container.addEventListener('lostpointercapture', event => finish(event, true));
  container.addEventListener('click', event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}
