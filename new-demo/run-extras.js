// new-demo/run-extras.js
// Presentation helpers for run-level systems: team traits (队伍特质), the
// difficulty-level unlock store and their icons. Pure functions + localStorage.
import { TEAM_TRAITS, TEAMS, RELICS, EQUIP_TIERS, SUPPLIES } from './content.js';
import { MAX_ASCENSION } from './engine.js';

const svg = body => `<svg class="trait-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

export const TRAIT_ICONS = {
  momentum: svg('<path d="M3 5l7 7-7 7M11 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 5v14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  fortify: svg('<path d="M2.5 20.5h19M4 20.5v-5h16v5M5.5 15.5v-4.5h13v4.5M7 11V7h10v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 15.5V11M9 20.5v-5M15 20.5v-5M12 7V3.5" stroke="currentColor" stroke-width="1.6"/>'),
  intel: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".7"/><path d="M12 12 19 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="16.5" cy="15" r="1.6" fill="currentColor"/>'),
  dispatch: svg('<path d="M19 8.5A8 8 0 0 0 5 7.5M5 15.5A8 8 0 0 0 19 16.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M19 3.5v5h-5M5 20.5v-5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>')
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function teamTrait(teamId) {
  return TEAM_TRAITS[TEAMS[teamId]?.trait] || null;
}

// Small trait line for the team-select cards and guide.
export function traitTagHtml(teamId) {
  const t = teamTrait(teamId);
  if (!t) return '';
  return `<div class="team-trait" title="${esc(t.text)}"><span class="trait-icon trait-${t.id}">${TRAIT_ICONS[t.id]}</span><b>队伍特质 · ${esc(t.name)}</b><small>${esc(t.text)}</small></div>`;
}

// Combat HUD counter: icon + number + tooltip, per trait.
export function squadChipHtml(b) {
  const sq = b?.squad;
  const t = sq && TEAM_TRAITS[sq.id];
  if (!t) return '';
  let value = '';
  let extra = '';
  let status = '';
  if (sq.id === 'momentum') {
    value = `${sq.n}/${t.max}`;
    if (sq.armed) { extra = '<span class="trait-armed">下一击翻倍</span>'; status = '已就绪：下一张攻击牌伤害翻倍。'; }
    else status = `再打出${t.max - sq.n}张攻击牌后，下一张攻击牌伤害翻倍。`;
  } else if (sq.id === 'fortify') {
    value = String(sq.kept || 0);
    status = `本回合从上回合保留了${sq.kept || 0}点布防。`;
  } else if (sq.id === 'intel') {
    value = `${sq.n}/${t.max}`;
    status = `再获得${t.max - sq.n}点情报触发：抽1张牌、获得1点能量。`;
  } else if (sq.id === 'dispatch') {
    value = sq.used ? '已用' : '就绪';
    status = sq.used ? '本回合的调度已触发，下回合恢复。' : '本回合第一次切换姿态会抽1张牌；手动切换不耗能量。';
  }
  const title = `${t.name}：${t.text}\n${status}`;
  return `<div class="trait-chip trait-${sq.id}${sq.armed ? ' is-armed' : ''}${sq.used ? ' is-spent' : ''}" tabindex="0" role="status" aria-label="${esc(title)}" title="${esc(title)}" data-tooltip="${esc(title)}">
    <span class="trait-icon">${TRAIT_ICONS[sq.id]}</span><span class="trait-text"><small>${esc(t.name)}</small><b>${esc(value)}</b></span>${extra}
  </div>`;
}

// ----------------------------- Difficulty unlocks -----------------------------
export const ASCENSION_KEY = 'new-demo-ascension-v1';

// Highest unlocked level per team ({breach: 3, ...}); missing teams are 0.
export function loadAscensionUnlocks() {
  try {
    const raw = JSON.parse(localStorage.getItem(ASCENSION_KEY) || '{}');
    const out = {};
    for (const team of Object.keys(TEAMS)) out[team] = Math.max(0, Math.min(MAX_ASCENSION, Math.floor(Number(raw?.[team]) || 0)));
    return out;
  } catch {
    return Object.fromEntries(Object.keys(TEAMS).map(t => [t, 0]));
  }
}

// A win at level N on a team unlocks level N+1 for that team. Returns the
// newly unlocked level, or null when nothing changed.
export function recordAscensionWin(team, level) {
  const unlocks = loadAscensionUnlocks();
  if (!(team in unlocks)) return null;
  const next = Math.min(MAX_ASCENSION, (level || 0) + 1);
  if (next <= unlocks[team]) return null;
  unlocks[team] = next;
  try { localStorage.setItem(ASCENSION_KEY, JSON.stringify(unlocks)); } catch { return null; }
  return next;
}

// ----------------------------- Equipment & supply icons -----------------------------
const G = {
  medic: '<rect x="4" y="6" width="16" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v7M8.5 12.5h7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M9 6V4h6v2" fill="none" stroke="currentColor" stroke-width="2"/>',
  mag: '<path d="M8 3h8l-1 18H9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 7h5M9.5 11h5M9.5 15h5" stroke="currentColor" stroke-width="1.6"/>',
  tablet: '<rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 15l3-4 3 2 4-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  smoke: '<path d="M6.5 18.5h11a4 4 0 0 0 .6-7.9 5.5 5.5 0 0 0-10.6-1.2A4.6 4.6 0 0 0 6.5 18.5z" fill="currentColor"/>',
  flash: '<path d="M12 2l2 6 6-2-4 5 5 3-6 .6 1 6.4-4-5-4 5 1-6.4-6-.6 5-3-4-5 6 2z" fill="currentColor"/>',
  plate: '<path d="M12 2.5 4 5.6v6.1c0 5 3.4 8.7 8 9.8 4.6-1.1 8-4.8 8-9.8V5.6z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10h8M8 14h8" stroke="currentColor" stroke-width="1.6"/>',
  coin: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v10M9.5 9.5c0-1.2 1-1.8 2.5-1.8s2.5.7 2.5 1.8-1 1.6-2.5 1.9-2.5.9-2.5 2 1 1.9 2.5 1.9 2.5-.7 2.5-1.9" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  book: '<path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  band: '<path d="M5 8h14v8H5z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 8v8M15 8v8" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  energy: '<path d="M13 2 5 13.5h5.5L9 22l9-12h-5.8z" fill="currentColor"/>',
  radio: '<path d="M4 13a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="2.5" y="12" width="5" height="8" rx="1.5" fill="currentColor"/><rect x="16.5" y="12" width="5" height="8" rx="1.5" fill="currentColor"/>',
  sandbag: '<path d="M3 20h18M4 20v-4.5h16V20M6 15.5V11h12v4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  crosshair: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  thorns: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7l1.4 3.6L17 12l-3.6 1.4L12 17l-1.4-3.6L7 12l3.6-1.4z" fill="currentColor"/>',
  clock: '<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8.5V13l3 2M9.5 2.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  grip: '<path d="M7 3h10v18H7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 7l10 3M7 11l10 3M7 15l10 3" stroke="currentColor" stroke-width="1.5"/>',
  muzzle: '<path d="M2 10h12v4H2zM14 8.5h5v7h-5z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19 12h3" stroke="currentColor" stroke-width="2"/><path d="M16 8.5v7" stroke="currentColor" stroke-width="1.4"/>',
  counter: '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 10v4M11 10v4M15 10v4" stroke="currentColor" stroke-width="2"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 12h3l1.5-3 2 6 1.5-3H18" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  chain: '<rect x="3" y="9" width="8" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="9" width="8" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 12h6" stroke="currentColor" stroke-width="2"/>',
  bomb: '<circle cx="11" cy="14" r="6.5" fill="currentColor"/><path d="M15 9l3-3M18 3v2M21 6h-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  bed: '<path d="M3 18V8M3 14h18v4M7 11h4a2 2 0 0 1 2 2v1H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  marker: '<path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/>',
  bag: '<path d="M6 8h12l1 12H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2"/>',
  card: '<rect x="5" y="3" width="12" height="16" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 21h11V6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8h6M8 11h6" stroke="currentColor" stroke-width="1.4"/>',
  trigger: '<path d="M3 9h14l3 3-3 3H10l-2 5H5l1-5H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 15c0 2 1 3 2 3" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  vest: '<path d="M8 3 4 6v14h6v-5h4v5h6V6l-4-3-2 3h-4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  head: '<circle cx="12" cy="9" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 21c1-4 4-6 7-6s6 2 7 6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9h4" stroke="currentColor" stroke-width="1.6"/>',
  fire: '<path d="M12.5 2c.6 3.4 4.8 5.2 4.8 10.2A5.3 5.3 0 0 1 12 17.6a5.3 5.3 0 0 1-5.3-5.4c0-2.3 1.2-3.9 2.3-5 .1 1.6.8 2.7 1.8 3.2C10.8 7.3 11.5 4.3 12.5 2z" fill="currentColor"/>',
  syringe: '<path d="M16 3l5 5M18.5 5.5 9 15l-3-3 9.5-9.5M6 12l-3 3v3h3l3-3M11 10l2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.4"/>',
  knife: '<path d="M3 21 14 10l3 1 4-8-8 4 1 3L3 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  drone: '<circle cx="5.5" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18.5" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 7.5l2.5 3M16.5 7.5 14 10.5" stroke="currentColor" stroke-width="1.6"/><rect x="8.5" y="10" width="7" height="5" rx="1.5" fill="currentColor"/><path d="M12 15v4" stroke="currentColor" stroke-width="1.6"/>',
  jammer: '<rect x="5" y="9" width="14" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9 7 3M15 9l2-6M9 14.5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  flare: '<path d="M12 22V11" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7" r="4" fill="currentColor"/><path d="M12 1v1.5M6 3.5l1 1M18 3.5l-1 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  ammo: '<path d="M6 21V9l2-5 2 5v12zM14 21V9l2-5 2 5v12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 17h4M14 17h4" stroke="currentColor" stroke-width="1.6"/>',
  gel: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 14h6M12 11v6" stroke="currentColor" stroke-width="1.8"/>',
  box: '<path d="M3 8l9-5 9 5v9l-9 5-9-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 8l9 5 9-5M12 13v9" fill="none" stroke="currentColor" stroke-width="1.6"/>'
};
const EQUIP_GLYPH = {
  R01: 'medic', R02: 'mag', R03: 'tablet', R04: 'smoke', R05: 'flash', R06: 'radio', R07: 'plate', R08: 'coin', R09: 'book', R10: 'book',
  R11: 'band', R12: 'energy', R13: 'sandbag', R14: 'crosshair', R15: 'medic', R16: 'thorns', R17: 'clock', R18: 'grip', R19: 'muzzle', R20: 'counter',
  R21: 'heart', R22: 'chain', R23: 'ammo', R24: 'bomb', R25: 'bed', R26: 'mag', R27: 'marker', R28: 'bag', R29: 'card', R30: 'trigger',
  R31: 'vest', R32: 'head', R33: 'fire', R34: 'syringe', R35: 'map', R36: 'card', R37: 'knife', R38: 'vest',
  R40: 'bag', R41: 'radio', R42: 'bed', R43: 'radio', R44: 'syringe', R45: 'ammo', R46: 'sandbag', R47: 'crosshair', R48: 'coin', R49: 'energy', R50: 'book'
};
const SUPPLY_GLYPH = {
  P01: 'syringe', P02: 'energy', P03: 'bomb', P04: 'ammo', P05: 'smoke', P06: 'tablet', P07: 'plate', P08: 'flash', P09: 'crosshair',
  P10: 'syringe', P11: 'gel', P12: 'jammer', P13: 'fire', P14: 'drone', P15: 'marker', P16: 'box', P17: 'flare', P18: 'ammo'
};
export const TIER_COLORS = { common: '#b8c4cc', uncommon: '#5fb3ff', rare: '#f2b233', shop: '#7ddc6a', boss: '#ff5d4a' };
const glyph = key => `<svg class="gear-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${G[key] || G.box}</svg>`;

