// Hit feedback ("打击感") shared by both demos: floating numbers, target shake/flash,
// screen shake for big hits and kills, death collapse and the played-card slam.
// Pure diff helpers are import-safe in Node; DOM helpers run only when called in a browser.
// Sounds are cued through globalThis.gameSfx (shared/sfx.js) so this file has no imports.

export const BIG_HIT = 15;

const sum = (...values) => values.reduce((n, v) => n + (Number(v) || 0), 0);

// New demo state -> normalized snapshot.
export function snapshotNew(state) {
  if (!state) return null;
  const b = state.battle;
  const list = !b ? [] : Array.isArray(b.enemies) && !(b.enemies.length === 1 && 'enemyHp' in b)
    ? b.enemies
    : 'enemyHp' in b ? [{ uid: b.enemies?.[0]?.uid || 'e0', hp: b.enemyHp, statuses: b.statuses?.enemy || {} }] : [];
  const player = b?.statuses?.player || {};
  return {
    hp: state.hp,
    block: b?.playerBlock || 0,
    debuffs: sum(player.weak, player.vuln),
    inCombat: state.phase === 'combat' || state.phase === 'reward',
    enemies: list.map(e => ({ id: String(e.uid), hp: Math.max(0, e.hp || 0), block: e.statuses?.block || 0, debuffs: sum(e.statuses?.weak, e.statuses?.vuln, e.statuses?.smoke, e.statuses?.flash) })),
  };
}

// Wa demo state -> normalized snapshot (single opponent).
export function snapshotWa(state) {
  if (!state) return null;
  const b = state.battle;
  return {
    hp: state.hp,
    block: b?.block || 0,
    debuffs: sum(b?.weak, b?.vulnerable),
    inCombat: !!b && state.phase === 'combat',
    enemies: b ? [{ id: 'enemy', hp: Math.max(0, b.enemyHp || 0), block: b.enemyBlock || 0, debuffs: sum(b.enemyWeak, b.enemyVulnerable) }] : [],
  };
}

// Compare two snapshots and describe what the player should feel.
// A battle that ends (enemies gone from `next`) while the player lives counts as kills.
export function diffCombat(prev, next) {
  const events = [];
  if (!prev || !next || !prev.enemies?.length) return events;
  const after = new Map((next.enemies || []).map(e => [e.id, e]));
  const battleOver = !next.enemies?.length && next.hp > 0;
  for (const e of prev.enemies) {
    if (e.hp <= 0) continue;
    const n = after.get(e.id) || (battleOver ? { hp: 0, block: 0, debuffs: e.debuffs } : null);
    if (!n) continue;
    const damage = e.hp - n.hp;
    if (damage > 0) events.push({ kind: 'damage', target: 'enemy', id: e.id, amount: damage, killed: n.hp <= 0, big: damage >= BIG_HIT || n.hp <= 0 });
    if (n.block > e.block && n.hp > 0) events.push({ kind: 'block', target: 'enemy', id: e.id, amount: n.block - e.block });
    if (n.debuffs > e.debuffs && n.hp > 0) events.push({ kind: 'debuff', target: 'enemy', id: e.id });
  }
  const hpDelta = next.hp - prev.hp;
  if (hpDelta < 0) events.push({ kind: 'hurt', target: 'player', amount: -hpDelta, big: -hpDelta >= BIG_HIT || next.hp <= 0 });
  if (hpDelta > 0 && prev.inCombat) events.push({ kind: 'heal', target: 'player', amount: hpDelta });
  if (next.block > prev.block) events.push({ kind: 'block', target: 'player', amount: next.block - prev.block });
  if (next.debuffs > prev.debuffs) events.push({ kind: 'debuff', target: 'player' });
  return events;
}

export function shakeLevel(events) {
  if (!Array.isArray(events)) return 0;
  if (events.some(e => e.killed)) return 2;
  if (events.some(e => (e.kind === 'damage' || e.kind === 'hurt') && e.big)) return 1;
  return 0;
}

