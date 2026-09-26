// new-demo/run-screens.js
// Information screens for the new demo: deck/pile viewer, run results, run
// history (战绩), the seen collection (图鉴) and the upgraded-card peek.
// Pure bookkeeping lives in /shared/run-meta.js.
import { cardSheetOpen } from '/shared/touch-feel.js';
import { tapPlayMode } from '/shared/tap-play.js';
import { CARDS, STATUS_CARDS, TEAMS, RELICS, SUPPLIES, ENEMIES } from './content.js';
import { EXTRA_ENEMIES } from './season-map.js';
import { battleEnemies } from './engine.js';
import { tacticalCard } from './tactical-card.js';
import { equipTileHtml } from './run-extras.js';
import { combatArt } from './art.js';
import { highlightKeywords } from '/shared/status-icons.js';
import { computeScore, scoreFormulaText, recordRun, loadHistory, markSeen, loadCollection, trackStep, loadTracker, saveTracker, filterSortCards, SORT_LABELS, COST_FILTERS, formatDuration } from '/shared/run-meta.js';

export const HISTORY_KEY = 'new-demo-run-history-v1';
export const SEEN_KEY = 'new-demo-collection-v1';
const TRACK_KEY = 'new-demo-run-tracker-v1';
const store = (() => { try { return localStorage; } catch { return null; } })();
const OUTCOME = { win: '通关', loss: '出局', abandon: '放弃' };
const TYPE_LABEL = { attack: '攻击', skill: '技能', power: '能力', status: '状态' };
const TYPE_ORDER = ['attack', 'skill', 'power', 'status'];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const defOf = id => CARDS[id] || STATUS_CARDS[id];
export const ALL_ENEMIES = () => ({ ...ENEMIES, ...EXTRA_ENEMIES });

// Same face as ui.js cardHtml, tagged with the card id for the upgrade peek.
export function cardFace(id, { up = false, cost, badge } = {}) {
  const def = defOf(id);
  if (!def) return '';
  const text = up && def.upgradeText ? def.upgradeText : def.text;
  const shownCost = cost ?? (up && def.upgradeCost !== undefined ? def.upgradeCost : def.cost);
  return tagCard(tacticalCard(def, { up, cost: shownCost, text: highlightKeywords(text), badge }), id, up);
}
export function tagCard(html, id, up) {
  return html.replace('<article ', `<article data-card-id="${esc(id)}" data-card-up="${!!up}" `);
}
const costOf = c => { const d = defOf(c.id); const n = c.up && d?.upgradeCost !== undefined ? d.upgradeCost : d?.cost; return typeof n === 'number' ? n : null; };
const typeOf = c => defOf(c.id)?.type || 'status';

// ---- tracking ----
function nodeOf(s) { return s.map?.nodes?.find(n => n.key === s.currentNode) || null; }
function fightSnap(s) {
  const b = s.battle;
  if (!b) return null;
  const n = nodeOf(s);
  const names = battleEnemies(b).map(e => e.name);
  return { enemy: battleEnemies(b)[0]?.id || null, name: b.groupName || names.join('、') || '对手', act: s.act, floor: n?.step ?? null, kind: n?.kind === 'elite' || n?.kind === 'boss' ? n.kind : 'battle' };
}
const outcomeOf = s => (s.phase !== 'result' ? null : s.result === 'win' ? 'win' : 'loss');

