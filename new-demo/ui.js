import { createRun, act, legalActions, observe, preview, describeIntent, describeIntents, battleEnemies, livingEnemies, cardNeedsTarget, cardHitsAll, categoryUpgradeQuote, shopPrice } from './engine.js';
import { CARDS, CARD_IDS, STATUS_CARDS, TEAMS, RELICS, TRAITS, FIELDS, ARCHETYPES } from './content.js';
import { statusBadges, statusBadge, statusIcon, highlightKeywords } from '/shared/status-icons.js';
import { ACTS } from './season-map.js';
import { cardArt, combatArt, relicArt } from './art.js';
import { tacticalCard } from './tactical-card.js';
import { captureCombatPresentation, animateCombatTransition, clearCombatPresentation } from './fx.js';
import { attachCardGesture } from '/shared/card-gesture.js';
import { flyCardsFromPile, flyCardsToPile } from '/shared/card-pile-motion.js';
import { soundToggleHtml } from '/shared/sfx.js';
import { juiceAction, juiceImpact, juiceSlam } from './juice-hooks.js';

const STORAGE_KEY = 'new-demo-run-route-v3';
const GUIDE_KEY = 'new-demo-guide-v2-';
// Internal beta: discard runs created with the previous route layout.
try { for (const key of ['new-demo-run-v1', 'new-demo-run-route-v2']) localStorage.removeItem(key); } catch {}
let state = null;
let previousState = null;
let selectedCardUid = null;
let showLibrary = false;
let selectedTeam = 'breach';
let noticeTimeout = null;
let presentationBusy = false;

const typeMap = { attack: '攻击', skill: '技能', power: '能力', status: '状态' };
const rarityMap = { common: '普通', uncommon: '罕见', rare: '稀有' };
const tagMap = { basic: '基础通用', damage: '交火输出', utility: '战术道具', stance: '掩护前压', core: '构筑核心', hybrid: '混搭连接', response: '应对调度', status: '特殊', burn: '燃烧', deploy: '部署', combo: '连击', fortify: '布防', overload: '过载', execute: '处决', discover: '发现' };

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Save failed', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // basic validation
    if (!saved || saved.version !== 'new-1' || !saved.phase || !saved.map || !Array.isArray(saved.deck) || saved.deck.length === 0) return null;
    return saved;
  } catch (e) {
    return null;
  }
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

function showNotice(msg) {
  const notice = document.createElement('div');
  notice.className = 'notice';
  notice.setAttribute('aria-live', 'assertive');
  notice.textContent = msg;
  document.body.appendChild(notice);
  if (noticeTimeout) clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => notice.remove(), 3000);
}

function getCardDefinition(id) {
  return CARDS[id] || STATUS_CARDS[id];
}

function getCardDisplay(card, up = false) {
  const def = getCardDefinition(card.id);
  if (!def) return null;
  const text = up && def.upgradeText ? def.upgradeText : def.text;
  return {
    id: card.id,
    uid: card.uid,
    name: def.name,
    cost: up && def.upgradeCost !== undefined ? def.upgradeCost : def.cost,
    type: def.type,
    tag: def.tag,
    rarity: def.rarity,
    text,
    detail: def.detail || '',
    exhaust: def.exhaust || false,
    up
  };
}

// Build-direction label shown on the card's type strip.
function tagLabel(def) {
  return tagMap[def.tag] || '';
}
function cardHtml(id, { up = false, cost, badge, extraClass } = {}) {
  const def = getCardDefinition(id);
  if (!def) return '';
  const text = up && def.upgradeText ? def.upgradeText : def.text;
  const shownCost = cost ?? (up && def.upgradeCost !== undefined ? def.upgradeCost : def.cost);
  return tacticalCard(def, { up, cost: shownCost, text: highlightKeywords(text), tagLabel: tagLabel(def), badge, extraClass });
}

function describeCardFull(card) {
  const d = getCardDisplay(card, card.up);
  if (!d) return '';
  const parts = [
    `${d.name} [${d.cost}费 ${typeMap[d.type]||d.type} ${tagMap[d.tag]||d.tag} ${rarityMap[d.rarity]||d.rarity}${d.exhaust?' 消耗':''}${d.up?' 已升级':''}]`,
    d.text
  ];
  if (d.detail) parts.push(d.detail);
  if (d.text.includes('烟雾')) parts.push('烟雾：敌方每次命中伤害减少，按层数抵消；敌方回合结束减少1层。');
  if (d.text.includes('闪光')) parts.push('闪光：敌方下一次命中伤害减少3×层数，触发后移除。');
  if (d.text.includes('压制')) parts.push('压制：攻击伤害变为原来的75%。');
  if (d.text.includes('易伤')) parts.push('易伤：受到攻击伤害变为原来的150%。');
  return parts.join('\n');
}

function guideStrip(phase, message) {
  if (localStorage.getItem(GUIDE_KEY + phase)) return '';
  const extra = phase === 'combat' ? '<span class="guide-roles">攻击＝伤害 · 技能＝布防/道具/抽牌 · 能力＝整场生效</span>' : '';
  return `<aside class="guide-strip" aria-label="新手提示"><span><strong>第一步：</strong>${message}${extra}</span><button type="button" class="guide-dismiss" aria-label="关闭新手提示">知道了 ×</button></aside>`;
}

function bindGuideStrip(root, phase) {
  root.querySelector('.guide-dismiss')?.addEventListener('click', () => {
    localStorage.setItem(GUIDE_KEY + phase, '1');
    root.querySelector('.guide-strip')?.remove();
  });
}

function renderGuideModal() {
  const modalRoot = document.getElementById('modal-root');
  modalRoot.innerHTML = `<div class="modal-overlay" id="guide-overlay"><div class="modal quick-guide" role="dialog" aria-modal="true" aria-label="玩法指南">
    <div class="modal-header"><h2>一分钟学会开赛</h2><button class="btn" id="guide-close">关闭</button></div>
    <p><strong>目标：</strong>沿赛季路线打过三幕。每场胜利挑一张牌，把初始牌组逐渐改成自己的战术组合。</p>
    <p><strong>队伍：</strong>突破擅长直接攻击；架点靠布防抵伤；道具协同用烟雾和闪光；调度靠抽牌和能量连招。新手可先选突破。</p>
    <p><strong>路线：</strong>点亮起的节点前进。⚔ 比赛、☠ 强敌、? 未知、⇄ 补给、✚ 休整、👑 幕末决赛。</p>
    <p><strong>战斗：</strong>先看敌人下一步意图，再按费用出牌。攻击造成伤害，技能负责布防、道具或抽牌，能力打出后整场生效。点牌再按执行，或拖到战场。遇到多名对手时，攻击和减益牌要点选目标（或直接拖到那名对手身上），“所有敌人”的范围牌无需目标；敌方回合每名在场对手依次行动。</p>
    <p><strong>回合：</strong>每回合通常有3能量；结束回合时没打出的手牌进入弃牌堆，消耗牌打出后本场不再抽到。布防抵消伤害，回合后清掉。前压/掩护姿态可以切换，但要花1能量。</p>
  </div></div>`;
  const overlay = modalRoot.querySelector('#guide-overlay');
  const close = () => { modalRoot.innerHTML = ''; };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  modalRoot.querySelector('#guide-close').addEventListener('click', close);
  modalRoot.querySelector('#guide-close').focus();
}

const SCREEN_KEY = 'new-demo-screen';
function rememberScreen(name) { try { sessionStorage.setItem(SCREEN_KEY, name); } catch {} }

function renderHome() {
  rememberScreen('home');
  const teamsHtml = Object.values(TEAMS).map(t => `
    <div class="team-card ${selectedTeam === t.id ? 'selected' : ''}" data-team="${t.id}" tabindex="0" role="button" aria-pressed="${selectedTeam === t.id}">
      <div class="team-art">${combatArt(t.id, 'ally')}</div>
      <div class="team-name">${escapeHtml(t.name)}${t.id === 'breach' ? '<small class="rookie-tag">推荐入门</small>' : ''}</div>
      <div class="team-desc">${escapeHtml(t.desc)}</div>
    </div>
  `).join('');

  const saved = loadState();
  const continueDisabled = !saved;

  document.getElementById('app').innerHTML = `
    <main class="new-home">
    <section class="hero-cover" aria-label="战术试炼封面">
      <img class="hero-bg" src="/new/cover.webp" alt="" />
      <div class="hero-content">
        <div class="eyebrow">原创建构 · 三幕赛程</div>
        <h1 class="hero-title">战术试炼</h1>
        <p class="hero-tagline">一支队伍，${CARD_IDS.length}种战术，三段赛程</p>
      </div>
    </section>
    <section class="home-section" id="team-selection">
      <h2 class="setup-title">选择队伍</h2>
      <p class="setup-hint">先选一套打法，再沿路线打比赛、选卡、组出自己的战术牌组。</p>
      <div class="team-select" role="radiogroup" aria-label="选择初始队伍">
        ${teamsHtml}
      </div>
      <div class="home-actions">
        <button class="btn primary" id="btn-new-secondary">确认开赛</button>
        <button class="btn" id="btn-continue" ${continueDisabled ? 'disabled' : ''}>继续上局</button>
      </div>
      <nav class="nav-links" aria-label="其他入口">
        <button class="hero-link" id="btn-guide-home">怎么玩</button>
        <button class="hero-link" id="btn-library">卡牌总览</button>
        <a href="/">选择版本</a>
      </nav>
      <footer class="credit">猪之家出品</footer>
    </section>
    </main>
  `;

  // 事件绑定
  document.querySelectorAll('.team-card').forEach(el => {
    el.addEventListener('click', () => {
      selectTeam(el.dataset.team);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectTeam(el.dataset.team);
      }
    });
  });

  function selectTeam(id) {
    selectedTeam = id;
    document.querySelectorAll('.team-card').forEach(card => {
      const active = card.dataset.team === id;
      card.classList.toggle('selected', active);
      card.setAttribute('aria-pressed', String(active));
    });
  }

  function startNewGame() {
    if (loadState()) {
      const confirmOverwrite = window.confirm('开始新局将覆盖当前存档，确定？');
      if (!confirmOverwrite) return;
    }
    try {
      const seed = crypto.randomUUID();
      state = createRun(seed, selectedTeam);
      saveState();
      selectedCardUid = null;
      renderGame();
    } catch (error) {
      console.error('Start failed', error);
      showNotice(`开赛失败：${error.message}`);
    }
  }

  function continueGame() {
    const saved = loadState();
    if (saved) {
      state = saved;
      selectedCardUid = null;
      renderGame();
    }
  }

  document.getElementById('btn-new-secondary').addEventListener('click', startNewGame);
  document.getElementById('btn-continue').addEventListener('click', continueGame);

  document.getElementById('btn-library').addEventListener('click', () => {
    showLibrary = true;
    renderLibraryModal();
  });
  document.getElementById('btn-guide-home').addEventListener('click', renderGuideModal);
}

