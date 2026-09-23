import { CARDS, STATUS_CARDS, TEAMS, RELICS, ENEMIES } from './content.js';

let uidCounter = 0;
const uid = () => `u${uidCounter++}`;
const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const BG = '#0b0f14';
const CYAN = '#00e5ff';
const AMBER = '#ffb300';
const WHITE = '#e0e0e0';
const RED = '#ff3d00';
const GREEN = '#00e676';

function tag(name, attrs = {}, inner = '') {
  const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
  return `<${name} ${attrStr}>${inner}</${name}>`;
}
function path(d, attrs = {}) { return tag('path', { d, ...attrs }); }
function rect(x, y, w, h, attrs = {}) { return tag('rect', { x, y, width: w, height: h, ...attrs }); }
function circle(cx, cy, r, attrs = {}) { return tag('circle', { cx, cy, r, ...attrs }); }
function ellipse(cx, cy, rx, ry, attrs = {}) { return tag('ellipse', { cx, cy, rx, ry, ...attrs }); }
function line(x1, y1, x2, y2, attrs = {}) { return tag('line', { x1, y1, x2, y2, ...attrs }); }
function poly(points, attrs = {}) { return tag('polygon', { points: points.join(' '), ...attrs }); }

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 16777619); }
  return h >>> 0;
}

function background(w, h, uid) {
  const gradId = `bg-${uid}`;
  const gridId = `grid-${uid}`;
  return `<defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1f2b"/>
      <stop offset="100%" stop-color="#0b0f14"/>
    </linearGradient>
    <pattern id="${gridId}" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1c2733" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${gradId})"/>
  <rect width="${w}" height="${h}" fill="url(#${gridId})"/>`;
}