export function numberText(evt) {
  if (evt.kind === 'block') return `+${evt.amount}`;
  if (evt.kind === 'heal') return `+${evt.amount}`;
  return `-${evt.amount}`;
}

// ---------------------------------------------------------------- DOM
const MAX_NODES = 28;
let layerEl = null;

export function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function layer() {
  if (layerEl && layerEl.isConnected) return layerEl;
  layerEl = document.createElement('div');
  layerEl.className = 'juice-layer';
  layerEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layerEl);
  return layerEl;
}

function spawn(className, rect) {
  const host = layer();
  while (host.childElementCount >= MAX_NODES) host.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = className;
  if (rect) Object.assign(el.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  host.appendChild(el);
  return el;
}

function run(el, keyframes, options, removeAfter = true) {
  try {
    const anim = el.animate(keyframes, options);
    if (removeAfter) anim.finished.then(() => el.remove(), () => el.remove());
    return anim;
  } catch {
    if (removeAfter) setTimeout(() => el.remove(), options?.duration || 600);
    return null;
  }
}

const stackCount = new WeakMap();

export function floatNumber(target, evt) {
  if (!target?.getBoundingClientRect) return;
  const r = target.getBoundingClientRect();
  if (!r.width && !r.height) return;
  const lane = stackCount.get(target) || 0;
  stackCount.set(target, lane + 1);
  setTimeout(() => stackCount.set(target, Math.max(0, (stackCount.get(target) || 1) - 1)), 450);
  const tier = evt.kind === 'damage' || evt.kind === 'hurt' ? (evt.killed ? 'kill' : evt.big ? 'big' : 'normal') : 'normal';
  const el = spawn(`juice-num is-${evt.kind} tier-${tier}`);
  el.textContent = numberText(evt);
  const x = Math.max(24, Math.min(innerWidth - 24, r.left + r.width / 2 + (lane % 2 ? 14 : -14) * Math.min(lane, 2)));
  const y = Math.max(40, r.top + (evt.anchor != null ? r.height * evt.anchor : Math.min(r.height * 0.14, 40)) - lane * 22);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const rise = evt.kind === 'block' ? 26 : 44;
  const pop = tier === 'normal' ? 1.05 : 1.25;
  run(el, [
    { transform: 'translate(-50%, 6px) scale(.7)', opacity: 0 },
    { transform: `translate(-50%, -6px) scale(${pop})`, opacity: 1, offset: 0.16 },
    { transform: 'translate(-50%, -14px) scale(1)', opacity: 1, offset: 0.55 },
    { transform: `translate(-50%, -${rise}px) scale(.96)`, opacity: 0 },
  ], { duration: tier === 'normal' ? 820 : 1000, easing: 'cubic-bezier(.2,.7,.3,1)' });
}

export function flashTarget(target, kind = 'damage') {
  if (!target?.getBoundingClientRect || reducedMotion()) return;
  const r = target.getBoundingClientRect();
  if (!r.width) return;
  const el = spawn(`juice-flash is-${kind}`, r);
  run(el, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' });
}

export function shakeTarget(target, strength = 1) {
  if (!target?.animate || reducedMotion()) return;
  const a = 3 + 3 * strength;
  run(target, [
    { transform: 'translate(0,0)' },
    { transform: `translate(${a}px,-1px)` },
    { transform: `translate(${-a * 0.7}px,1px)` },
    { transform: `translate(${a * 0.4}px,0)` },
    { transform: 'translate(0,0)' },
  ], { duration: 240, easing: 'ease-out', composite: 'add' }, false);
}

export function screenShake(level = 1, root) {
  if (level <= 0 || reducedMotion()) return;
  const el = root || document.getElementById('app');
  if (!el?.animate) return;
  const a = level >= 2 ? 7 : 4;
  run(el, [
    { transform: 'translate(0,0)' },
    { transform: `translate(${-a}px,${a * 0.5}px)` },
    { transform: `translate(${a * 0.8}px,${-a * 0.4}px)` },
    { transform: `translate(${-a * 0.4}px,${a * 0.3}px)` },
    { transform: `translate(${a * 0.2}px,0)` },
    { transform: 'translate(0,0)' },
  ], { duration: level >= 2 ? 340 : 260, easing: 'ease-out', composite: 'add' }, false);
}

// Fade/collapse a defeated enemy in place (element stays until the next render).
export function collapseTarget(target) {
  if (!target?.animate) return;
  if (reducedMotion()) { target.style.opacity = '0.35'; return; }
  run(target, [
    { transform: 'translateY(0) scale(1)', opacity: 1 },
    { transform: 'translateY(-4px) scale(1.02)', opacity: 1, offset: 0.18 },
    { transform: 'translateY(14px) scale(.9, .8)', opacity: 0.25 },
  ], { duration: 520, easing: 'cubic-bezier(.4,0,.8,.4)', fill: 'forwards', composite: 'add' }, false);
}

// Collapse a snapshot of an element that is about to be re-rendered away (Wa: killing blow ends the match).
export function ghostCollapse(target) {
  if (!target?.getBoundingClientRect || reducedMotion()) return;
  const r = target.getBoundingClientRect();
  if (!r.width) return;
  const el = spawn('juice-ghost', r);
  const clone = target.cloneNode(true);
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  Object.assign(clone.style, { width: '100%', height: '100%', margin: '0', pointerEvents: 'none' });
  el.appendChild(clone);
  run(el, [
    { transform: 'translateY(0) scale(1)', opacity: 1 },
    { transform: 'translateY(-4px) scale(1.03)', opacity: 1, offset: 0.15 },
    { transform: 'translateY(22px) scale(.9, .72)', opacity: 0 },
  ], { duration: 560, easing: 'cubic-bezier(.4,0,.8,.4)' });
}

// A short "slam" on the played card: lift, then stamp down. `base` keeps an existing transform.
export function cardSlam(el, base = '') {
  if (!el?.animate || reducedMotion()) return null;
  const b = base ? `${base} ` : '';
  return run(el, [
    { transform: `${b}translateY(0) scale(1)` },
    { transform: `${b}translateY(-10px) scale(1.08)`, offset: 0.35 },
    { transform: `${b}translateY(2px) scale(.97)`, offset: 0.7 },
    { transform: `${b}translateY(0) scale(1)` },
  ], { duration: 260, easing: 'cubic-bezier(.3,.8,.4,1)' }, false);
}

// Apply feedback for a list of diffCombat events. `resolve(evt)` returns the DOM element
// for evt.target/evt.id. Options: { sound: true, kill: 'collapse'|'ghost'|'none', numbers: true }.
export function playFeedback(events, resolve, { sound = true, kill = 'collapse', numbers = true } = {}) {
  if (!Array.isArray(events) || !events.length || typeof document === 'undefined') return;
  try {
    for (const evt of events) {
      const el = resolve(evt);
      if (!el) continue;
      if (numbers && evt.kind !== 'debuff') floatNumber(el, evt);
      if (evt.kind === 'damage' || evt.kind === 'hurt') {
        flashTarget(el, evt.kind);
        if (!evt.killed) shakeTarget(el, evt.big ? 2 : 1);
      }
      if (evt.kind === 'heal') flashTarget(el, 'heal');
      if (evt.killed && kill === 'collapse') collapseTarget(el);
      if (evt.killed && kill === 'ghost') ghostCollapse(el);
    }
    screenShake(shakeLevel(events));
    if (sound && globalThis.gameSfx) {
      const names = globalThis.gameSfx.soundsForEvents?.(events) || [];
      names.forEach((name, i) => globalThis.gameSfx.play(name, { delay: i && name === 'enemyDeath' ? 90 : 0 }));
    }
  } catch (err) {
    try { console.warn('[juice]', err); } catch {}
  }
}
