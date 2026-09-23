import { CARDS } from './content.js';

let currentSession = null;
let sessionCounter = 0;

function addVisibilityHandler(session) {
  const handler = () => {
    if (document.hidden) {
      cancelSession(session);
    }
  };
  document.addEventListener('visibilitychange', handler);
  session.removeVisibilityHandler = () => document.removeEventListener('visibilitychange', handler);
}

function cancelSession(session) {
  if (!session || session.done) return;
  session.done = true;
  if (session.animations) {
    session.animations.forEach(anim => { try { anim.cancel(); } catch(e){} });
  }
  if (session.timers) {
    session.timers.forEach(timer => { try { clearTimeout(timer); } catch(e){} });
  }
  if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
  if (session.root && session.root.parentNode) session.root.parentNode.removeChild(session.root);
  if (session.removeVisibilityHandler) session.removeVisibilityHandler();
  if (session.resolve) session.resolve();
  if (currentSession === session) currentSession = null;
}

export function clearCombatPresentation() {
  if (currentSession) {
    cancelSession(currentSession);
  }
}

function getCenter(el, fallbackX, fallbackY) {
  if (!el) return { x: fallbackX, y: fallbackY };
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
}

export function captureCombatPresentation(root, state, action) {
  const fallbackX = window.innerWidth/2;
  const fallbackY = window.innerHeight/2;
  const q = (sel) => root.querySelector(sel);
  const playerBox = q('#player-box');
  const enemyBox = q('#enemy-box');
  const drawPile = q('#pile-draw');
  const discardPile = q('#pile-discard');
  const exhaustPile = q('#pile-exhaust');
  const capture = {
    playerBox: getCenter(playerBox, fallbackX, fallbackY),
    enemyBox: getCenter(enemyBox, fallbackX, fallbackY),
    drawPile: getCenter(drawPile, fallbackX, fallbackY),
    discardPile: getCenter(discardPile, fallbackX, fallbackY),
    exhaustPile: getCenter(exhaustPile, fallbackX, fallbackY),
    playedCardClone: null,
    playedCardStart: {x:0,y:0},
    handCardClones: [],
  };
  const handCards = root.querySelectorAll('.hand-card[data-uid]');
  for (const cardEl of handCards) {
    const uid = cardEl.dataset.uid;
    const clone = cardEl.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.margin = '0';
    const originalRect = cardEl.getBoundingClientRect();
    clone.style.width = originalRect.width + 'px';
    clone.style.height = originalRect.height + 'px';
    clone.style.pointerEvents = 'none';
    const center = getCenter(cardEl, fallbackX, fallbackY);
    capture.handCardClones.push({ uid, clone, center });
    if (action && action.uid === uid) {
      capture.playedCardClone = clone;
      capture.playedCardStart = center;
    }
  }
  return capture;
}

function createFx(session, kind, {x, y, text='', className='', scale=1, duration=300, delay=0, keyframes, easing='ease-out'}) {
  if (!session || session.done || session !== currentSession) return;
  const el = document.createElement('div');
  el.className = `new-fx-node ${className}`;
  el.dataset.fxKind = kind;
  el.style.position = 'absolute';
  el.style.left = (x - 10) + 'px';
  el.style.top = (y - 10) + 'px';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '9999';
  if (text) el.textContent = text;
  if (scale !== 1) el.style.transform = `scale(${scale})`;
  session.root.appendChild(el);
  const anim = el.animate(keyframes, { duration, delay, easing, fill: 'forwards' });
  session.animations.push(anim);
}