function drawSoldier(x,y,scale,pose,colors,flip,uid,armorLevel=0) { const p=colors.primary||'#2a2a2a'; const s=colors.secondary||'#4a4a4a'; const a=colors.accent||'#00aaff'; const h=colors.highlight||'#ffffff'; const gid='g'+uid+'-'+x+'-'+y+'-'+armorLevel; const grad={
 body:`<linearGradient id="${gid}-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p}"/><stop offset="100%" stop-color="${s}"/></linearGradient>`,
 armor:`<linearGradient id="${gid}-armor" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${s}"/><stop offset="100%" stop-color="${p}"/></linearGradient>`,
 accent:`<linearGradient id="${gid}-acc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${s}"/></linearGradient>`
 };
 const visorLit = `url(#${gid}-acc)`;
 const visorDark = 'rgba(0,0,0,0.7)';
 const gunMetal = '#3b3b3b';
 const gunDark = '#1e1e1e';
 const skin = '#e0ac69';
 const glove = '#8b5a2b';
 const boot = '#1a1a1a';
 const knee = '#555';
 const belt = '#222';
 const pouch = '#3c3c3c';
 const stitch = '#ffaa00';
 let poseTransform = '';
 let leftHand = {x:10,y:0,rot:0};
 let rightHand = {x:-10,y:0,rot:0};
 let weaponTransform = '';
 let extraItems = '';
 switch(pose){
 case 'fire':
 leftHand = {x:14,y:-4,rot:15}; rightHand = {x:-6,y:2,rot:-10}; weaponTransform = 'translate(2,-2) rotate(-5)';
 break;
 case 'crouchFire':
 leftHand = {x:12,y:-2,rot:10}; rightHand = {x:-8,y:6,rot:-15}; weaponTransform = 'translate(0,2) rotate(5)'; poseTransform = 'translate(0,4) skewX(5)';
 break;
 case 'cover':
 leftHand = {x:20,y:-10,rot:45}; rightHand = {x:-20,y:-10,rot:-45}; weaponTransform = 'translate(0,-10)'; extraItems = `<rect x="-25" y="-30" width="50" height="40" rx="4" fill="${s}" stroke="${p}" stroke-width="2"/><path d="M-15 -30 L-15 10 M15 -30 L15 10" stroke="${a}" stroke-width="2"/>`;
 break;
 case 'throw':
 leftHand = {x:10,y:-25,rot:90}; rightHand = {x:-10,y:-15,rot:-30}; weaponTransform = 'translate(0,-15)'; extraItems = `<circle cx="10" cy="-30" r="6" fill="${p}" stroke="${s}" stroke-width="2"/><path d="M10 -36 L12 -42 M10 -36 L8 -42 M12 -42 L8 -42" stroke="${s}" stroke-width="1.5"/>`;
 break;
 case 'tablet':
 leftHand = {x:5,y:0,rot:0}; rightHand = {x:-5,y:0,rot:0}; weaponTransform = 'translate(0,0)'; extraItems = `<rect x="-8" y="-10" width="16" height="20" rx="2" fill="${gunDark}" stroke="${s}"/><rect x="-6" y="-8" width="12" height="16" fill="${a}" opacity="0.8"/><line x1="-6" y1="-2" x2="6" y2="-2" stroke="${h}" stroke-width="1"/><line x1="-6" y1="0" x2="6" y2="0" stroke="${h}" stroke-width="1"/><line x1="-6" y1="2" x2="6" y2="2" stroke="${h}" stroke-width="1"/>`;
 break;
 case 'stanceSwitch':
 leftHand = {x:10,y:-5,rot:20}; rightHand = {x:-10,y:-5,rot:-20}; weaponTransform = 'translate(0,-5) rotate(10)';
 break;
 case 'heal':
 leftHand = {x:10,y:-20,rot:120}; rightHand = {x:-10,y:-15,rot:-60}; weaponTransform = 'translate(0,-10)'; extraItems = `<rect x="8" y="-28" width="6" height="10" rx="2" fill="${h}" stroke="${a}" stroke-width="1"/><path d="M11 -26 L11 -20 M8 -23 L14 -23" stroke="${a}" stroke-width="1.5"/>`;
 break;
 case 'power':
 leftHand = {x:12,y:-10,rot:30}; rightHand = {x:-12,y:-10,rot:-30}; weaponTransform = 'translate(0,-8)'; extraItems = `<path d="M12 -20 L14 -28 L10 -24 L12 -32" fill="${a}" stroke="${h}" stroke-width="1"/><path d="M-12 -20 L-14 -28 L-10 -24 L-12 -32" fill="${a}" stroke="${h}" stroke-width="1"/>`;
 break;
 default:
 leftHand = {x:10,y:0,rot:0}; rightHand = {x:-10,y:0,rot:0}; weaponTransform = '';
 }
 const helmetExtra = armorLevel>0 ? `<polygon points="-8,-30 -4,-34 4,-34 8,-30" fill="${s}" stroke="${p}" stroke-width="1"/>` : '';
 const shoulderExtra = armorLevel>1 ? `<polygon points="-18,-8 -24,-8 -24,2 -18,5" fill="${s}" stroke="${p}" stroke-width="1"/><polygon points="18,-8 24,-8 24,2 18,5" fill="${s}" stroke="${p}" stroke-width="1"/>` : '';
 const svg = `<g transform="translate(${x},${y}) scale(${flip?-scale:scale},${scale})">
 <defs>${grad.body}${grad.armor}${grad.accent}</defs>
 <g transform="${poseTransform}">
 <ellipse cx="0" cy="32" rx="20" ry="3" fill="rgba(0,0,0,0.3)"/>
 <g id="legs">
 <path d="M-10,10 L-14,24 L-7,24 L-4,10 Z" fill="${p}" stroke="${s}" stroke-width="1"/>
 <path d="M10,10 L14,24 L7,24 L4,10 Z" fill="${p}" stroke="${s}" stroke-width="1"/>
 <polygon points="-14,22 -14,30 -7,30 -7,22" fill="${knee}" stroke="${s}" stroke-width="1"/>
 <polygon points="14,22 14,30 7,30 7,22" fill="${knee}" stroke="${s}" stroke-width="1"/>
 <rect x="-14" y="29" width="7" height="5" rx="1" fill="${boot}" stroke="${p}" stroke-width="1"/>
 <rect x="7" y="29" width="7" height="5" rx="1" fill="${boot}" stroke="${p}" stroke-width="1"/>
 </g>
 <g id="torso">
 <polygon points="-12,-20 12,-20 16,10 -16,10" fill="url(#${gid}-body)" stroke="${p}" stroke-width="1.5"/>
 <polygon points="-12,-20 0,-20 0,10 -12,10" fill="rgba(255,255,255,0.1)"/>
 <polygon points="-10,-8 10,-8 12,0 -12,0" fill="url(#${gid}-armor)" stroke="${s}" stroke-width="1"/>
 <polygon points="-10,-8 0,-8 0,0 -10,0" fill="rgba(255,255,255,0.15)"/>
 <rect x="-12" y="0" width="24" height="6" fill="${belt}" stroke="${p}" stroke-width="1"/>
 <rect x="-8" y="1" width="5" height="4" rx="1" fill="${pouch}"/>
 <rect x="3" y="1" width="5" height="4" rx="1" fill="${pouch}"/>
 <path d="M-12,0 L12,0" stroke="${stitch}" stroke-width="1"/>
 </g>
 <g id="head">
 <ellipse cx="0" cy="-20" rx="12" ry="10" fill="${skin}" stroke="${p}" stroke-width="1"/>
 <path d="M-12,-18 Q-13,-28 0,-30 Q13,-28 12,-18 Z" fill="${p}" stroke="${s}" stroke-width="1.5"/>
 ${helmetExtra}
 <rect x="-8" y="-18" width="16" height="6" fill="${visorDark}" stroke="${s}" stroke-width="1"/>
 <rect x="-8" y="-18" width="16" height="3" fill="${visorLit}" opacity="0.8"/>
 <path d="M-6,-12 L6,-12 L4,-8 L-4,-8 Z" fill="${p}" stroke="${s}" stroke-width="1"/>
 <rect x="-4" y="-9" width="8" height="3" rx="1" fill="${s}"/>
 </g>
 <g id="arms">
 <g transform="translate(${leftHand.x},${leftHand.y}) rotate(${leftHand.rot})">
 <path d="M-3,0 L-12,-12 L-6,-16 L0,-6 Z" fill="${p}" stroke="${s}" stroke-width="2"/>
 <polygon points="-12,-12 -6,-16 -10,-18 -16,-14" fill="${s}"/>
 <circle cx="0" cy="-6" r="5" fill="${glove}" stroke="${p}" stroke-width="1"/>
 </g>
 <g transform="translate(${rightHand.x},${rightHand.y}) rotate(${rightHand.rot})">
 <path d="M3,0 L12,-12 L6,-16 L0,-6 Z" fill="${p}" stroke="${s}" stroke-width="2"/>
 <polygon points="12,-12 6,-16 10,-18 16,-14" fill="${s}"/>
 <circle cx="0" cy="-6" r="5" fill="${glove}" stroke="${p}" stroke-width="1"/>
 </g>
 </g>
 <g id="weapon" transform="${weaponTransform}">
 <rect x="-18" y="-3" width="36" height="6" rx="1" fill="${gunMetal}" stroke="${gunDark}" stroke-width="1"/>
 <polygon points="-18,-3 -22,-1 -22,5 -18,5" fill="${gunDark}"/>
 <rect x="-5" y="3" width="8" height="10" rx="1" fill="${gunDark}"/>
 <polygon points="-5,13 -1,13 -1,16 -5,16" fill="${p}"/>
 <rect x="18" y="-2" width="12" height="4" rx="1" fill="${s}" stroke="${gunDark}" stroke-width="1"/>
 <rect x="30" y="-2.5" width="4" height="5" fill="${gunMetal}"/>
 <circle cx="2" cy="0" r="1.5" fill="${h}"/>
 <line x1="0" y1="0" x2="0" y2="2" stroke="${h}" stroke-width="0.8"/>
 <path d="M10,-1 L12,-3 L14,-1" stroke="${h}" fill="none" stroke-width="0.5"/>
 </g>
 ${extraItems}
 ${shoulderExtra}
 <g id="edge-highlights">
 <path d="M-12,-20 Q-14,-12 -12,-4" stroke="rgba(255,255,255,0.3)" fill="none" stroke-width="1"/>
 <path d="M12,-20 Q14,-12 12,-4" stroke="rgba(255,255,255,0.1)" fill="none" stroke-width="1"/>
 <path d="M-10,10 L-14,19 M10,10 L14,19" stroke="rgba(255,255,255,0.2)" fill="none" stroke-width="1"/>
 </g>
 </g>
 </g>`;
 return svg;
}

