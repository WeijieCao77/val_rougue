// Procedural sound effects shared by both demos (Web Audio API only, no audio files).
// Import-safe in Node: no DOM or AudioContext is touched until a browser gesture unlocks audio.
// Also exposed as globalThis.gameSfx so modules that cannot import it (shared pile motion) can cue sounds.

export const SFX_STORAGE_KEY = 'val-sfx-v1';
export const SFX_DEFAULT_VOLUME = 0.5;
export const SFX_NAMES = ['click', 'draw', 'shuffle', 'cardAttack', 'cardSkill', 'cardPower', 'hit', 'hitHeavy', 'multiHit', 'block', 'debuff', 'enemyDeath', 'hurt', 'heal', 'turnEnd', 'reward', 'coin', 'victory', 'defeat'];

export function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SFX_DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

export function loadAudioPrefs(storage) {
  const prefs = { volume: SFX_DEFAULT_VOLUME, muted: false };
  try {
    const raw = storage?.getItem(SFX_STORAGE_KEY);
    if (!raw) return prefs;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      if ('volume' in data) prefs.volume = clampVolume(data.volume);
      prefs.muted = data.muted === true;
    }
  } catch {}
  return prefs;
}

export function saveAudioPrefs(storage, prefs) {
  const clean = { volume: clampVolume(prefs?.volume), muted: prefs?.muted === true };
  try { storage?.setItem(SFX_STORAGE_KEY, JSON.stringify(clean)); } catch {}
  return clean;
}

// Card sound by card type (new demo: attack/skill/power/status; Wa: derived by the caller).
export function soundForCard(type) {
  if (type === 'attack') return 'cardAttack';
  if (type === 'power') return 'cardPower';
  return 'cardSkill';
}

// Feedback events (from juice diffCombat) -> sounds. Several enemy hits become one rattle.
export function soundsForEvents(events) {
  const list = Array.isArray(events) ? events : [];
  const out = [];
  const add = name => { if (!out.includes(name)) out.push(name); };
  const hits = list.filter(e => e.kind === 'damage');
  if (hits.length > 1) add('multiHit');
  else if (hits.length === 1) add(hits[0].big ? 'hitHeavy' : 'hit');
  if (list.some(e => e.kind === 'damage' && e.killed)) add('enemyDeath');
  if (list.some(e => e.kind === 'hurt')) add('hurt');
  if (list.some(e => e.kind === 'block' && e.target === 'player')) add('block');
  else if (list.some(e => e.kind === 'block')) add('block');
  if (list.some(e => e.kind === 'heal')) add('heal');
  if (list.some(e => e.kind === 'debuff')) add('debuff');
  return out;
}

// Non-combat actions and phase changes in either demo -> one sound (or null).
// info: { prevPhase, nextPhase, outcome: 'win'|'loss'|null, hp }
export function soundForAction(action, info = {}) {
  const type = action?.type;
  const { prevPhase, nextPhase, outcome } = info;
  if (nextPhase === 'result' && prevPhase !== 'result') return outcome === 'win' ? 'victory' : 'defeat';
  if (prevPhase === 'combat' && nextPhase && nextPhase !== 'combat') return (info.hp ?? 1) > 0 ? 'victory' : 'defeat';
  if (prevPhase !== 'combat' && nextPhase === 'combat') return 'shuffle';
  switch (type) {
    case 'end': return 'turnEnd';
    case 'reward': case 'recruit': case 'skin': case 'trial': case 'discover':
      return action.id === null || action.id === undefined ? 'click' : 'reward';
    case 'buy': case 'remove': case 'upgradeCategory': return 'coin';
    case 'rest': return action.choice === 'heal' ? 'heal' : 'reward';
    case 'upgrade': case 'eventUpgrade': case 'cleanse': case 'eventCleanse': case 'training': return 'reward';
    default: return null;
  }
}

