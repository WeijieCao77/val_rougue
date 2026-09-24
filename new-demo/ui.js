import { createRun, act, legalActions, observe, preview, describeIntent, describeIntents, describeIntentsActual, incomingDamage, battleEnemies, livingEnemies, cardNeedsTarget, cardHitsAll, categoryUpgradeQuote, shopPrice, ASCENSION_RULES, MAX_ASCENSION, restHealAmount, removePrice, baseEnergy, supplySlots, hasRelic, RELIC_SLOTS, relicSellValue, describeEvent, combatCardText } from './engine.js';
import { squadChipHtml, traitTagHtml, teamTrait, TRAIT_ICONS, loadAscensionUnlocks, recordAscensionWin, equipIconHtml, supplyGlyphHtml, equipTileHtml, supplyTileHtml, TIER_COLORS } from './run-extras.js';
import { CARDS, CARD_IDS, STATUS_CARDS, TEAMS, RELICS, TRAITS, FIELDS, ARCHETYPES, SUPPLIES, SUPPLY_IDS, EQUIP_TIERS, BOSSES } from './content.js';
import { statusBadges, statusBadge, statusIcon, highlightKeywords, keywordRules, STATUS_INFO } from '/shared/status-icons.js';
import { attachCardDetail, showDragHint, hideDragHint } from '/shared/touch-feel.js';
import { ACTS } from './season-map.js';
import { cardArt, combatArt, relicArt } from './art.js';
import { tacticalCard } from './tactical-card.js';
import { captureCombatPresentation, animateCombatTransition, clearCombatPresentation } from './fx.js';
import { attachCardGesture } from '/shared/card-gesture.js';
import { flyCardsFromPile, flyCardsToPile } from '/shared/card-pile-motion.js';
import { soundToggleHtml } from '/shared/sfx.js';
import { juiceAction, juiceImpact, juiceSlam } from './juice-hooks.js';
import { restHealRate, econOn } from './engine.js';
import { unlockRunOptions, recordUnlockProgress, recordAbandonedRun, unlockBarHtml, unlockTestHtml, toggleAllUnlocks, unlockNoticeHtml, skipOptionsHtml, rerollButtonHtml, investOfferHtml, investChipHtml, investListHtml } from './economy.js';
import { trackNewRun, recordNewAbandon, entryFor, resultPageHtml, openHistory, openDeckViewer, collection, foundText, unseenTileHtml, enemyTileHtml, gearTile, tagCard, initUpgradePeek, ALL_ENEMIES } from './run-screens.js';

const STORAGE_KEY = 'new-demo-run-route-v5';
const GUIDE_KEY = 'new-demo-guide-v2-';
// Internal beta: discard runs created with the previous route layout.
try { for (const key of ['new-demo-run-v1', 'new-demo-run-route-v2', 'new-demo-run-route-v3', 'new-demo-run-route-v4']) localStorage.removeItem(key); } catch {}
let state = null;
let previousState = null;
let selectedCardUid = null;
let showLibrary = false;
let selectedTeam = 'breach';
let selectedAscension = 0;
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
    recordUnlockProgress(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Save failed', e);
  }
  trackNewRun(state);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // basic validation
    if (!saved || saved.version !== 'new-1' || !saved.phase || !saved.map || !Array.isArray(saved.deck) || saved.deck.length === 0) return null;
    // Runs saved before equipment/supplies existed.
    if (!Array.isArray(saved.supplies)) saved.supplies = [];
    if (typeof saved.supplyChance !== 'number') saved.supplyChance = 40;
    saved.relics = (saved.relics || []).filter(r => RELICS[r.id]);
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
  // Combat copies of 成长 cards show the growth gained this combat.
  const text = card.grow && CARDS[card.id] ? combatCardText({ ...card, up }) : up && def.upgradeText ? def.upgradeText : def.text;
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
function cardHtml(id, { up = false, cost, badge, extraClass, text: textOverride } = {}) {
  const def = getCardDefinition(id);
  if (!def) return '';
  const text = textOverride ?? (up && def.upgradeText ? def.upgradeText : def.text);
  // X 费 cards show "X" instead of a number.
  const shownCost = def.x ? 'X' : cost ?? (up && def.upgradeCost !== undefined ? def.upgradeCost : def.cost);
  return tagCard(tacticalCard(def, { up, cost: shownCost, text: highlightKeywords(text), tagLabel: tagLabel(def), badge, extraClass }), id, up);
}