// Enhanced card flight with arc and impact handling.
function animateCardFlight(session, clone, from, to, options = {}) {
  if (!session || session.done || session !== currentSession) return;
  const {
    duration = 450,
    delay = 0,
    targetScale = 0.25,
    arcHeight = 120,
    impactKind = 'card-flight',
    impactTarget = null,
    impactFx = null,
    onComplete = null,
    kind = 'card-flight'
  } = options;

  clone.style.position = 'absolute';
  const width = parseFloat(clone.style.width) || 60;
  const height = parseFloat(clone.style.height) || 84;
  clone.style.left = (from.x - width / 2) + 'px';
  clone.style.top = (from.y - height / 2) + 'px';
  clone.style.pointerEvents = 'none';
  clone.style.zIndex = '9999';
  clone.dataset.fxKind = kind;
  session.root.appendChild(clone);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const midX = from.x + dx / 2;
  const midY = from.y + dy / 2 - (arcHeight || Math.max(60, dist * 0.2));

  const keyframes = [
    { transform: 'translate(0px, 0px) scale(1)', opacity: 1, offset: 0 },
    { transform: `translate(${dx/2}px, ${dy/2 - arcHeight}px) scale(1.2)`, opacity: 1, offset: 0.5, easing: 'ease-out' },
    { transform: `translate(${dx}px, ${dy}px) scale(${targetScale})`, opacity: 0.9, offset: 1 }
  ];

  // Create timeline with card flight
  const flightAnim = clone.animate(keyframes, { duration, delay, easing: 'ease-in-out', fill: 'forwards' });
  session.animations.push(flightAnim);

  // Impact effect at end of flight
  const impactTime = delay + duration;
  const impactCallback = () => {
    if (session.done || session !== currentSession) return;
    if (impactTarget) {
      // Impact specific visual: ring, particles, shake
      const ring = document.createElement('div');
      ring.className = 'new-fx-node impact-ring';
      ring.dataset.fxKind = impactKind === 'attack' ? 'attack-impact' : impactKind === 'block' ? 'block-impact' : 'impact';
      ring.style.position = 'absolute';
      ring.style.left = (impactTarget.x - 30) + 'px';
      ring.style.top = (impactTarget.y - 30) + 'px';
      ring.style.width = '60px';
      ring.style.height = '60px';
      ring.style.borderRadius = '50%';
      ring.style.border = '3px solid rgba(255,255,255,0.9)';
      ring.style.pointerEvents = 'none';
      ring.style.zIndex = '9999';
      session.root.appendChild(ring);
      const ringAnim = ring.animate([
        { transform: 'scale(0)', opacity: 1 },
        { transform: 'scale(2.5)', opacity: 0 }
      ], { duration: 350, easing: 'ease-out', fill: 'forwards' });
      session.animations.push(ringAnim);

      // Particles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const speed = 30 + Math.random() * 30;
        const tx = Math.cos(angle) * speed;
        const ty = Math.sin(angle) * speed;
        const particle = document.createElement('div');
        particle.className = 'new-fx-node impact-particle';
        particle.dataset.fxKind = 'impact-particle';
        particle.style.position = 'absolute';
        particle.style.left = (impactTarget.x - 4) + 'px';
        particle.style.top = (impactTarget.y - 4) + 'px';
        particle.style.width = '8px';
        particle.style.height = '8px';
        particle.style.backgroundColor = '#ffd166';
        particle.style.borderRadius = '50%';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '9999';
        session.root.appendChild(particle);
        const particleAnim = particle.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], { duration: 400, easing: 'ease-out', fill: 'forwards' });
        session.animations.push(particleAnim);
      }

      // Shake target element (if DOM element exists)
      const targetInfo = session.targetEls?.find(info => info.impactTarget === impactTarget.id);
      if (targetInfo && targetInfo.el) {
        const shakeAnim = targetInfo.el.animate([
          { transform: 'translateX(0)' },
          { transform: 'translateX(-5px)' },
          { transform: 'translateX(5px)' },
          { transform: 'translateX(-3px)' },
          { transform: 'translateX(3px)' },
          { transform: 'translateX(0)' }
        ], { duration: 200, easing: 'ease-in-out' });
        session.animations.push(shakeAnim);
      }
    }
    if (impactFx && typeof impactFx === 'function') {
      impactFx(session);
    }
    if (onComplete) {
      const rect = clone.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      flightAnim.cancel();
      clone.style.transform = 'none';
      onComplete(center);
    }
  };

  // Schedule impact callback
  const impactTimer = setTimeout(impactCallback, impactTime);
  session.timers.push(impactTimer);
}

// added helper to get card type
function getCardType(card) {
  if (!card) return 'other';
  const def = CARDS[card.id];
  if (!def) return 'other';
  if (def.type && def.type.includes('attack')) return 'attack';
  if (def.type && (def.type.includes('block') || def.type.includes('skill') || def.type.includes('power'))) return 'defense';
  return 'other';
}