function drawMuzzleFlash(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <polygon points="0,-2 1,-1 3,-3 1.5,0 3,3 1,1 0,2 -1,1 -3,3 -1.5,0 -3,-3 -1,-1" fill="${AMBER}" opacity="0.8"/>
  </g>`;
}

function drawTracers(x, y, count, uid) {
  let lines = '';
  for (let i = 0; i < count; i++) {
    const yOff = (i - (count - 1) / 2) * 4;
    lines += `<line x1="${x}" y1="${y + yOff}" x2="${x + 60}" y2="${y + yOff}" stroke="${AMBER}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`;
  }
  return lines;
}

function drawBarrier(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-20" y="-10" width="40" height="20" fill="#2a3a4a" stroke="#4a5a6a" stroke-width="1"/>
    <path d="M -15 -10 L -15 -15 M 15 -10 L 15 -15" stroke="#4a5a6a" stroke-width="1"/>
    <rect x="-18" y="-8" width="36" height="4" fill="#34495e"/>
  </g>`;
}

function drawShield(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <polygon points="0,-15 15,-10 15,10 0,15 -15,10 -15,-10" fill="${CYAN}" opacity="0.5" stroke="${CYAN}" stroke-width="1"/>
    <path d="M -8 -5 L 8 -5 L 8 5 L -8 5 Z" fill="${CYAN}" opacity="0.3"/>
  </g>`;
}

function drawSmokeClouds(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="0.6">
    <ellipse cx="0" cy="0" rx="20" ry="15" fill="#6b7a8a"/>
    <ellipse cx="15" cy="-10" rx="15" ry="12" fill="#5a6a7a"/>
    <ellipse cx="-15" cy="-5" rx="18" ry="10" fill="#7a8a9a"/>
    <ellipse cx="5" cy="-20" rx="10" ry="8" fill="#8a9aaa" opacity="0.8"/>
  </g>`;
}

function drawGrenade(x, y, scale, flip, uid) {
  const s = scale;
  const dir = flip ? -1 : 1;
  return `<g transform="translate(${x} ${y}) scale(${dir * s} ${s})">
    <circle cx="0" cy="0" r="4" fill="#33414e" stroke="#4a5a6a" stroke-width="1"/>
    <path d="M 0 -4 L 2 -6 L 4 -6" stroke="#4a5a6a" stroke-width="1" fill="none"/>
    <circle cx="3" cy="-6" r="1" fill="${AMBER}"/>
  </g>`;
}

function drawFlashBurst(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="0" r="8" fill="${WHITE}" opacity="0.9"/>
    <circle cx="0" cy="0" r="14" fill="${AMBER}" opacity="0.5"/>
    ${[0,45,90,135,180,225,270,315].map(ang => `<line x1="0" y1="0" x2="${20 * Math.cos(ang * Math.PI/180)}" y2="${20 * Math.sin(ang * Math.PI/180)}" stroke="${WHITE}" stroke-width="1.5"/>`).join('')}
    <polygon points="0,-25 5,-15 -5,-15" fill="${AMBER}" opacity="0.6"/>
  </g>`;
}

