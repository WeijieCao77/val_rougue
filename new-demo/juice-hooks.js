// New demo glue for shared sound + hit feedback. ui.js calls these at a few timeline points.
import { CARDS } from './content.js';
import { playSfx, soundForAction, soundForCard } from '/shared/sfx.js';
import { snapshotNew, diffCombat, playFeedback, cardSlam } from '/shared/juice.js';

const esc = v => (globalThis.CSS?.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'));

function resolveTarget(evt) {
  if (evt.target === 'enemy') {
    const unit = document.querySelector(`.enemy-unit[data-enemy-uid="${esc(evt.id)}"]`);
    return unit?.querySelector('.enemy-figure') || unit;
  }
  return document.querySelector('.ally-figure') || document.getElementById('player-box');
}

// Immediately after an action resolves: card / UI / phase sounds.
export function juiceAction(prev, next, action) {
  try {
    if (action?.type === 'play') {
      const card = prev?.battle?.hand?.find(c => c.uid === action.uid);
      playSfx(soundForCard(CARDS[card?.id]?.type));
    }
    const name = soundForAction(action, { prevPhase: prev?.phase, nextPhase: next?.phase, outcome: next?.result, hp: next?.hp });
    if (!name) return;
    // Let hits land before a match-ending stinger.
    const late = prev?.phase === 'combat' && ['victory', 'defeat'].includes(name);
    playSfx(name, { delay: late ? (action?.type === 'end' ? 2000 : 1500) : 0 });
  } catch {}
}

// At the moment hits land: numbers, shake/flash, kill collapse, screen shake, hit sounds.
export function juiceImpact(prev, next, delay = 0) {
  const events = diffCombat(snapshotNew(prev), snapshotNew(next));
  if (!events.length) return;
  const fire = () => playFeedback(events, resolveTarget, { kill: 'collapse' });
  if (delay > 0) setTimeout(fire, delay); else fire();
}

export function juiceSlam(el, base) {
  cardSlam(el, base);
}