function renderGame() {
  rememberScreen('game');
  if (!state) {
    renderHome();
    return;
  }
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="app-header">
      <div class="app-title">新demo · 战术试炼</div>
        <div class="app-buttons">
        <button class="btn" id="btn-library">卡牌总览</button>
        <button class="btn" id="btn-guide">怎么玩</button>
        <button class="btn" id="btn-home">返回首页</button>
        ${soundToggleHtml()}
      </div>
    </header>
    <div id="game-root" style="flex:1;display:flex;flex-direction:column;"></div>
  `;
  document.getElementById('btn-library').addEventListener('click', () => {
    showLibrary = true;
    renderLibraryModal();
  });
  document.getElementById('btn-guide').addEventListener('click', renderGuideModal);
  document.getElementById('btn-home').addEventListener('click', () => {
    if (presentationBusy) return;
    clearCombatPresentation();
    presentationBusy = false;
    renderHome();
  });
  renderPhase();
}

function renderPhase() {
  const root = document.getElementById('game-root');
  if (!root) return;
  root.innerHTML = '';
  if (state.phase === 'map') renderMap(root);
  else if (state.phase === 'combat') renderCombat(root);
  else if (state.phase === 'reward') renderReward(root);
  else if (state.phase === 'shop') renderShop(root);
  else if (state.phase === 'rest') renderRest(root);
  else if (state.phase === 'event') renderEvent(root);
  else if (state.phase === 'intermission') renderIntermission(root);
  else if (state.phase === 'result') renderResult(root);
  else renderHome();
}

function renderMap(root) {
  const act = ACTS[state.act - 1];
  const nodes = state.map.nodes;
  const edges = state.map.edges;
  const currentKey = state.currentNode;
  const completedSet = new Set(state.completed);
  const legal = legalActions(state).filter(a => a.type === 'enter');
  const availableKeys = new Set(legal.map(a => a.key));

  const w = 400, h = 1000;
  const scaleX = w / 100;
  const scaleY = h / 100;
  const sx = (x) => x * scaleX;
  const sy = (y) => y * scaleY;

  const edgesSvg = edges.map(e => {
    const from = nodes.find(n => n.key === e.from);
    const to = nodes.find(n => n.key === e.to);
    if (!from || !to) return '';
    return `<line class="map-edge" x1="${sx(from.x)}" y1="${sy(from.y)}" x2="${sx(to.x)}" y2="${sy(to.y)}" />`;
  }).join('');

  const nodesSvg = nodes.map(n => {
    const isAvailable = availableKeys.has(n.key);
    const isCompleted = completedSet.has(n.key) && n.key !== currentKey;
    const isCurrent = n.key === currentKey;
    const cls = `map-node kind-${n.kind} ${isAvailable ? 'available' : ''} ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`;
    const glyph = { battle: '⚔', elite: '☠', event: '?', shop: '⇄', rest: '✚', boss: '👑' }[n.kind] || '·';
    const label = n.name || { battle: '战斗', elite: '强敌', event: '事件', shop: '转会', rest: '休整', boss: 'Boss' }[n.kind] || n.kind;
    return `<g class="${cls}" data-key="${n.key}" tabindex="${isAvailable ? '0' : '-1'}" role="button" aria-label="${n.kind === 'boss' ? 'Boss：' : n.kind === 'elite' ? '强敌：' : ''}${escapeHtml(n.name)}" style="cursor:pointer">
      <circle cx="${sx(n.x)}" cy="${sy(n.y)}" r="${n.kind === 'boss' ? 24 : 18}" />
      <text class="map-glyph" x="${sx(n.x)}" y="${sy(n.y) + 1}">${glyph}</text>
      ${isAvailable ? `<text class="map-choice-label" x="${sx(n.x)}" y="${sy(n.y) - 29}">${escapeHtml(label)}</text>` : ''}
    </g>`;
  }).join('');

  root.innerHTML = `
    <div class="map-container">
      ${guideStrip('map', '先点亮起的节点开赛。向上滑动可预览后续路线和决赛；每场胜利后挑一张新牌。')}
      <div class="map-stage-info">
        <span>幕 ${state.act}：${act.name} · ${act.subtitle} · ${state.completed.filter(key => state.map.nodes.some(node => node.key === key)).length}/12 站</span>
        <span>HP ${state.hp}/${state.maxHp} · 💰 ${state.money}</span>
      </div>
      <div class="map-quick-legend" aria-label="路线图标说明">⚔ 比赛　☠ 强敌　? 事件　⇄ 补给　✚ 休整　👑 决赛</div>
      <div class="map-scroll">
        <svg class="map-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          ${edgesSvg}
          ${nodesSvg}
        </svg>
      </div>
      <div class="map-legend">
        <div class="legend-item"><span class="legend-icon">⚔</span> 常规比赛：标准战斗，获胜得卡牌奖励。</div>
        <div class="legend-item"><span class="legend-icon">☠</span> 强敌：更高难度，奖励更丰厚。</div>
        <div class="legend-item"><span class="legend-icon">?</span> 未知事件：随机事件，风险与机遇并存。</div>
        <div class="legend-item"><span class="legend-icon">⇄</span> 转会补给：购买卡牌或删除卡牌。</div>
        <div class="legend-item"><span class="legend-icon">✚</span> 休整：回复生命或升级卡牌。</div>
        <div class="legend-item"><span class="legend-icon">👑</span> BOSS：幕末强敌，击败进入下一幕。</div>
      </div>
      <div id="node-details" class="node-details" aria-live="polite"></div>
    </div>
  `;
  bindGuideStrip(root, 'map');

  const details = root.querySelector('#node-details');
  const showDetails = (node) => {
    const kindNames = { battle: '常规比赛', elite: '高压强敌', event: '未知事件', shop: '战术补给', rest: '战术休整', boss: 'BOSS' };
    const kindDesc = { battle: '标准战斗，获胜获得卡牌奖励。', elite: '更高难度，奖励更丰厚。', event: '随机事件，风险与机遇并存。', shop: '购买卡牌或删除卡牌。', rest: '回复生命或升级卡牌。', boss: '幕末强敌，击败进入下一幕。' };
    const isAvailable = availableKeys.has(node.key);
    const isCurrent = node.key === currentKey;
    const isCompleted = completedSet.has(node.key);
    let status = '';
    if (isCurrent) status = '当前所在';
    else if (isCompleted) status = '已完成';
    else if (isAvailable) status = '可进入';
    else status = '暂不可达';
    details.innerHTML = `
      <strong>${escapeHtml(node.name)}</strong>
      <span>${kindNames[node.kind] || '未知'}：${kindDesc[node.kind] || '无说明'}</span>
      <span>${status}</span>
    `;
  };

  root.querySelectorAll('.map-node').forEach(el => {
    const key = el.dataset.key;
    const node = nodes.find(n => n.key === key);
    if (!node) return;

    const handleEnter = () => {
      if (availableKeys.has(key)) {
        dispatch({ type: 'enter', key });
      }
    };

    if (availableKeys.has(key)) {
      el.addEventListener('click', handleEnter);
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleEnter();
        }
      });
    }

    el.addEventListener('mouseenter', () => showDetails(node));
    el.addEventListener('focus', () => showDetails(node));
  });

  root.querySelector('.map-scroll').addEventListener('mouseleave', () => {
    const next = nodes.find(n => availableKeys.has(n.key));
    if (next) showDetails(next);
  });

  const nextChoice = nodes.find(n => availableKeys.has(n.key));
  if (nextChoice) showDetails(nextChoice);

  // Scroll to current node if possible
  const currentEl = root.querySelector('.map-node.current, .map-node.available');
  if (currentEl) {
    const circle = currentEl.querySelector('circle');
    if (circle) {
      const cx = circle.getAttribute('cx');
      const cy = circle.getAttribute('cy');
      const scrollContainer = root.querySelector('.map-scroll');
      scrollContainer.scrollTop = cy - scrollContainer.clientHeight / 2;
      scrollContainer.scrollLeft = cx - scrollContainer.clientWidth / 2;
    }
  }
}

// A card waiting for a target: selected, affordable, aimed, and 2+ enemies alive.
function aimingCard(b, playableUids) {
  if (!selectedCardUid || !playableUids.has(selectedCardUid)) return null;
  const card = b.hand.find(c => c.uid === selectedCardUid);
  if (!card || livingEnemies(b).length < 2 || !cardNeedsTarget(card)) return null;
  return card;
}

function enemyUnitHtml(e, { intentText, aiming, isPrimary }) {
  const dead = e.hp <= 0;
  const st = e.statuses || {};
  const badges = dead ? '' : statusBadges([['block', st.block], ['strength', st.strength], ['aim', st.aim], ['burn', st.burn], ['smoke', st.smoke], ['flash', st.flash], ['weak', st.weak], ['vuln', st.vuln]]);
  const traitInfo = !dead && e.trait && TRAITS[e.trait.id];
  const traitHtml = traitInfo ? `<span class="trait-tag" tabindex="0" title="${escapeHtml(traitInfo.text(e.trait.n))}">${statusIcon(traitInfo.icon)}${escapeHtml(traitInfo.name)}${e.trait.id === 'tempo' ? ` ${e.tempoCount || 0}/${e.trait.n}` : ''}</span>` : '';
  const pct = Math.max(0, Math.min(100, e.hp / e.maxHp * 100));
  return `<div class="enemy-unit${dead ? ' is-dead' : ''}${aiming && !dead ? ' targetable' : ''}" data-enemy-uid="${escapeHtml(e.uid)}"${isPrimary ? ' id="enemy-box"' : ''} role="button" tabindex="${dead ? -1 : 0}" aria-label="${escapeHtml(e.name)}${dead ? '（已淘汰）' : ''}">
      <div class="intent">${dead ? '已淘汰' : highlightKeywords(intentText || '未知')}</div>
      <div class="fighter-figure enemy-figure${dead ? ' is-dead' : ''}" data-character-variant="${escapeHtml(e.look || e.id)}">${dead ? '' : combatArt(e.id, 'enemy')}</div>
      <div class="unit-hud enemy-hud">
        <div class="enemy-name">${escapeHtml(e.name)}</div>
        ${traitHtml}
        <div class="enemy-hp" data-hp="${e.hp}"><div class="hp-bar"><i style="width:${pct}%"></i></div><span>${e.hp}/${e.maxHp}</span></div>
        <div class="status-row" aria-label="对手状态">${badges}</div>
      </div>
    </div>`;
}

function renderCombat(root) {
  const b = state.battle;
  if (!b) return;
  const enemies = battleEnemies(b);
  const living = enemies.filter(e => e.hp > 0);
  const intents = describeIntents(state);
  const legal = legalActions(state);
  const playableUids = new Set(legal.filter(a => a.type === 'play').map(a => a.uid));
  const canStance = legal.some(a => a.type === 'stance');
  const aimCard = aimingCard(b, playableUids);
  const playerBadges = statusBadges([['strength', b.powerStacks.inflame], ['overload', b.overload], ['weak', b.statuses.player.weak], ['vuln', b.statuses.player.vuln]]);
  const turretDmg = d => d.n + 3 * (b.powerStacks.turret_core || 0);
  const deployHtml = (b.deployables || []).map(d => `<span class="deploy-chip" tabindex="0" title="${d.kind === 'turret' ? `哨戒炮：回合结束时对生命最低的敌人造成${turretDmg(d)}点伤害` : `屏障无人机：回合结束时获得${d.n}点布防`}，剩余${d.turns}回合">${statusIcon(d.kind === 'turret' ? 'sentry' : 'block')}<b>${d.kind === 'turret' ? turretDmg(d) : d.n}</b><small>×${d.turns}</small></span>`).join('');
  const discoverHtml = b.pendingDiscover ? `<div class="discover-overlay" role="dialog" aria-label="发现一张牌"><div class="discover-panel"><h3>${statusIcon('discover')} 发现：选一张加入手牌</h3><p>本回合 0 费，打出后消耗。</p><div class="discover-options">${b.pendingDiscover.options.map(id => `<button class="discover-card tc-pick" data-discover="${id}">${cardHtml(id, { cost: 0, badge: '本回合 0 费' })}</button>`).join('')}</div></div></div>` : '';
  const field = b.field && FIELDS[b.field];
  const fieldHtml = field ? `<span class="battlefield-tag" tabindex="0" title="${escapeHtml(field.text)}">战场：<b>${escapeHtml(field.name)}</b> · ${escapeHtml(field.text)}</span>` : '';
  const allyArt = combatArt(state.team, 'ally');
  const handHtml = b.hand.map((card, idx) => {
    const display = getCardDisplay(card, card.up);
    if (!display) return '';
    const isSelected = selectedCardUid === card.uid;
    const isPlayable = playableUids.has(card.uid);
    const tooltip = describeCardFull(card);
    const offset = idx - (b.hand.length - 1) / 2;
    return `<div class="hand-card shared-card role-${escapeHtml(display.type)} ${isSelected ? 'selected' : ''} ${isPlayable ? '' : 'not-playable'}" data-uid="${card.uid}" data-index="${idx}" tabindex="0" role="button" aria-label="${escapeHtml(display.name)}" data-tooltip="${escapeHtml(tooltip)}" style="--offset:${offset};--tilt:${offset * (b.hand.length > 6 ? 1.6 : 3)}deg;--bend:${Math.abs(offset) * Math.abs(offset) * 1.8}px;--order:${idx}">
      ${cardHtml(card.id, { up: card.up, cost: card.free ? 0 : display.cost, badge: card.temp ? '临时' : '' })}
    </div>`;
  }).join('');

  let hintHtml = '';
  if (aimCard) hintHtml = `<div class="arena-hint aiming-hint">选择目标：点击一名敌人打出「${escapeHtml(getCardDisplay(aimCard, aimCard.up).name)}」</div>`;
  else if (selectedCardUid) {
    const card = b.hand.find(c => c.uid === selectedCardUid);
    if (card) hintHtml = `<div class="arena-hint preview-panel">${escapeHtml(describeCardFull(card))}</div>`;
  }
  const firstLiving = living[0]?.uid;

  root.innerHTML = `
    ${guideStrip('combat', living.length > 1 ? '这是多人对局：攻击和减益要先选目标。点牌后点击敌人，或直接把牌拖到那名敌人身上；范围牌无需目标。' : '先看对手意图，再看手牌费用和效果。点牌后“执行战术”，或把牌拖向战场；不想再出牌就结束回合。')}
    <div class="battle arena${aimCard ? ' aiming' : ''}" data-enemies="${enemies.length}" data-presentation-busy="${presentationBusy}">
      <div class="arena-top">
        <div class="arena-turn"><b>第 ${b.turn} 回合</b>${b.groupName ? `<span>${escapeHtml(b.groupName)} · ${living.length}/${enemies.length} 名在场</span>` : ''}</div>
        ${fieldHtml}
        ${hintHtml}
      </div>
      <div class="arena-floor">
        <section class="ally-zone" aria-label="我方">
          <div class="ally-unit">
            <div class="status-row ally-status" aria-label="我方状态">${playerBadges}${deployHtml ? `<span class="deploy-row" aria-label="已部署">${deployHtml}</span>` : ''}</div>
            <div class="fighter-figure ally-figure">${allyArt}</div>
          </div>
          <div class="ally-hud" id="player-box">
            <div class="energy-orb" title="能量"><b>${b.energy}</b><small>/3</small></div>
            <div class="ally-vitals">
              <div class="hp-line"><span class="value">HP ${state.hp}/${state.maxHp}</span><div class="hp-bar"><i style="width:${state.hp / state.maxHp * 100}%"></i></div></div>
              <div class="block-value" data-block="${b.playerBlock}"><span class="mini-armor" aria-hidden="true"></span><span>布防 ${b.playerBlock}</span></div>
            </div>
            <div class="stance-chip">
              <div class="stance-name" title="${b.stance === 'cover' ? '掩护：每回合第一次布防+3' : '前压：每回合第一次攻击+3，但每次受到攻击+2'}">${b.stance === 'cover' ? '掩护' : '前压'}<small>${b.stance === 'cover' ? '首次布防+3' : '首攻+3 · 受击+2'}</small></div>
              <button class="btn" id="btn-stance" ${canStance ? '' : 'disabled'} title="切换姿态：1费，每回合一次">${b.stanceSwitchUsedThisTurn ? '已切换' : '切换 1费'}</button>
            </div>
          </div>
        </section>
        <section class="enemy-zone" aria-label="对手" data-count="${enemies.length}">
          ${enemies.map(e => enemyUnitHtml(e, { intentText: intents[e.uid], aiming: !!aimCard, isPrimary: e.uid === firstLiving })).join('')}
        </section>
      </div>
      <div class="arena-hud">
        <div class="hud-left">
          <button class="pile-btn" data-pile="draw" id="pile-draw"><b>${b.drawPile.length}</b><span>抽牌堆</span></button>
        </div>
        <div class="hand-area" id="hand-area" role="list" style="--slots:${Math.max(1, b.hand.length)}">
          ${handHtml}
        </div>
        <div class="hud-right">
          <div class="ops-actions">
            <button class="btn primary" id="btn-play" ${selectedCardUid && playableUids.has(selectedCardUid) ? '' : 'disabled'}>${aimCard ? '选择目标' : '执行战术'}</button>
            <button class="btn" id="btn-end">结束回合 <small>E</small></button>
          </div>
          <div class="hud-piles">
            <button class="pile-btn" data-pile="discard" id="pile-discard"><b>${b.discardPile.length}</b><span>弃牌堆</span></button>
            <button class="pile-btn" data-pile="exhaust" id="pile-exhaust"><b>${b.exhaustPile.length}</b><span>消耗堆</span></button>
          </div>
        </div>
      </div>
    </div>
    ${discoverHtml}
  `;
  root.querySelectorAll('[data-discover]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'discover', id: el.dataset.discover })));
  bindGuideStrip(root, 'combat');

  const needsPick = card => card && living.length > 1 && cardNeedsTarget(card);
  const selectedCard = () => b.hand.find(c => c.uid === selectedCardUid);
  // Play the selected card; `target` is an enemy uid or null.
  const playSelected = target => {
    const card = selectedCard();
    if (!card || !playableUids.has(card.uid) || presentationBusy) return false;
    if (needsPick(card) && !target) { showNotice('这张牌需要目标：点击一名敌人'); return false; }
    return dispatch(target && cardNeedsTarget(card) ? { type: 'play', uid: card.uid, target } : { type: 'play', uid: card.uid });
  };

  root.querySelectorAll('.enemy-unit:not(.is-dead)').forEach(unit => {
    const fire = () => { if (selectedCardUid) playSelected(unit.dataset.enemyUid); };
    unit.addEventListener('click', fire);
    unit.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); fire(); } });
  });
  root.querySelector('.ally-zone').addEventListener('click', event => {
    if (event.target.closest('button')) return;
    if (selectedCardUid) playSelected(null);
  });

  document.getElementById('btn-play').addEventListener('click', () => playSelected(null));
  document.getElementById('btn-end').addEventListener('click', () => { if (!presentationBusy) dispatch({ type: 'end' }); });
  document.getElementById('btn-stance').addEventListener('click', () => {
    if (canStance && !presentationBusy) dispatch({ type: 'stance' });
  });

  root.querySelectorAll('.pile-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (presentationBusy) return;
      showPileModal(btn.dataset.pile);
    });
  });

  // Selection stays game-specific; dragging uses the same full-card gesture as Wa.
  const select = uid => {
    const handScroll = root.querySelector('#hand-area')?.scrollLeft || 0;
    selectedCardUid = uid;
    renderCombat(root);
    root.querySelector('#hand-area').scrollLeft = handScroll;
  };
  root.querySelectorAll('.hand-card.shared-card').forEach(el => {
    el.addEventListener('click', () => { if (!presentationBusy) select(el.dataset.uid); });
    el.addEventListener('keydown', event => {
      if (presentationBusy || !['Enter',' '].includes(event.key)) return;
      event.preventDefault();event.stopPropagation();
      select(el.dataset.uid);
    });
  });
  const hand = root.querySelector('#hand-area');
  const battleEl = root.querySelector('.battle');
  const clearDrop = () => root.querySelectorAll('.drop-ready').forEach(el => el.classList.remove('drop-ready'));
  // One living enemy: like Slay the Spire, releasing a dragged card anywhere
  // above the hand plays it. Two or more: aimed cards must land on an enemy.
  const targetsEnemy = card => cardNeedsTarget(card) || cardHitsAll(card) || CARDS[card.id]?.type === 'attack';
  const unitAt = point => document.elementFromPoint(point.x, point.y)?.closest('.enemy-unit:not(.is-dead)') || null;
  const zoneAt = (point, card) => {
    if (needsPick(card)) return unitAt(point);
    const handTop = hand.getBoundingClientRect().top;
    if (point.y > handTop - 10 || point.startY - point.y < 60) return null;
    return targetsEnemy(card) ? root.querySelector('.enemy-zone') : root.querySelector('.ally-zone');
  };
  attachCardGesture(hand, {
    getCard: el => b.hand.find(card => card.uid === el.dataset.uid),
    canDrag: card => !presentationBusy && playableUids.has(card.uid),
    onStart: (card, el) => {
      selectedCardUid = card.uid; el.classList.add('selected');
      if (needsPick(card)) { battleEl.classList.add('aiming'); root.querySelectorAll('.enemy-unit:not(.is-dead)').forEach(u => u.classList.add('targetable')); }
    },
    onMove: (card, point) => { clearDrop(); zoneAt(point, card)?.classList.add('drop-ready'); },
    onDrop: (card, point) => {
      const zone = zoneAt(point, card); clearDrop();
      if (!zone || presentationBusy || !playableUids.has(card.uid)) return false;
      selectedCardUid = card.uid;
      const target = zone.dataset.enemyUid;
      return dispatch(target && cardNeedsTarget(card) ? { type: 'play', uid: card.uid, target } : { type: 'play', uid: card.uid });
    },
    onEnd: (card, point, landed) => {
      clearDrop();
      if (!landed && !aimCard) { battleEl.classList.remove('aiming'); root.querySelectorAll('.enemy-unit.targetable').forEach(u => u.classList.remove('targetable')); }
    },
  });
}

function showPileModal(kind) {
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot.querySelector('#pile-overlay')) return;
  let pile;
  if (kind === 'draw') pile = state.battle.drawPile;
  else if (kind === 'discard') pile = state.battle.discardPile;
  else if (kind === 'exhaust') pile = state.battle.exhaustPile;
  else return;
  const sortedPile = kind === 'draw' ? [...pile].sort((a,b) => a.id.localeCompare(b.id)) : pile;
  const cardsHtml = sortedPile.map(card => {
    const display = getCardDisplay(card, card.up);
    if (!display) return '';
    return `<div class="pile-card tc-slot">${cardHtml(card.id, { up: card.up })}</div>`;
  }).join('');
  const previousFocus = document.activeElement;
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePile();
    }
  };
  const closePile = () => {
    modalRoot.innerHTML = '';
    document.removeEventListener('keydown', handleKeydown);
    if (previousFocus) previousFocus.focus();
  };
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="pile-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>${kind === 'draw' ? '抽牌堆' : kind === 'discard' ? '弃牌堆' : '消耗堆'}</h2>
          <button class="btn" id="close-pile">关闭</button>
        </div>
        <div class="pile-grid">${cardsHtml || '<div class="library-empty">空</div>'}</div>
        ${kind === 'draw' ? '<p style="font-size:0.8rem;opacity:0.7;text-align:center;">按名称展示，不代表抽牌顺序</p>' : ''}
      </div>
    </div>
  `;
  document.getElementById('close-pile').addEventListener('click', closePile);
  document.getElementById('pile-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePile();
  });
  document.addEventListener('keydown', handleKeydown);
  document.getElementById('close-pile').focus();
}