function drawDrone(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-8" y="-3" width="16" height="6" rx="1" fill="#2c3e50" stroke="#4a5a6a" stroke-width="0.5"/>
    <circle cx="0" cy="0" r="1.5" fill="${CYAN}"/>
    <path d="M -8 0 L -12 -4 L -12 4 Z" fill="#4a5a6a"/>
    <path d="M 8 0 L 12 -4 L 12 4 Z" fill="#4a5a6a"/>
    <ellipse cx="-12" cy="-4" rx="3" ry="1" fill="#6b7a8a"/>
    <ellipse cx="12" cy="-4" rx="3" ry="1" fill="#6b7a8a"/>
    <ellipse cx="-12" cy="4" rx="3" ry="1" fill="#6b7a8a"/>
    <ellipse cx="12" cy="4" rx="3" ry="1" fill="#6b7a8a"/>
  </g>`;
}

function drawTabletExtra(x, y, scale, flip, uid) {
  const s = scale;
  const dir = flip ? -1 : 1;
  return `<g transform="translate(${x} ${y}) scale(${dir * s} ${s})">
    <rect x="-10" y="-5" width="20" height="10" rx="1" fill="#1e2c3a" stroke="${CYAN}" stroke-width="0.5"/>
    <rect x="-8" y="-3" width="16" height="6" fill="#00e5ff" opacity="0.3"/>
    <line x1="-6" y1="0" x2="6" y2="0" stroke="${CYAN}" stroke-width="0.5"/>
  </g>`;
}

function drawEnemySilhouette(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="0.6">
    <path d="M -8 -20 L 8 -20 L 6 10 L -6 10 Z" fill="#0a0a0a"/>
    <circle cx="0" cy="-25" r="5" fill="#0a0a0a"/>
    <path d="M -8 -15 L -15 -10 L -15 -5 M 8 -15 L 15 -10 L 15 -5" stroke="#0a0a0a" stroke-width="2" fill="none"/>
  </g>`;
}

function drawMotionLines(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${AMBER}" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.5">
    <line x1="-20" y1="-15" x2="20" y2="-15"/>
    <line x1="-15" y1="-10" x2="15" y2="-10"/>
    <line x1="-20" y1="15" x2="20" y2="15"/>
  </g>`;
}

function drawPowerAura(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="0" r="20" fill="none" stroke="${CYAN}" stroke-width="1" opacity="0.5"/>
    <circle cx="0" cy="0" r="22" fill="none" stroke="${CYAN}" stroke-width="0.5" stroke-dasharray="4 2"/>
    <polygon points="0,-25 5,-15 -5,-15" fill="${CYAN}" opacity="0.8"/>
    <polygon points="0,25 5,15 -5,15" fill="${CYAN}" opacity="0.8"/>
    <polygon points="-25,0 -15,5 -15,-5" fill="${CYAN}" opacity="0.8"/>
    <polygon points="25,0 15,5 15,-5" fill="${CYAN}" opacity="0.8"/>
  </g>`;
}

function drawMedKit(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-10" y="-5" width="20" height="15" rx="2" fill="#2d3e4e" stroke="#4a5a6a" stroke-width="0.5"/>
    <rect x="-8" y="-3" width="16" height="11" rx="1" fill="#3d4e5e"/>
    <path d="M -3 -3 L 3 -3 M 0 -6 L 0 0" stroke="${GREEN}" stroke-width="1.5"/>
    <circle cx="0" cy="0" r="5" fill="none" stroke="${GREEN}" stroke-width="0.5"/>
  </g>`;
}

function drawHealGlow(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="0" r="30" fill="${GREEN}" opacity="0.15"/>
    <circle cx="0" cy="0" r="20" fill="${GREEN}" opacity="0.2"/>
  </g>`;
}

function drawPurgeEffect(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="0" r="25" fill="none" stroke="${WHITE}" stroke-width="1" stroke-dasharray="5 3" opacity="0.6"/>
    <circle cx="0" cy="0" r="20" fill="none" stroke="${WHITE}" stroke-width="0.5" stroke-dasharray="2 3" opacity="0.4"/>
    <path d="M -5 -5 L 5 5 M 5 -5 L -5 5" stroke="${RED}" stroke-width="1.5" opacity="0.7"/>
  </g>`;
}

function drawScopeGlint(x, y, scale, uid) {
  const s = scale;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="0" r="2" fill="${WHITE}"/>
    <circle cx="0" cy="0" r="4" fill="${WHITE}" opacity="0.3"/>
  </g>`;
}