function seenIn(s) {
  const cards = new Set(s.deck.map(c => c.id));
  const gear = new Set((s.relics || []).map(r => r.id));
  const supplies = new Set(s.supplies || []);
  const enemies = new Set();
  const b = s.battle;
  if (b) {
    if (s.phase === 'combat') for (const e of battleEnemies(b)) enemies.add(e.id);
    for (const k of ['hand', 'drawPile', 'discardPile', 'exhaustPile']) for (const c of b[k] || []) cards.add(c.id);
    for (const id of b.rewardPool || []) cards.add(id);
    for (const id of b.pendingDiscover?.options || []) cards.add(id);
    for (const id of b.rewardRelics || []) gear.add(id);
    if (b.rewardSupply) supplies.add(b.rewardSupply);
    if (b.rewardSupplyTaken) supplies.add(b.rewardSupplyTaken);
  }
  for (const item of s.shop?.cards || []) cards.add(item.id);
  for (const item of s.shop?.relics || []) gear.add(item.id);
  for (const item of s.shop?.supplies || []) supplies.add(item.id);
  for (const id of s.pendingRelics || []) gear.add(id);
  for (const id of s.bossRelic?.options || []) gear.add(id);
  for (const o of s.opening?.options || []) for (const id of o.cards || []) cards.add(id);
  for (const id of s.opening?.pick?.cards || []) cards.add(id);
  const crateEquip = s.crate?.result?.equip && Object.values(RELICS).find(r => r.name === s.crate.result.equip);
  if (crateEquip) gear.add(crateEquip.id);
  const allEnemies = ALL_ENEMIES();
  return {
    cards: [...cards].filter(id => defOf(id)),
    gear: [...gear].filter(id => RELICS[id]),
    supplies: [...supplies].filter(id => SUPPLIES[id]),
    enemies: [...enemies].filter(id => allEnemies[id])
  };
}

function runSummary(s, t) {
  const won = s.result === 'win';
  const perAct = Math.max(1, ...(s.map?.nodes || []).map(n => n.step || 0));
  const done = (s.completed || []).length;
  return {
    floors: Math.max(0, (s.act - 1) * perAct + done),
    elites: t?.elites || 0,
    bosses: Math.max(t?.bosses || 0, (s.act || 1) - 1 + (won ? 1 : 0)),
    perfect: t?.perfect || 0,
    hp: s.hp,
    gold: s.money,
    won,
    ascension: s.ascension || 0
  };
}

function runEntry(s, outcome, t) {
  const sum = runSummary(s, t);
  const now = Date.now();
  const lf = t?.lastFight;
  const at = { act: s.act, floor: nodeOf(s)?.step ?? null };
  const death = outcome === 'loss'
    ? (lf && !lf.won ? { name: lf.name, act: lf.act, floor: lf.floor, kind: lf.kind } : { name: '赛程事件', ...at })
    : outcome === 'abandon' ? { name: '主动放弃', ...at, abandon: true } : null;
  return {
    id: String(s.seed), demo: 'new', outcome, score: computeScore(sum).total, summary: sum,
    startedAt: t?.startedAt || null, endedAt: now, durationMs: t?.startedAt ? now - t.startedAt : null,
    seed: s.seed, team: TEAMS[s.team]?.name || s.team, teamId: s.team, ascension: sum.ascension, act: s.act, maxHp: s.maxHp,
    deck: s.deck.map(c => ({ id: c.id, up: !!c.up })), gear: (s.relics || []).map(r => r.id), supplies: [...(s.supplies || [])],
    death, fights: t?.fights || 0
  };
}

// Called after every saved state change.
export function trackNewRun(s) {
  if (!s || !s.seed) return;
  try {
    const inCombat = s.phase === 'combat' && !!s.battle;
    const t = trackStep(loadTracker(store, TRACK_KEY, s.seed), { seed: s.seed, phase: s.phase, hp: s.hp, inCombat, fight: inCombat ? fightSnap(s) : null, outcome: outcomeOf(s) });
    saveTracker(store, TRACK_KEY, t);
    markSeen(store, SEEN_KEY, seenIn(s));
    if (s.phase === 'result') recordRun(store, HISTORY_KEY, runEntry(s, outcomeOf(s), t));
  } catch {}
}

// Abandoning (or starting over on top of) an unfinished run. Returns the entry.
export function recordNewAbandon(s) {
  if (!s || s.phase === 'result') return null;
  try {
    const entry = runEntry(s, 'abandon', loadTracker(store, TRACK_KEY, s.seed));
    recordRun(store, HISTORY_KEY, entry);
    return loadHistory(store, HISTORY_KEY).find(e => e.id === entry.id) || entry;
  } catch { return null; }
}

