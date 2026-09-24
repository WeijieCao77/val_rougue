// Shared status vocabulary for both demos: one icon, colour and rule text per
// combat status, plus a card-text highlighter that bolds the same keywords.
// Plain ES module with named exports only (bundled for the Wa demo by
// tools/build-browser.mjs and imported directly by the new demo).

const svg = body => `<svg class="status-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

const ICONS = {
  block: svg('<path d="M12 2.5 4 5.6v6.1c0 5 3.4 8.7 8 9.8 4.6-1.1 8-4.8 8-9.8V5.6z" fill="currentColor"/><path d="M12 6v12" stroke="rgba(0,0,0,.35)" stroke-width="1.6"/>'),
  weak: svg('<path d="M5 4l9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M13.5 12.5l2-2 3 3-2 2z" fill="currentColor"/><path d="M12 15.5v5M9 18l3 3 3-3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  vuln: svg('<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M10 8.5l3 3-2.2 1.2 2.6 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>'),
  smoke: svg('<path d="M6.5 18.5h11a4 4 0 0 0 .6-7.9 5.5 5.5 0 0 0-10.6-1.2A4.6 4.6 0 0 0 6.5 18.5z" fill="currentColor"/><circle cx="5" cy="7" r="1.8" fill="currentColor" opacity=".7"/><circle cx="8.5" cy="4.5" r="1.2" fill="currentColor" opacity=".5"/>'),
  flash: svg('<path d="M12 1.8l2.1 6.3 6.3-2.4-3.9 5.5 5.7 3.1-6.6.6.9 6.6L12 16.5l-4.5 5 .9-6.6-6.6-.6 5.7-3.1-3.9-5.5 6.3 2.4z" fill="currentColor"/>'),
  strength: svg('<path d="M12.5 2c.6 3.4 4.8 5.2 4.8 10.2A5.3 5.3 0 0 1 12 17.6a5.3 5.3 0 0 1-5.3-5.4c0-2.3 1.2-3.9 2.3-5 .1 1.6.8 2.7 1.8 3.2C10.8 7.3 11.5 4.3 12.5 2z" fill="currentColor"/><path d="M7 20.5h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  thorns: svg('<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7l1.4 3.6L17 12l-3.6 1.4L12 17l-1.4-3.6L7 12l3.6-1.4z" fill="currentColor"/>'),
  aim: svg('<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  enrage: svg('<path d="M4 20 8 9l3 5 2-9 3 7 2-3 2 11z" fill="currentColor"/>'),
  sentry: svg('<path d="M9 13h6l1.5 7h-9z" fill="currentColor"/><rect x="6.5" y="6.5" width="11" height="6.5" rx="1.5" fill="currentColor"/><path d="M17.5 9.5H22" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="10.5" cy="9.7" r="1.4" fill="rgba(0,0,0,.45)"/>'),
  overload: svg('<path d="M13 2 5 13.5h5.5L9 22l9-12h-5.8z" fill="currentColor"/>'),
  exhaust: svg('<path d="M12 21c-4 0-7-2.8-7-6.6 0-3.1 2.2-4.9 3.5-6.8.4 1.6 1.3 2.6 2.4 3 .1-3.4 1.5-6.1 3.6-8.6.3 3.3 2.2 5.2 3.5 7.3a7 7 0 0 1 1 3.9c0 4-3 7.8-7 7.8z" fill="none" stroke="currentColor" stroke-width="2"/>'),
  draw: svg('<rect x="4" y="5" width="10" height="14" rx="1.6" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="3" width="10" height="14" rx="1.6" fill="currentColor"/>'),
  status: svg('<path d="M12 2.5 22 20H2z" fill="currentColor"/><path d="M12 9v5" stroke="rgba(0,0,0,.55)" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.3" fill="rgba(0,0,0,.55)"/>'),
  damage: svg('<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>'),
  burn: svg('<path d="M9 3h6v3l-1.5 1.5V9c2.6.9 4.5 3.3 4.5 6.2A6 6 0 0 1 12 21a6 6 0 0 1-6-5.8C6 12.3 7.9 9.9 10.5 9V7.5L9 6z" fill="currentColor"/><path d="M12 12.5c1 1.2 2.4 2 2.4 3.6a2.4 2.4 0 0 1-4.8 0c0-1.1.9-1.9 1.3-2.4.2.6.6 1 1.1 1.1z" fill="rgba(0,0,0,.45)"/>'),
  retain: svg('<path d="M7 3h10v18l-5-4-5 4z" fill="currentColor"/>'),
  discover: svg('<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" stroke-width="2"/>'),
  combo: svg('<path d="M4 17 10 7l3 5 3-5 4 10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="4" cy="17" r="2" fill="currentColor"/><circle cx="20" cy="17" r="2" fill="currentColor"/>'),
  tempo: svg('<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 8.5V13l3 2" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M9 2.5h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  team: svg('<circle cx="7" cy="8" r="2.6" fill="currentColor"/><circle cx="17" cy="8" r="2.6" fill="currentColor"/><circle cx="12" cy="6" r="3" fill="currentColor"/><path d="M2.5 19c0-3.2 2-5.2 4.5-5.2s4.5 2 4.5 5.2M12.5 19c0-3.2 2-5.2 4.5-5.2s4.5 2 4.5 5.2" fill="currentColor"/><path d="M7 17.5c.6-4 2.6-6.3 5-6.3s4.4 2.3 5 6.3z" fill="currentColor"/>'),
  chain: svg('<path d="M3 17 8 7l3 6 3-6 3 6 3-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="7" r="2.3" fill="currentColor"/><path d="M4 21h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  counter: svg('<path d="M12 2.5 4 5.6v6.1c0 5 3.4 8.7 8 9.8 4.6-1.1 8-4.8 8-9.8V5.6z" fill="currentColor"/><path d="M8 13l4-4 4 4M12 9v8" stroke="rgba(0,0,0,.5)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  improv: svg('<rect x="3" y="6" width="9" height="13" rx="1.6" fill="currentColor" opacity=".55"/><rect x="9" y="3" width="9" height="13" rx="1.6" fill="currentColor"/><path d="M19 15l2 2-2 2M21 17h-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  heal: svg('<rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor"/><path d="M12 7v10M7 12h10" stroke="rgba(0,0,0,.55)" stroke-width="3" stroke-linecap="round"/>'),
  coin: svg('<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M9 8h6M9 12h6M9 16h6M12 6v12" stroke="rgba(0,0,0,.45)" stroke-width="1.8"/>'),
  supply: svg('<rect x="4" y="7" width="16" height="13" rx="2" fill="currentColor"/><path d="M9 7V4.5h6V7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 10v7M8.5 13.5h7" stroke="rgba(0,0,0,.5)" stroke-width="2.4" stroke-linecap="round"/>'),
  cards: svg('<rect x="3" y="6" width="11" height="15" rx="1.6" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="3" width="11" height="15" rx="1.6" fill="currentColor"/>'),
  curse: svg('<circle cx="12" cy="11" r="7.5" fill="currentColor"/><circle cx="9.3" cy="10.5" r="1.7" fill="rgba(0,0,0,.55)"/><circle cx="14.7" cy="10.5" r="1.7" fill="rgba(0,0,0,.55)"/><path d="M9 20v-2.5M12 20v-2.5M15 20v-2.5" stroke="currentColor" stroke-width="2"/>')
};

// label: short on-body name; rule: the full hover explanation.
export const STATUS_INFO = {
  block: { label: '布防', color: '#7fb4ff', rule: '布防：抵消等量伤害。' },
  weak: { label: '压制', color: '#c49bff', rule: '压制：造成的攻击伤害 ×0.75，每回合 -1 层。' },
  vuln: { label: '易伤', color: '#ff8a4c', rule: '易伤：受到的攻击伤害 ×1.5，每回合 -1 层。' },
  smoke: { label: '烟雾', color: '#b9c4cf', rule: '烟雾：敌方每次命中伤害 -层数，敌方回合结束 -1 层。' },
  flash: { label: '闪光', color: '#ffe066', rule: '闪光：敌方下一次命中伤害 -3×层数，触发后清空。' },
  strength: { label: '火力', color: '#ff5a5a', rule: '火力：每次命中伤害 +层数，本场持续。' },
  thorns: { label: '反击', color: '#e0a15a', rule: '反击：每次被攻击命中时，对攻击方造成等量伤害。' },
  aim: { label: '瞄准', color: '#ff4d8d', rule: '瞄准：下回合将打出致命狙击；让它失去瞄准或做好布防。' },
  enrage: { label: '狂热', color: '#ff7043', rule: '狂热：你每打出一张技能牌，它获得等量火力。' },
  sentry: { label: '哨戒', color: '#5fd3c6', rule: '哨戒炮：回合结束时自动开火。' },
  overload: { label: '过载', color: '#8fd3ff', rule: '过载：本回合行动点已被上回合的爆发扣减等量。' },
  damage: { label: '伤害', color: '#ff5d4a', rule: '伤害：先扣布防，再扣生命／防线。' },
  burn: { label: '燃烧', color: '#ff7a1a', rule: '燃烧：敌方回合开始时失去等同层数的生命（无视布防），然后 -1 层。' },
  retain: { label: '保留', color: '#9fd8ff', rule: '保留：回合结束时不会被弃掉，留在手中。' },
  discover: { label: '发现', color: '#f5d76e', rule: '发现：从三张随机牌中选一张加入手牌，本回合 0 费，打出后消耗。' },
  combo: { label: '连击', color: '#ff9ecf', rule: '连击：本回合已打出过其他牌时触发额外效果。' },
  exhaust: { label: '消耗', color: '#ffb36b', rule: '消耗：打出后本场移出牌组循环。' },
  draw: { label: '抽牌', color: '#9fe3a0', rule: '抽牌：从抽牌堆抽取卡牌。' },
  status: { label: '异常', color: '#ff6b6b', rule: '异常：对手塞入的状态牌，不能打出，常在回合末造成惩罚。' },
  curse: { label: '隐患', color: '#d17bff', rule: '俱乐部隐患：跨比赛保留的负面牌，需要永久移除。' }
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function statusIcon(key) {
  return ICONS[key] || ICONS.status;
}

// One badge: icon + stack count, coloured, with the rule as tooltip.
export function statusBadge(key, value, extraRule = '') {
  const info = STATUS_INFO[key] || { label: key, color: '#ddd', rule: key };
  const title = `${info.label} ${value}｜${info.rule}${extraRule ? ' ' + extraRule : ''}`;
  return `<span class="status-badge status-${esc(key)}" style="--status-color:${info.color}" tabindex="0" role="img" aria-label="${esc(title)}" title="${esc(title)}">${statusIcon(key)}<b>${esc(value)}</b><em>${esc(info.label)}</em></span>`;
}

// statuses: object {key: value} or array of [key, value]; zero/empty values are skipped.
export function statusBadges(statuses) {
  const entries = Array.isArray(statuses) ? statuses : Object.entries(statuses || {});
  return entries.filter(([, v]) => v !== undefined && v !== null && v !== 0 && v !== '').map(([k, v]) => statusBadge(k, v)).join('');
}

// Keywords in card/rule text → bold coloured tag with icon. Longer words first
// so "虚弱" and "布防" style synonyms map to one status each.
const KEYWORDS = [
  ['烟雾', 'smoke'], ['闪光', 'flash'], ['压制', 'weak'], ['虚弱', 'weak'], ['易伤', 'vuln'],
  ['布防', 'block'], ['格挡', 'block'], ['火力', 'strength'], ['反击', 'thorns'], ['瞄准', 'aim'],
  ['哨戒炮', 'sentry'], ['哨戒', 'sentry'], ['过载', 'overload'], ['消耗', 'exhaust'], ['异常', 'status'],
  ['燃烧', 'burn'], ['保留', 'retain'], ['发现', 'discover'], ['连击', 'combo'], ['伤害', 'damage'], ['抽牌', 'draw']
];
const KEYWORD_RE = new RegExp(KEYWORDS.map(([w]) => w).join('|'), 'g');
const KEYWORD_MAP = new Map(KEYWORDS);

// Pass escaped=true when the text is already HTML-safe (e.g. contains <strong> markup).
export function highlightKeywords(text, escaped = false) {
  return (escaped ? String(text ?? '') : esc(text)).replace(KEYWORD_RE, word => {
    const key = KEYWORD_MAP.get(word);
    return `<b class="kw kw-${key}" style="--status-color:${STATUS_INFO[key].color}">${statusIcon(key)}${word}</b>`;
  });
}

// Rules for every keyword that appears in `text`, once each: [[label, rule], ...].
// Used by the long-press card detail sheet.
export function keywordRules(text) {
  const seen = new Set();
  const out = [];
  for (const word of String(text ?? '').match(KEYWORD_RE) || []) {
    const key = KEYWORD_MAP.get(word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push([STATUS_INFO[key].label, STATUS_INFO[key].rule.replace(/^[^：]*：/, '')]);
  }
  return out;
}
