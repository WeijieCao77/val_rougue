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

function animateCardFlight(session, clone, from, to, targetScale=0.2, duration=500, delay=0, kind = 'card-flight') {
  if (!session || session.done || session !== currentSession) return;
  clone.style.position = 'absolute';
  // Use width/height from the clone's bounding rect or fallback to 60x84
  const width = parseFloat(clone.style.width) || 60;
  const height = parseFloat(clone.style.height) || 84;
  clone.style.left = (from.x - width / 2) + 'px';
  clone.style.top = (from.y - height / 2) + 'px';
  clone.style.pointerEvents = 'none';
  clone.style.zIndex = '9999';
  clone.dataset.fxKind = kind;
  // For exhaust, wrap in an indicator or set data attr on parent? We set on clone itself.
  session.root.appendChild(clone);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const keyframes = [
    { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
    { transform: `translate(${dx}px, ${dy}px) scale(${targetScale})`, opacity: 0.8, offset: 1 }
  ];
  const anim = clone.animate(keyframes, { duration, delay, easing: 'ease-in', fill: 'forwards' });
  session.animations.push(anim);
}

export async function animateCombatTransition(prevState, nextState, action, capture) {
  // Requirement: must call clearCombatPresentation() at start
  clearCombatPresentation();
  const prev = prevState;
  // Ensure next has battle, merging with previous battle to avoid null battle
  const next = {
    ...nextState,
    battle: nextState.battle || {
      ...prev.battle,
      hand: [],
      exhaustPile: [],
      statuses: prev.battle.statuses,
    },
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const session = {
    id: ++sessionCounter,
    root: document.createElement('div'),
    animations: [],
    done: false,
    cleanupTimer: null,
    removeVisibilityHandler: null,
    resolve: null,
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

  const promise = new Promise(resolve => {
    session.resolve = resolve;
  });

  // Set cleanup timer immediately (850ms default), will be adjusted for reduced motion
  session.cleanupTimer = setTimeout(() => {
    cancelSession(session);
  }, 850);

  if (reducedMotion) {
    // Clear previous timer and set shorter 80ms
    clearTimeout(session.cleanupTimer);
    session.cleanupTimer = setTimeout(() => {
      cancelSession(session);
    }, 80);

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

    if (capture.playedCardClone) {
      const flightKind = isExhaust ? 'exhaust' : 'discard';
      const flightMarker = document.createElement('span');
      flightMarker.dataset.fxKind = 'card-flight';
      session.root.append(flightMarker);
      animateCardFlight(session, capture.playedCardClone, capture.playedCardStart, flyTarget, 0.3, 500, 0, flightKind);
    }

    let damage = 0;
    let isAttack = false;
    if (playedCard && CARDS[playedCard.id]) {
      const def = CARDS[playedCard.id];
      if (def.type && def.type.includes('attack')) {
        isAttack = true;
        damage = Math.max(0, prev.battle.enemyHp - next.battle.enemyHp);
      }
    }
    if (isAttack) {
      const dx = eb.x - pb.x;
      const dy = eb.y - pb.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const line = document.createElement('div');
      line.dataset.fxKind = 'attack';
      line.style.position = 'absolute';
      line.style.left = pb.x + 'px';
      line.style.top = pb.y + 'px';
      line.style.width = dist + 'px';
      line.style.height = '3px';
      line.style.background = 'rgba(255,193,7,0.8)';
      line.style.transformOrigin = '0 50%';
      line.style.transform = `rotate(${angle}deg)`;
      line.style.pointerEvents = 'none';
      session.root.appendChild(line);
      const lineAnim = line.animate([
        { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 },
        { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 1, offset: 0.3 },
        { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.8, offset: 0.7 },
        { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 }
      ], { duration: 500, easing: 'ease-out', fill: 'forwards' });
      session.animations.push(lineAnim);

      createFx(session, 'damage', {
        x: eb.x, y: eb.y - 20,
        text: `-${damage}`,
        className: 'fx-damage',
        duration: 400, delay: 100,
        keyframes: [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(-30px)', opacity: 0 }
        ]
      });
    }

    let blockGain = 0;
    let isBlock = false;
    if (playedCard && CARDS[playedCard.id]) {
      const def = CARDS[playedCard.id];
      if (def.type && (def.type.includes('block') || def.type.includes('skill'))) {
        isBlock = true;
        blockGain = Math.max(0, next.battle.playerBlock - prev.battle.playerBlock);
      }
    }
    if (isBlock) {
      createFx(session, 'block', {
        x: pb.x, y: pb.y - 40,
        text: `+${blockGain} 布防`,
        className: 'fx-text block-text',
        duration: 400, delay: 100,
        keyframes: [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(-40px)', opacity: 0 }
        ]
      });
      createFx(session, 'block', {
        x: pb.x, y: pb.y,
        className: 'block-aura',
        scale: 0.5,
        duration: 300, delay: 50,
        keyframes: [
          { transform: 'scale(0.5)', opacity: 0.8 },
          { transform: 'scale(1.2)', opacity: 0 }
        ]
      });
    }

    const enemyStatusKeys = ['smoke', 'flash', 'weak', 'vuln', 'block'];
    for (const key of enemyStatusKeys) {
      const prevVal = prev.battle.statuses.enemy[key] || 0;
      const nextVal = next.battle.statuses.enemy[key] || 0;
      if (nextVal > prevVal) {
        if (key === 'smoke') {
          createFx(session, 'smoke', {
            x: eb.x, y: eb.y, className: 'smoke-cloud',
            duration: 400, delay: 100,
            keyframes: [
              { transform: 'scale(0.2)', opacity: 0.8 },
              { transform: 'scale(1.5)', opacity: 0 }
            ]
          });
        } else if (key === 'flash') {
          createFx(session, 'flash', {
            x: eb.x, y: eb.y, text: '', className: 'flash-star',
            duration: 300, delay: 0,
            keyframes: [
              { transform: 'scale(0)', opacity: 1 },
              { transform: 'scale(1.5)', opacity: 0 }
            ]
          });
        } else if (key === 'weak' || key === 'vuln') {
          createFx(session, 'power', {
            x: eb.x, y: eb.y - 30, text: key === 'weak' ? '压制' : '易伤', className: 'status-text',
            duration: 300, delay: 100,
            keyframes: [
              { transform: 'translateY(0)', opacity: 1 },
              { transform: 'translateY(-20px)', opacity: 0 }
            ]
          });
        } else if (key === 'block') {
          createFx(session, 'block', {
            x: eb.x, y: eb.y, className: 'enemy-block-aura',
            scale: 0.5, duration: 300, delay: 50,
            keyframes: [
              { transform: 'scale(0.5)', opacity: 0.8 },
              { transform: 'scale(1.1)', opacity: 0 }
            ]
          });
        }
      }
    }

    if (prev.battle.stance !== next.battle.stance) {
      createFx(session, 'stance', {
        x: pb.x, y: pb.y,
        className: 'stance-aura',
        scale: 0.5,
        duration: 400, delay: 50,
        keyframes: [
          { transform: 'scale(0.5)', opacity: 0.8 },
          { transform: 'scale(1.2)', opacity: 0 }
        ]
      });
      createFx(session, 'stance', {
        x: pb.x, y: pb.y - 30,
        text: next.battle.stance === 'cover' ? '掩护' : '前压',
        className: 'stance-text',
        duration: 400, delay: 50,
        keyframes: [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(-30px)', opacity: 0 }
        ]
      });
    }

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
      cardEl.dataset.fxKind = 'draw';
      session.root.appendChild(cardEl);
      const anim = cardEl.animate([
        { transform: 'translate(0,0) scale(0.5)', opacity: 0.5 },
        { transform: `translate(${targetX - dp.x}px, ${targetY - dp.y}px) scale(1)`, opacity: 1 }
      ], { duration: 400, delay: 100 + i*50, easing: 'ease-out', fill: 'forwards' });
      session.animations.push(anim);
    }

    if (action && action.type === 'end') {
      capture.handCardClones.forEach((item, index) => {
        animateCardFlight(session, item.clone, item.center, dcp, 0.2, 400, index * 30);
      });
      const playerDamage = Math.max(0, prev.hp - next.hp);
      if (playerDamage > 0) {
        const dx = pb.x - eb.x;
        const dy = pb.y - eb.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const line = document.createElement('div');
        line.dataset.fxKind = 'attack';
        line.style.position = 'absolute';
        line.style.left = eb.x + 'px';
        line.style.top = eb.y + 'px';
        line.style.width = dist + 'px';
        line.style.height = '3px';
        line.style.background = 'rgba(255,193,7,0.8)';
        line.style.transformOrigin = '0 50%';
        line.style.transform = `rotate(${angle}deg)`;
        line.style.pointerEvents = 'none';
        session.root.appendChild(line);
        const lineAnim = line.animate([
          { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 },
          { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 1, offset: 0.3 },
          { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.8, offset: 0.7 },
          { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 }
        ], { duration: 500, delay: 200, easing: 'ease-out', fill: 'forwards' });
        session.animations.push(lineAnim);
        createFx(session, 'damage', {
          x: pb.x, y: pb.y - 20,
          text: `-${playerDamage}`,
          className: 'damage-text',
          duration: 400, delay: 300,
          keyframes: [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-30px)', opacity: 0 }
          ]
        });
      }
    }

    if (next.battle.enemyHp <= 0 && prev.battle.enemyHp > 0) {
      createFx(session, 'victory', {
        x: window.innerWidth/2, y: window.innerHeight/2,
        text: '胜利！',
        className: 'victory-text',
        duration: 600, delay: 200,
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
        duration: 400, delay: 200,
        keyframes: [
          { transform: 'scale(0.5)', opacity: 0.8 },
          { transform: 'scale(1.5)', opacity: 0 }
        ]
      });
    }

  }

  return promise;
}