export function entryFor(s) {
  const id = String(s.seed);
  return loadHistory(store, HISTORY_KEY).find(e => e.id === id) || runEntry(s, outcomeOf(s), loadTracker(store, TRACK_KEY, s.seed));
}

// ---- results / history ----
function deathText(e) {
  const d = e.death;
  if (!d) return e.outcome === 'win' ? '无（三幕通关）' : '—';
  const where = d.floor != null ? `第 ${d.act} 幕第 ${d.floor} 层` : `第 ${d.act} 幕`;
  return d.abandon ? `主动放弃 · ${where}` : `${d.name} · ${where}`;
}
function scoreTable(e) {
  const sc = computeScore(e.summary || {});
  return `<table class="rm-score"><thead><tr><th>项目</th><th>数量</th><th>分值</th><th>得分</th></tr></thead><tbody>${sc.lines.map(l => `<tr class="${l.points ? '' : 'rm-zero'}"><th title="${esc(l.rule)}">${esc(l.label)}</th><td>${l.key === 'gold' ? `${l.raw}（${l.count} 组）` : l.count}</td><td>×${l.each}</td><td>${l.points}</td></tr>`).join('')}<tr class="rm-sub"><th>小计</th><td></td><td></td><td>${sc.subtotal}</td></tr><tr class="rm-sub"><th>难度加成</th><td>难度 ${sc.ascension}</td><td>×${sc.percent}%</td><td></td></tr><tr class="rm-total"><th>总分</th><td></td><td></td><td>${sc.total}</td></tr></tbody></table><p class="rm-formula"><b>计分规则</b>${esc(scoreFormulaText())}</p>`;
}
export function entryDetail(e) {
  const counts = new Map();
  for (const c of e.deck || []) { if (!defOf(c.id)) continue; const k = c.id + (c.up ? '+' : ''); counts.set(k, { c, n: (counts.get(k)?.n || 0) + 1 }); }
  const deck = [...counts.values()].sort((a, b) => (costOf(a.c) ?? 9) - (costOf(b.c) ?? 9) || defOf(a.c.id).name.localeCompare(defOf(b.c.id).name, 'zh-Hans-CN'))
    .map(({ c, n }) => `<span class="rm-deck-chip${c.up ? ' up' : ''}" data-card-id="${esc(c.id)}" data-card-up="${c.up}" tabindex="0"><b>${costOf(c) ?? '—'}</b>${esc(defOf(c.id).name)}${c.up ? '+' : ''}${n > 1 ? `<small>×${n}</small>` : ''}</span>`).join('');
  const gear = (e.gear || []).filter(id => RELICS[id]).map(id => `<span class="rm-gear-chip" title="${esc(RELICS[id].desc)}">${esc(RELICS[id].name)}</span>`).join('') || '<span class="rm-muted">无</span>';
  const sm = e.summary || {};
  const facts = [['结果', OUTCOME[e.outcome]], ['队伍', e.team], ['难度', e.ascension ?? 0], ['推进', `第 ${e.act} 幕 · 完成 ${sm.floors ?? 0} 个节点`], [e.outcome === 'abandon' ? '结束位置' : '出局原因', deathText(e)], ['剩余生命', `${sm.hp ?? 0} / ${e.maxHp ?? '?'}`], ['金币', sm.gold ?? 0], ['战斗', `胜 ${e.fights ?? 0} 场 · 强敌 ${sm.elites ?? 0} · 无伤 ${sm.perfect ?? 0}`], ['用时', e.durationMs != null ? formatDuration(e.durationMs) : '未记录'], ['结束时间', e.endedAt ? new Date(e.endedAt).toLocaleString('zh-CN', { hour12: false }) : '—'], ['种子', e.seed]];
  return `<div class="rm-detail"><dl class="rm-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${scoreTable(e)}<h3 class="rm-h">最终牌组 · ${(e.deck || []).length} 张</h3><div class="rm-deck-list">${deck || '<span class="rm-muted">无</span>'}</div><h3 class="rm-h">装备</h3><div class="rm-gear-list">${gear}</div></div>`;
}