function combatKeyHandler(e) {
  if (state?.phase !== 'combat') return;
  if (e.target.matches('input, textarea, select')) return;
  if (e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key) - 1;
    if (state.battle.hand[idx]) {
      selectedCardUid = state.battle.hand[idx].uid;
      renderCombat(document.getElementById('game-root'));
    }
  } else if (e.key === '0') {
    const idx = 9;
    if (state.battle.hand[idx]) {
      selectedCardUid = state.battle.hand[idx].uid;
      renderCombat(document.getElementById('game-root'));
    }
  } else if (e.key === 'Enter') {
    if (e.target.closest?.('.enemy-unit, .hand-card, button')) return;
    e.preventDefault();
    const legal = legalActions(state);
    const playableUids = new Set(legal.filter(a => a.type === 'play').map(a => a.uid));
    if (selectedCardUid && playableUids.has(selectedCardUid)) {
      if (aimingCard(state.battle, playableUids)) showNotice('这张牌需要目标：点击一名敌人');
      else dispatch({ type: 'play', uid: selectedCardUid });
    }
  } else if (e.key.toLowerCase() === 'e') {
    dispatch({ type: 'end' });
  }
}

function renderReward(root) {
  const b = state.battle;
  if (!b) return;
  const cards = b.rewardPool || [];
  const rewardHtml = cards.map(id => {
    const def = CARDS[id];
    if (!def) return '';
    return `<button class="reward-card tc-pick" data-id="${id}" aria-label="选择 ${escapeHtml(def.name)}">${cardHtml(id)}</button>`;
  }).join('');
  root.innerHTML = `
    <div class="phase-container">
      <div class="ops-eyebrow">DEBRIEF // 战后简报</div>
      <h2 class="ops-title">补充战术 · 三选一</h2>

      <div class="reward-cards">
        ${rewardHtml}
      </div>
      <button class="btn ops-skip" id="btn-skip">跳过，不加入新牌</button>
    </div>
  `;
  document.querySelectorAll('.reward-card').forEach(el => {
    el.addEventListener('click', () => dispatch({ type: 'reward', id: el.dataset.id }));
  });
  document.getElementById('btn-skip').addEventListener('click', () => dispatch({ type: 'reward', id: null }));
}

