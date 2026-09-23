import { createRun, act, legalActions, observe, preview, describeIntent } from './engine.js';
import { CARDS, CARD_IDS, STATUS_CARDS, TEAMS, RELICS } from './content.js';
import { ACTS } from './season-map.js';
import { cardArt, combatArt, relicArt } from './art.js';
import { captureCombatPresentation, animateCombatTransition, clearCombatPresentation } from './fx.js';
import { attachCardGesture } from '/shared/card-gesture.js';

const STORAGE_KEY = 'new-demo-run-v1';
let state = null;
let previousState = null;
let selectedCardUid = null;
let showLibrary = false;
let selectedTeam = 'breach';
let seedInputValue = '';
let noticeTimeout = null;
let presentationBusy = false;

const typeMap = { attack: '攻击', skill: '技能', power: '能力', status: '状态' };
const rarityMap = { common: '普通', uncommon: '罕见', rare: '稀有' };
const tagMap = { basic: '基础通用', damage: '交火输出', utility: '战术道具', stance: '掩护前压', core: '构筑核心', hybrid: '混搭连接', response: '应对调度', status: '特殊' };

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
    cost: def.cost,
    type: def.type,
    tag: def.tag,
    rarity: def.rarity,
    text,
    detail: def.detail || '',
    exhaust: def.exhaust || false,
    up
  };
}

function describeCardFull(card) {
  const d = getCardDisplay(card, card.up);
  if (!d) return '';
  const parts = [
    `${d.name} [${d.cost}费 ${typeMap[d.type]||d.type} ${tagMap[d.tag]||d.tag} ${rarityMap[d.rarity]||d.rarity}${d.exhaust?' 消耗':''}${d.up?' 已升级':''}]`,
    d.text
  ];
  if (d.detail) parts.push(d.detail);
  return parts.join('\n');
}

function renderHome() {
  const teamsHtml = Object.values(TEAMS).map(t => `
    <div class="team-card ${selectedTeam === t.id ? 'selected' : ''}" data-team="${t.id}" tabindex="0" role="button" aria-pressed="${selectedTeam === t.id}">
      <div class="team-art">${combatArt(t.id, 'ally')}</div>
      <div class="team-name">${escapeHtml(t.name)}</div>
      <div class="team-desc">${escapeHtml(t.desc)}</div>
    </div>
  `).join('');

  const saved = loadState();
  const continueDisabled = !saved;
  const hasSaved = !!saved;

  document.getElementById('app').innerHTML = `
    <div class="hero-cover">
      <img class="hero-bg" src="/new/cover.webp" alt="" />
      <div class="hero-content">
        <h1 class="hero-title">战术试炼</h1>
        <p class="hero-tagline">一支队伍，75种战术，三段赛程</p>
        <div class="hero-actions">
          <button class="btn hero-btn primary" id="btn-new">开始新局${hasSaved ? '（覆盖当前存档）' : ''}</button>
          <button class="btn hero-btn" id="btn-continue" ${continueDisabled ? 'disabled' : ''}>继续上局</button>
        </div>
        <div class="hero-nav">
          <a href="#team-selection" class="hero-link">选择队伍</a>
          <button class="hero-link" id="btn-library">卡牌总览</button>
        </div>
      </div>
    </div>
    <main class="home-section" id="team-selection">
      <div class="team-select" role="radiogroup" aria-label="选择初始队伍">
        ${teamsHtml}
      </div>
      <div class="seed-control">
        <label for="seed-input">种子：</label>
        <input type="text" id="seed-input" class="seed-input" placeholder="留空为随机" value="${escapeHtml(seedInputValue)}" />
      </div>
      <div class="home-actions">
        <button class="btn primary" id="btn-new-secondary">开始新局${hasSaved ? '（覆盖当前存档）' : ''}</button>
        <button class="btn" id="btn-continue-secondary" ${continueDisabled ? 'disabled' : ''}>继续上局</button>
      </div>
      <div class="nav-links">
        <a href="/pvp/">好友PvP</a>
        <a href="/">瓦demo</a>
      </div>
      <div class="credit">猪之家出品</div>
    </main>
  `;

  // 事件绑定
  document.querySelectorAll('.team-card').forEach(el => {
    el.addEventListener('click', () => {
      selectedTeam = el.dataset.team;
      renderHome();
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectedTeam = el.dataset.team;
        renderHome();
      }
    });
  });

  const seedInput = document.getElementById('seed-input');
  seedInput.addEventListener('input', e => {
    seedInputValue = e.target.value;
  });

  function startNewGame() {
    if (loadState()) {
      const confirmOverwrite = window.confirm('开始新局将覆盖当前存档，确定？');
      if (!confirmOverwrite) return;
    }
    const seed = seedInputValue.trim() || String(Date.now());
    state = createRun(seed, selectedTeam);
    saveState();
    selectedCardUid = null;
    renderGame();
  }

  function continueGame() {
    const saved = loadState();
    if (saved) {
      state = saved;
      selectedCardUid = null;
      renderGame();
    }
  }

  document.getElementById('btn-new').addEventListener('click', startNewGame);
  document.getElementById('btn-new-secondary').addEventListener('click', startNewGame);
  document.getElementById('btn-continue').addEventListener('click', continueGame);
  document.getElementById('btn-continue-secondary').addEventListener('click', continueGame);

  document.getElementById('btn-library').addEventListener('click', () => {
    showLibrary = true;
    renderLibraryModal();
  });
}