// Results page for a finished (or abandoned) run.
export function resultPageHtml(e, extra = '') {
  const title = e.outcome === 'win' ? '三幕通关' : e.outcome === 'abandon' ? '本局已放弃' : '队伍出局';
  return `<div class="phase-container rm-result rm-${e.outcome}">
    <div class="ops-eyebrow">DEBRIEF // 赛季结算</div>
    <h2 class="ops-title">${title}</h2>
    ${extra}
    <div class="rm-score-big"><span>本局得分</span><strong>${e.score}</strong></div>
    ${entryDetail(e)}
    <div class="rm-actions"><button class="btn primary" id="rm-again">再来一局</button><button class="btn" id="rm-deck">查看最终牌组</button><button class="btn" id="rm-history">查看战绩</button><button class="btn" id="rm-home">返回首页</button></div>
  </div>`;
}

// ---- modal ----
export function openModal(id, title, body, bind) {
  const root = document.getElementById('modal-root');
  const previousFocus = document.activeElement;
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  function close() { root.innerHTML = ''; document.removeEventListener('keydown', onKey); hidePeek(); previousFocus?.focus?.(); }
  root.innerHTML = `<div class="modal-overlay" id="${id}"><div class="modal rm-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-header"><h2>${esc(title)}</h2><button class="btn" data-rm-close>关闭</button></div><div class="rm-modal-body">${body}</div></div></div>`;
  const overlay = root.querySelector('.modal-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  root.querySelector('[data-rm-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  root.querySelector('[data-rm-close]').focus({ preventScroll: true });
  bind?.(root, close);
  return close;
}

export function openHistory() {
  const list = loadHistory(store, HISTORY_KEY);
  const best = list.reduce((m, e) => Math.max(m, e.score || 0), 0);
  const body = list.length
    ? `<p class="rm-note">最近 ${list.length} 局（最多保存 30 局，只存在本机浏览器）。最高分 <b>${best}</b>。点开一行查看详情。</p><div class="rm-history">${list.map(e => `<details class="rm-run rm-${e.outcome}"><summary><b class="rm-outcome">${OUTCOME[e.outcome]}</b><span class="rm-team">${esc(e.team)} · 难度 ${e.ascension ?? 0}</span><span class="rm-where">第 ${e.act} 幕 · ${e.summary?.floors ?? 0} 节点</span><strong class="rm-pts">${e.score} 分</strong><time>${e.endedAt ? new Date(e.endedAt).toLocaleDateString('zh-CN') : ''}</time></summary>${entryDetail(e)}</details>`).join('')}</div>`
    : '<p class="rm-note">还没有结束的对局。通关、出局或放弃一局后，会在这里留下记录。</p>';
  openModal('history-overlay', '战绩', body);
}

// ---- deck / pile viewer ----
const PILES = { deck: '牌组', drawPile: '抽牌堆', discardPile: '弃牌堆', exhaustPile: '消耗堆' };
const NOTES = { deck: '当前牌组的全部卡牌。悬停或长按一张牌，可在旁边看到升级后的版本。', drawPile: '抽牌堆按所选方式排序展示，不代表实际抽牌顺序。', discardPile: '抽牌堆用完时，弃牌堆会洗成新的抽牌堆。', exhaustPile: '本场已消耗的牌，战斗结束后回到牌组。' };
// cards: explicit list (e.g. a finished run's deck) instead of reading from the state.
export function openDeckViewer(state, source = 'deck', cards = null) {
  const inCombat = !cards && state?.phase === 'combat' && state.battle;
  const listFor = src => cards || (src === 'deck' ? state.deck : inCombat ? state.battle[src] || [] : []);
  const view = { source: PILES[source] ? source : 'deck', type: '', cost: '', sort: source === 'drawPile' ? 'type' : 'acquired' };
  const body = () => {
    const all = listFor(view.source);
    const shown = filterSortCards(all, view, { typeOf, costOf, nameOf: c => defOf(c.id)?.name || c.id, orderOf: c => TYPE_ORDER.indexOf(typeOf(c)) });
    const chip = (label, attr, on) => `<button class="rm-chip${on ? ' active' : ''}" ${attr} aria-pressed="${on}">${esc(label)}</button>`;
    const types = TYPE_ORDER.filter(t => all.some(c => typeOf(c) === t));
    const sorts = Object.entries(SORT_LABELS).filter(([k]) => !(view.source === 'drawPile' && k === 'acquired'));
    const piles = inCombat ? `<div class="rm-row rm-piles">${Object.entries(PILES).map(([k, l]) => chip(`${l} ${listFor(k).length}`, `data-dv-src="${k}"`, view.source === k)).join('')}</div>` : '';
    return `${piles}<p class="rm-note">${NOTES[view.source]}</p><div class="rm-viewer-controls">
      <div class="rm-row"><span>类型</span>${chip('全部', 'data-dv-type=""', !view.type)}${types.map(t => chip(`${TYPE_LABEL[t]} ${all.filter(c => typeOf(c) === t).length}`, `data-dv-type="${t}"`, view.type === t)).join('')}</div>
      <div class="rm-row"><span>费用</span>${COST_FILTERS.map(([k, l]) => chip(l, `data-dv-cost="${k}"`, view.cost === k)).join('')}</div>
      <div class="rm-row"><span>排序</span>${sorts.map(([k, l]) => chip(l, `data-dv-sort="${k}"`, view.sort === k)).join('')}</div></div>
      <p class="rm-count">显示 ${shown.length} / ${all.length} 张</p>
      <div class="pile-grid rm-grid">${shown.map(c => `<div class="pile-card tc-slot">${cardFace(c.id, { up: c.up })}</div>`).join('') || '<div class="library-empty">没有符合条件的牌</div>'}</div>`;
  };
  const title = () => `${PILES[view.source]} · ${listFor(view.source).length} 张`;
  openModal('deck-overlay', title(), body(), function bind(root) {
    root.querySelector('.rm-modal-body').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.dvSrc !== undefined) { view.source = b.dataset.dvSrc; view.type = ''; view.cost = ''; view.sort = view.source === 'drawPile' ? 'type' : 'acquired'; }
      else if (b.dataset.dvType !== undefined) view.type = b.dataset.dvType;
      else if (b.dataset.dvCost !== undefined) view.cost = b.dataset.dvCost;
      else if (b.dataset.dvSort !== undefined) view.sort = b.dataset.dvSort;
      else return;
      root.querySelector('.rm-modal-body').innerHTML = body();
      root.querySelector('.modal-header h2').textContent = title();
    });
  });
}