export function equipIconHtml(id, { tag = 'span', attrs = '' } = {}) {
  const r = RELICS[id];
  if (!r) return '';
  const title = `${r.name}（${EQUIP_TIERS[r.tier]?.name || ''}装备）：${r.desc}`;
  return `<${tag} class="gear-icon tier-${r.tier}" style="--tier:${TIER_COLORS[r.tier]}" title="${esc(title)}" aria-label="${esc(title)}" data-tooltip="${esc(title)}" ${attrs}>${glyph(EQUIP_GLYPH[id])}</${tag}>`;
}
export function supplyGlyphHtml(id) {
  const sp = SUPPLIES[id];
  if (!sp) return '';
  return `<span class="supply-glyph rarity-${sp.rarity}" style="--tier:${TIER_COLORS[sp.rarity]}">${glyph(SUPPLY_GLYPH[id])}</span>`;
}
// Big tile used by reward, shop, boss choice and the library.
export function equipTileHtml(id, extra = '') {
  const r = RELICS[id];
  if (!r) return '';
  return `<div class="gear-tile tier-${r.tier}" style="--tier:${TIER_COLORS[r.tier]}">
    <span class="gear-tile-icon">${glyph(EQUIP_GLYPH[id])}</span>
    <span class="gear-tile-body"><b>${esc(r.name)}</b><small>${esc(EQUIP_TIERS[r.tier]?.name || '')}装备</small><span>${esc(r.desc)}</span>${extra}</span>
  </div>`;
}
export function supplyTileHtml(id, extra = '') {
  const sp = SUPPLIES[id];
  if (!sp) return '';
  const rarity = { common: '普通', uncommon: '罕见', rare: '稀有' }[sp.rarity];
  return `<div class="gear-tile supply-tile rarity-${sp.rarity}" style="--tier:${TIER_COLORS[sp.rarity]}">
    <span class="gear-tile-icon">${glyph(SUPPLY_GLYPH[id])}</span>
    <span class="gear-tile-body"><b>${esc(sp.name)}</b><small>${rarity}补给品 · 一次性</small><span>${esc(sp.desc)}</span>${extra}</span>
  </div>`;
}