// The quartermaster's line depends on what the player can afford right now.
function quartermasterLine(shop) {
  const cheapest = Math.min(...shop.cards.map(shopPrice), Infinity);
  const sale = shop.cards.find(item => item.sale);
  const lines = state.money < 50
    ? ['手头紧？删掉一张基础牌也是变强，牌组越精越好抽到王牌。', '钱不够没关系，先看看柜台的服务。']
    : state.money >= 150
      ? ['大客户来了，货都在架子上。', '预算充足？随便挑。']
      : [sale ? `今天「${CARDS[sale.id]?.name}」半价，错过就没了。` : '都是刚到的货。', '慢慢看，不催你。', `最便宜的只要 ${cheapest} 金币。`];
  return lines[state.rev % lines.length];
}

function renderShop(root) {
  const shop = state.shop;
  const rarityName = { common: '普通', uncommon: '罕见', rare: '稀有' };
  const shopCards = shop.cards.map((item, idx) => {
    const def = CARDS[item.id];
    if (!def) return '';
    const cost = shopPrice(item);
    const canBuy = state.money >= cost;
    return `<div class="shop-card shelf-item rarity-${def.rarity}${item.sale ? ' on-sale' : ''}">
      <div class="price-tag">${item.sale ? `<s>${priceOf(item.id)}</s>` : ''}<b>${cost}</b><span>金币</span></div>
      ${item.sale ? '<div class="sale-ribbon">今日半价</div>' : ''}
      ${cardHtml(item.id)}
      <button class="btn" data-buy-index="${idx}" ${canBuy ? '' : 'disabled'}>${canBuy ? '买下' : '金币不足'}</button>
    </div>`;
  }).join('') || '<p class="shelf-empty">货架已经被你买空了。</p>';
  const rmCost = removePrice(state);
  const upgradeServices = ['attack', 'skill'].map(category => {
    const quote = categoryUpgradeQuote(state, category);
    const label = category === 'attack' ? '攻击牌' : '技能牌';
    const disabled = quote.used || quote.count === 0 || state.money < quote.price;
    return `<div class="upgrade-service"><strong>${label}</strong><span>${quote.count ? `${quote.count}张可升级 · ${quote.price}金币` : '暂无可升级牌'}</span><button class="btn" data-upgrade-category="${category}" ${disabled ? 'disabled' : ''}>${quote.used ? '本店已升级' : '升级这一类'}</button></div>`;
  }).join('');
  const deckItems = state.deck.map(c => {
    const def = getCardDefinition(c.id);
    if (!def) return '';
    const canRemove = state.money >= rmCost;
    return `<div class="deck-item">
      <div class="deck-item-art">${cardArt(c.id)}</div>
      <span>${escapeHtml(def.name)}${c.up ? ' (升级)' : ''}</span>
      <button class="btn" data-remove-uid="${c.uid}" ${canRemove ? '' : 'disabled'}>删除 (${rmCost}💰)</button>
    </div>`;
  }).join('');
  root.innerHTML = `
    <div class="phase-container shop-scene">
      <div class="shop-header">
        <div class="npc-booth">
          <div class="npc-stage" data-npc="quartermaster" aria-hidden="true"></div>
          <div class="npc-info">
            <div class="npc-name">军需官 · 老周 <small>战术补给站</small></div>
            <div class="npc-bubble">${escapeHtml(quartermasterLine(shop))}</div>
          </div>
        </div>
        <div class="shop-wallet"><span>你的金币</span><b>${state.money}</b></div>
      </div>
      <h3 class="shelf-title">补给货架</h3>
      <div class="shop-shelf">${shopCards}</div>
      <div class="shop-counter">
        <section class="counter-service">
          <h4>战术训练 · 选一类永久升级</h4>
          <p>每次到店只能选一次；升级会保留到后续比赛。</p>
          <div class="upgrade-services">${upgradeServices}</div>
        </section>
        <details class="counter-service remove-service">
          <summary><h4>精简牌组 · 删一张牌（${rmCost} 金币）</h4><span>展开牌组</span></summary>
          <div class="deck-list">${deckItems}</div>
        </details>
      </div>
      <button class="btn primary shop-leave" id="btn-leave">离开补给站，继续赛程 →</button>
    </div>
  `;
  document.querySelectorAll('[data-buy-index]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.buyIndex);
      dispatch({ type: 'buy', index: idx, id: shop.cards[idx].id });
    });
  });
  document.querySelectorAll('[data-upgrade-category]').forEach(el => {
    el.addEventListener('click', () => dispatch({type:'upgradeCategory', category:el.dataset.upgradeCategory}));
  });
  document.querySelectorAll('[data-remove-uid]').forEach(el => {
    el.addEventListener('click', () => {
      dispatch({ type: 'remove', uid: el.dataset.removeUid });
    });
  });
  document.getElementById('btn-leave').addEventListener('click', () => dispatch({ type: 'leave' }));
}