// Long-press sheet: the full-size card, complete text, keyword rules and the upgraded version.
function cardDetailHtml(el) {
  const id = el.dataset.cardId;
  const up = el.dataset.cardUp === 'true';
  const def = getCardDefinition(id);
  if (!def) return '';
  const d = getCardDisplay({ id }, up);
  const upText = !up && def.upgradeText && def.upgradeText !== def.text ? def.upgradeText : '';
  const upCost = !up && def.upgradeCost !== undefined && def.upgradeCost !== def.cost ? def.upgradeCost : null;
  const extra = [def.exhaust ? '消耗' : '', def.retain ? '保留' : ''].join(' ');
  const rules = keywordRules(`${d.text} ${upText} ${extra}`);
  const art = cardHtml(id, { up }).replace(/ data-card-id="[^"]*"/, '');
  return `<div class="card-sheet-body"><div class="card-sheet-art new-sheet-art">${art}</div><div class="card-sheet-info">
    <h3>${escapeHtml(d.name)}${up ? ' +' : ''}</h3>
    <p class="card-sheet-meta">${d.cost === null || d.cost === undefined ? '不能打出' : `${escapeHtml(d.cost)} 费`} · ${escapeHtml(typeMap[d.type] || d.type || '')}${tagMap[d.tag] ? ` · ${escapeHtml(tagMap[d.tag])}` : ''}${rarityMap[d.rarity] ? ` · ${escapeHtml(rarityMap[d.rarity])}` : ''}</p>
    <p class="card-sheet-text">${highlightKeywords(d.text)}</p>
    ${d.detail ? `<p class="card-sheet-scene">${escapeHtml(d.detail)}</p>` : ''}
    ${rules.length ? `<dl class="card-sheet-keywords">${rules.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>` : ''}
    ${up ? '<p class="card-sheet-upgrade"><b>已升级</b>这是升级后的版本。</p>' : upText || upCost !== null ? `<p class="card-sheet-upgrade"><b>升级后</b>${upCost !== null ? `${escapeHtml(upCost)} 费 · ` : ''}${highlightKeywords(upText || d.text)}</p>` : ''}
  </div></div>`;
}
attachCardDetail({ selector: '[data-card-id]', render: cardDetailHtml });

function describeCardFull(card) {
  const d = getCardDisplay(card, card.up);
  if (!d) return '';
  const parts = [
    `${d.name} [${getCardDefinition(card.id)?.x ? "X" : d.cost}费 ${typeMap[d.type]||d.type} ${tagMap[d.tag]||d.tag} ${rarityMap[d.rarity]||d.rarity}${d.exhaust?' 消耗':''}${d.up?' 已升级':''}]`,
    d.text
  ];
  if (d.detail) parts.push(d.detail);
  if (d.text.includes('烟雾')) parts.push('烟雾：敌方每次命中伤害减少，按层数抵消；敌方回合结束减少1层。');
  if (d.text.includes('闪光')) parts.push('闪光：敌方下一次命中伤害减少3×层数，触发后移除。');
  if (d.text.includes('压制')) parts.push('压制：攻击伤害变为原来的75%。');
  if (d.text.includes('易伤')) parts.push('易伤：受到攻击伤害变为原来的150%。');
  // Card keywords, same rule text as the keyword highlight tooltips.
  for (const [word, key] of [['虚无', 'ethereal'], ['固有', 'innate'], ['X 费', 'xcost'], ['成长', 'growth'], ['保留', 'retain'], ['消耗', 'exhaust']]) {
    if (d.text.includes(word) || (key === 'exhaust' && d.exhaust)) parts.push(STATUS_INFO[key].rule);
  }
  if (card.grow) parts.push(`本场已成长 ${card.grow} 次。`);
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
    <p><strong>队伍特质：</strong>每支队伍自带一项常驻被动，战斗中在能量旁显示计数。${Object.values(TEAMS).map(t => { const tr = teamTrait(t.id); return tr ? `<br>· ${escapeHtml(t.name.split(' · ')[0])}「${escapeHtml(tr.name)}」：${escapeHtml(tr.text)}` : ''; }).join('')}</p>
    <p><strong>装备：</strong>整局生效的被动道具，最多装备${RELIC_SLOTS}件（决战专属装备也占槽），显示在顶部状态栏，点击查看效果；非战斗时可出售（普通15、罕见25、补给站专属25、稀有40、决战专属50金币）。槽满时获得新装备，需替换一件（被替换的按同样价格折算金币）或放弃新装备。精英战胜利后必得1件；补给站有售；部分事件也会给出。每幕决战胜利后，从3件决战专属装备中选1件（可跳过），这类装备效果更强，但多数附带代价。</p>
    <p><strong>补给品：</strong>一次性战斗道具，最多携带${3}件（部分装备可扩容）。战斗中点击顶部栏位查看说明并使用，需要目标的补给品在多名敌人时要选择目标。战斗胜利后有机会掉落（未掉落时下次机会提高），补给站也有售；栏位满时可以丢弃或替换。</p>
    <p><strong>赛前准备：</strong>选好队伍后，从4个开局选项中选1个：两个免费小加成、一个有代价的较大奖励、以及总是提供的“热身赛”。选项由本局种子决定。</p>
    <p><strong>难度等级：</strong>用某支队伍打通三幕后，为该队伍解锁下一难度（最高${MAX_ASCENSION}级）。每一级在之前所有规则之上再加一条，开赛前在首页选择。</p>
    <p><strong>解锁：</strong>每支队伍初次游玩时队伍专属卡较少，装备也少 15 件。战斗胜利 +1 解锁经验，每击败一幕决战对手 +10，打通三幕再 +10；每升一级为该队伍加入 8 张战术卡并开放 3 件装备，共 5 级，下一局起生效。首页显示进度。</p>
    <p><strong>跳过与补给站：</strong>跳过战后选卡可得 15 金币，或 1 次免费刷新补给货架（可留到之后的补给站）。补给货架可付费刷新：每个补给站第一次 20 金币，之后每次 +10。每个补给站提供 1 项战术投资（150–220 金币），买下后整局生效，同一项只能买一次；顶部栏显示已拥有的投资。</p>
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
      <div class="team-name">${escapeHtml(t.name)}</div>
      <div class="team-desc">${escapeHtml(t.desc)}</div>
      ${traitTagHtml(t.id)}
    </div>
  `).join('');
  const unlocks = loadAscensionUnlocks();
  selectedAscension = Math.min(selectedAscension, unlocks[selectedTeam] || 0);

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
      <div id="ascension-picker">${ascensionPickerHtml(unlocks)}</div>
      <div id="unlock-progress">${unlockBarHtml(selectedTeam)}${unlockTestHtml()}</div>
      <div class="home-actions">
        <button class="btn primary" id="btn-new-secondary">确认开赛</button>
        <button class="btn" id="btn-continue" ${continueDisabled ? 'disabled' : ''}>继续上局</button>
      </div>
      <nav class="nav-links" aria-label="其他入口">
        <button class="hero-link" id="btn-guide-home">怎么玩</button>
        <button class="hero-link" id="btn-library">图鉴</button>
        <button class="hero-link" id="btn-history">战绩</button>
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
    const fresh = loadAscensionUnlocks();
    selectedAscension = Math.min(selectedAscension, fresh[selectedTeam] || 0);
    document.getElementById('ascension-picker').innerHTML = ascensionPickerHtml(fresh);
    bindAscensionPicker();
    renderUnlockProgress();
  }
  function renderUnlockProgress() {
    const host = document.getElementById('unlock-progress');
    if (!host) return;
    host.innerHTML = unlockBarHtml(selectedTeam) + unlockTestHtml();
    host.querySelector('#btn-unlock-all')?.addEventListener('click', () => {
      const on = toggleAllUnlocks();
      showNotice(on ? '测试：之后新开的对局全部解锁。' : '已恢复正常解锁进度。');
      renderUnlockProgress();
      host.querySelector('.unlock-test')?.setAttribute('open', '');
    });
  }
  renderUnlockProgress();
  function bindAscensionPicker() {
    document.querySelectorAll('[data-asc]').forEach(el => el.addEventListener('click', () => {
      if (el.disabled) return;
      selectedAscension = Number(el.dataset.asc);
      document.getElementById('ascension-picker').innerHTML = ascensionPickerHtml(loadAscensionUnlocks());
      bindAscensionPicker();
    }));
  }
  bindAscensionPicker();

  function startNewGame() {
    if (loadState()) {
      const confirmOverwrite = window.confirm('开始新局将覆盖当前存档，确定？');
      if (!confirmOverwrite) return;
      recordNewAbandon(loadState());
      recordAbandonedRun(loadState());
    }
    try {
      const seed = crypto.randomUUID();
      state = createRun(seed, selectedTeam, { ascension: selectedAscension, opening: true, ...unlockRunOptions(selectedTeam) });
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
  document.getElementById('btn-history').addEventListener('click', openHistory);
}

// Difficulty picker for the selected team: unlocked levels are selectable, the
// next locked one is shown with how to unlock it. Every level lists its rule.
function ascensionPickerHtml(unlocks) {
  const top = unlocks[selectedTeam] || 0;
  const teamName = TEAMS[selectedTeam].name.split(' · ')[0];
  const shown = Math.min(MAX_ASCENSION, top + 1);
  const rows = [];
  for (let lv = 0; lv <= shown; lv++) {
    const locked = lv > top;
    rows.push(`<button type="button" class="asc-level${lv === selectedAscension ? ' selected' : ''}${locked ? ' locked' : ''}" data-asc="${lv}" ${locked ? 'disabled' : ''} aria-pressed="${lv === selectedAscension}">
      <b>${lv === 0 ? '基础' : '难度 ' + lv}</b><span>${locked ? `用${escapeHtml(teamName)}在${lv - 1 ? '难度 ' + (lv - 1) + ' ' : '基础难度'}通关三幕后解锁` : escapeHtml(ASCENSION_RULES[lv])}</span></button>`);
  }
  return `<section class="ascension-picker" aria-label="难度等级">
    <h3 class="asc-title">难度等级 <small>${escapeHtml(teamName)} 已解锁至 ${top} 级 · 规则逐级叠加</small></h3>
    <div class="asc-levels">${rows.join('')}</div>
  </section>`;
}

// Top strip during a run: equipment icons + supply slots. Supplies open a small
// panel with their rule and 使用 / 丢弃 (使用 only in combat).
function runStripHtml() {
  if (!state) return '';
  const gearSlots = [];
  for (let i = 0; i < RELIC_SLOTS; i++) {
    const r = state.relics[i];
    gearSlots.push(r ? equipIconHtml(r.id, { tag: 'button', attrs: `type="button" data-gear-index="${i}"` }) : '<span class="gear-icon gear-empty" aria-label="空装备槽"></span>');
  }
  const gear = gearSlots.join('');
  const slots = [];
  const total = supplySlots(state);
  for (let i = 0; i < total; i++) {
    const id = state.supplies?.[i];
    slots.push(id ? `<button type="button" class="supply-slot filled" data-supply-index="${i}" title="${escapeHtml(SUPPLIES[id].name + '：' + SUPPLIES[id].desc)}" aria-label="补给品：${escapeHtml(SUPPLIES[id].name)}">${supplyGlyphHtml(id)}</button>`
      : `<span class="supply-slot empty" aria-label="空补给品栏位"></span>`);
  }
  return `<div class="run-strip" role="region" aria-label="装备与补给品">
    <div class="strip-group gear-row" aria-label="装备"><span class="strip-label">装备 ${state.relics.length}/${RELIC_SLOTS}</span>${gear}</div>
    <div class="strip-group supply-row" aria-label="补给品"><span class="strip-label">补给品</span>${slots.join('')}</div>
    ${investChipHtml(state)}
  </div>`;
}

function renderRunStrip() {
  const host = document.getElementById('run-strip');
  if (!host) return;
  host.innerHTML = state && !['opening', 'openingPick'].includes(state.phase) ? runStripHtml() : '';
  host.querySelectorAll('[data-gear-index]').forEach(el => el.addEventListener('click', () => openGearPanel(Number(el.dataset.gearIndex))));
  host.querySelectorAll('[data-supply-index]').forEach(el => el.addEventListener('click', () => openSupplyPanel(Number(el.dataset.supplyIndex))));
  host.querySelector('#btn-invest-list')?.addEventListener('click', openInvestPanel);
}

// Owned 战术投资 (whole-run upgrades bought at shops).
function openInvestPanel() {
  if (!state || presentationBusy) return;
  const modalRoot = document.getElementById('modal-root');
  modalRoot.innerHTML = `<div class="modal-overlay" id="invest-overlay"><div class="modal supply-modal" role="dialog" aria-modal="true" aria-label="战术投资">
    <h3>战术投资</h3>${investListHtml(state)}
    <div class="supply-actions"><button class="btn" id="invest-close">关闭</button></div>
  </div></div>`;
  const close = () => { modalRoot.innerHTML = ''; };
  const overlay = modalRoot.querySelector('#invest-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  modalRoot.querySelector('#invest-close').addEventListener('click', close);
  modalRoot.querySelector('#invest-close').focus();
}

// Equipment detail with 出售 (not during combat).
function openGearPanel(index) {
  const r = state?.relics?.[index];
  if (!r || presentationBusy) return;
  const modalRoot = document.getElementById('modal-root');
  const canSell = state.phase !== 'combat' && state.phase !== 'result' && !state.pendingRelics?.length;
  modalRoot.innerHTML = `<div class="modal-overlay" id="gear-overlay"><div class="modal supply-modal" role="dialog" aria-modal="true" aria-label="装备">
    ${equipTileHtml(r.id)}
    <div class="supply-actions"><button class="btn" id="gear-sell" ${canSell ? '' : 'disabled'}>出售（+${relicSellValue(r.id)} 金币）</button><button class="btn" id="gear-close">关闭</button>
    ${canSell ? '' : '<p class="supply-note">战斗中不能出售装备。</p>'}</div>
  </div></div>`;
  const close = () => { modalRoot.innerHTML = ''; };
  const overlay = modalRoot.querySelector('#gear-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  modalRoot.querySelector('#gear-close').addEventListener('click', close);
  modalRoot.querySelector('#gear-sell').addEventListener('click', () => { if (!canSell) return; close(); dispatch({ type: 'sellRelic', index }); });
  modalRoot.querySelector('#gear-close').focus();
}

// Slots full: the new piece waits until one is replaced (sold) or it is declined.
function renderPendingRelic() {
  const id = state?.pendingRelics?.[0];
  const modalRoot = document.getElementById('modal-root');
  if (!id) { modalRoot.querySelector('#pending-gear-overlay')?.remove(); return; }
  modalRoot.innerHTML = `<div class="modal-overlay" id="pending-gear-overlay"><div class="modal pending-gear-modal" role="dialog" aria-modal="true" aria-label="装备槽已满">
    <h2>装备槽已满（${RELIC_SLOTS}/${RELIC_SLOTS}）</h2>
    <p class="supply-note">新装备：</p>
    ${equipTileHtml(id)}
    <p class="supply-note">替换一件现有装备（被替换的按品级折算金币），或放弃新装备：</p>
    <div class="pending-gear-list">${state.relics.map((r, i) => `<button class="gear-choice" data-replace-gear="${i}">${equipTileHtml(r.id, `<em class="loot-tag">替换并获得 ${relicSellValue(r.id)} 金币</em>`)}</button>`).join('')}</div>
    <div class="supply-actions"><button class="btn" id="decline-gear">放弃新装备</button></div>
  </div></div>`;
  modalRoot.querySelectorAll('[data-replace-gear]').forEach(el => el.addEventListener('click', () => { modalRoot.innerHTML = ''; dispatch({ type: 'replaceRelic', index: Number(el.dataset.replaceGear) }); }));
  modalRoot.querySelector('#decline-gear').addEventListener('click', () => { modalRoot.innerHTML = ''; dispatch({ type: 'declineRelic' }); });
  modalRoot.querySelector('#decline-gear').focus();
}

function openSupplyPanel(index) {
  const id = state?.supplies?.[index];
  const sp = SUPPLIES[id];
  if (!sp || presentationBusy) return;
  const modalRoot = document.getElementById('modal-root');
  const inCombat = state.phase === 'combat' && !state.battle?.pendingDiscover;
  const living = inCombat ? livingEnemies(state.battle) : [];
  const legal = inCombat ? legalActions(state).filter(a => a.type === 'useSupply' && a.index === index) : [];
  let useHtml = '';
  if (!inCombat) useHtml = '<p class="supply-note">只能在战斗中使用。</p>';
  else if (sp.target === 'enemy' && living.length > 1) useHtml = `<p class="supply-note">选择目标：</p><div class="supply-targets">${legal.map(a => { const e = living.find(x => x.uid === a.target); return `<button class="btn primary" data-use-target="${a.target}">${escapeHtml(e?.name || a.target)}</button>`; }).join('')}</div>`;
  else useHtml = `<button class="btn primary" id="supply-use">使用</button>`;
  modalRoot.innerHTML = `<div class="modal-overlay" id="supply-overlay"><div class="modal supply-modal" role="dialog" aria-modal="true" aria-label="补给品">
    ${supplyTileHtml(id)}
    <div class="supply-actions">${useHtml}<button class="btn" id="supply-discard">丢弃</button><button class="btn" id="supply-close">关闭</button></div>
  </div></div>`;
  const close = () => { modalRoot.innerHTML = ''; };
  const overlay = modalRoot.querySelector('#supply-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  modalRoot.querySelector('#supply-close').addEventListener('click', close);
  modalRoot.querySelector('#supply-discard').addEventListener('click', () => { close(); dispatch({ type: 'discardSupply', index }); });
  modalRoot.querySelector('#supply-use')?.addEventListener('click', () => { close(); dispatch({ type: 'useSupply', index }); });
  modalRoot.querySelectorAll('[data-use-target]').forEach(el => el.addEventListener('click', () => { close(); dispatch({ type: 'useSupply', index, target: el.dataset.useTarget }); }));
  (modalRoot.querySelector('#supply-use') || modalRoot.querySelector('[data-use-target]') || modalRoot.querySelector('#supply-close')).focus();
}

function renderBossRelic(root) {
  const options = state.bossRelic?.options || [];
  root.innerHTML = `
    <div class="phase-container boss-relic-screen">
      <div class="ops-eyebrow">DEBRIEF // 决战奖励</div>
      <h2 class="ops-title">决战专属装备 · 三选一</h2>
      <p class="opening-sub">效果强力，多数附带代价；可以跳过。</p>
      <div class="gear-choices">${options.map(id => `<button class="gear-choice" data-boss-relic="${id}">${equipTileHtml(id)}</button>`).join('')}</div>
      <button class="btn ops-skip" id="btn-boss-skip">跳过，不拿装备</button>
    </div>`;
  root.querySelectorAll('[data-boss-relic]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'bossRelic', id: el.dataset.bossRelic })));
  root.querySelector('#btn-boss-skip').addEventListener('click', () => dispatch({ type: 'bossRelic', id: null }));
}

const OPENING_GROUP_LABEL = { free: '免费', trade: '代价换奖励', steady: '稳健' };
function renderOpening(root) {
  const op = state.opening;
  const tr = teamTrait(state.team);
  const optionsHtml = op.options.map(o => `
    <button class="opening-option group-${o.group}" data-opening="${o.id}">
      <span class="opening-group">${OPENING_GROUP_LABEL[o.group] || ''}</span>
      <span class="opening-text">${escapeHtml(o.text)}</span>
      ${o.cards ? `<span class="opening-note">可选：${o.cards.map(id => escapeHtml(CARDS[id]?.name || id)).join(' / ')}</span>` : ''}
    </button>`).join('');
  root.innerHTML = `
    <div class="phase-container opening-screen">
      <div class="ops-eyebrow">PRE-MATCH // 赛前准备</div>
      <h2 class="ops-title">赛前准备 · 四选一</h2>
      <p class="opening-sub">${escapeHtml(TEAMS[state.team].name)}${state.ascension ? ` · 难度 ${state.ascension}` : ''} · HP ${state.hp}/${state.maxHp} · 💰 ${state.money}</p>
      ${tr ? `<div class="opening-trait"><span class="trait-icon trait-${tr.id}">${TRAIT_ICONS[tr.id]}</span><span><b>队伍特质 · ${escapeHtml(tr.name)}</b><br>${escapeHtml(tr.text)}</span></div>` : ''}
      <div class="opening-options">${optionsHtml}</div>
    </div>`;
  root.querySelectorAll('[data-opening]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'opening', choice: el.dataset.opening })));
}

function renderOpeningPick(root) {
  const pick = state.opening?.pick;
  if (!pick) return;
  let body = '';
  let title = '';
  if (pick.kind === 'card') {
    title = '选择一张牌加入牌组';
    body = `<div class="reward-cards">${pick.cards.map(id => `<button class="reward-card tc-pick" data-pick-id="${id}" aria-label="选择 ${escapeHtml(CARDS[id]?.name || id)}">${cardHtml(id)}</button>`).join('')}</div>
      <button class="btn ops-skip" id="btn-pick-skip">跳过，不加入新牌</button>`;
  } else {
    const upgrade = pick.kind === 'upgrade';
    title = upgrade ? '选择一张牌升级' : '选择一张牌删除';
    const legalUids = new Set(legalActions(state).map(a => a.uid));
    body = `<div class="opening-deck">${state.deck.filter(c => legalUids.has(c.uid)).map(c => `<button class="tc-pick opening-deck-card" data-pick-uid="${c.uid}" aria-label="${upgrade ? '升级' : '删除'} ${escapeHtml(getCardDefinition(c.id)?.name || c.id)}">${cardHtml(c.id, { up: upgrade ? true : c.up, badge: upgrade ? '升级后' : '' })}</button>`).join('')}</div>`;
  }
  root.innerHTML = `
    <div class="phase-container opening-screen">
      <div class="ops-eyebrow">PRE-MATCH // 赛前准备</div>
      <h2 class="ops-title">${title}</h2>
      ${body}
    </div>`;
  root.querySelectorAll('[data-pick-id]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'openingPick', id: el.dataset.pickId })));
  root.querySelectorAll('[data-pick-uid]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'openingPick', uid: el.dataset.pickUid })));
  root.querySelector('#btn-pick-skip')?.addEventListener('click', () => dispatch({ type: 'openingPick', id: null }));
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
        <button class="btn" id="btn-deck">牌组 ${state.deck.length}</button>
        <button class="btn" id="btn-library">图鉴</button>
        <button class="btn" id="btn-guide">怎么玩</button>
        <button class="btn" id="btn-abandon">放弃本局</button>
        <button class="btn" id="btn-home">返回首页</button>
        ${soundToggleHtml()}
      </div>
    </header>
    <div id="run-strip"></div>
    <div id="game-root" style="flex:1;display:flex;flex-direction:column;"></div>
  `;
  document.getElementById('btn-library').addEventListener('click', () => {
    showLibrary = true;
    renderLibraryModal();
  });
  document.getElementById('btn-guide').addEventListener('click', renderGuideModal);
  document.getElementById('btn-deck').addEventListener('click', () => { if (state && !presentationBusy) openDeckViewer(state, 'deck'); });
  document.getElementById('btn-abandon').addEventListener('click', () => {
    if (!state || presentationBusy || state.phase === 'result') return;
    if (!window.confirm('放弃本局？本局会记入战绩，存档将被清除。')) return;
    clearCombatPresentation();
    const entry = recordNewAbandon(state);
    recordAbandonedRun(state);
    clearState();
    state = null;
    if (entry) renderEntryPage(entry); else renderHome();
  });
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
  const deckBtn = document.getElementById('btn-deck');
  if (deckBtn) deckBtn.textContent = `牌组 ${state.deck.length}`;
  const abandonBtn = document.getElementById('btn-abandon');
  if (abandonBtn) abandonBtn.hidden = state.phase === 'result';
  renderRunStrip();
  renderPendingRelic();
  if (state.phase === 'opening') renderOpening(root);
  else if (state.phase === 'openingPick') renderOpeningPick(root);
  else if (state.phase === 'map') renderMap(root);
  else if (state.phase === 'combat') renderCombat(root);
  else if (state.phase === 'reward') renderReward(root);
  else if (state.phase === 'shop') renderShop(root);
  else if (state.phase === 'rest') renderRest(root);
  else if (state.phase === 'event') renderEvent(root);
  else if (state.phase === 'crate') renderCrate(root);
  else if (state.phase === 'intermission') renderIntermission(root);
  else if (state.phase === 'bossRelic') renderBossRelic(root);
  else if (state.phase === 'result') renderResult(root);
  else renderHome();
}

const MAP_GLYPHS = { battle: '⚔', elite: '☠', event: '?', shop: '⇄', rest: '✚', crate: '▣', boss: '👑' };
const REVEALED_NAMES = { battle: '遭遇战', shop: '战术补给', crate: '补给箱', event: '事件' };

function renderMap(root) {
  const act = ACTS[state.act - 1];
  const nodes = state.map.nodes;
  const edges = state.map.edges;
  const currentKey = state.currentNode;
  const completedSet = new Set(state.completed);
  const legal = legalActions(state).filter(a => a.type === 'enter');
  const availableKeys = new Set(legal.map(a => a.key));

  // 15 floors + boss: the board keeps the old ~84px floor spacing.
  const w = 400, h = 1360;
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
    const cls = `map-node kind-${n.kind}${n.revealed ? ' revealed' : ''} ${isAvailable ? 'available' : ''} ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`;
    const glyph = MAP_GLYPHS[n.revealed || n.kind] || '·';
    const label = n.name || { battle: '战斗', elite: '强敌', event: '未知', shop: '补给', rest: '休整', crate: '补给箱', boss: 'Boss' }[n.kind] || n.kind;
    return `<g class="${cls}" data-key="${n.key}" tabindex="${isAvailable ? '0' : '-1'}" role="button" aria-label="${n.kind === 'boss' ? 'Boss：' : n.kind === 'elite' ? '强敌：' : ''}${escapeHtml(n.name)}" style="cursor:pointer">
      <title>${escapeHtml(({ battle: '常规比赛', elite: '强敌', event: n.revealed ? '未知 · 已揭晓：' + (REVEALED_NAMES[n.revealed] || '') : '未知', shop: '战术补给', rest: '休整', crate: '补给箱', boss: '幕末决战' })[n.kind] || n.kind)}：${escapeHtml(n.name || '')}</title>
      <circle cx="${sx(n.x)}" cy="${sy(n.y)}" r="${n.kind === 'boss' ? 24 : 18}" />
      <text class="map-glyph" x="${sx(n.x)}" y="${sy(n.y) + 1}">${glyph}</text>
      ${isAvailable ? `<text class="map-choice-label" x="${sx(n.x)}" y="${sy(n.y) - 29}">${escapeHtml(label)}</text>` : ''}
    </g>`;
  }).join('');

  // This act's boss, fixed by seed when the map was built (older saves: read the boss node).
  const bossId = state.map.boss || nodes.find(n => n.kind === 'boss')?.enemy;
  const boss = BOSSES[bossId];
  const bossHtml = boss ? `<div class="boss-preview" style="--boss-color:${boss.color}" role="note" aria-label="本幕决赛对手：${escapeHtml(boss.name)}。${escapeHtml(boss.text)}">
        <span class="boss-preview-figure" data-character-variant="${escapeHtml(boss.look)}"></span>
        <span class="boss-preview-body"><small><i class="boss-preview-emblem">${statusIcon(boss.icon)}</i>本幕决赛 · 第16层</small><b>${escapeHtml(boss.name)}</b><em>${highlightKeywords(boss.text)}</em></span>
      </div>` : '';

  root.innerHTML = `
    <div class="map-container">
      ${bossHtml}
      ${guideStrip('map', '先点亮起的节点开赛。向上滑动可预览后续路线和决赛；每场胜利后挑一张新牌。')}
      <div class="map-stage-info">
        <span>幕 ${state.act}：${act.name} · ${act.subtitle} · ${state.completed.filter(key => state.map.nodes.some(node => node.key === key && node.kind !== 'boss')).length}/15 站 · 之后是决赛${state.ascension ? ` · 难度 ${state.ascension}` : ''}${state.warmup ? ` · 热身赛剩余 ${state.warmup} 场` : ''}</span>
        <span>HP ${state.hp}/${state.maxHp} · 💰 ${state.money}</span>
      </div>
      <div class="map-quick-legend" aria-label="路线图标说明">⚔ 比赛　☠ 强敌　? 未知　⇄ 补给　▣ 补给箱　✚ 休整　👑 决赛</div>
      <div class="map-scroll">
        <svg class="map-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          ${edgesSvg}
          ${nodesSvg}
        </svg>
      </div>
      <div class="map-legend">
        <div class="legend-item"><span class="legend-icon">⚔</span> 常规比赛：标准战斗，获胜得卡牌奖励。</div>
        <div class="legend-item"><span class="legend-icon">☠</span> 强敌：更高难度，奖励更丰厚。</div>
        <div class="legend-item"><span class="legend-icon">?</span> 未知：进入后揭晓，多半是事件，也可能是比赛、补给站或补给箱。</div>
        <div class="legend-item"><span class="legend-icon">⇄</span> 转会补给：购买卡牌或删除卡牌。</div>
        <div class="legend-item"><span class="legend-icon">▣</span> 补给箱：必得金币，常有战术装备。</div>
        <div class="legend-item"><span class="legend-icon">✚</span> 休整：回复生命或升级卡牌。</div>
        <div class="legend-item"><span class="legend-icon">👑</span> BOSS：幕末强敌，击败进入下一幕。</div>
      </div>
      <div id="node-details" class="node-details" aria-live="polite"></div>
    </div>
  `;
  bindGuideStrip(root, 'map');

  const details = root.querySelector('#node-details');
  const showDetails = (node) => {
    const kindNames = { battle: '常规比赛', elite: '高压强敌', event: '未知', shop: '战术补给', rest: '战术休整', crate: '补给箱', boss: 'BOSS' };
    const kindDesc = { battle: '标准战斗，获胜获得卡牌奖励。', elite: '更高难度，奖励更丰厚。', event: node.revealed ? `已揭晓：${REVEALED_NAMES[node.revealed]}。` : '进入后揭晓：多半是事件，也可能是比赛、补给站或补给箱。', shop: '购买卡牌或删除卡牌。', rest: '回复生命或升级卡牌。', crate: '打开后必得金币，常有战术装备。', boss: boss ? `幕末强敌，击败进入下一幕。${boss.text}` : '幕末强敌，击败进入下一幕。' };
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
  const badges = dead ? '' : statusBadges([['block', st.block], ['strength', st.strength], ['aim', st.aim], ['thorns', e.traitState?.spikes], ['burn', st.burn], ['smoke', st.smoke], ['flash', st.flash], ['weak', st.weak], ['vuln', st.vuln]]);
  const traitInfo = !dead && e.trait && TRAITS[e.trait.id];
  const plays = state.battle?.playsThisTurn || 0;
  const traitCount = e.trait?.id === 'tempo' ? ` ${e.tempoCount || 0}/${e.trait.n}`
    : e.trait?.id === 'overwatch' ? ` ${Math.min(plays, e.trait.n)}/${e.trait.n}`
    : e.trait?.id === 'modeShift' ? (e.traitState?.spikes ? ' · 架势中' : ` ${Math.max(0, e.maxHp - e.hp)}/${e.traitState?.nextShift ?? e.trait.n}`) : '';
  const traitHtml = traitInfo ? `<span class="trait-tag" tabindex="0" title="${escapeHtml(traitInfo.text(e.trait.n))}">${statusIcon(traitInfo.icon)}${escapeHtml(traitInfo.name)}${traitCount}</span>` : '';
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
  renderRunStrip();
  const hideIntents = hasRelic(state, 'R41');
  const enemies = battleEnemies(b);
  const living = enemies.filter(e => e.hp > 0);
  const intents = describeIntentsActual(state);
  const incoming = incomingDamage(state).total;
  const legal = legalActions(state);
  const playableUids = new Set(legal.filter(a => a.type === 'play').map(a => a.uid));
  const canStance = legal.some(a => a.type === 'stance');
  const stanceFree = b.squad?.id === 'dispatch' && !b.squad.used;
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
      ${cardHtml(card.id, { up: card.up, cost: card.free ? 0 : display.cost, badge: card.temp ? '临时' : card.grow ? `成长×${card.grow}` : '', text: display.text })}
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
            <div class="energy-orb" title="能量"><b>${b.energy}</b><small>/${baseEnergy(state)}</small></div>
            <div class="ally-vitals">
              <div class="hp-line"><span class="value">HP ${state.hp}/${state.maxHp}</span><div class="hp-bar"><i style="width:${state.hp / state.maxHp * 100}%"></i></div></div>
              <div class="block-value" data-block="${b.playerBlock}"><span class="mini-armor" aria-hidden="true"></span><span>布防 ${b.playerBlock}</span></div>
              ${hideIntents ? '' : `<div class="rm-incoming" title="敌方意图中的数字为实际伤害：已计入火力、压制、易伤、烟雾、闪光、战场与姿态，未扣除布防。">预计受到 <b>${incoming}</b> 伤害${incoming ? ` · 结束回合失去 <b>${Math.max(0, incoming - b.playerBlock)}</b>` : ''}</div>`}
            </div>
            ${squadChipHtml(b)}
            <div class="stance-chip">
              <div class="stance-name" title="${b.stance === 'cover' ? '掩护：每回合第一次布防+3' : '前压：每回合第一次攻击+3，但每次受到攻击+2'}">${b.stance === 'cover' ? '掩护' : '前压'}<small>${b.stance === 'cover' ? '首次布防+3' : '首攻+3 · 受击+2'}</small></div>
              <button class="btn" id="btn-stance" ${canStance ? '' : 'disabled'} title="${stanceFree ? '切换姿态：本回合免费（机动调度），每回合一次' : '切换姿态：1费，每回合一次'}">${b.stanceSwitchUsedThisTurn ? '已切换' : stanceFree ? '切换 0费' : '切换 1费'}</button>
            </div>
          </div>
        </section>
        <section class="enemy-zone" aria-label="对手" data-count="${enemies.length}">
          ${enemies.map(e => enemyUnitHtml(e, { intentText: hideIntents ? '意图未知（静默通讯协议）' : e.intent === null && e.hp > 0 ? '本回合不行动' : intents[e.uid], aiming: !!aimCard, isPrimary: e.uid === firstLiving })).join('')}
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
      openDeckViewer(state, { draw: 'drawPile', discard: 'discardPile', exhaust: 'exhaustPile' }[btn.dataset.pile] || 'deck');
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
    onMove: (card, point) => {
      clearDrop();
      const zone = zoneAt(point, card);
      zone?.classList.add('drop-ready');
      const name = zone?.dataset.enemyUid ? zone.querySelector('.enemy-name')?.textContent?.trim() : '';
      const text = zone ? `松手打出${name ? ` → ${name}` : ''}` : needsPick(card) ? '拖到敌人身上' : '向上拖出手牌区';
      showDragHint(text, { ready: !!zone, x: point.x, y: point.y, lift: point.lift });
    },
    onDrop: (card, point) => {
      const zone = zoneAt(point, card); clearDrop();
      if (!zone || presentationBusy || !playableUids.has(card.uid)) return false;
      selectedCardUid = card.uid;
      const target = zone.dataset.enemyUid;
      return dispatch(target && cardNeedsTarget(card) ? { type: 'play', uid: card.uid, target } : { type: 'play', uid: card.uid });
    },
    onEnd: (card, point, landed) => {
      clearDrop(); hideDragHint();
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
  const gained = (b.rewardRelics || []).map(id => `<div class="loot-line">${equipTileHtml(id, `<em class="loot-tag">${state.relics.some(r => r.id === id) ? '已获得' : '装备槽已满：替换或放弃'}</em>`)}</div>`).join('');
  let supplyHtml = '';
  if (b.rewardSupply) {
    const full = (state.supplies || []).length >= supplySlots(state);
    supplyHtml = `<div class="loot-line">${supplyTileHtml(b.rewardSupply, full ? '<em class="loot-tag">补给品栏位已满：替换一件，或放弃</em>' : '')}
      <div class="loot-actions">${full ? state.supplies.map((sid, i) => `<button class="btn" data-take-replace="${i}">替换「${escapeHtml(SUPPLIES[sid].name)}」</button>`).join('') : '<button class="btn primary" id="btn-take-supply">收下</button>'}</div></div>`;
  } else if (b.rewardSupplyTaken) {
    supplyHtml = `<div class="loot-line">${supplyTileHtml(b.rewardSupplyTaken, '<em class="loot-tag">已放入补给品栏位</em>')}</div>`;
  }
  // 后勤车队 can add a second supply: list the ones already stowed alongside the pending one.
  if (b.rewardSuppliesTaken?.length) supplyHtml = b.rewardSuppliesTaken.map(id => `<div class="loot-line">${supplyTileHtml(id, '<em class="loot-tag">已放入补给品栏位</em>')}</div>`).join('') + (b.rewardSupply ? supplyHtml : '');
  root.innerHTML = `
    <div class="phase-container">
      <div class="ops-eyebrow">DEBRIEF // 战后简报</div>
      ${gained || supplyHtml ? `<div class="loot-list">${gained}${supplyHtml}</div>` : ''}
      <h2 class="ops-title">补充战术 · ${cards.length === 4 ? '四' : '三'}选一</h2>

      <div class="reward-cards">
        ${rewardHtml}
      </div>
      ${econOn(state) ? skipOptionsHtml(state) : '<button class="btn ops-skip" id="btn-skip">跳过，不加入新牌</button>'}
    </div>
  `;
  document.querySelectorAll('.reward-card').forEach(el => {
    el.addEventListener('click', () => dispatch({ type: 'reward', id: el.dataset.id }));
  });
  document.getElementById('btn-skip')?.addEventListener('click', () => dispatch({ type: 'reward', id: null }));
  root.querySelectorAll('[data-skip-comp]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'reward', id: null, comp: el.dataset.skipComp })));
  root.querySelector('#btn-take-supply')?.addEventListener('click', () => dispatch({ type: 'takeSupply' }));
  root.querySelectorAll('[data-take-replace]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'takeSupply', replace: Number(el.dataset.takeReplace) })));
}

// The quartermaster's line depends on what the player can afford right now.
function quartermasterLine(shop) {
  const cheapest = Math.min(...shop.cards.map(item => shopPrice(item, state)), Infinity);
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
    const cost = shopPrice(item, state);
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
      <h3 class="shelf-title">补给货架${econOn(state) ? ` <span class="reroll-control">${rerollButtonHtml(state)}</span>` : ''}</h3>
      <div class="shop-shelf">${shopCards}</div>
      ${econOn(state) ? investOfferHtml(state) : ''}
      <h3 class="shelf-title">装备柜台</h3>
      <div class="gear-shelf">${(shop.relics || []).map((item, idx) => { const cost = shopPrice(item, state); return `<div class="gear-offer">${equipTileHtml(item.id)}<button class="btn" data-buy-relic="${idx}" ${state.money >= cost && state.relics.length < RELIC_SLOTS ? '' : 'disabled'}>${cost} 金币${state.relics.length >= RELIC_SLOTS ? ' · 装备槽已满' : state.money >= cost ? ' · 买下' : ' · 不足'}</button></div>`; }).join('') || '<p class="shelf-empty">装备已售罄。</p>'}</div>
      <h3 class="shelf-title">补给品 <small>栏位 ${(state.supplies || []).length}/${supplySlots(state)}</small></h3>
      <div class="gear-shelf">${(shop.supplies || []).map((item, idx) => { const cost = shopPrice(item, state); const full = (state.supplies || []).length >= supplySlots(state); const ok = state.money >= cost && !full; return `<div class="gear-offer">${supplyTileHtml(item.id)}<button class="btn" data-buy-supply="${idx}" ${ok ? '' : 'disabled'}>${cost} 金币${full ? ' · 栏位已满' : state.money >= cost ? ' · 买下' : ' · 不足'}</button></div>`; }).join('') || '<p class="shelf-empty">补给品已售罄。</p>'}</div>
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
  document.querySelectorAll('[data-buy-relic]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'buyRelic', index: Number(el.dataset.buyRelic) })));
  document.querySelectorAll('[data-buy-supply]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'buySupply', index: Number(el.dataset.buySupply) })));
  document.querySelectorAll('[data-upgrade-category]').forEach(el => {
    el.addEventListener('click', () => dispatch({type:'upgradeCategory', category:el.dataset.upgradeCategory}));
  });
  document.querySelectorAll('[data-remove-uid]').forEach(el => {
    el.addEventListener('click', () => {
      dispatch({ type: 'remove', uid: el.dataset.removeUid });
    });
  });
  document.getElementById('btn-leave').addEventListener('click', () => dispatch({ type: 'leave' }));
  document.getElementById('btn-reroll')?.addEventListener('click', () => dispatch({ type: 'rerollShop' }));
  document.getElementById('btn-invest')?.addEventListener('click', () => dispatch({ type: 'buyInvest' }));
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
        <div class="rest-option${hasRelic(state, 'R42') ? ' is-disabled' : ''}" id="rest-heal" ${hasRelic(state, 'R42') ? 'aria-disabled="true" title="无休整合同：休整点不能回复生命"' : ''}>
          <div class="card-title">回复生命</div>
          <div class="card-desc">恢复最大生命的${Math.round(restHealRate(state) * 100)}%（${restHealAmount(state)}点）</div>
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
  const view = describeEvent(state);
  if (!view) return;
  if (view.pending) {
    const pickVerb = { upgrade: '升级', remove: '永久移除', transform: '变换', duplicate: '复制', cleanse: '移除' }[view.pending.kind] || '选择';
    const cards = view.pending.candidates.map(uid => {
      const c = state.deck.find(card => card.uid === uid);
      const upgrade = view.pending.kind === 'upgrade';
      return `<button class="event-pick-card tc-pick" data-pick-uid="${uid}" aria-label="${pickVerb} ${escapeHtml(getCardDefinition(c.id)?.name || c.id)}">${cardHtml(c.id, { up: upgrade ? true : c.up })}<span class="event-pick-verb">${pickVerb}${upgrade ? '（显示升级后）' : ''}</span></button>`;
    }).join('');
    root.innerHTML = `
      <div class="phase-container event-room">
        <div class="ops-eyebrow">EVENT // ${escapeHtml(view.title)}</div>
        <h2 class="ops-title">${escapeHtml(view.pending.title)} · 选择一张牌</h2>
        <p class="event-effects">确认后生效：${escapeHtml(view.pending.effects)}</p>
        <div class="event-pick-grid">${cards}</div>
        <button class="btn ops-skip" id="btn-event-back">返回事件，不付出代价</button>
      </div>`;
    root.querySelectorAll('[data-pick-uid]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'eventPick', uid: el.dataset.pickUid })));
    document.getElementById('btn-event-back').addEventListener('click', () => dispatch({ type: 'eventBack' }));
    return;
  }
  const choicesHtml = view.options.map(o => `
    <button class="event-option${o.reason ? ' is-disabled' : ''}" data-choice="${o.id}" ${o.reason ? 'disabled aria-disabled="true"' : ''}>
      <strong>${escapeHtml(o.title)}</strong>
      <span class="event-option-effects">${escapeHtml(o.effects)}</span>
      ${o.reason ? `<small class="event-option-reason">${escapeHtml(o.reason)}</small>` : ''}
    </button>`).join('');
  root.innerHTML = `
    <div class="phase-container event-room">
      <div class="ops-eyebrow">EVENT // 未知已揭晓</div>
      <h2 class="ops-title">${escapeHtml(view.title)}</h2>
      <p class="event-scene">${escapeHtml(view.scene)}</p>
      <div class="event-options">${choicesHtml}</div>
      <div class="event-status">生命 ${state.hp}/${state.maxHp} · 金币 ${state.money}</div>
    </div>`;
  root.querySelectorAll('.event-option:not([disabled])').forEach(el => {
    el.addEventListener('click', () => dispatch({ type: 'event', choice: el.dataset.choice }));
  });
}

const CRATE_NAMES = { small: '小型补给箱', medium: '中型补给箱', large: '大型补给箱' };
function renderCrate(root) {
  const crate = state.crate;
  if (!crate) return;
  const r = crate.result;
  const relic = r?.equip ? Object.values(RELICS).find(x => x.name === r.equip) : null;
  const loot = r ? `
      <div class="crate-loot">
        <div class="crate-loot-item"><b>+${r.money + r.bonusMoney}</b><span>金币${r.bonusMoney ? `（含无装备补偿 ${r.bonusMoney}）` : ''}</span></div>
        ${relic ? `<div class="crate-loot-item crate-relic"><div class="crate-relic-art">${relicArt(relic.id)}</div><div><b>${escapeHtml(relic.name)}</b><span>${escapeHtml(relic.desc)}</span></div></div>` : '<div class="crate-loot-item"><span>箱里没有战术装备。</span></div>'}
      </div>` : '';
  root.innerHTML = `
    <div class="phase-container crate-room">
      <div class="ops-eyebrow">SUPPLY // 补给箱</div>
      <h2 class="ops-title">${CRATE_NAMES[crate.size] || '补给箱'}</h2>
      <div class="crate-box crate-${crate.size}${crate.opened ? ' is-open' : ''}" aria-hidden="true"><span class="crate-lid"></span><span class="crate-body"></span></div>
      <p class="event-scene">${crate.opened ? '封条已经撕开。' : '一只贴着赛事物流封条的补给箱。越大的箱子越少见，金币越多，也越可能装着战术装备。'}</p>
      ${loot}
      ${crate.opened ? '<button class="btn primary" id="btn-crate-leave">收好物资，继续赛程 →</button>' : '<button class="btn primary" id="btn-crate-open">打开补给箱</button>'}
    </div>`;
  document.getElementById(crate.opened ? 'btn-crate-leave' : 'btn-crate-open').addEventListener('click', () => dispatch({ type: 'crate', choice: crate.opened ? 'leave' : 'open' }));
}

function renderIntermission(root) {
  root.innerHTML = `
    <div class="phase-container">
      <h2>幕间休息</h2>
      <p>全员状态恢复至满，准备进入下一幕</p>
      ${unlockNoticeHtml(state)}
      <button class="btn primary" id="btn-next-act">进入下一幕</button>
    </div>
  `;
  document.getElementById('btn-next-act').addEventListener('click', () => dispatch({ type: 'nextAct' }));
}

function bindResultButtons(entry, onAgain) {
  document.getElementById('rm-again')?.addEventListener('click', onAgain);
  document.getElementById('rm-home')?.addEventListener('click', () => renderHome());
  document.getElementById('rm-history')?.addEventListener('click', openHistory);
  document.getElementById('rm-deck')?.addEventListener('click', () => openDeckViewer(null, 'deck', entry.deck));
}
// Results page shown without a run (after 放弃本局).
function renderEntryPage(entry) {
  rememberScreen('home');
  document.getElementById('modal-root').innerHTML = '';
  document.getElementById('app').innerHTML = `<main class="rm-page">${resultPageHtml(entry)}</main>`;
  bindResultButtons(entry, () => renderHome());
}
function renderResult(root) {
  const win = state.result === 'win';
  const unlocked = win ? recordAscensionWin(state.team, state.ascension || 0) : null;
  const entry = entryFor(state);
  root.innerHTML = resultPageHtml(entry, (unlocked !== null ? `<p class="asc-unlock">已为${escapeHtml(TEAMS[state.team].name.split(' · ')[0])}解锁难度 ${unlocked}：${escapeHtml(ASCENSION_RULES[unlocked])}</p>` : '') + unlockNoticeHtml(state));
  bindResultButtons(entry, () => { clearState(); state = null; renderHome(); });
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
  // 图鉴: entries met in a run are shown; the rest stay silhouettes.
  const seen = collection();
  const enemyIds = Object.keys(ALL_ENEMIES());
  const statusIds = Object.keys(STATUS_CARDS);
  const relicIds = Object.keys(RELICS);

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
          if (!seen.cards.has(id)) return unseenTileHtml('card');
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
        if (!seen.cards.has(c.id)) return unseenTileHtml('card');
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
      html = Object.entries(EQUIP_TIERS).map(([tier, info]) => {
        const list = relics.filter(r => r.tier === tier);
        return `<section class="library-group"><h3 style="--tier:${TIER_COLORS[tier]}">${escapeHtml(info.name)}装备 · ${list.length}</h3><div class="gear-grid">${list.map(r => gearTile(r.id, seen.gear.has(r.id))).join('')}</div></section>`;
      }).join('');
    } else if (activeTab === 'supply') {
      count = SUPPLY_IDS.length;
      html = `<section class="library-group"><h3>补给品 · 一次性战斗道具</h3><div class="gear-grid">${SUPPLY_IDS.map(id => seen.supplies.has(id) ? supplyTileHtml(id) : unseenTileHtml('gear')).join('')}</div></section>`;
    } else if (activeTab === 'enemy') {
      count = enemyIds.length;
      html = `<div class="library-grid rm-enemy-grid">${enemyIds.map(id => enemyTileHtml(id, seen.enemies.has(id))).join('')}</div>`;
    }

    grid.innerHTML = html;
    const found = { tactical: foundText(seen.cards, CARD_IDS), status: foundText(seen.cards, statusIds), relic: foundText(seen.gear, relicIds), supply: foundText(seen.supplies, SUPPLY_IDS), enemy: foundText(seen.enemies, enemyIds) }[activeTab];
    matchSpan.textContent = `已发现 ${found} · 匹配 ${count} ${activeTab === 'relic' || activeTab === 'supply' ? '件' : activeTab === 'enemy' ? '名' : '张'}`;
    grid.classList.toggle('grouped', activeTab === 'relic' || activeTab === 'supply' || activeTab === 'enemy');
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
      <div class="modal" role="dialog" aria-modal="true" aria-label="图鉴">
        <div class="modal-header">
          <h2>图鉴</h2>
          <button class="btn" id="close-library">关闭</button>
        </div>
        <div class="library-tabs" role="tablist" aria-label="分类">
          <button class="library-tab active" role="tab" aria-selected="true" data-tab="tactical">战术牌 (${foundText(seen.cards, CARD_IDS)})</button>
          <button class="library-tab" role="tab" aria-selected="false" data-tab="status">状态牌 (${foundText(seen.cards, statusIds)})</button>
          <button class="library-tab" role="tab" aria-selected="false" data-tab="relic">装备 (${foundText(seen.gear, relicIds)})</button>
          <button class="library-tab" role="tab" aria-selected="false" data-tab="supply">补给品 (${foundText(seen.supplies, SUPPLY_IDS)})</button>
          <button class="library-tab" role="tab" aria-selected="false" data-tab="enemy">对手 (${foundText(seen.enemies, enemyIds)})</button>
        </div>
        <p class="rm-found"><b>已发现</b> 战术牌 ${foundText(seen.cards, CARD_IDS)} · 状态牌 ${foundText(seen.cards, statusIds)} · 装备 ${foundText(seen.gear, relicIds)} · 补给品 ${foundText(seen.supplies, SUPPLY_IDS)} · 对手 ${foundText(seen.enemies, enemyIds)}<small>在对局中被提供、抽到、拥有或交手过的条目才会点亮。</small></p>
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
  initUpgradePeek();
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