function selectScene(card) {
  if (card.type === 'power') return 7;
  const tag = card.tag;
  if (tag === 'basic') {
    if (card.type === 'attack') return 0;
    if (card.type === 'skill') {
      if (card.effects?.some(e => e.type === 'block')) return 1;
      if (card.effects?.some(e => e.type === 'smoke')) return 2;
      if (card.effects?.some(e => e.type === 'flash')) return 3;
      if (card.effects?.some(e => e.type === 'draw')) return 4;
      return 1;
    }
  }
  if (tag === 'damage') {
    if (card.effects?.some(e => e.times > 1) || card.name.includes('连') || card.name.includes('扫')) return 10;
    const dmg = card.effects?.find(e => e.type === 'attack')?.n || 0;
    if (dmg >= 18) return 11;
    return 0;
  }
  if (tag === 'utility') {
    if (card.effects?.some(e => e.type === 'smoke') && card.effects?.some(e => e.type === 'flash')) return 5;
    if (card.effects?.some(e => e.type === 'smoke')) return 2;
    if (card.effects?.some(e => e.type === 'flash')) return 3;
    if (card.effects?.some(e => e.type === 'draw') || card.effects?.some(e => e.type === 'energy')) return 4;
    if (card.effects?.some(e => e.type === 'weak') || card.effects?.some(e => e.type === 'vuln')) return 9;
    return 4;
  }
  if (tag === 'stance') return 6;
  if (tag === 'hybrid') {
    if (card.effects?.some(e => e.type === 'attack') && card.effects?.some(e => e.condition?.includes('smoke') || e.condition?.includes('flash'))) return 5;
    if (card.effects?.some(e => e.type === 'attack') && card.effects?.some(e => e.type === 'block')) return 1;
    if (card.effects?.some(e => e.type === 'attack') && card.effects?.some(e => e.type === 'draw')) return 4;
    return 5;
  }
  if (tag === 'response') {
    if (card.effects?.some(e => e.type === 'heal')) return 8;
    if (card.effects?.some(e => e.type === 'purgePlayerStatus') || card.effects?.some(e => e.type === 'purgeEnemyStatus')) return 9;
    return 4;
  }
  if (card.type === 'status') return 9;
  return 0;
}

function drawScene(index, card, uid) {
  const w = 320, h = 190;
  const bg = background(w, h, uid);
  const hsh = hash(card.id);
  const variations = { colorShift: (hsh % 20) - 10, xOff: (hsh % 40) - 20, yOff: (hsh % 30) - 15 };
  const soldierColors = {
    primary: hsh % 2 ? '#2a3a4a' : '#34495e',
    secondary: '#4a5a6a',
    accent: AMBER,
    skin: '#c68642',
    helmet: '#1e2c3a',
    weapon: '#2c3e50'
  };
  let soldierPose = 'fire';
  switch (index) {
    case 0: soldierPose = 'fire'; break;
    case 1: soldierPose = 'cover'; break;
    case 2: soldierPose = 'throw'; break;
    case 3: soldierPose = 'throw'; break;
    case 4: soldierPose = 'tablet'; break;
    case 5: soldierPose = 'fire'; break;
    case 6: soldierPose = 'stanceSwitch'; break;
    case 7: soldierPose = 'fire'; break;
    case 8: soldierPose = 'heal'; break;
    case 9: soldierPose = 'cover'; break;
    case 10: soldierPose = 'dualFire'; break;
    case 11: soldierPose = 'snipe'; break;
  }
  let sx = 160 + variations.xOff * 0.4;
  let sy = 100 + variations.yOff * 0.2;
  const scale = 2.5;
  const flip = hsh % 2 === 0;
  const soldierGroup = drawSoldier(sx, sy, scale, soldierPose, soldierColors, flip, uid);
  let extras = '';
  switch (index) {
    case 0:
      extras += drawMuzzleFlash(sx + (flip ? -40 : 40), sy - 30, 0.4, uid);
      extras += drawTracers(sx + (flip ? -40 : 40), sy - 30, 3, uid);
      break;
    case 1:
      extras += drawBarrier(sx + 20, sy + 10, scale, uid);
      extras += drawShield(sx, sy, scale, uid);
      break;
    case 2:
      extras += drawSmokeClouds(sx, sy, scale, uid);
      extras += drawGrenade(sx, sy, scale, flip, uid);
      break;
    case 3:
      extras += drawFlashBurst(sx + (flip ? -40 : 40), sy - 40, 0.5, uid);
      extras += drawGrenade(sx, sy, scale, flip, uid);
      break;
    case 4:
      extras += drawDrone(sx + 30, sy - 60, 0.4, uid);
      extras += drawTabletExtra(sx, sy, scale, flip, uid);
      break;
    case 5:
      extras += drawSmokeClouds(sx + 60, sy - 20, 0.5, uid);
      extras += drawEnemySilhouette(220, 130, 0.3, uid);
      break;
    case 6:
      extras += drawMotionLines(sx, sy, scale, uid);
      break;
    case 7:
      extras += drawPowerAura(sx, sy, scale, uid);
      break;
    case 8:
      extras += drawMedKit(sx + (flip ? -30 : 30), sy + 20, 0.3, uid);
      extras += drawHealGlow(sx, sy, scale, uid);
      break;
    case 9:
      extras += drawPurgeEffect(sx, sy, scale, uid);
      break;
    case 10:
      extras += drawMuzzleFlash(sx + (flip ? -50 : 50), sy - 30, 0.5, uid);
      extras += drawTracers(sx + (flip ? -50 : 50), sy - 30, 5, uid);
      break;
    case 11:
      extras += drawScopeGlint(sx + (flip ? -60 : 60), sy - 20, 0.2, uid);
      extras += '<circle cx="' + (sx + (flip ? -60 : 60)) + '" cy="' + (sy - 20) + '" r="1" fill="' + WHITE + '"/>';
      break;
  }
  const wall = `<polygon points="0,190 0,140 320,140 320,190" fill="#2c3e50" opacity="0.5"/><polygon points="0,140 160,120 320,140 320,160 0,160" fill="${soldierColors.primary}" opacity="0.6"/><polygon points="160,120 320,140 320,160 160,140" fill="${soldierColors.secondary}" opacity="0.4"/>`;
  return bg + wall + soldierGroup + extras;
}