function renderRest(root) {
  const upgradeable = state.deck.filter(c => !c.up && getCardDefinition(c.id)?.upgradeEffects?.length);
  let upgradeListHtml = '';
  if (upgradeable.length) {
    upgradeListHtml = `<div class="deck-list">` + upgradeable.map(c => {
      const def = getCardDefinition(c.id);
      return `<div class="deck-item">
        <div class="deck-item-art">${cardArt(c.id)}</div>
        <span>${escapeHtml(def.name)}</span>
        <button class="btn" data-upgrade-uid="${c.uid}">升级</button>
      </div>`;
    }).join('') + `</div>`;
  } else {
    upgradeListHtml = '<p>没有可升级的卡牌</p>';
  }
  root.innerHTML = `
    <div class="phase-container">
      <h2>休整</h2>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;">
        <div class="rest-option" id="rest-heal">
          <div class="card-title">回复生命</div>
          <div class="card-desc">恢复最大生命的30%（${Math.floor(state.maxHp * 0.3)}点）</div>
        </div>
        <div class="rest-option" id="rest-upgrade">
          <div class="card-title">升级卡牌</div>
          <div class="card-desc">选择一张可升级的卡牌</div>
        </div>
        <div class="rest-option" id="rest-maxhp">
          <div class="card-title">提升上限</div>
          <div class="card-desc">最大生命+8，并回复8点生命</div>
        </div>
      </div>
      <div id="upgrade-panel" style="display:none;width:100%;max-width:400px;">
        ${upgradeListHtml}
      </div>
    </div>
  `;
  document.getElementById('rest-heal').addEventListener('click', () => dispatch({ type: 'rest', choice: 'heal' }));
  document.getElementById('rest-upgrade').addEventListener('click', () => {
    document.getElementById('upgrade-panel').style.display = 'block';
  });
  document.getElementById('rest-maxhp').addEventListener('click', () => dispatch({ type: 'rest', choice: 'maxHp' }));
  document.querySelectorAll('[data-upgrade-uid]').forEach(el => {
    el.addEventListener('click', () => {
      const uid = el.dataset.upgradeUid;
      dispatch({ type: 'rest', choice: 'upgrade', uid });
    });
  });
}

function renderEvent(root) {
  const ev = state.event;
  if (!ev) return;
  const choicesHtml = ev.choices.map(ch => `
    <div class="event-choice" data-choice="${ch.id}">
      ${escapeHtml(ch.text)}
    </div>
  `).join('');
  root.innerHTML = `
    <div class="phase-container">
      <h2>事件</h2>
      <p>${escapeHtml(ev.text)}</p>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;">${choicesHtml}</div>
    </div>
  `;
  document.querySelectorAll('.event-choice').forEach(el => {
    el.addEventListener('click', () => dispatch({ type: 'event', choice: el.dataset.choice }));
  });
}

function renderIntermission(root) {
  root.innerHTML = `
    <div class="phase-container">
      <h2>幕间休息</h2>
      <p>全员状态恢复至满，准备进入下一幕</p>
      <button class="btn primary" id="btn-next-act">进入下一幕</button>
    </div>
  `;
  document.getElementById('btn-next-act').addEventListener('click', () => dispatch({ type: 'nextAct' }));
}

function renderResult(root) {
  const win = state.result === 'win';
  root.innerHTML = `
    <div class="phase-container">
      <h1>${win ? '🏆 胜利！' : '💀 失败'}</h1>
      <p>${win ? '恭喜你完成三幕赛程！' : '队伍出局，请重新开始'}</p>
      <div style="display:flex;gap:1rem;">
        <button class="btn primary" id="btn-again">再来一局</button>
        <button class="btn" id="btn-home2">返回首页</button>
      </div>
    </div>
  `;
  document.getElementById('btn-again').addEventListener('click', () => {
    clearState();
    state = null;
    renderHome();
  });
  document.getElementById('btn-home2').addEventListener('click', () => {
    renderHome();
  });
}