// ---------------------------------------------------------------- engine
const hasWindow = typeof window !== 'undefined';
const storage = () => { try { return hasWindow ? window.localStorage : null; } catch { return null; } };
let prefs = hasWindow ? loadAudioPrefs(storage()) : { volume: SFX_DEFAULT_VOLUME, muted: false };
let ctx = null, master = null, noiseBuf = null, unlocked = false;
const lastPlayed = new Map();
const log = [];
let pendingClick = null;

const debugOn = () => {
  try { return globalThis.__SFX_DEBUG === true || window.localStorage.getItem('val-sfx-debug') === '1' || /[?&]sfxdebug\b/.test(location.search); } catch { return false; }
};

function masterLevel() { return prefs.muted ? 0 : prefs.volume * 0.7; }

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = hasWindow ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = masterLevel();
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  } catch { ctx = null; master = null; }
  return ctx;
}

function unlock() {
  const c = ensureContext();
  if (!c) return;
  unlocked = true;
  if (c.state === 'suspended') c.resume().catch(() => {});
}

// Envelope helper: quick attack, exponential decay.
function env(gainNode, t, peak, dur, attack = 0.004) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, t);
  g.linearRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(t, { freq = 440, to = null, type = 'sine', dur = 0.12, gain = 0.2, attack = 0.004 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  env(g, t, gain, dur, attack);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(t, { dur = 0.08, gain = 0.3, filter = 'bandpass', freq = 2000, to = null, q = 1, attack = 0.002 }) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf;
  f.type = filter; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  env(g, t, gain, dur, attack);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
}

const RECIPES = {
  click: t => tone(t, { freq: 1500, to: 1100, type: 'triangle', dur: 0.035, gain: 0.08 }),
  draw: t => noise(t, { dur: 0.07, gain: 0.12, filter: 'bandpass', freq: 2400, to: 4200, q: 0.8 }),
  shuffle: t => { for (let i = 0; i < 5; i++) noise(t + i * 0.04, { dur: 0.05, gain: 0.09, freq: 2200 + i * 300, to: 4000, q: 0.9 }); },
  cardAttack: t => { noise(t, { dur: 0.09, gain: 0.16, filter: 'highpass', freq: 1400, to: 5200 }); tone(t + 0.02, { freq: 220, to: 150, type: 'triangle', dur: 0.07, gain: 0.12 }); },
  cardSkill: t => { noise(t, { dur: 0.08, gain: 0.1, filter: 'bandpass', freq: 1800, to: 3600 }); tone(t + 0.01, { freq: 660, to: 880, type: 'sine', dur: 0.09, gain: 0.08 }); },
  cardPower: t => { tone(t, { freq: 330, to: 660, type: 'triangle', dur: 0.26, gain: 0.11, attack: 0.02 }); tone(t + 0.05, { freq: 495, to: 990, type: 'sine', dur: 0.24, gain: 0.07, attack: 0.02 }); },
  // Gunshot-like: sharp broadband crack + low thump.
  hit: t => { noise(t, { dur: 0.06, gain: 0.42, filter: 'highpass', freq: 900 }); noise(t, { dur: 0.1, gain: 0.2, filter: 'lowpass', freq: 1800, to: 400 }); tone(t, { freq: 150, to: 48, dur: 0.12, gain: 0.45, attack: 0.002 }); },
  hitHeavy: t => { noise(t, { dur: 0.08, gain: 0.5, filter: 'highpass', freq: 700 }); noise(t, { dur: 0.22, gain: 0.3, filter: 'lowpass', freq: 1400, to: 180 }); tone(t, { freq: 120, to: 36, dur: 0.22, gain: 0.6, attack: 0.002 }); },
  multiHit: t => { for (let i = 0; i < 4; i++) { noise(t + i * 0.055, { dur: 0.045, gain: 0.3 - i * 0.04, filter: 'highpass', freq: 1000 }); tone(t + i * 0.055, { freq: 140, to: 50, dur: 0.07, gain: 0.3 - i * 0.04, attack: 0.002 }); } },
  block: t => { [820, 1230, 1690].forEach((f, i) => tone(t, { freq: f, to: f * 0.985, type: i ? 'triangle' : 'square', dur: 0.22 - i * 0.04, gain: 0.07 - i * 0.015, attack: 0.002 })); noise(t, { dur: 0.05, gain: 0.14, filter: 'bandpass', freq: 3000, q: 3 }); },
  debuff: t => { tone(t, { freq: 440, to: 210, type: 'sawtooth', dur: 0.22, gain: 0.05, attack: 0.01 }); tone(t + 0.03, { freq: 466, to: 220, type: 'sine', dur: 0.22, gain: 0.07, attack: 0.01 }); },
  enemyDeath: t => { noise(t, { dur: 0.42, gain: 0.26, filter: 'lowpass', freq: 1500, to: 160 }); tone(t, { freq: 220, to: 50, type: 'triangle', dur: 0.45, gain: 0.22, attack: 0.01 }); },
  hurt: t => { tone(t, { freq: 110, to: 40, dur: 0.22, gain: 0.5, attack: 0.002 }); noise(t, { dur: 0.14, gain: 0.26, filter: 'lowpass', freq: 700, to: 200 }); },
  heal: t => { tone(t, { freq: 523, to: 784, dur: 0.22, gain: 0.08, attack: 0.02 }); tone(t + 0.08, { freq: 784, to: 1046, dur: 0.2, gain: 0.06, attack: 0.02 }); },
  turnEnd: t => { tone(t, { freq: 523, type: 'triangle', dur: 0.09, gain: 0.09 }); tone(t + 0.09, { freq: 392, type: 'triangle', dur: 0.14, gain: 0.09 }); },
  reward: t => { [523, 659, 784].forEach((f, i) => tone(t + i * 0.07, { freq: f, type: 'triangle', dur: 0.14, gain: 0.09 })); },
  coin: t => { tone(t, { freq: 988, type: 'square', dur: 0.06, gain: 0.05 }); tone(t + 0.06, { freq: 1319, type: 'square', dur: 0.2, gain: 0.05 }); },
  victory: t => { [392, 523, 659, 784].forEach((f, i) => tone(t + i * 0.09, { freq: f, type: 'triangle', dur: 0.16, gain: 0.1 })); [523, 659, 784].forEach(f => tone(t + 0.36, { freq: f, type: 'sine', dur: 0.6, gain: 0.06, attack: 0.02 })); },
  defeat: t => { [392, 330, 262, 196].forEach((f, i) => tone(t + i * 0.16, { freq: f, to: f * 0.97, type: 'triangle', dur: 0.3, gain: 0.1, attack: 0.01 })); },
};

function record(name, status) {
  log.push({ name, status, t: Math.round(hasWindow && window.performance ? performance.now() : 0) });
  if (log.length > 60) log.shift();
  if (debugOn()) try { console.debug(`[sfx] ${name} (${status})`); } catch {}
}

// Short vibration on phones for the physical moments (play, hit, hurt). Tied to
// playSfx so muting the sound (or volume 0) also turns vibration off.
const HAPTICS = { cardAttack: 12, cardSkill: 8, cardPower: [8, 40, 8], hit: 16, hitHeavy: [26, 30, 26], multiHit: [10, 24, 10, 24, 10], hurt: 32, enemyDeath: [20, 40, 30] };
function buzz(name) {
  try { if (HAPTICS[name] && hasWindow && navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(HAPTICS[name]); } catch {}
}

export function playSfx(name, { delay = 0 } = {}) {
  try {
    if (!RECIPES[name]) return false;
    if (name !== 'click' && pendingClick) { clearTimeout(pendingClick); pendingClick = null; }
    if (delay > 0) { setTimeout(() => playSfx(name), delay); return true; }
    const now = hasWindow && window.performance ? performance.now() : Date.now();
    if (now - (lastPlayed.get(name) || -1e9) < 40) return false;
    lastPlayed.set(name, now);
    if (prefs.muted || prefs.volume <= 0) { record(name, 'muted'); return false; }
    buzz(name);
    if (!unlocked || !ctx || !master) { record(name, 'locked'); return false; }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    RECIPES[name](ctx.currentTime + 0.005);
    record(name, 'played');
    return true;
  } catch { return false; }
}

export function getAudioPrefs() { return { ...prefs }; }

export function setAudioPrefs(next) {
  prefs = saveAudioPrefs(storage(), { ...prefs, ...next });
  try { if (master && ctx) master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.02); } catch {}
  syncToggles();
  return getAudioPrefs();
}

// ---------------------------------------------------------------- header control
const ICON_ON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function soundToggleHtml(extraClass = '') {
  const off = prefs.muted || prefs.volume <= 0;
  return `<button type="button" class="sfx-toggle ${extraClass}" data-sfx-toggle aria-haspopup="dialog" aria-label="音效设置（${off ? '已静音' : '音量 ' + Math.round(prefs.volume * 100)}）" title="音效">${off ? ICON_OFF : ICON_ON}</button>`;
}

function syncToggles() {
  if (!hasWindow) return;
  const off = prefs.muted || prefs.volume <= 0;
  document.querySelectorAll('[data-sfx-toggle]').forEach(btn => {
    btn.innerHTML = off ? ICON_OFF : ICON_ON;
    btn.classList.toggle('is-muted', off);
    btn.setAttribute('aria-label', `音效设置（${off ? '已静音' : '音量 ' + Math.round(prefs.volume * 100)}）`);
  });
  const pop = document.querySelector('.sfx-pop');
  if (pop) {
    pop.querySelector('[data-sfx-mute]').textContent = prefs.muted ? '取消静音' : '静音';
    pop.querySelector('output').textContent = Math.round(prefs.volume * 100);
  }
}

function closePop() { document.querySelector('.sfx-pop')?.remove(); }

function openPop(anchor) {
  closePop();
  const pop = document.createElement('div');
  pop.className = 'sfx-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', '音效设置');
  pop.innerHTML = `<div class="sfx-row"><span>音量</span><output>${Math.round(prefs.volume * 100)}</output></div><input type="range" min="0" max="100" step="5" value="${Math.round(prefs.volume * 100)}" data-sfx-volume aria-label="主音量"><button type="button" class="sfx-mute" data-sfx-mute>${prefs.muted ? '取消静音' : '静音'}</button>`;
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth;
  pop.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.right - w))}px`;
  pop.style.top = `${r.bottom + 6}px`;
  const range = pop.querySelector('[data-sfx-volume]');
  range.addEventListener('input', () => setAudioPrefs({ volume: range.value / 100, muted: false }));
  range.addEventListener('change', () => playSfx('click'));
  pop.querySelector('[data-sfx-mute]').addEventListener('click', () => { setAudioPrefs({ muted: !prefs.muted }); if (!prefs.muted) playSfx('reward'); });
  range.focus({ preventScroll: true });
}

function install() {
  if (!hasWindow || globalThis.gameSfx) return;
  const opts = { capture: true, passive: true };
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, unlock, opts));
  document.addEventListener('click', e => {
    const toggle = e.target.closest?.('[data-sfx-toggle]');
    if (toggle) {
      e.preventDefault(); e.stopPropagation();
      if (document.querySelector('.sfx-pop')) closePop(); else openPop(toggle);
      return;
    }
    if (!e.target.closest?.('.sfx-pop')) closePop();
    const btn = e.target.closest?.('button, .btn, [role="button"]');
    if (!btn || btn.disabled || btn.closest('.hand-card, [data-select], .enemy-unit, [data-target], [data-sfx-quiet], .sfx-pop')) return;
    // Deferred so an action sound fired by the same click replaces it.
    if (pendingClick) clearTimeout(pendingClick);
    pendingClick = setTimeout(() => { pendingClick = null; playSfx('click'); }, 0);
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  window.addEventListener('resize', closePop);
  globalThis.gameSfx = { play: playSfx, soundsForEvents, soundForAction, soundForCard, getPrefs: getAudioPrefs, setPrefs: setAudioPrefs, log, names: SFX_NAMES };
}

install();