// ---- collection (图鉴) ----
export function collection() {
  const c = loadCollection(store, SEEN_KEY);
  return { cards: new Set(c.cards), gear: new Set(c.gear), supplies: new Set(c.supplies), enemies: new Set(c.enemies) };
}
export function foundText(set, ids) { return `${ids.filter(id => set.has(id)).length}/${ids.length}`; }
export function unseenTileHtml(kind = 'card') {
  return `<div class="rm-unseen rm-unseen-${kind}" aria-label="未发现"><span class="rm-q">？</span><small>未发现</small></div>`;
}
export function enemyTileHtml(id, seen) {
  if (!seen) return unseenTileHtml('enemy');
  const e = ALL_ENEMIES()[id];
  return `<div class="library-card rm-enemy"><div class="rm-enemy-art">${combatArt(id, 'enemy')}</div><div class="name">${esc(e.name)}</div><div class="meta">${e.boss ? '幕末决战' : e.elite ? '强敌' : '对手'} · 生命 ${e.hp}</div></div>`;
}
export function gearTile(id, seen) { return seen ? equipTileHtml(id) : unseenTileHtml('gear'); }

// ---- upgraded version beside a hovered / long-pressed card ----
let peekEl = null;
let peekFor = null;
function hidePeek() { if (peekEl) peekEl.hidden = true; peekFor = null; }
function showPeek(el) {
  const id = el.dataset.cardId;
  const def = CARDS[id];
  if (!def || el.dataset.cardUp === 'true' || !def.upgradeText || el.closest('.rm-peek')) return;
  if (!peekEl) { peekEl = document.createElement('aside'); peekEl.className = 'rm-peek'; peekEl.setAttribute('aria-hidden', 'true'); document.body.append(peekEl); }
  peekFor = el;
  peekEl.innerHTML = `<small>升级后</small>${cardFace(id, { up: true })}`;
  peekEl.hidden = false;
  const r = el.getBoundingClientRect();
  const w = Math.max(140, Math.min(200, r.width || 160));
  peekEl.style.width = `${w}px`;
  const h = peekEl.offsetHeight;
  let x = r.right + 10;
  if (x + w > innerWidth - 8) x = r.left - w - 10;
  let y = r.top + (r.height - h) / 2;
  if (x < 8) { x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)); y = r.top - h - 10; if (y < 8) y = r.bottom + 10; }
  peekEl.style.left = `${Math.round(x)}px`;
  peekEl.style.top = `${Math.round(Math.max(8, Math.min(y, innerHeight - h - 8)))}px`;
}
export function initUpgradePeek() {
  let timer = null;
  let held = false;
  const target = e => (e.target instanceof Element ? e.target.closest('[data-card-id]') : null);
  document.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    const el = target(e);
    if (el && el !== peekFor && !el.closest('.dragging-card')) { clearTimeout(timer); timer = setTimeout(() => el.isConnected && el.matches(':hover') && showPeek(el), 1000); }
  });
  // Close when the pointer has left the card or the card was re-rendered away.
  const stalePeek = () => peekFor && !held && (!peekFor.isConnected || !peekFor.matches(':hover'));
  document.addEventListener('pointermove', e => { if (e.pointerType !== 'touch' && stalePeek()) hidePeek(); }, { passive: true });
  setInterval(() => { if (stalePeek() && !tapPlayMode()) hidePeek(); }, 300);
  document.addEventListener('pointerout', e => {
    const el = target(e);
    if (el && !el.contains(e.relatedTarget)) { clearTimeout(timer); if (peekFor === el) hidePeek(); }
  });
  document.addEventListener('pointerdown', e => {
    held = false;
    if (e.pointerType !== 'touch') { hidePeek(); return; }
    // Phones: the long-press sheet already shows the upgraded version.
    if (tapPlayMode()) { hidePeek(); return; }
    const el = target(e);
    if (!el) { hidePeek(); return; }
    const x = e.clientX, y = e.clientY;
    const stop = ev => {
      if (ev.type === 'pointermove' && Math.hypot(ev.clientX - x, ev.clientY - y) < 10) return;
      clearTimeout(timer);
      if (ev.type !== 'pointermove' && held) hidePeek();
      for (const t of ['pointermove', 'pointerup', 'pointercancel']) document.removeEventListener(t, stop, true);
    };
    for (const t of ['pointermove', 'pointerup', 'pointercancel']) document.addEventListener(t, stop, true);
    clearTimeout(timer);
    timer = setTimeout(() => { if (el.isConnected && !el.closest('.dragging-card') && !cardSheetOpen()) { held = true; showPeek(el); } }, 450);
  }, true);
  // The click that ends a long press only closes the peek.
  document.addEventListener('click', e => { if (held) { held = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  document.addEventListener('contextmenu', e => { if (target(e) && e.pointerType !== 'mouse') e.preventDefault(); });
  document.addEventListener('scroll', hidePeek, true);
  window.addEventListener('resize', hidePeek);
}