function renderLibraryModal() {
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot.querySelector('#library-overlay')) return;
  const previousFocus = document.activeElement;
  let activeTab = 'tactical';
  let filterType = '';
  let filterTag = '';
  let filterCost = '';
  let filterRegion = '';

  function closeLibrary() {
    modalRoot.innerHTML = '';
    showLibrary = false;
    document.removeEventListener('keydown', handleKeydown);
    if (previousFocus) previousFocus.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeLibrary();
    }
    if (e.key === 'Tab') {
      const focusableElements = Array.from(modalRoot.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary')).filter(el => el.getClientRects().length > 0 && el.tabIndex >= 0);
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }

  function renderContent() {
    const grid = document.getElementById('library-grid');
    const matchSpan = document.getElementById('match-count');
    if (!grid) return;

    let html = '';
    let count = 0;

    if (activeTab === 'tactical') {
      const filtered = CARD_IDS.filter(id => {
        const c = CARDS[id];
        if (filterType && c.type !== filterType) return false;
        if (filterTag && c.tag !== filterTag) return false;
        if (filterCost !== '' && c.cost !== parseInt(filterCost)) return false;
        if (filterRegion && (c.region||'shared') !== filterRegion) return false;
        return true;
      });
      count = filtered.length;
      if (count === 0) {
        html = '<div class="library-empty">没有匹配的战术牌</div>';
      } else {
        html = filtered.map(id => {
          const c = CARDS[id];
          const tooltip = describeCardFull({id, uid:'', up:false});
          const upgradeHtml = c.upgradeText ? `<details class="upgrade-details"><summary>升级文本</summary><div class="upgrade-text">${highlightKeywords(c.upgradeText)}</div></details>` : '';
          return `<div class="library-card tc-slot" data-tooltip="${escapeHtml(tooltip)}" tabindex="0">
            ${cardHtml(id)}
            ${upgradeHtml}
          </div>`;
        }).join('');
      }
    } else if (activeTab === 'status') {
      const statusCards = Object.values(STATUS_CARDS);
      count = statusCards.length;
      html = statusCards.map(c => {
        const tooltip = `${escapeHtml(c.name)} [${c.curse?'诅咒':'状态'}]\n${escapeHtml(c.text)}`;
        return `<div class="library-card status-card" data-tooltip="${tooltip}" tabindex="0">
          <div class="card-art">${cardArt(c.id)}</div>
          <div class="name">${escapeHtml(c.name)}</div>
          <div class="meta">${c.curse?'全队伍共享隐患 · 跨比赛保留':'比赛状态 · 战后消失'} · 不计入${CARD_IDS.length}张可选牌</div>
          <div class="card-text">${highlightKeywords(c.text)}</div>
        </div>`;
      }).join('');
    } else if (activeTab === 'relic') {
      const relics = Object.values(RELICS);
      count = relics.length;
      html = relics.map(r => {
        const tooltip = `${escapeHtml(r.name)}\n${escapeHtml(r.desc)}`;
        return `<div class="library-card relic-card" data-tooltip="${tooltip}" tabindex="0">
          <div class="card-art">${relicArt(r.id)}</div>
          <div class="name">${escapeHtml(r.name)}</div>
          <div class="card-text">${escapeHtml(r.desc)}</div>
          <div class="meta">被动 · 不进入抽牌堆</div>
        </div>`;
      }).join('');
    }

    grid.innerHTML = html;
    matchSpan.textContent = `匹配 ${count} ${activeTab === 'relic' ? '件' : '张'}`;
  }

  function switchTab(tab) {
    activeTab = tab;
    filterType = '';
    filterTag = '';
    filterCost = '';
    filterRegion = '';
    const typeSelect = document.getElementById('filter-type');
    const tagSelect = document.getElementById('filter-tag');
    const costSelect = document.getElementById('filter-cost');
    const regionSelect = document.getElementById('filter-region');
    if (typeSelect) typeSelect.value = '';
    if (tagSelect) tagSelect.value = '';
    if (costSelect) costSelect.value = '';
    if (regionSelect) regionSelect.value = '';
    document.querySelectorAll('.library-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
      btn.setAttribute('aria-selected', btn.dataset.tab === tab ? 'true' : 'false');
    });
    const filterRow = document.getElementById('filter-row');
    if (filterRow) {
      filterRow.style.display = tab === 'tactical' ? 'flex' : 'none';
    }
    renderContent();
  }

  modalRoot.innerHTML = `
    <div class="modal-overlay" id="library-overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-label="卡牌总览">
        <div class="modal-header">
          <h2>卡牌总览</h2>
          <button class="btn" id="close-library">关闭</button>
        </div>
        <div class="library-tabs" role="tablist" aria-label="分类">
          <button class="library-tab active" role="tab" aria-selected="true" data-tab="tactical">战术牌 (${CARD_IDS.length})</button>
          <button class="library-tab" role="tab" aria-selected="false" data-tab="status">状态牌 (${Object.keys(STATUS_CARDS).length})</button>
          <button class="library-tab" role="tab" aria-selected="false" data-tab="relic">遗物 (${Object.keys(RELICS).length})</button>
        </div>
        <div id="filter-row" class="filter-row">
          <select id="filter-region" class="filter-select" aria-label="筛选队伍专属牌">
            <option value="">全部队伍与共享</option><option value="shared">共享牌 (${CARD_IDS.filter(id=>!CARDS[id].region).length})</option><option value="AM">烈锋突击队 (75)</option><option value="CN">磐石守备队 (75)</option><option value="EMEA">雾隐战术组 (75)</option><option value="PAC">疾风调度组 (75)</option>
          </select>
          <select id="filter-type" class="filter-select">
            <option value="">全部类型</option>
            <option value="attack">攻击</option>
            <option value="skill">技能</option>
            <option value="power">能力</option>
          </select>
          <select id="filter-tag" class="filter-select">
            <option value="">全部标签</option>
            ${Object.entries(tagMap).map(([key,val]) => `<option value="${key}">${val}</option>`).join('')}
          </select>
          <select id="filter-cost" class="filter-select">
            <option value="">全部费用</option>
            <option value="0">0费</option>
            <option value="1">1费</option>
            <option value="2">2费</option>
            <option value="3">3费</option>
          </select>
        </div>
        <div class="library-meta"><span id="match-count"></span></div>
        <div class="library-grid" id="library-grid"></div>
      </div>
    </div>
  `;

  const overlay = document.getElementById('library-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLibrary();
  });
  document.getElementById('close-library').addEventListener('click', closeLibrary);

  document.querySelectorAll('.library-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('filter-type').addEventListener('change', (e) => {
    filterType = e.target.value;
    renderContent();
  });
  document.getElementById('filter-tag').addEventListener('change', (e) => {
    filterTag = e.target.value;
    renderContent();
  });
  document.getElementById('filter-cost').addEventListener('change', (e) => {
    filterCost = e.target.value;
    renderContent();
  });
  document.getElementById('filter-region').addEventListener('change', (e) => {
    filterRegion = e.target.value;
    renderContent();
  });

  document.addEventListener('keydown', handleKeydown);

  const closeButton = document.getElementById('close-library');
  if (closeButton) closeButton.focus();

  switchTab('tactical');
}

function getEnemyDef(id) {
  return ENEMIES[id];
}

// import ENEMIES and EXTRA_ENEMIES
import { ENEMIES } from './content.js';
import { EXTRA_ENEMIES } from './season-map.js';

function getEnemyDefImpl(id) {
  return ENEMIES[id] || EXTRA_ENEMIES[id] || null;
}

function priceOf(cardId) {
  const rarity = CARDS[cardId]?.rarity;
  return rarity === 'rare' ? 150 : rarity === 'uncommon' ? 100 : 50;
}

function removePrice(state) {
  return state.relics.some(r => r.id === 'R09') && !state.freeRemovalUsed ? 0 : 75;
}

function dispatch(action) {
  if (!state || presentationBusy) return false;
  presentationBusy = true;
  try {
    const root = document.getElementById('game-root');
    const capture = state.phase === 'combat' && root ? captureCombatPresentation(root, state, action) : null;
    const result = act(state, action);
    if (result.error) {
      presentationBusy = false;
      showNotice(result.error);
      return false;
    }
    const prev = state;
    state = result.state;
    juiceAction(prev, state, action);
    saveState();
    selectedCardUid = null;

    // Determine reduced motion preference
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Handle end turn with bespoke timeline
    if (action.type === 'end' && prev.phase === 'combat') {
      handleEndTurnTimeline(prev, state, action, capture, reducedMotion).then(() => {
        presentationBusy = false;
        previousState = state;
      }).catch(() => {
        renderPhase();
        presentationBusy = false;
        previousState = state;
      });
      return true;
    }

    if (action.type === 'play' && prev.phase === 'combat' && capture) {
      handlePlayCardTimeline(prev, state, action, capture, reducedMotion).catch(console.error).then(async () => {
        renderPhase();
        await revealDrawnCards(prev);
      }).finally(() => {
        presentationBusy = false;
        previousState = state;
      });
      return true;
    }

    // Entering combat also deals a real opening hand from the visible pile.
    renderPhase();
    globalThis.characterStages?.cueFromTransition('new', prev, state, action);
    revealDrawnCards(prev).finally(() => {
      presentationBusy = false;
      previousState = state;
    });
    return true;
  } catch (e) {
    presentationBusy = false;
    console.error(e);
    return false;
  }
}