export function cardArt(cardId) {
  const card = CARDS[cardId] || STATUS_CARDS[cardId];
  if (!card) return '';
  const u = uid();
  const sceneIndex = selectScene(card);
  const inner = drawScene(sceneIndex, card, u);
  return `<svg viewBox="0 0 320 190" class="tactical-art" role="img" aria-label="${esc(card.name)}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

function drawSquad(positions, poses, colors, uid, backgroundExtra = '', armorLevels = [0,0,0]) {
  let squad = '';
  for (let i = 0; i < positions.length; i++) {
    squad += drawSoldier(positions[i].x, positions[i].y, positions[i].scale, poses[i], colors, positions[i].flip, uid, armorLevels[i]);
  }
  return backgroundExtra + squad;
}

function drawEnemySquad(enemy, uid) {
  const w = 640, h = 360;
  const bg = background(w, h, uid);
  const isElite = enemy.elite;
  const isBoss = enemy.boss;
  let armorLevels = [0,0,0];
  if (isElite) armorLevels = [1,1,1];
  if (isBoss) armorLevels = [2,2,2];
  const colors = {
    primary: isBoss ? '#3d2b1f' : (isElite ? '#3d1f1f' : '#2a3a4a'),
    secondary: isBoss ? '#5a4a3a' : (isElite ? '#5a3a3a' : '#4a5a6a'),
    accent: isBoss ? '#ffb300' : (isElite ? '#ff3d00' : '#00e5ff'),
    skin: '#c68642',
    helmet: isBoss ? '#2a1f1a' : (isElite ? '#2a1f1f' : '#1e2c3a'),
    weapon: '#2c3e50',
    armor: isBoss ? '#8a6a3a' : (isElite ? '#8a3a3a' : '#4a5a6a'),
    core: isBoss ? '#ffb300' : (isElite ? '#ff3d00' : '#00e5ff')
  };
  const positions = [
    { x: 140, y: 210, scale: 3, flip: false },
    { x: 320, y: 200, scale: 3.5, flip: false },
    { x: 500, y: 210, scale: 3, flip: true }
  ];
  const poses = ['crouchFire', 'fire', 'throw'];
  let extra = backgroundExtra(w, h, uid);
  // Add enemy specific background elements
  if (isBoss) {
    extra += `<circle cx="320" cy="180" r="60" fill="none" stroke="${AMBER}" stroke-width="1" stroke-dasharray="10 5" opacity="0.3"/>`;
  } else if (isElite) {
    extra += `<circle cx="320" cy="180" r="50" fill="none" stroke="${RED}" stroke-width="1" stroke-dasharray="10 5" opacity="0.3"/>`;
  }
  // smoke
  extra += drawSmokeClouds(200, 250, 0.4, uid);
  extra += drawSmokeClouds(480, 260, 0.4, uid);
  return bg + drawSquad(positions, poses, colors, uid, extra, armorLevels);
}

function drawAllySquad(team, uid) {
  const w = 640, h = 360;
  const bg = background(w, h, uid);
  let primary, accent, secondary;
  switch (team.id) {
    case 'breach':
      primary = '#3d2b1f'; secondary = '#5a4a3a'; accent = '#ff3d00'; break;
    case 'anchor':
      primary = '#1f2b3d'; secondary = '#3a4a5a'; accent = '#2196f3'; break;
    case 'utility':
      primary = '#1f3d2b'; secondary = '#3a5a4a'; accent = '#00e676'; break;
    case 'rotation':
      primary = '#3d1f2b'; secondary = '#5a3a4a'; accent = '#ffb300'; break;
    default:
      primary = '#2a3a4a'; secondary = '#4a5a6a'; accent = '#00e5ff';
  }
  const colors = {
    primary,
    secondary,
    accent,
    skin: '#c68642',
    helmet: '#1e2c3a',
    weapon: '#2c3e50',
    armor: '#4a5a6a',
    core: accent
  };
  const positions = [
    { x: 140, y: 210, scale: 3, flip: false },
    { x: 320, y: 200, scale: 3.5, flip: false },
    { x: 500, y: 210, scale: 3, flip: true }
  ];
  const poses = ['fire', 'cover', 'tablet'];
  let extra = backgroundExtra(w, h, uid);
  // Ally specific extra: drone
  extra += drawDrone(400, 100, 0.5, uid);
  extra += drawSmokeClouds(150, 250, 0.3, uid);
  return bg + drawSquad(positions, poses, colors, uid, extra, [0,0,0]);
}

function backgroundExtra(w, h, uid) {
  // Add some ambient lines or shapes
  let extra = '';
  const hsh = hash(uid);
  const numLines = 3 + (hsh % 4);
  for (let i = 0; i < numLines; i++) {
    const y = 50 + (hsh % 100) + i * 20;
    extra += `<line x1="0" y1="${y}" x2="${w}" y2="${y - 30}" stroke="${AMBER}" stroke-width="0.5" opacity="0.2"/>`;
  }
  // distant city silhouette
  extra += `<path d="M0 ${h - 60} L40 ${h - 80} L80 ${h - 60} L120 ${h - 70} L160 ${h - 50} L200 ${h - 75} L240 ${h - 55} L280 ${h - 70} L320 ${h - 50} L360 ${h - 80} L400 ${h - 60} L440 ${h - 70} L480 ${h - 50} L520 ${h - 75} L560 ${h - 55} L600 ${h - 65} L640 ${h - 50} Z" fill="#0a0f14" opacity="0.5"/>`;
  return extra;
}

export function combatArt(id, side = 'enemy') {
  const u = uid();
  if (side === 'enemy') {
    const enemy = ENEMIES[id];
    if (!enemy) return '';
    const inner = drawEnemySquad(enemy, u);
    return `<svg viewBox="0 0 640 360" class="tactical-art" role="img" aria-label="${esc(enemy.name)}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  } else if (side === 'ally') {
    const team = TEAMS[id];
    if (!team) return '';
    const inner = drawAllySquad(team, u);
    return `<svg viewBox="0 0 640 360" class="tactical-art" role="img" aria-label="${esc(team.name)}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  }
  return '';
}

function drawRelicItem(relic, uid) {
  const hsh = hash(relic.id);
  const cx = 160, cy = 95;
  let item = '';
  switch (relic.id) {
    case 'R01': // 随队医生
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <rect x="-30" y="-20" width="60" height="40" rx="5" fill="#2d3e4e" stroke="#4a5a6a" stroke-width="1"/>
        <rect x="-25" y="-15" width="50" height="30" rx="3" fill="#3d4e5e"/>
        <path d="M -10 -10 L 10 10 M 10 -10 L -10 10" stroke="${GREEN}" stroke-width="3"/>
        <circle cx="0" cy="0" r="12" fill="none" stroke="${GREEN}" stroke-width="1"/>
      </g>`;
      break;
    case 'R02': // 备用弹夹
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <rect x="-20" y="-25" width="40" height="50" rx="3" fill="#4a5a6a" stroke="#2c3e50" stroke-width="1"/>
        <rect x="-15" y="-20" width="30" height="40" rx="2" fill="#6b7a8a"/>
        <rect x="-15" y="-20" width="30" height="10" fill="${AMBER}" opacity="0.5"/>
        <circle cx="0" cy="5" r="5" fill="${CYAN}" opacity="0.5"/>
      </g>`;
      break;
    case 'R03': // 战术平板
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <rect x="-30" y="-20" width="60" height="40" rx="3" fill="#1e2c3a" stroke="${CYAN}" stroke-width="1"/>
        <rect x="-25" y="-15" width="50" height="30" rx="1" fill="#0b0f14"/>
        <path d="M -15 0 L 15 0 M 0 -10 L 0 10 M -10 -10 L 10 10" stroke="${CYAN}" stroke-width="0.5"/>
        <circle cx="0" cy="0" r="3" fill="${CYAN}"/>
      </g>`;
      break;
    case 'R04': // 烟雾发生器
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <rect x="-25" y="-25" width="50" height="50" rx="25" fill="#4a5a6a" stroke="#2c3e50" stroke-width="1"/>
        <circle cx="0" cy="0" r="15" fill="#6b7a8a"/>
        <ellipse cx="-10" cy="-15" rx="10" ry="8" fill="#8a9aaa" opacity="0.7"/>
        <ellipse cx="10" cy="-15" rx="8" ry="6" fill="#8a9aaa" opacity="0.7"/>
        <rect x="-5" y="-30" width="10" height="5" fill="#2c3e50"/>
      </g>`;
      break;
    case 'R05': // 闪光发生器
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <circle cx="0" cy="0" r="20" fill="#4a5a6a"/>
        <circle cx="0" cy="0" r="12" fill="${WHITE}" opacity="0.7"/>
        ${[0,45,90,135,180,225,270,315].map(ang => `<line x1="0" y1="0" x2="${28 * Math.cos(ang * Math.PI/180)}" y2="${28 * Math.sin(ang * Math.PI/180)}" stroke="${AMBER}" stroke-width="1.5"/>`).join('')}
      </g>`;
      break;
    case 'R06': // 通讯耳机
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <path d="M -20 -10 A 25 25 0 0 1 20 -10" fill="none" stroke="#4a5a6a" stroke-width="3"/>
        <rect x="-25" y="-15" width="12" height="20" rx="3" fill="#2c3e50"/>
        <rect x="13" y="-15" width="12" height="20" rx="3" fill="#2c3e50"/>
        <line x1="-25" y1="-5" x2="-33" y2="-2" stroke="#4a5a6a" stroke-width="1"/>
        <line x1="37" y1="-5" x2="45" y2="-2" stroke="#4a5a6a" stroke-width="1"/>
        <circle cx="-33" cy="-2" r="2" fill="${CYAN}"/>
        <circle cx="45" cy="-2" r="2" fill="${CYAN}"/>
      </g>`;
      break;
    case 'R07': // 护甲板
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <path d="M -20 -20 L 20 -20 L 25 10 L 0 30 L -25 10 Z" fill="#4a5a6a" stroke="#2c3e50" stroke-width="1"/>
        <path d="M -15 -10 L 15 -10 L 18 5 L 0 20 L -18 5 Z" fill="#6b7a8a" opacity="0.5"/>
        <circle cx="0" cy="0" r="8" fill="${AMBER}" opacity="0.5"/>
      </g>`;
      break;
    case 'R08': // 奖金加成
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <rect x="-25" y="-15" width="50" height="30" rx="3" fill="#1e3d2b" stroke="#00e676" stroke-width="1"/>
        <path d="M -15 5 L -10 -5 L 0 5 L 10 -5 L 15 5" stroke="${GREEN}" stroke-width="2" fill="none"/>
        <circle cx="-10" cy="-5" r="1" fill="${GREEN}"/>
        <circle cx="0" cy="5" r="1" fill="${GREEN}"/>
        <circle cx="10" cy="-5" r="1" fill="${GREEN}"/>
      </g>`;
      break;
    case 'R09': // 战术手册
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <rect x="-30" y="-25" width="60" height="50" rx="3" fill="#4a2b1f" stroke="#8a6a3a" stroke-width="1"/>
        <rect x="-25" y="-20" width="50" height="40" fill="#5a3a2a"/>
        <path d="M -20 -15 L 20 -15 M -20 -10 L 20 -10 M -20 -5 L 20 -5 M -20 0 L 20 0 M -20 5 L 20 5" stroke="${AMBER}" stroke-width="0.5"/>
        <circle cx="15" cy="10" r="5" fill="${AMBER}" opacity="0.5"/>
      </g>`;
      break;
    case 'R10': // 旧战术笔记
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <rect x="-20" y="-30" width="40" height="60" rx="2" fill="#5a4a3a" stroke="#3d2b1f" stroke-width="1"/>
        <rect x="-16" y="-26" width="32" height="52" rx="1" fill="#6b5a4a"/>
        <circle cx="0" cy="-15" r="3" fill="#3d2b1f"/>
        <path d="M -15 -10 L 15 -10 M -15 -5 L 15 -5 M -15 0 L 15 0 M -15 5 L 15 5" stroke="#3d2b1f" stroke-width="0.5"/>
      </g>`;
      break;
    case 'R11': // 冠军戒指
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <circle cx="0" cy="0" r="20" fill="none" stroke="${AMBER}" stroke-width="4"/>
        <circle cx="0" cy="0" r="16" fill="none" stroke="#8a6a3a" stroke-width="2"/>
        <polygon points="0,-25 5,-10 -5,-10" fill="${CYAN}" opacity="0.7"/>
      </g>`;
      break;
    case 'R12': // 幸运护符
      item = `<g transform="translate(${cx} ${cy}) scale(1)">
        <circle cx="0" cy="0" r="18" fill="#1e2c3a" stroke="${CYAN}" stroke-width="1"/>
        <path d="M 0 -15 L 5 -5 L 15 0 L 5 5 L 0 15 L -5 5 L -15 0 L -5 -5 Z" fill="${CYAN}" opacity="0.5"/>
        <circle cx="0" cy="0" r="3" fill="${WHITE}"/>
      </g>`;
      break;
    default:
      item = `<circle cx="${cx}" cy="${cy}" r="25" fill="#4a5a6a"/>`;
  }
  return item;
}

export function relicArt(id) {
  const relic = RELICS[id];
  if (!relic) return '';
  const u = uid();
  const item = drawRelicItem(relic, u);
  const svg = `<svg viewBox="0 0 320 190" class="tactical-art" role="img" aria-label="${esc(relic.name)}" xmlns="http://www.w3.org/2000/svg">${background(320,190,u)}${item}</svg>`;
  return svg;
}
