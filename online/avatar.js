// Original Pig House portraits, shared by the profile editor and battle HUD.
export const AVATARS = [
  { id: 'pig-scout', name: '侦察猪', color: '#38696c', visor: '#8de0dd' },
  { id: 'pig-guard', name: '守点猪', color: '#55577e', visor: '#b9b0ff' },
  { id: 'pig-rush', name: '突击猪', color: '#884d50', visor: '#ffb49a' },
  { id: 'pig-coach', name: '战术猪', color: '#69603c', visor: '#ffe1a1' },
  { id: 'pig-frost', name: '冰锋猪', color: '#466880', visor: '#b0dfff' },
  { id: 'pig-night', name: '夜行猪', color: '#493d65', visor: '#edb8ff' },
];
export function avatarSrc(value) {
  if (typeof value === 'string' && /^\/api\/avatars\/[a-f0-9]{16}\?v=[a-f0-9]{16}$/.test(value)) return value;
  const a = AVATARS.find(a => a.id === value) || AVATARS[0];
  const i = AVATARS.indexOf(a);
  const accessory = i === 1 ? '<path d="M20 33L32 16L44 33" fill="#e0d5be"/>' : i === 3 ? '<path d="M14 24H50V31H14Z" fill="#333d47"/>' : i === 5 ? '<path d="M17 44L32 58L47 44" fill="#282b40"/>' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${a.color}"/><path d="M14 30L12 12L29 20M50 30L52 12L35 20" fill="#efaaa9" stroke="#342b39" stroke-width="2"/><ellipse cx="32" cy="36" rx="22" ry="21" fill="#f3c1b5" stroke="#342b39" stroke-width="2"/>${accessory}<path d="M14 29Q32 24 50 29V37Q32 41 14 37Z" fill="#263a45"/><path d="M20 31L29 30M36 30L44 31" stroke="${a.visor}" stroke-width="3"/><ellipse cx="32" cy="45" rx="10" ry="7" fill="#df9195"/><circle cx="28" cy="45" r="2" fill="#613c4b"/><circle cx="36" cy="45" r="2" fill="#613c4b"/><path d="M7 59L18 52M57 59L46 52" stroke="${a.visor}" stroke-width="5"/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