function revealDrawnCards(prev) {
  if (state.phase !== 'combat' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const old = new Set(prev.battle?.hand?.map(card => card.uid) || []);
  const cards = [...document.querySelectorAll('#hand-area .hand-card[data-uid]')].filter(el => !old.has(el.dataset.uid));
  return flyCardsFromPile(cards, document.getElementById('pile-draw'));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCardType(card) {
  if (!card) return 'other';
  const def = CARDS[card.id];
  if (!def) return 'other';
  if (def.type && def.type.includes('attack')) return 'attack';
  if (def.type && (def.type.includes('block') || def.type.includes('skill') || def.type.includes('power'))) return 'defense';
  return 'other';
}

async function handlePlayCardTimeline(prev, next, action, capture, reducedMotion) {
  const session = {
    root: document.createElement('div'),
    animations: [],
    timers: [],
    done: false,
    cleanupTimer: null,
    removeVisibilityHandler: null,
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

  const cleanup = () => {
    if (session.done) return;
    session.done = true;
    session.animations.forEach(anim => { try { anim.cancel(); } catch(e){} });
    session.timers.forEach(timer => { try { clearTimeout(timer); } catch(e){} });
    if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
    if (session.root.parentNode) session.root.parentNode.removeChild(session.root);
    if (session.removeVisibilityHandler) session.removeVisibilityHandler();
  };

  const onVisibility = () => {
    if (document.hidden) cleanup();
  };
  document.addEventListener('visibilitychange', onVisibility);
  session.removeVisibilityHandler = () => document.removeEventListener('visibilitychange', onVisibility);

  try {
    if (reducedMotion) {
      await delay(100);
      globalThis.characterStages?.cueFromTransition('new', prev, next, action);
      juiceImpact(prev, next);
      cleanup();
      return;
    }

    const playedCard = prev.battle.hand.find(c => c.uid === action.uid);
    const cardType = getCardType(playedCard);
    const pb = capture.playerBox;
    const eb = capture.enemyBox;
    const hits = enemyHpDrops(prev, next);
    const dcp = capture.discardPile;
    const ep = capture.exhaustPile;
    const isExhaust = playedCard && next.battle?.exhaustPile?.some(c => c.uid === playedCard.uid);
    const flyTarget = isExhaust ? ep : dcp;

    // Hide original played card element to prevent duplicate
    const originalPlayedEl = document.querySelector(`.hand-card[data-uid="${action.uid}"]`);
    if (originalPlayedEl) originalPlayedEl.style.visibility = 'hidden';

    let playedClone = null;
    if (capture.playedCardClone) {
      playedClone = capture.playedCardClone;
      const startRect = originalPlayedEl ? originalPlayedEl.getBoundingClientRect() : null;
      const startX = startRect ? startRect.left + startRect.width/2 : capture.playedCardStart.x;
      const startY = startRect ? startRect.top + startRect.height/2 : capture.playedCardStart.y;
      const cardWidth = startRect?.width || parseFloat(playedClone.style.width) || 160;
      const cardHeight = startRect?.height || parseFloat(playedClone.style.height) || 230;
      playedClone.style.position = 'absolute';
      playedClone.style.left = (startX - cardWidth / 2) + 'px';
      playedClone.style.top = (startY - cardHeight / 2) + 'px';
      playedClone.style.width = cardWidth + 'px';
      playedClone.style.height = cardHeight + 'px';
      playedClone.style.pointerEvents = 'none';
      playedClone.style.zIndex = '9999';
      session.root.appendChild(playedClone);
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const anim = playedClone.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${centerX - startX}px, ${centerY - startY}px) scale(.85)`, opacity: 1 }
      ], { duration: 500, easing: 'ease-in-out', fill: 'forwards' });
      session.animations.push(anim);
      await delay(500);
      anim.cancel();
      playedClone.style.left = (centerX - cardWidth / 2) + 'px';
      playedClone.style.top = (centerY - cardHeight / 2) + 'px';
      playedClone.style.transform = 'scale(.85)';
      juiceSlam(playedClone, 'scale(.85)');
    }

    // Cue character action
    globalThis.characterStages?.cueFromTransition('new', prev, next, action);
    juiceImpact(prev, next, cardType === 'attack' ? 450 : 120);

    if (cardType === 'attack') {
      // Ally attack: muzzle flash, bullet line, enemy hit, damage number
      const flash = document.createElement('div');
      flash.className = 'new-fx-node muzzle-flash';
      flash.style.position = 'absolute';
      flash.style.left = (pb.x - 20) + 'px';
      flash.style.top = (pb.y - 20) + 'px';
      flash.style.width = '40px';
      flash.style.height = '40px';
      flash.style.pointerEvents = 'none';
      flash.style.zIndex = '9999';
      session.root.appendChild(flash);
      const flashAnim = flash.animate([
        { transform: 'scale(0)', opacity: 1 },
        { transform: 'scale(1.5)', opacity: 0.8, offset: 0.5 },
        { transform: 'scale(2.5)', opacity: 0 }
      ], { duration: 300, easing: 'ease-out', fill: 'forwards' });
      session.animations.push(flashAnim);
      await delay(100);

      // Bullet line (to the aimed enemy; area hits get their own rings below)
      const dx = eb.x - pb.x;
      const dy = eb.y - pb.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const line = document.createElement('div');
      line.className = 'new-fx-node';
      line.style.position = 'absolute';
      line.style.left = pb.x + 'px';
      line.style.top = pb.y + 'px';
      line.style.width = dist + 'px';
      line.style.height = '2px';
      line.style.background = 'rgba(255,193,7,0.8)';
      line.style.transformOrigin = '0 50%';
      line.style.transform = `rotate(${angle}deg)`;
      line.style.pointerEvents = 'none';
      line.style.zIndex = '9999';
      session.root.appendChild(line);
      const lineAnim = line.animate([
        { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 },
        { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.9, offset: 0.4 },
        { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.4, offset: 0.7 },
        { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 }
      ], { duration: 400, easing: 'ease-out', fill: 'forwards' });
      session.animations.push(lineAnim);
      await delay(350);

      // Enemy hit effect and damage number on every enemy that lost HP
      const marks = hits.length ? hits.map(h => ({ at: capture.enemyBoxes?.[h.uid] || eb, damage: h.damage })) : [{ at: eb, damage: 0 }];
      for (const { at, damage } of marks) {
        const hitRing = document.createElement('div');
        hitRing.className = 'new-fx-node hit-ring';
        Object.assign(hitRing.style, { position: 'absolute', left: (at.x - 30) + 'px', top: (at.y - 30) + 'px', width: '60px', height: '60px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.9)', pointerEvents: 'none', zIndex: '9999' });
        session.root.appendChild(hitRing);
        session.animations.push(hitRing.animate([
          { transform: 'scale(0)', opacity: 1 },
          { transform: 'scale(2)', opacity: 0 }
        ], { duration: 300, easing: 'ease-out', fill: 'forwards' }));
        if (damage > 0) {
          const dmgEl = document.createElement('div');
          dmgEl.className = 'new-fx-node fx-damage';
          dmgEl.textContent = `-${damage}`;
          Object.assign(dmgEl.style, { position: 'absolute', left: (at.x - 20) + 'px', top: (at.y - 50) + 'px', pointerEvents: 'none', zIndex: '9999' });
          session.root.appendChild(dmgEl);
          session.animations.push(dmgEl.animate([
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-40px)', opacity: 0 }
          ], { duration: 500, easing: 'ease-out', fill: 'forwards' }));
        }
      }
      await delay(300);

      // Move played card to discard/exhaust with a fresh clone
      const finalClone = playedClone;
      if (finalClone) {
        finalClone.style.position = 'absolute';
        finalClone.style.left = (window.innerWidth/2 - finalClone.offsetWidth/2) + 'px';
        finalClone.style.top = (window.innerHeight/2 - finalClone.offsetHeight/2) + 'px';
        finalClone.style.pointerEvents = 'none';
        finalClone.style.zIndex = '9999';
        session.root.appendChild(finalClone);
        const anim = finalClone.animate([
          { transform: 'translate(0,0) scale(0.7)', opacity: 0.9 },
          { transform: `translate(${flyTarget.x - window.innerWidth/2}px, ${flyTarget.y - window.innerHeight/2}px) scale(0.2)`, opacity: 0 }
        ], { duration: 300, easing: 'ease-in', fill: 'forwards' });
        session.animations.push(anim);
        await delay(300);
        finalClone.remove();
      }
    } else if (cardType === 'defense') {
      // Defense: shield visual and block text
      const blockGain = Math.max(0, next.battle.playerBlock - prev.battle.playerBlock);
      if (blockGain > 0) {
        const shield = document.createElement('div');
        shield.className = 'new-fx-node block-aura';
        shield.style.position = 'absolute';
        shield.style.left = (pb.x - 60) + 'px';
        shield.style.top = (pb.y - 60) + 'px';
        shield.style.width = '120px';
        shield.style.height = '120px';
        shield.style.pointerEvents = 'none';
        shield.style.zIndex = '9999';
        session.root.appendChild(shield);
        const shieldAnim = shield.animate([
          { transform: 'scale(0.5)', opacity: 0.8 },
          { transform: 'scale(1.2)', opacity: 0 }
        ], { duration: 400, easing: 'ease-out', fill: 'forwards' });
        session.animations.push(shieldAnim);

        const blockText = document.createElement('div');
        blockText.className = 'new-fx-node block-text';
        blockText.textContent = `+${blockGain} 布防`;
        blockText.style.position = 'absolute';
        blockText.style.left = (pb.x - 40) + 'px';
        blockText.style.top = (pb.y - 80) + 'px';
        blockText.style.pointerEvents = 'none';
        blockText.style.zIndex = '9999';
        session.root.appendChild(blockText);
        const textAnim = blockText.animate([
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(-30px)', opacity: 0 }
        ], { duration: 500, easing: 'ease-out', fill: 'forwards' });
        session.animations.push(textAnim);
      }
      await delay(400);
      // Move played card to discard/exhaust with a fresh clone
      const finalClone = playedClone;
      if (finalClone) {
        finalClone.style.position = 'absolute';
        finalClone.style.left = (window.innerWidth/2 - finalClone.offsetWidth/2) + 'px';
        finalClone.style.top = (window.innerHeight/2 - finalClone.offsetHeight/2) + 'px';
        finalClone.style.pointerEvents = 'none';
        finalClone.style.zIndex = '9999';
        session.root.appendChild(finalClone);
        const anim = finalClone.animate([
          { transform: 'translate(0,0) scale(0.7)', opacity: 0.9 },
          { transform: `translate(${flyTarget.x - window.innerWidth/2}px, ${flyTarget.y - window.innerHeight/2}px) scale(0.2)`, opacity: 0 }
        ], { duration: 300, easing: 'ease-in', fill: 'forwards' });
        session.animations.push(anim);
        await delay(300);
        finalClone.remove();
      }
    } else {
      // Other cards: keep readable, just discard
      const finalClone = playedClone;
      if (finalClone) {
        finalClone.style.position = 'absolute';
        finalClone.style.left = (window.innerWidth/2 - finalClone.offsetWidth/2) + 'px';
        finalClone.style.top = (window.innerHeight/2 - finalClone.offsetHeight/2) + 'px';
        finalClone.style.pointerEvents = 'none';
        finalClone.style.zIndex = '9999';
        session.root.appendChild(finalClone);
        const anim = finalClone.animate([
          { transform: 'translate(0,0) scale(0.7)', opacity: 0.9 },
          { transform: `translate(${flyTarget.x - window.innerWidth/2}px, ${flyTarget.y - window.innerHeight/2}px) scale(0.2)`, opacity: 0 }
        ], { duration: 300, easing: 'ease-in', fill: 'forwards' });
        session.animations.push(anim);
        await delay(300);
        finalClone.remove();
      }
    }
    cleanup();
  } catch (e) {
    console.error(e);
    cleanup();
  }
}

async function handleEndTurnTimeline(prev, next, action, capture, reducedMotion) {
  const session = {
    root: document.createElement('div'),
    animations: [],
    timers: [],
    done: false,
    cleanupTimer: null,
    removeVisibilityHandler: null,
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

  const cleanup = () => {
    if (session.done) return;
    session.done = true;
    session.animations.forEach(anim => { try { anim.cancel(); } catch(e){} });
    session.timers.forEach(timer => { try { clearTimeout(timer); } catch(e){} });
    if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
    if (session.root.parentNode) session.root.parentNode.removeChild(session.root);
    if (session.removeVisibilityHandler) session.removeVisibilityHandler();
  };

  const onVisibility = () => {
    if (document.hidden) cleanup();
  };
  document.addEventListener('visibilitychange', onVisibility);
  session.removeVisibilityHandler = () => document.removeEventListener('visibilitychange', onVisibility);

  try {
    if (reducedMotion) {
      juiceImpact(prev, next);
      await delay(100);
      cleanup();
      return;
    }

    const handCardEls = [...document.querySelectorAll('#hand-area .hand-card[data-uid]')];
    const exhausted = new Set(next.battle?.exhaustPile?.map(card => card.uid) || []);
    await Promise.all([
      flyCardsToPile(handCardEls.filter(el => !exhausted.has(el.dataset.uid)), document.getElementById('pile-discard'), { keepHidden: true }),
      flyCardsToPile(handCardEls.filter(el => exhausted.has(el.dataset.uid)), document.getElementById('pile-exhaust'), { keepHidden: true }),
    ]);

    // Enemy turn banner
    const battle = document.querySelector('.battle');
    if (battle) {
      const banner = document.createElement('div');
      banner.className = 'enemy-turn-banner';
      banner.innerHTML = '<strong>对手回合</strong><span>对手正在执行战术</span>';
      battle.appendChild(banner);
      banner.style.position = 'absolute';
      banner.style.top = '10%';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.pointerEvents = 'none';
      session.root.appendChild(banner);
    }
    await delay(500);

    // Enemy action always happens
    globalThis.characterStages?.cueFromTransition('new', prev, next, action);
    juiceImpact(prev, next, 150);
    const pb = capture.playerBox;
    const eb = capture.enemyBox;
    const playerDamage = Math.max(0, prev.hp - next.hp);

    // Enemy attack lines regardless of damage to show each living enemy acting
    const shooters = livingEnemies(prev.battle).map(e => capture.enemyBoxes?.[e.uid]).filter(Boolean);
    (shooters.length ? shooters : [eb]).forEach((from, i) => {
      const dx = pb.x - from.x;
      const dy = pb.y - from.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const line = document.createElement('div');
      line.className = 'new-fx-node';
      Object.assign(line.style, { position: 'absolute', left: from.x + 'px', top: from.y + 'px', width: dist + 'px', height: '2px', background: 'rgba(255,87,34,0.7)', transformOrigin: '0 50%', transform: `rotate(${angle}deg)`, pointerEvents: 'none', zIndex: '9999' });
      session.root.appendChild(line);
      session.animations.push(line.animate([
        { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 },
        { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.8, offset: 0.4 },
        { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.2, offset: 0.7 },
        { transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 }
      ], { duration: 500, delay: i * 120, easing: 'ease-out', fill: 'forwards' }));
    });

    if (playerDamage > 0) {
      // Player hit effect only if damage occurs
      const hitRing = document.createElement('div');
      hitRing.className = 'new-fx-node hit-ring';
      hitRing.style.position = 'absolute';
      hitRing.style.left = (pb.x - 30) + 'px';
      hitRing.style.top = (pb.y - 30) + 'px';
      hitRing.style.width = '60px';
      hitRing.style.height = '60px';
      hitRing.style.borderRadius = '50%';
      hitRing.style.border = '3px solid rgba(255,255,255,0.9)';
      hitRing.style.pointerEvents = 'none';
      hitRing.style.zIndex = '9999';
      session.root.appendChild(hitRing);
      const ringAnim = hitRing.animate([
        { transform: 'scale(0)', opacity: 1 },
        { transform: 'scale(2)', opacity: 0 }
      ], { duration: 300, easing: 'ease-out', fill: 'forwards' });
      session.animations.push(ringAnim);

      const dmgEl = document.createElement('div');
      dmgEl.className = 'new-fx-node damage-text';
      dmgEl.textContent = `-${playerDamage}`;
      dmgEl.style.position = 'absolute';
      dmgEl.style.left = (pb.x - 20) + 'px';
      dmgEl.style.top = (pb.y - 50) + 'px';
      dmgEl.style.pointerEvents = 'none';
      dmgEl.style.zIndex = '9999';
      session.root.appendChild(dmgEl);
      const dmgAnim = dmgEl.animate([
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(-40px)', opacity: 0 }
      ], { duration: 500, easing: 'ease-out', fill: 'forwards' });
      session.animations.push(dmgAnim);
    }
    await delay(500);

    renderPhase();
    if (next.phase === 'combat') await flyCardsFromPile([...document.querySelectorAll('#hand-area .hand-card[data-uid]')], document.getElementById('pile-draw'));

    cleanup();
  } catch (e) {
    console.error(e);
    cleanup();
  }
}

// HP each enemy lost between two states (area cards hit several).
function enemyHpDrops(prev, next) {
  const after = new Map(battleEnemies(next?.battle).map(e => [e.uid, e.hp]));
  return battleEnemies(prev?.battle).map(e => ({ uid: e.uid, damage: Math.max(0, e.hp - (after.get(e.uid) ?? 0)) })).filter(h => h.damage > 0);
}
const totalEnemyHp = b => battleEnemies(b).reduce((sum, e) => sum + Math.max(0, e.hp), 0);

function applyCombatFx(prev, next) {
  if (!prev?.battle || !next?.battle) return;
  const prevEnemyHp = totalEnemyHp(prev.battle);
  const nextEnemyHp = totalEnemyHp(next.battle);
  const prevPlayerHp = prev.hp;
  const nextPlayerHp = next.hp;
  const prevBlock = prev.battle.playerBlock || 0;
  const nextBlock = next.battle.playerBlock || 0;
  const enemyBox = document.getElementById('enemy-box');
  const playerBox = document.getElementById('player-box');
  if (nextEnemyHp < prevEnemyHp && enemyBox) {
    enemyBox.classList.add('hit-flash');
    setTimeout(() => enemyBox.classList.remove('hit-flash'), 300);
  }
  if (nextPlayerHp < prevPlayerHp && playerBox) {
    playerBox.classList.add('hit-flash');
    setTimeout(() => playerBox.classList.remove('hit-flash'), 300);
  }
  if (nextBlock !== prevBlock && playerBox) {
    playerBox.classList.add('block-pulse');
    setTimeout(() => playerBox.classList.remove('block-pulse'), 400);
  }
}

// Debug API
window.newDemo = {
  observe: () => observe(state),
  legalActions: () => legalActions(state),
  dispatch: (action) => dispatch(action)
};

function initGlobalTooltip() {
  const tooltip = document.createElement('div');
  tooltip.id = 'global-tooltip';
  tooltip.style.position = 'fixed';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.zIndex = '1000';
  tooltip.style.maxWidth = '300px';
  tooltip.style.background = '#0c0f14';
  tooltip.style.color = '#d9e2ec';
  tooltip.style.border = '1px solid #3e4d62';
  tooltip.style.borderRadius = '4px';
  tooltip.style.padding = '0.4rem 0.6rem';
  tooltip.style.fontSize = '0.75rem';
  tooltip.style.whiteSpace = 'pre-wrap';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  function showTooltip(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    const text = target.getAttribute('data-tooltip');
    if (!text) return;
    tooltip.textContent = text;
    tooltip.style.display = 'block';
    // Phones: a tapped hand card already shows its text in the arena hint; a
    // floating tooltip there would cover the action buttons.
    if (target.closest('.arena .hand-card') && innerWidth <= 720) { hideTooltip(); return; }
    let rect = target.getBoundingClientRect();
    // Hand cards: show the text in the open space at the top of the battlefield,
    // never over the stance/action buttons beside the hand.
    const floor = target.closest('.arena .hand-card') && innerWidth > 720 ? document.querySelector('.arena-floor') : null;
    if (floor) { const f = floor.getBoundingClientRect(); rect = { left: f.left, width: f.width, top: f.top + tooltip.offsetHeight + 10, bottom: f.top }; }
    let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
    let top = rect.top - tooltip.offsetHeight - 5;
    const margin = 10;
    if (left < margin) left = margin;
    const maxLeft = window.innerWidth - tooltip.offsetWidth - margin;
    if (left > maxLeft) left = maxLeft;
    if (top < margin) {
      top = rect.bottom + 5;
      if (top + tooltip.offsetHeight > window.innerHeight - margin) {
        top = margin;
      }
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  document.addEventListener('pointerover', showTooltip);
  document.addEventListener('focusin', showTooltip);
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest('[data-tooltip]')) hideTooltip();
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.closest('[data-tooltip]')) hideTooltip();
  });
  document.addEventListener('scroll', hideTooltip);
  window.addEventListener('resize', hideTooltip);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initGlobalTooltip();
  document.addEventListener('keydown', (e) => {
    if (state && state.phase === 'combat' && !presentationBusy && !showLibrary && !document.querySelector('.modal-overlay')) {
      combatKeyHandler(e);
    }
  });
  // Reload returns to the screen the player was on: home stays home;
  // only a reload in the middle of a run resumes it directly.
  const saved = loadState();
  let lastScreen = null;
  try { lastScreen = sessionStorage.getItem(SCREEN_KEY); } catch {}
  if (saved && lastScreen === 'game') {
    state = saved;
    renderGame();
  } else {
    renderHome();
  }
});
