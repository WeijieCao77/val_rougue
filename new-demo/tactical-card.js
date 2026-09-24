// new-demo/tactical-card.js
// Original "tactical ops" card component for the new demo: a dark field card
// with a numeric cost badge, type strip, emblem art drawn from the card's own
// effects on a tactical grid, keyword-highlighted rules and rarity chevrons.
// All art is procedural SVG made for this project.

const TYPE = {
  attack: { label: '攻击', code: 'ASSAULT', color: '#ff6b3d' },
  skill: { label: '技能', code: 'SUPPORT', color: '#4fb3ff' },
  power: { label: '能力', code: 'DOCTRINE', color: '#f2b233' },
  status: { label: '异常', code: 'HAZARD', color: '#e0483e' }
};
const RARITY = { common: 1, uncommon: 2, rare: 3 };

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function hash(str) { let h = 2166136261; for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

function flatEffects(def) {
  const out = [];
  const walk = e => { if (!e) return; out.push(e); if (e.effect) walk(e.effect); };
  (def.effects || []).forEach(walk);
  return out;
}

// Pick the emblem that best describes what the card does.
function emblemOf(def) {
  if (def.type === 'power') return 'chip';
  const es = flatEffects(def);
  const has = t => es.some(e => e.type === t);
  if (has('discover')) return 'radar';
  if (es.some(e => e.type === 'deploy' && e.kind === 'turret') || has('fireTurrets')) return 'turret';
  if (has('deploy')) return 'drone';
  if (has('burn') || has('burnMultiply') || has('detonate')) return has('detonate') ? 'blast' : 'flame';
  if (es.some(e => e.type === 'addCardToHand' && e.id === 'TK01') || def.id === 'TK01') return 'knives';
  if (has('overload')) return 'overload';
  if (has('attackFromBlock')) return 'ram';
  const attack = es.find(e => e.type === 'attack');
  if (attack && (attack.times || 1) > 1) return 'tracers';
  if (attack && attack.n >= 15) return 'scope';
  if (attack) return 'rifle';
  if (has('smoke') && has('flash')) return 'combo-nade';
  if (has('smoke')) return 'smoke';
  if (has('flash')) return 'flash';
  if (has('stanceSwitch')) return 'stance';
  if (has('heal') || has('maxHp')) return 'medkit';
  if (has('weak') || has('vuln')) return 'target';
  if (has('block')) return 'shield';
  if (has('energy')) return 'battery';
  if (has('draw')) return 'intel';
  if (has('upgradeRandomInHand') || has('upgradeAllInHand') || has('upgradeAllInCombatDeck')) return 'chevrons';
  return def.type === 'status' ? 'hazard' : 'intel';
}

const GLYPHS = {
  rifle: c => `<path d="M40 58h78l6-6h22v10h-10l-4 6H96l-8 14H74l6-14H40z" fill="${c}"/><rect x="58" y="50" width="26" height="6" rx="2" fill="${c}" opacity=".7"/><circle cx="160" cy="57" r="12" fill="none" stroke="${c}" stroke-width="2"/><path d="M160 41v8M160 65v8M144 57h8M168 57h8" stroke="${c}" stroke-width="2"/>`,
  scope: c => `<circle cx="100" cy="56" r="34" fill="none" stroke="${c}" stroke-width="3"/><circle cx="100" cy="56" r="20" fill="none" stroke="${c}" stroke-width="1.5" opacity=".6"/><path d="M100 18v24M100 70v24M62 56h24M114 56h24" stroke="${c}" stroke-width="2.5"/><circle cx="100" cy="56" r="3" fill="${c}"/><path d="M92 48l16 16" stroke="${c}" stroke-width="1" opacity=".5"/>`,
  tracers: c => [0, 1, 2].map(i => `<path d="M${36 + i * 6} ${38 + i * 18}h${90 - i * 10}" stroke="${c}" stroke-width="${4 - i}" stroke-linecap="round"/><circle cx="${130 - i * 4}" cy="${38 + i * 18}" r="${5 - i}" fill="${c}"/>`).join('') + `<path d="M150 30l24 26-24 26" fill="none" stroke="${c}" stroke-width="3"/>`,
  shield: c => `<path d="M100 20 70 32v24c0 20 13 34 30 40 17-6 30-20 30-40V32z" fill="${c}" opacity=".9"/><path d="M100 30v58M80 48h40" stroke="rgba(0,0,0,.35)" stroke-width="3"/>`,
  smoke: c => `<circle cx="84" cy="58" r="20" fill="${c}" opacity=".55"/><circle cx="108" cy="48" r="24" fill="${c}" opacity=".7"/><circle cx="126" cy="64" r="18" fill="${c}" opacity=".5"/><rect x="60" y="74" width="14" height="22" rx="4" fill="${c}"/><path d="M62 74l10-8" stroke="${c}" stroke-width="3"/>`,
  flash: c => `<path d="M100 16l8 24 24-8-14 22 22 12-26 4 4 26-18-18-18 18 4-26-26-4 22-12-14-22 24 8z" fill="${c}"/><circle cx="100" cy="56" r="9" fill="#fff" opacity=".85"/>`,
  'combo-nade': c => `<circle cx="80" cy="56" r="22" fill="${c}" opacity=".45"/><path d="M122 26l6 16 16-4-9 14 14 8-17 3 3 17-13-12-13 12 3-17-17-3 14-8-9-14 16 4z" fill="${c}"/>`,
  flame: c => `<path d="M102 16c4 16 26 26 26 50a28 28 0 0 1-56 0c0-12 6-20 12-26 1 10 5 16 11 18-2-16 2-30 7-42z" fill="${c}"/><path d="M100 60c6 7 12 11 12 20a12 12 0 0 1-24 0c0-6 4-10 7-13 1 4 3 6 5 7z" fill="#fff4" />`,
  blast: c => `<path d="M100 14l10 26 26-12-10 26 28 6-28 10 12 26-28-14-10 26-10-26-28 14 12-26-28-10 28-6-10-26 26 12z" fill="${c}"/><circle cx="100" cy="56" r="12" fill="#1a1208"/>`,
  turret: c => `<rect x="72" y="70" width="56" height="12" rx="3" fill="${c}"/><path d="M84 70l6-22h26l6 22z" fill="${c}" opacity=".85"/><rect x="112" y="46" width="48" height="8" rx="3" fill="${c}"/><circle cx="100" cy="56" r="6" fill="#0b1117"/><path d="M78 82l-8 14M122 82l8 14M100 82v14" stroke="${c}" stroke-width="3"/><path d="M166 50h10" stroke="${c}" stroke-width="3" stroke-dasharray="3 3"/>`,
  drone: c => `<rect x="84" y="46" width="32" height="16" rx="6" fill="${c}"/><path d="M84 50H62M116 50h22" stroke="${c}" stroke-width="3"/><ellipse cx="58" cy="46" rx="14" ry="3" fill="${c}"/><ellipse cx="142" cy="46" rx="14" ry="3" fill="${c}"/><path d="M78 72 100 64l22 8v10c0 8-10 14-22 16-12-2-22-8-22-16z" fill="none" stroke="${c}" stroke-width="2.5"/>`,
  knives: c => [-18, 0, 18].map((d, i) => `<g transform="rotate(${d} 100 60)"><path d="M100 20l7 34h-14z" fill="${c}" opacity="${0.6 + i * 0.2}"/><rect x="96" y="54" width="8" height="22" rx="2" fill="${c}"/></g>`).join(''),
  overload: c => `<path d="M108 14 78 62h20l-8 38 34-52h-22z" fill="${c}"/><path d="M40 92h120" stroke="${c}" stroke-width="6" stroke-dasharray="10 8" opacity=".6"/>`,
  ram: c => `<path d="M100 20 70 32v24c0 20 13 34 30 40 17-6 30-20 30-40V32z" fill="none" stroke="${c}" stroke-width="4"/><path d="M130 56h36M154 44l14 12-14 12" stroke="${c}" stroke-width="4" fill="none"/>`,
  stance: c => `<path d="M60 76l40-40 40 40" fill="none" stroke="${c}" stroke-width="6"/><path d="M60 96l40-40 40 40" fill="none" stroke="${c}" stroke-width="3" opacity=".6"/>`,
  medkit: c => `<rect x="70" y="32" width="60" height="48" rx="6" fill="${c}"/><path d="M100 42v28M86 56h28" stroke="#0b1117" stroke-width="7"/><path d="M90 32v-6h20v6" fill="none" stroke="${c}" stroke-width="3"/>`,
  target: c => `<circle cx="100" cy="56" r="30" fill="none" stroke="${c}" stroke-width="3"/><circle cx="100" cy="56" r="16" fill="none" stroke="${c}" stroke-width="3"/><circle cx="100" cy="56" r="4" fill="${c}"/><path d="M92 40l10 12-6 4 10 14" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>`,
  battery: c => `<rect x="70" y="36" width="56" height="36" rx="4" fill="none" stroke="${c}" stroke-width="4"/><rect x="126" y="46" width="6" height="16" fill="${c}"/><path d="M102 40 88 58h12l-4 12 16-20h-12z" fill="${c}"/>`,
  intel: c => `<rect x="62" y="30" width="44" height="56" rx="4" fill="${c}" opacity=".45"/><rect x="80" y="24" width="44" height="56" rx="4" fill="${c}"/><path d="M88 38h28M88 48h28M88 58h18" stroke="#0b1117" stroke-width="3"/><path d="M136 34a26 26 0 0 1 0 44M146 26a38 38 0 0 1 0 60" fill="none" stroke="${c}" stroke-width="2.5"/>`,
  chevrons: c => [0, 1, 2].map(i => `<path d="M74 ${82 - i * 18}l26-16 26 16" fill="none" stroke="${c}" stroke-width="5" opacity="${0.5 + i * 0.25}"/>`).join(''),
  chip: c => `<rect x="76" y="32" width="48" height="48" rx="4" fill="none" stroke="${c}" stroke-width="3"/><rect x="88" y="44" width="24" height="24" fill="${c}"/>${[40, 52, 64, 76].map(y => `<path d="M64 ${y - 4}h12M124 ${y - 4}h12" stroke="${c}" stroke-width="2"/>`).join('')}${[88, 100, 112].map(x => `<path d="M${x} 20v12M${x} 80v12" stroke="${c}" stroke-width="2"/>`).join('')}`,
  radar: c => `<circle cx="100" cy="56" r="34" fill="none" stroke="${c}" stroke-width="2"/><circle cx="100" cy="56" r="20" fill="none" stroke="${c}" stroke-width="1.5" opacity=".6"/><path d="M100 56 128 36A34 34 0 0 1 134 56z" fill="${c}" opacity=".6"/><circle cx="118" cy="70" r="3" fill="#fff"/><circle cx="84" cy="42" r="2.5" fill="#fff"/><circle cx="100" cy="56" r="3" fill="${c}"/>`,
  hazard: c => `<path d="M100 22 136 86H64z" fill="${c}"/><path d="M100 44v22" stroke="#0b1117" stroke-width="6"/><circle cx="100" cy="76" r="4" fill="#0b1117"/>`
};

export function tacticalArt(def) {
  const t = TYPE[def.type] || TYPE.skill;
  const h = hash(def.id || def.name);
  const grid = 16;
  const ox = h % grid, oy = (h >> 5) % grid;
  const glyph = (GLYPHS[emblemOf(def)] || GLYPHS.intel)(t.color);
  const uid = 'g' + (h % 100000);
  return `<svg viewBox="0 0 200 112" class="tc-svg" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="${uid}" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M${grid} 0H0V${grid}" fill="none" stroke="${t.color}" stroke-opacity=".07" stroke-width="1"/></pattern></defs>
    <rect width="200" height="112" fill="#0b1015"/><rect width="200" height="112" fill="url(#${uid})"/>
    <g>${glyph}</g>
  </svg>`;
}

// card: {id, up}; def: card definition; opts: {text, cost, tagLabel, extraClass, badge}
export function tacticalCard(def, opts = {}) {
  const t = TYPE[def.type] || TYPE.skill;
  const up = !!opts.up;
  const rarity = RARITY[def.rarity] || 1;
  const cost = opts.cost ?? def.cost;
  const text = opts.text ?? '';
  return `<article class="tc tc-${def.type || 'skill'} tc-r${rarity}${up ? ' tc-up' : ''} ${opts.extraClass || ''}" style="--tc:${t.color}">
    <div class="tc-cost" aria-label="费用 ${esc(cost)}"><b>${esc(cost)}</b></div>
    <header class="tc-head"><span class="tc-type">${t.label}</span><span class="tc-code">${esc(opts.tagLabel || t.code)}</span></header>
    <div class="tc-art">${tacticalArt(def)}${opts.badge ? `<span class="tc-badge">${opts.badge}</span>` : ''}</div>
    <h4 class="tc-name">${esc(def.name)}${up ? '<i>+</i>' : ''}</h4>
    <div class="tc-text">${text}</div>
    <footer class="tc-foot"><span class="tc-rarity" aria-label="稀有度 ${rarity}">${'<i></i>'.repeat(rarity)}</span><span class="tc-id">${def.exhaust ? '消耗' : ''}${def.retain ? '保留' : ''}</span></footer>
  </article>`;
}