function renderGame() {
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
        <button class="btn" id="btn-home">返回首页</button>
      </div>
    </header>
    <div id="game-root" style="flex:1;display:flex;flex-direction:column;"></div>
  `;
  document.getElementById('btn-library').addEventListener('click', () => {
    showLibrary = true;
    renderLibraryModal();
  });
  document.getElementById('btn-home').addEventListener('click', () => {
    if (window.confirm('返回首页将丢弃当前进度，确定？')) {
      clearState();
      state = null;
      renderHome();
    }
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

  const w = 400, h = 880;
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
    const cls = `map-node ${isAvailable ? 'available' : ''} ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`;
    const glyph = { battle: '⚔', elite: '◆', event: '?', shop: '⇄', rest: '✚', boss: '★' }[n.kind] || '·';
    const label = n.kind === 'battle' ? n.name : ({ elite: '强敌', event: '事件', shop: '转会', rest: '休整', boss: '决赛' }[n.kind] || n.name);
    return `<g class="${cls}" data-key="${n.key}" tabindex="${isAvailable ? '0' : '-1'}" role="button" aria-label="${escapeHtml(n.name)}" style="cursor:pointer">
      <circle cx="${sx(n.x)}" cy="${sy(n.y)}" r="18" />
      <text class="map-glyph" x="${sx(n.x)}" y="${sy(n.y) + 1}">${glyph}</text>
      ${isAvailable ? `<text class="map-choice-label" x="${sx(n.x)}" y="${sy(n.y) - 29}">${escapeHtml(label)}</text>` : ''}
    </g>`;
  }).join('');

  root.innerHTML = `
    <div class="map-container">
      <div class="map-stage-info">
        <span>幕 ${state.act}：${act.name} · ${act.subtitle}</span>
        <span>HP ${state.hp}/${state.maxHp} · 💰 ${state.money}</span>
      </div>
      <div class="map-scroll">
        <svg class="map-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          ${edgesSvg}
          ${nodesSvg}
        </svg>
      </div>
      <div class="map-legend">
        <span class="legend-item"><span class="legend-dot current"></span> 当前</span>
        <span class="legend-item"><span class="legend-dot available"></span> 可进入</span>
        <span class="legend-item"><span class="legend-dot completed"></span> 已完成</span>
      </div>
      <div id="node-details" class="node-details" aria-live="polite"></div>
    </div>
  `;

  const details = root.querySelector('#node-details');
  const showDetails = (node) => {
    const kindNames = { battle: '常规比赛', elite: '高压强敌', event: '未知事件', shop: '战术补给', rest: '战术休整', boss: 'BOSS' };
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
      <span>${kindNames[node.kind] || '未知'}</span>
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

function renderStatuses(statusObj) {
  const mapping = {
    smoke: { key: 'smoke', desc: '烟雾：敌方每次命中伤害 -1/层，敌方回合结束 -1层' },
    flash: { key: 'flash', desc: '闪光：敌方下一次命中伤害 -3×层数，触发后消耗全部层数' },
    weak: { key: 'weak', desc: '压制：攻击伤害 ×0.75' },
    vuln: { key: 'vuln', desc: '易伤：受到攻击 ×1.5' },
    block: { key: 'block', desc: '布防：抵消等量伤害' }
  };
  return Object.entries(statusObj).filter(([k,v]) => v > 0).map(([k,v]) => {
    const info = mapping[k] || { key: k, desc: `${k}:${v}` };
    return `<span class="status-chip" tabindex="0" title="${escapeHtml(info.desc)}">${info.key}:${v}</span>`;
  }).join('');
}

function renderCombat(root) {
  const b = state.battle;
  if (!b) return;
  const enemyDef = getEnemyDef(b.enemyId);
  const intentStr = describeIntent(state) || '未知';
  const playerStatuses = renderStatuses(b.statuses.player);
  const enemyStatuses = renderStatuses(b.statuses.enemy);
  const legal = legalActions(state);
  const playableUids = new Set(legal.filter(a => a.type === 'play').map(a => a.uid));
  const canStance = legal.some(a => a.type === 'stance');
  const allyArt = combatArt(state.team, 'ally');
  const enemyArt = combatArt(b.enemyId, 'enemy');
  const handHtml = b.hand.map((card, idx) => {
    const display = getCardDisplay(card, card.up);
    if (!display) return '';
    const isSelected = selectedCardUid === card.uid;
    const isPlayable = playableUids.has(card.uid);
    const tooltip = describeCardFull(card);
    const offset = idx - (b.hand.length - 1) / 2;
    return `<div class="hand-card shared-card role-${escapeHtml(display.type)} ${isSelected ? 'selected' : ''} ${isPlayable ? '' : 'not-playable'}" data-uid="${card.uid}" data-index="${idx}" tabindex="0" role="button" aria-label="${escapeHtml(display.name)}" data-tooltip="${escapeHtml(tooltip)}" style="--offset:${offset};--tilt:${offset * (b.hand.length > 6 ? 1.6 : 3)}deg;--bend:${Math.abs(offset) * Math.abs(offset) * 1.8}px;--order:${idx}">
      <div class="card-face">
        <span class="card-cost">${display.cost}</span>
        <span class="card-title">${escapeHtml(display.name)}</span>
        <span class="card-portrait">${cardArt(card.id)}<span class="portrait-role">${escapeHtml(typeMap[display.type] || display.type)}</span></span>
        <b class="card-tactic">${escapeHtml(tagMap[display.tag] || display.tag || typeMap[display.type] || '')}</b>
        <span class="card-effect"><span>${escapeHtml(display.text)}</span></span>
        <span class="card-foot">${escapeHtml(rarityMap[display.rarity] || '')}${display.exhaust ? ' · 消耗' : ''}</span>
      </div>
    </div>`;
  }).join('');

  let previewHtml = '';
  if (selectedCardUid) {
    const card = b.hand.find(c => c.uid === selectedCardUid);
    if (card) {
      const fullDesc = describeCardFull(card);
      previewHtml = `<div class="preview-panel">${escapeHtml(fullDesc)}</div>`;
    }
  }

  const pileCounts = {
    draw: b.drawPile.length,
    discard: b.discardPile.length,
    exhaust: b.exhaustPile.length,
  };

  root.innerHTML = `
    <div class="battle" data-presentation-busy="${presentationBusy}">
      <div class="enemy-area">
        <div class="enemy-art-container" data-character-variant="${escapeHtml(b.enemyId)}">${enemyArt}</div>
        <div class="enemy-box" id="enemy-box">
          <div class="enemy-name">${escapeHtml(b.enemyName)}</div>
          <div class="enemy-hp" data-hp="${b.enemyHp}">
            <div class="hp-bar"><i style="width:${b.enemyHp/b.enemyMaxHp*100}%"></i></div>
            <span>${b.enemyHp}/${b.enemyMaxHp}</span>
          </div>
          ${enemyStatuses ? `<div class="enemy-statuses">${enemyStatuses}</div>` : ''}
          <div class="intent">意图：${escapeHtml(intentStr)}</div>
        </div>
      </div>
      <div class="player-area">
        <div class="ally-art-container">${allyArt}</div>
        <div class="player-box" id="player-box">
          <div class="label">队伍状态</div>
          <div class="value">HP ${state.hp}/${state.maxHp}</div>
          <div class="hp-bar"><i style="width:${state.hp/state.maxHp*100}%"></i></div>
          <div>能量 ${b.energy}/3</div>
          <div class="block-value" data-block="${b.playerBlock}"><span class="mini-armor" aria-hidden="true"></span><span>布防 ${b.playerBlock}</span></div>
          ${playerStatuses ? `<div class="player-statuses">${playerStatuses}</div>` : ''}
        </div>
        <div class="stance-box">
          <div>姿态：${b.stance === 'cover' ? '掩护' : '前压'}</div>
          <div style="font-size:0.8rem">${b.stance === 'cover' ? '掩护首次布防+3' : '前压首次攻击+3，每次受到攻击+2'}</div>
          <button class="btn" id="btn-stance" ${canStance ? '' : 'disabled'}>切换姿态（1费，每回合一次）${b.stanceSwitchUsedThisTurn ? '已用' : ''}</button>
        </div>
      </div>
      <div class="pile-display">
        <button class="pile-btn" data-pile="draw" id="pile-draw">抽牌堆 (${pileCounts.draw})</button>
        <button class="pile-btn" data-pile="discard" id="pile-discard">弃牌堆 (${pileCounts.discard})</button>
        <button class="pile-btn" data-pile="exhaust" id="pile-exhaust">消耗堆 (${pileCounts.exhaust})</button>
      </div>
      <div class="battle-actions">
        <button class="btn primary" id="btn-play" ${selectedCardUid && playableUids.has(selectedCardUid) ? '' : 'disabled'}>执行战术 (Enter)</button>
        <button class="btn" id="btn-end">结束回合 (E)</button>
        ${previewHtml}
      </div>
      <div class="hand-area" id="hand-area" role="list" style="--slots:${Math.max(1,b.hand.length)}">
        ${handHtml}
      </div>
    </div>
  `;

  // attach events
  const enemyBox = document.getElementById('enemy-box');
  enemyBox.addEventListener('click', () => { if (selectedCardUid && playableUids.has(selectedCardUid) && !presentationBusy) dispatch({ type: 'play', uid: selectedCardUid }); });
  const playerBox = document.getElementById('player-box');
  playerBox.addEventListener('click', () => { if (selectedCardUid && playableUids.has(selectedCardUid) && !presentationBusy) dispatch({ type: 'play', uid: selectedCardUid }); });

  document.getElementById('btn-play').addEventListener('click', () => {
    if (selectedCardUid && playableUids.has(selectedCardUid) && !presentationBusy) {
      dispatch({ type: 'play', uid: selectedCardUid });
    }
  });

  document.getElementById('btn-end').addEventListener('click', () => { if (!presentationBusy) dispatch({ type: 'end' }); });

  document.getElementById('btn-stance').addEventListener('click', () => {
    if (canStance && !presentationBusy) dispatch({ type: 'stance' });
  });

  document.querySelectorAll('.pile-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (presentationBusy) return;
      const kind = btn.dataset.pile;
      showPileModal(kind);
    });
  });

  // Selection stays game-specific; dragging uses the same full-card gesture as Wa.
  root.querySelectorAll('.hand-card.shared-card').forEach(el => {
    el.addEventListener('click', () => {
      if (presentationBusy) return;
      selectedCardUid = el.dataset.uid;
      renderCombat(root);
    });
    el.addEventListener('keydown', event => {
      if (presentationBusy || !['Enter',' '].includes(event.key)) return;
      event.preventDefault();event.stopPropagation();
      selectedCardUid = el.dataset.uid;
      renderCombat(root);
    });
  });
  const hand = root.querySelector('#hand-area');
  const clearDrop = () => root.querySelectorAll('.drop-ready').forEach(el => el.classList.remove('drop-ready'));
  const zoneAt = point => {
    const battle = root.querySelector('.battle')?.getBoundingClientRect();
    const handTop = hand.getBoundingClientRect().top;
    if (!battle || point.y < battle.top || point.y > handTop - 20 || point.x < battle.left || point.x > battle.right) return null;
    return point.x < battle.left + battle.width / 2 ? root.querySelector('.player-area') : root.querySelector('.enemy-area');
  };
  attachCardGesture(hand, {
    getCard: el => b.hand.find(card => card.uid === el.dataset.uid),
    canDrag: card => !presentationBusy && playableUids.has(card.uid),
    onStart: (card, el) => { selectedCardUid = card.uid; el.classList.add('selected'); },
    onMove: (_card, point) => { clearDrop(); zoneAt(point)?.classList.add('drop-ready'); },
    onDrop: (card, point) => {
      const zone = zoneAt(point); clearDrop();
      if (!zone || presentationBusy || !playableUids.has(card.uid)) return false;
      selectedCardUid = card.uid;
      return dispatch({ type: 'play', uid: card.uid });
    },
    onEnd: clearDrop,
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
    return `<div class="pile-card">
      <div class="card-art">${cardArt(card.id)}</div>
      <div class="card-info">${escapeHtml(display.name)} (${display.cost}费)</div>
    </div>`;
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
    e.preventDefault();
    const legal = legalActions(state);
    const playableUids = new Set(legal.filter(a => a.type === 'play').map(a => a.uid));
    if (selectedCardUid && playableUids.has(selectedCardUid)) {
      dispatch({ type: 'play', uid: selectedCardUid });
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
    return `<div class="reward-card" data-id="${id}">
      <div class="card-art">${cardArt(id)}</div>
      <div class="card-title">${escapeHtml(def.name)}</div>
      <div class="card-cost">${def.cost}费</div>
      <div class="card-desc">${escapeHtml(def.text)}</div>
    </div>`;
  }).join('');
  root.innerHTML = `
    <div class="phase-container">
      <h2>战斗胜利！选择奖励</h2>
      <div class="reward-cards">
        ${rewardHtml}
      </div>
      <button class="btn" id="btn-skip">跳过</button>
    </div>
  `;
  document.querySelectorAll('.reward-card').forEach(el => {
    el.addEventListener('click', () => dispatch({ type: 'reward', id: el.dataset.id }));
  });
  document.getElementById('btn-skip').addEventListener('click', () => dispatch({ type: 'reward', id: null }));
}

function renderShop(root) {
  const shop = state.shop;
  const shopCards = shop.cards.map((item, idx) => {
    const def = CARDS[item.id];
    if (!def) return '';
    const cost = priceOf(item.id);
    const canBuy = state.money >= cost;
    return `<div class="shop-card">
      <div class="card-art">${cardArt(item.id)}</div>
      <div class="card-title">${escapeHtml(def.name)}</div>
      <div class="card-cost">价格：${cost}</div>
      <div class="card-desc">${escapeHtml(def.text)}</div>
      <button class="btn" data-buy-index="${idx}" ${canBuy ? '' : 'disabled'}>购买</button>
    </div>`;
  }).join('');
  const rmCost = removePrice(state);
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
    <div class="phase-container">
      <h2>商店</h2>
      <p>金币：${state.money}</p>
      <h3>出售卡牌</h3>
      <div style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:center;">${shopCards}</div>
      <h3>删除卡牌（每张${rmCost}金币）</h3>
      <div class="deck-list">${deckItems}</div>
      <button class="btn" id="btn-leave">离开商店</button>
    </div>
  `;
  document.querySelectorAll('[data-buy-index]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.buyIndex);
      dispatch({ type: 'buy', index: idx, id: shop.cards[idx].id });
    });
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
    clearState();
    state = null;
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
        return true;
      });
      count = filtered.length;
      if (count === 0) {
        html = '<div class="library-empty">没有匹配的战术牌</div>';
      } else {
        html = filtered.map(id => {
          const c = CARDS[id];
          const tooltip = describeCardFull({id, uid:'', up:false});
          const upgradeHtml = c.upgradeText ? `<details class="upgrade-details"><summary>升级文本</summary><div class="upgrade-text">${escapeHtml(c.upgradeText)}</div></details>` : '';
          return `<div class="library-card" data-tooltip="${escapeHtml(tooltip)}" tabindex="0">
            <div class="card-art">${cardArt(id)}</div>
            <div class="name">${escapeHtml(c.name)}</div>
            <div class="meta">${c.cost}费 ${typeMap[c.type]} ${tagMap[c.tag]} ${rarityMap[c.rarity]}</div>
            <div class="card-text">${escapeHtml(c.text)}</div>
            ${upgradeHtml}
          </div>`;
        }).join('');
      }
    } else if (activeTab === 'status') {
      const statusCards = Object.values(STATUS_CARDS);
      count = statusCards.length;
      html = statusCards.map(c => {
        const tooltip = `${escapeHtml(c.name)} [状态]\n${escapeHtml(c.text)}`;
        return `<div class="library-card status-card" data-tooltip="${tooltip}" tabindex="0">
          <div class="card-art">${cardArt(c.id)}</div>
          <div class="name">${escapeHtml(c.name)}</div>
          <div class="meta">状态 · 不可打出（不属于75张永久卡池）</div>
          <div class="card-text">${escapeHtml(c.text)}</div>
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
    const typeSelect = document.getElementById('filter-type');
    const tagSelect = document.getElementById('filter-tag');
    const costSelect = document.getElementById('filter-cost');
    if (typeSelect) typeSelect.value = '';
    if (tagSelect) tagSelect.value = '';
    if (costSelect) costSelect.value = '';
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
    saveState();
    selectedCardUid = null;
    renderPhase();
    globalThis.characterStages?.cueFromTransition('new',prev,state,action);
    if (prev.phase === 'combat' && state.phase === 'combat' && capture) {
      animateCombatTransition(prev, state, action, capture)
        .catch(() => {})
        .finally(() => {
          presentationBusy = false;
          const battleDiv = document.querySelector('.battle');
          if (battleDiv) {
            battleDiv.dataset.presentationBusy = 'false';
            battleDiv.querySelectorAll('button:disabled').forEach(btn => {
              // Optionally re-enable? Leave disabled as per state.
            });
          }
        });
    } else {
      presentationBusy = false;
      const battleDiv = document.querySelector('.battle');
      if (battleDiv) {
        battleDiv.dataset.presentationBusy = 'false';
      }
    }
    previousState = state;
    return true;
  } catch (e) {
    presentationBusy = false;
    console.error(e);
    return false;
  }
}

function applyCombatFx(prev, next) {
  if (!prev?.battle || !next?.battle) return;
  const prevEnemyHp = prev.battle.enemyHp;
  const nextEnemyHp = next.battle.enemyHp;
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
    const rect = target.getBoundingClientRect();
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
  const saved = loadState();
  if (saved) {
    state = saved;
    renderGame();
  } else {
    renderHome();
  }
});