export async function animateCombatTransition(prevState, nextState, action, capture) {
  clearCombatPresentation();
  const prev = prevState;
  const next = {
    ...nextState,
    battle: nextState.battle || { ...prev.battle, hand: [], exhaustPile: [], statuses: prev.battle.statuses },
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const session = {
    id: ++sessionCounter,
    root: document.createElement('div'),
    animations: [],
    timers: [],
    done: false,
    cleanupTimer: null,
    removeVisibilityHandler: null,
    resolve: null,
    targetEls: []
  };
  session.root.className = 'new-fx-layer';
  session.root.style.position = 'fixed';
  session.root.style.top = '0';
  session.root.style.left = '0';
  session.root.style.width = '100%';
  session.root.style.height = '100%';
  session.root.style.pointerEvents = 'none';
  session.root.style.zIndex = '9999';
  document.body.appendChild(session.root);
  currentSession = session;
  addVisibilityHandler(session);

  // Store references to actual target elements for shaking if needed
  session.targetEls = [
    { el: document.getElementById('enemy-box'), impactTarget: 'enemy' },
    { el: document.getElementById('player-box'), impactTarget: 'player' }
  ].filter(x => x.el);

  const promise = new Promise(resolve => { session.resolve = resolve; });

  session.cleanupTimer = setTimeout(() => {
    cancelSession(session);
  }, reducedMotion ? 80 : 1100);

  if (reducedMotion) {
    createFx(session, 'stance', {
      x: capture.playerBox.x, y: capture.playerBox.y - 50,
      text: '动画简化', className: 'reduced-hint',
      duration: 60, delay: 0,
      keyframes: [
        { opacity: 0 },
        { opacity: 1, offset: 0.5 },
        { opacity: 0 }
      ]
    });
  } else {
    const pb = capture.playerBox;
    const eb = capture.enemyBox;
    const dp = capture.drawPile;
    const dcp = capture.discardPile;
    const ep = capture.exhaustPile;

    let playedCard = null;
    if (action && action.uid) {
      playedCard = prev.battle.hand.find(c => c.uid === action.uid);
    }
    const isExhaust = playedCard && next.battle.exhaustPile.some(c => c.uid === playedCard.uid);
    const flyTarget = isExhaust ? ep : dcp;

    // Determine card type
    let isAttack = false;
    let isDefensive = false; // block or skill that targets self
    let isOther = false;
    if (playedCard && CARDS[playedCard.id]) {
      const def = CARDS[playedCard.id];
      if (def.type && def.type.includes('attack')) {
        isAttack = true;
      } else if (def.type && (def.type.includes('block') || def.type.includes('skill') || def.type.includes('power'))) {
        isDefensive = true;
      } else {
        isOther = true;
      }
    }

    // For attack: card flies to enemy, then to discard/exhaust
    if (isAttack) {
      if (capture.playedCardClone) {
        const flightKind = isExhaust ? 'exhaust' : 'discard';
        animateCardFlight(session, capture.playedCardClone, capture.playedCardStart, eb, {
          duration: 400,
          delay: 0,
          targetScale: 0.6,
          arcHeight: Math.max(80, Math.abs(eb.y - capture.playedCardStart.y) * 0.3 + 60),
          impactKind: 'attack',
          impactTarget: { x: eb.x, y: eb.y, id: 'enemy' },
          kind: 'attack-flight',
          onComplete: currentCenter => {
            // Then animate to discard/exhaust
            animateCardFlight(session, capture.playedCardClone, currentCenter, flyTarget, {
              duration: 250,
              targetScale: 0.2,
              arcHeight: 40,
              kind: flightKind,
              impactKind: 'discard',
              impactTarget: flyTarget
            });
          }
        });
      }
      // Additional attack line
      const dx = eb.x - pb.x;
      const dy = eb.y - pb.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const line = document.createElement('div');
      line.className = 'new-fx-node';
      line.dataset.fxKind = 'attack';
      line.style.position = 'absolute';
      line.style.left = pb.x + 'px';
      line.style.top = pb.y + 'px';
      line.style.width = dist + 'px';
      line.style.height = '2px';
      line.style.background = 'rgba(255,193,7,0.6)';
      line.style.transformOrigin = '0 50%';
      line.style.transform = `rotate(${angle}deg)`;
      line.style.pointerEvents = 'none';
      session.root.appendChild(line);
      const lineAnim = line.animate([
        { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 },
        { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.8, offset: 0.4 },
        { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.2, offset: 0.7 },
        { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 }
      ], { duration: 450, easing: 'ease-out', fill: 'forwards' });
      session.animations.push(lineAnim);

      // Damage number
      const damage = Math.max(0, prev.battle.enemyHp - next.battle.enemyHp);
      if (damage > 0) {
        createFx(session, 'damage', {
          x: eb.x, y: eb.y - 30,
          text: `-${damage}`,
          className: 'fx-damage',
          duration: 500, delay: 400,
          keyframes: [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-40px)', opacity: 0 }
          ]
        });
      }
    }

    // For defensive (block/skill/power): card flies to player box, then to discard/exhaust
    else if (isDefensive) {
      if (capture.playedCardClone) {
        const flightKind = isExhaust ? 'exhaust' : 'discard';
        animateCardFlight(session, capture.playedCardClone, capture.playedCardStart, pb, {
          duration: 400,
          delay: 0,
          targetScale: 0.6,
          arcHeight: Math.max(80, Math.abs(pb.y - capture.playedCardStart.y) * 0.3 + 60),
          impactKind: 'block',
          impactTarget: { x: pb.x, y: pb.y, id: 'player' },
          kind: 'block-flight',
          onComplete: currentCenter => {
            animateCardFlight(session, capture.playedCardClone, currentCenter, flyTarget, {
              duration: 250,
              targetScale: 0.2,
              arcHeight: 40,
              kind: flightKind,
              impactKind: 'discard',
              impactTarget: flyTarget
            });
          }
        });
      }
      // Block effect
      const blockGain = Math.max(0, next.battle.playerBlock - prev.battle.playerBlock);
      if (blockGain > 0) {
        createFx(session, 'block', {
          x: pb.x, y: pb.y - 40,
          text: `+${blockGain} 布防`,
          className: 'fx-text block-text',
          duration: 500, delay: 400,
          keyframes: [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-40px)', opacity: 0 }
          ]
        });
        createFx(session, 'block', {
          x: pb.x, y: pb.y,
          className: 'block-aura',
          scale: 0.5,
          duration: 400, delay: 350,
          keyframes: [
            { transform: 'scale(0.5)', opacity: 0.8 },
            { transform: 'scale(1.3)', opacity: 0 }
          ]
        });
      }
      // Power-specific flash
      if (playedCard && CARDS[playedCard.id]?.type === 'power') {
        createFx(session, 'power', {
          x: pb.x, y: pb.y,
          className: 'power-aura',
          scale: 0.5,
          duration: 400, delay: 350,
          keyframes: [
            { transform: 'scale(0.5)', opacity: 0.8 },
            { transform: 'scale(1.5)', opacity: 0 }
          ]
        });
      }
    }

    // For other card types (rare), fly to enemy? Or just discard? For now, treat as defensive target player.
    else if (isOther) {
      if (capture.playedCardClone) {
        const flightKind = isExhaust ? 'exhaust' : 'discard';
        animateCardFlight(session, capture.playedCardClone, capture.playedCardStart, pb, {
          duration: 400,
          targetScale: 0.6,
          arcHeight: 100,
          impactKind: 'generic',
          impactTarget: { x: pb.x, y: pb.y, id: 'player' },
          kind: 'card-flight',
          onComplete: currentCenter => {
            animateCardFlight(session, capture.playedCardClone, currentCenter, flyTarget, {
              duration: 250,
              targetScale: 0.2,
              arcHeight: 40,
              kind: flightKind,
              impactKind: 'discard',
              impactTarget: flyTarget
            });
          }
        });
      }
    }

    // Enemy status effects with new animation
    const enemyStatusKeys = ['smoke', 'flash', 'weak', 'vuln', 'block'];
    for (const key of enemyStatusKeys) {
      const prevVal = prev.battle.statuses.enemy[key] || 0;
      const nextVal = next.battle.statuses.enemy[key] || 0;
      if (nextVal > prevVal) {
        if (key === 'smoke') {
          createFx(session, 'smoke', {
            x: eb.x, y: eb.y, className: 'smoke-cloud',
            duration: 500, delay: 300,
            keyframes: [
              { transform: 'scale(0.2)', opacity: 0.8 },
              { transform: 'scale(1.8)', opacity: 0 }
            ]
          });
        } else if (key === 'flash') {
          createFx(session, 'flash', {
            x: eb.x, y: eb.y, className: 'flash-star',
            duration: 400, delay: 250,
            keyframes: [
              { transform: 'scale(0)', opacity: 1 },
              { transform: 'scale(1.5)', opacity: 0 }
            ]
          });
        } else if (key === 'weak' || key === 'vuln') {
          createFx(session, 'power', {
            x: eb.x, y: eb.y - 30, text: key === 'weak' ? '压制' : '易伤', className: 'status-text',
            duration: 400, delay: 300,
            keyframes: [
              { transform: 'translateY(0)', opacity: 1 },
              { transform: 'translateY(-25px)', opacity: 0 }
            ]
          });
        } else if (key === 'block') {
          createFx(session, 'block', {
            x: eb.x, y: eb.y, className: 'enemy-block-aura',
            scale: 0.5, duration: 400, delay: 300,
            keyframes: [
              { transform: 'scale(0.5)', opacity: 0.8 },
              { transform: 'scale(1.2)', opacity: 0 }
            ]
          });
        }
      }
    }

    // Player status effects similar? Not needed for now.

    if (prev.battle.stance !== next.battle.stance) {
      createFx(session, 'stance', {
        x: pb.x, y: pb.y,
        className: 'stance-aura',
        scale: 0.5,
        duration: 500, delay: 100,
        keyframes: [
          { transform: 'scale(0.5)', opacity: 0.8 },
          { transform: 'scale(1.3)', opacity: 0 }
        ]
      });
      createFx(session, 'stance', {
        x: pb.x, y: pb.y - 30,
        text: next.battle.stance === 'cover' ? '掩护' : '前压',
        className: 'stance-text',
        duration: 500, delay: 100,
        keyframes: [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(-35px)', opacity: 0 }
        ]
      });
    }

    // Draw effects
    const prevUids = new Set(prev.battle.hand.map(c => c.uid));
    const nextUids = new Set(next.battle.hand.map(c => c.uid));
    const newUids = [...nextUids].filter(uid => !prevUids.has(uid));
    for (let i = 0; i < newUids.length; i++) {
      const targetX = pb.x + (i - (newUids.length-1)/2) * 70;
      const targetY = pb.y - 30;
      const cardEl = document.createElement('div');
      cardEl.className = 'new-fx-node draw-card';
      cardEl.dataset.fxKind = 'draw';
      cardEl.style.position = 'absolute';
      cardEl.style.width = '60px';
      cardEl.style.height = '84px';
      cardEl.style.background = '#0d7377';
      cardEl.style.border = '2px solid #ffb703';
      cardEl.style.borderRadius = '6px';
      cardEl.style.left = (dp.x - 30) + 'px';
      cardEl.style.top = (dp.y - 42) + 'px';
      cardEl.style.pointerEvents = 'none';
      session.root.appendChild(cardEl);
      const anim = cardEl.animate([
        { transform: 'translate(0,0) scale(0.5)', opacity: 0.5 },
        { transform: `translate(${targetX - dp.x}px, ${targetY - dp.y}px) scale(1)`, opacity: 1 }
      ], { duration: 400, delay: 100 + i*50, easing: 'ease-out', fill: 'forwards' });
      session.animations.push(anim);
    }

    // End turn: fly remaining hand cards to discard
    if (action && action.type === 'end') {
      capture.handCardClones.forEach((item, index) => {
        animateCardFlight(session, item.clone, item.center, dcp, {
          duration: 300,
          delay: index * 40,
          targetScale: 0.2,
          arcHeight: 60,
          kind: 'discard'
        });
      });
      const playerDamage = Math.max(0, prev.hp - next.hp);
      if (playerDamage > 0) {
        // Enemy attack line
        const dx = pb.x - eb.x;
        const dy = pb.y - eb.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const line = document.createElement('div');
        line.className = 'new-fx-node';
        line.dataset.fxKind = 'attack';
        line.style.position = 'absolute';
        line.style.left = eb.x + 'px';
        line.style.top = eb.y + 'px';
        line.style.width = dist + 'px';
        line.style.height = '2px';
        line.style.background = 'rgba(255,87,34,0.7)';
        line.style.transformOrigin = '0 50%';
        line.style.transform = `rotate(${angle}deg)`;
        line.style.pointerEvents = 'none';
        session.root.appendChild(line);
        const lineAnim = line.animate([
          { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 },
          { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.8, offset: 0.4 },
          { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.2, offset: 0.7 },
          { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 }
        ], { duration: 500, delay: 300, easing: 'ease-out', fill: 'forwards' });
        session.animations.push(lineAnim);
        createFx(session, 'damage', {
          x: pb.x, y: pb.y - 30,
          text: `-${playerDamage}`,
          className: 'damage-text',
          duration: 500, delay: 500,
          keyframes: [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-40px)', opacity: 0 }
          ]
        });
      }
    }

    // Victory effect
    if (next.battle.enemyHp <= 0 && prev.battle.enemyHp > 0) {
      createFx(session, 'victory', {
        x: window.innerWidth/2, y: window.innerHeight/2,
        text: '胜利！',
        className: 'victory-text',
        duration: 700, delay: 300,
        keyframes: [
          { transform: 'scale(0.5)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1, offset: 0.5 },
          { transform: 'scale(1.2)', opacity: 0 }
        ]
      });
      createFx(session, 'power', {
        x: window.innerWidth/2, y: window.innerHeight/2,
        className: 'power-aura',
        scale: 0.5,
        duration: 500, delay: 300,
        keyframes: [
          { transform: 'scale(0.5)', opacity: 0.8 },
          { transform: 'scale(1.5)', opacity: 0 }
        ]
      });
    }
  }

  return promise;
}
