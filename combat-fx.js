// combat-fx.js
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let fxContainer = null;
let fxTimeouts = [];
let fxAnimations = [];
function later(fn,ms){const id=setTimeout(fn,ms);fxTimeouts.push(id);return id;}
function labelX(x){return `${Math.max(80,Math.min(window.innerWidth-80,x))}px`;}
function ensureContainer() {
  if (!fxContainer || !document.body.contains(fxContainer)) {
    fxContainer = document.createElement('div');
    fxContainer.className = 'cfx-container';
    fxContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fxContainer);
  }
  return fxContainer;
}
function cleanupFX() {
  if (fxContainer) {
    fxContainer.remove();
    fxContainer = null;
  }
  fxTimeouts.forEach(clearTimeout);
  fxTimeouts = [];
  fxAnimations.forEach(anim => {
    if (anim && typeof anim.cancel === 'function') anim.cancel();
  });
  fxAnimations = [];
}
export function clearCombatFx() { cleanupFX(); }
export function captureCombatStage() {
  const ally = document.querySelector('.fighter.ally .combat-target');
  const enemy = document.querySelector('.fighter.enemy .combat-target');
  if (!ally || !enemy) return null;
  const allyRect = ally.getBoundingClientRect();
  const enemyRect = enemy.getBoundingClientRect();
  return {
    ally: { x: allyRect.left + allyRect.width / 2, y: allyRect.top + allyRect.height / 2 },
    enemy: { x: enemyRect.left + enemyRect.width / 2, y: enemyRect.top + enemyRect.height / 2 }
  };
}
function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function animateElement(el, keyframes, options) {
  if (prefersReducedMotion()) {
    if (keyframes && keyframes.length > 0) {
      const last = keyframes[keyframes.length - 1];
      Object.assign(el.style, last);
    }
    const timeout = setTimeout(() => el.remove(), options.duration || 1000);
    fxTimeouts.push(timeout);
    return;
  }
  const anim = el.animate(keyframes, options);
  fxAnimations.push(anim);
  anim.finished.then(() => el.remove()).catch(() => el.remove());
  return anim;
}
function spawnRay(container, from, to, color, label, absorbed, lane, targetSide) {
  if (!from || !to) return;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const length = Math.hypot(dx, dy);
  const ray = createElement('div', 'cfx-ray');
  ray.style.left = `${from.x}px`;
  ray.style.top = `${from.y}px`;
  ray.style.width = `${length}px`;
  ray.style.height = '3px';
  ray.style.transform = `rotate(${angle}deg)`;
  ray.style.background = `linear-gradient(90deg, transparent, ${color}, transparent)`;
  ray.style.transformOrigin = '0 50%';
  container.appendChild(ray);
  const muzzle=createElement('div','cfx-muzzle');muzzle.style.left=`${from.x}px`;muzzle.style.top=`${from.y}px`;muzzle.style.background=color;container.appendChild(muzzle);
  animateElement(muzzle,[{opacity:1,transform:'translate(-50%,-50%) scale(.4)'},{opacity:0,transform:'translate(-50%,-50%) scale(2)'}],{duration:200,easing:'ease-out'});
  const bullet=createElement('div','cfx-bullet');bullet.style.left=`${from.x}px`;bullet.style.top=`${from.y}px`;bullet.style.background=color;bullet.style.boxShadow=`0 0 16px 5px ${color}`;container.appendChild(bullet);
  animateElement(bullet,[{opacity:1,transform:'translate(-50%,-50%)'},{opacity:1,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`}],{duration:270,easing:'ease-in'});
  const rayAnim = ray.animate([
    { opacity: 0, transform: `rotate(${angle}deg) scaleX(0.4)` },
    { opacity: 1, transform: `rotate(${angle}deg) scaleX(1)` },
    { opacity: 0, transform: `rotate(${angle}deg) scaleX(1.2)` }
  ], { duration: 180, easing: 'cubic-bezier(.2,.8,.3,1)' });
  fxAnimations.push(rayAnim);
  rayAnim.finished.then(() => ray.remove()).catch(() => ray.remove());
  later(() => {
    globalThis.characterStages?.cue?.(targetSide,label?'hit':'defend');
    const spark = createElement('div', 'cfx-spark');
    spark.style.left = `${to.x}px`;
    spark.style.top = `${to.y}px`;
    spark.style.background = color;
    spark.style.color = color;
    container.appendChild(spark);
    animateElement(spark, [
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(2.5)', opacity: 0 }
    ], { duration: 220, easing: 'ease-out' });
    const targetEl = to.el;
    if (targetEl && !prefersReducedMotion()) {
      const recoil = targetEl.animate([
        { transform: 'translate(0,0)' },
        { transform: 'translate(6px, -2px)' },
        { transform: 'translate(-3px, 1px)' },
        { transform: 'translate(0,0)' }
      ], { duration: 260, delay: 0 });
      fxAnimations.push(recoil);
    }
    if(absorbed>0)spawnDefense(container,to,to.el,absorbed,'intercept');
    if (label) {
      const float = createElement('span', 'cfx-float cfx-damage', label);
      float.style.left = labelX(to.x);
      float.style.top = `${to.y - 20 + lane*26}px`;
      container.appendChild(float);
      animateElement(float, [
        { opacity: 0, transform: 'translate(-50%, 10px)' },
        { opacity: 1, transform: 'translate(-50%, -10px)', offset: 0.2 },
        { opacity: 0, transform: 'translate(-50%, -35px)' }
      ], { duration: 900, easing: 'ease-out' });
    }
  }, 270);
}
function spawnDefense(container, targetPos, targetEl, amount, side) {
  const barrier = createElement('div', 'cfx-barrier');
  if (targetPos) {
    barrier.style.left = `${targetPos.x}px`;
    barrier.style.top = `${targetPos.y}px`;
  } else {
    const rect = targetEl.getBoundingClientRect();
    barrier.style.left = `${rect.left + rect.width/2}px`;
    barrier.style.top = `${rect.top + rect.height/2}px`;
  }
  barrier.style.transform = 'translate(-50%, -50%)';
  container.appendChild(barrier);
  const barrierAnim = barrier.animate([
    { transform: 'translate(-50%, -30%) scaleY(0.1)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scaleY(1)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.8, offset: 0.65 },
    { transform: 'translate(-50%, -50%) scale(1.05)', opacity: 0 }
  ], { duration: 950, easing: 'ease-out' });
  fxAnimations.push(barrierAnim);
  barrierAnim.finished.then(() => barrier.remove()).catch(() => barrier.remove());
  container.querySelectorAll('.cfx-defense').forEach(el=>el.remove());
  const label = createElement('span', 'cfx-float cfx-defense', side==='intercept'?`拦截 ${amount}`:`布防 +${amount}`);
  label.style.left = targetEl ? (() => { const r = targetEl.getBoundingClientRect(); return `${r.left + r.width/2}px`; })() : (targetPos ? `${targetPos.x}px` : '');
  label.style.top = targetEl ? (() => { const r = targetEl.getBoundingClientRect(); return `${r.top}px`; })() : '';
  label.style.left=labelX(targetPos.x);
  container.appendChild(label);
  animateElement(label, [
    { opacity: 0, transform: 'translate(-50%, 10px)' },
    { opacity: 1, transform: 'translate(-50%, -8px)', offset: 0.3 },
    { opacity: 0, transform: 'translate(-50%, -28px)' }
  ], { duration: 1000, easing: 'ease-out' });
}
function spawnStatus(container, targetEl, targetPos, statusLabel, side) {
  const ring = createElement('div', 'cfx-status-ring');
  if (targetPos) {
    ring.style.left = `${targetPos.x}px`;
    ring.style.top = `${targetPos.y}px`;
  } else {
    const rect = targetEl.getBoundingClientRect();
    ring.style.left = `${rect.left + rect.width/2}px`;
    ring.style.top = `${rect.top + rect.height/2}px`;
  }
  container.appendChild(ring);
  const ringAnim = ring.animate([
    { transform: 'translate(-50%, -50%) scale(0.7)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1, offset: 0.5 },
    { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }
  ], { duration: 700, easing: 'ease-out' });
  fxAnimations.push(ringAnim);
  ringAnim.finished.then(() => ring.remove()).catch(() => ring.remove());
  const label = createElement('span', 'cfx-float cfx-status-label', statusLabel);
  label.style.left = labelX(targetPos.x);
  label.style.top = parseInt(ring.style.top) - 15 + 'px';
  container.appendChild(label);
  animateElement(label, [
    { opacity: 0, transform: 'translate(-50%, 10px)' },
    { opacity: 1, transform: 'translate(-50%, -5px)', offset: 0.3 },
    { opacity: 0, transform: 'translate(-50%, -25px)' }
  ], { duration: 900, easing: 'ease-out' });
}
function spawnPower(container, targetEl, targetPos, side) {
  const flash = createElement('div', 'cfx-power-flash');
  if (targetPos) {
    flash.style.left = `${targetPos.x}px`;
    flash.style.top = `${targetPos.y}px`;
  } else {
    const rect = targetEl.getBoundingClientRect();
    flash.style.left = `${rect.left + rect.width/2}px`;
    flash.style.top = `${rect.top + rect.height/2}px`;
  }
  container.appendChild(flash);
  const flashAnim = flash.animate([
    { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0.8 },
    { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 0 }
  ], { duration: 500, easing: 'ease-out' });
  fxAnimations.push(flashAnim);
  flashAnim.finished.then(() => flash.remove()).catch(() => flash.remove());
}
function spawnLoss(container, targetPos, targetEl, amount, side) {
  const loss = createElement('span', 'cfx-float cfx-loss', `-${amount}`);
  if (targetPos) {
    loss.style.left = `${targetPos.x}px`;
    loss.style.top = `${targetPos.y}px`;
  } else {
    const rect = targetEl.getBoundingClientRect();
    loss.style.left = `${rect.left + rect.width/2}px`;
    loss.style.top = `${rect.top}px`;
  }
  container.appendChild(loss);
  animateElement(loss, [
    { opacity: 0, transform: 'translate(-50%, 10px)' },
    { opacity: 1, transform: 'translate(-50%, -8px)', offset: 0.3 },
    { opacity: 0, transform: 'translate(-50%, -30px)' }
  ], { duration: 800, easing: 'ease-out' });
}
export function playCombatFx(events, snapshot) {
  clearCombatFx();
  if (!events || events.length === 0) return;
  if (!document.querySelector('.arena')) {
    if(!snapshot)return;
    const host=ensureContainer(),loss=!!document.querySelector('.room-result')&&document.querySelector('.hud-hp b')?.textContent==='0';
    const toast=createElement('div','cfx-reduced-marker',loss?'比赛结束':'突破防线 · 比赛胜利');
    toast.style.left='50%';toast.style.top='80px';host.append(toast);later(cleanupFX,900);return;
  }
  events=events.slice(0,16);
  const container = ensureContainer();
  const allyEl = document.querySelector('.fighter.ally .combat-target');
  const enemyEl = document.querySelector('.fighter.enemy .combat-target');
  if (!allyEl || !enemyEl) {clearCombatFx();return;}
  let positions = captureCombatStage() || snapshot;
  if (!positions) {clearCombatFx();return;}
  positions.ally.el = allyEl;
  positions.enemy.el = enemyEl;
  let delay = 0;
  const totalEvents = events.length;
  const eventDelay = Math.min(180,400/Math.max(1,totalEvents-1));
  if (prefersReducedMotion()) {
    const marker = createElement('div', 'cfx-reduced-marker', events.map(getEventDescription).join('；'));
    marker.style.left = '50%';
    marker.style.top = '20%';
    container.appendChild(marker);
    later(cleanupFX,600);
    return;
  }
  events.forEach((evt, index) => {
    const currentDelay = delay;
    delay += eventDelay;
    const timeout = setTimeout(() => {
      while(container.childElementCount>50)container.firstElementChild.remove();
      switch (evt.kind) {
        case 'attack': {
          const from = evt.source === 'ally' ? positions.ally : positions.enemy;
          const to = evt.source === 'ally' ? positions.enemy : positions.ally;
          const label = evt.damage>0?`−${evt.damage}`:'';
          spawnRay(container, from, to, evt.source === 'ally' ? '#f5d17c' : '#ff826f', label, evt.absorbed,index%3,evt.target);
          break;
        }
        case 'defense':
          if (evt.target === 'ally') spawnDefense(container, positions.ally, allyEl, evt.amount, 'ally');
          else spawnDefense(container, positions.enemy, enemyEl, evt.amount, 'enemy');
          break;
        case 'status':
          if (evt.target === 'enemy') spawnStatus(container, enemyEl, positions.enemy, evt.label, 'enemy');
          else spawnStatus(container, allyEl, positions.ally, evt.label, 'ally');
          break;
        case 'loss':
          spawnLoss(container, positions.ally, allyEl, evt.amount, 'ally');
          break;
        case 'power':
          spawnPower(container, allyEl, positions.ally, 'ally');
          break;
      }
      const title = getEventTitle(evt);
      if (title) {
        container.querySelectorAll('.cfx-title').forEach(el=>el.remove());
        const titleEl = createElement('div', 'cfx-title', title);
        titleEl.style.left = '50%';
        titleEl.style.top = `${Math.max(80,Math.min(positions.ally.y,positions.enemy.y)-70)}px`;
        container.appendChild(titleEl);
        animateElement(titleEl, [
          { opacity: 0, transform: 'translate(-50%, 10px)' },
          { opacity: 1, transform: 'translate(-50%, 0)' },
          { opacity: 0, transform: 'translate(-50%, -10px)' }
        ], { duration: 700, easing: 'ease-out' });
      }
    }, currentDelay);
    fxTimeouts.push(timeout);
  });
  const cleanupTimeout = setTimeout(() => {
    cleanupFX();
  }, 1500);
  fxTimeouts.push(cleanupTimeout);
}
function getEventTitle(evt) {
  switch (evt.kind) {
    case 'attack':
      if (evt.source === 'ally') {
        if (evt.damage === 0 && evt.absorbed > 0) return '布防拦截';
        return '命中';
      } else {
        if (evt.damage === 0 && evt.absorbed > 0) return '布防拦截';
        return '对手开火';
      }
    case 'defense':
      return evt.target === 'ally' ? '布防完成' : '拦截进点';
    case 'status':
      return '战术生效';
    case 'loss':
      return '舆论压力';
    case 'power':
      return '能力触发';
    default:
      return '';
  }
}
function getEventDescription(evt) {
  switch (evt.kind) {
    case 'attack':
      if (evt.damage === 0 && evt.absorbed > 0) return '完全抵挡';
      return `${evt.source === 'ally' ? '我方' : '对方'}攻击 ${evt.damage}${evt.absorbed > 0 ? `（抵挡 ${evt.absorbed}）` : ''}`;
    case 'defense':
      return `布防 +${evt.amount}`;
    case 'status':
      return evt.label;
    case 'loss':
      return `失去 ${evt.amount}`;
    case 'power':
      return '能力';
  }
}
export function cleanupCombatFx() { cleanupFX(); }
window.addEventListener('pagehide', cleanupCombatFx);
window.addEventListener('beforeunload', cleanupCombatFx);
window.addEventListener('resize', cleanupCombatFx);
window.addEventListener('scroll', cleanupCombatFx, true);
