// new-demo/engine.js
import { buildMap, availableNodes } from './season-map.js';
import { CARDS, CARD_IDS, REGION_CARD_IDS, SHARED_CARD_IDS, STATUS_CARDS, TEAMS, ENEMIES, GROUPS, RELICS, ARCHETYPES } from './content.js';
import { CURSES, CURSE_RULES, EXTRA_STATUS_RULES } from '../afflictions.js';

const VERSION = 'new-1';
const MAX_HAND = 10;
const MAX_PLAYS_PER_TURN = 40;

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

function nextRand(state) {
  let x = state.rngState;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  state.rngState = x;
  return x / 4294967296;
}

function shuffle(arr, state) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function shuffledEnemyScript(script, state) {
  const sequence = script.slice();
  shuffle(sequence, state);
  return sequence;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function pushLog(state, event, data) {
  state.logs.push({ rev: state.rev, event, data: data ? deepClone(data) : null });
}

export function createRun(seed = String(Date.now()), team = 'breach') {
  const teamDef = TEAMS[team] || TEAMS.breach;
  const deck = [];
  for (const [id, count] of teamDef.startingDeck) {
    for (let i = 0; i < count; i++) {
      deck.push({ uid: `c${deck.length}_${id}`, id, up: false });
    }
  }
  const state = {
    version: VERSION,
    seed,
    team,
    act: 1,
    phase: 'map',
    deck,
    hp: 80,
    maxHp: 80,
    money: 100,
    map: null,
    currentNode: null,
    completed: [],
    rev: 0,
    battle: null,
    logs: [],
    relics: [],
    shop: null,
    event: null,
    uidCounter: deck.length,
    rngState: hashSeed(seed),
    stats: { wins: 0, losses: 0 },
    freeRemovalUsed: false,
    checkpoint: null
  };
  state.map = buildMap(seed, 1);
  pushLog(state, 'run_start');
  return state;
}

function getEnemyDef(id) {
  return ENEMIES[id] || null;
}

// ----------------------------- Enemy roster -----------------------------
// A battle holds `enemies: [{uid, id, name, look, hp, maxHp, statuses, script,
// scriptIndex, intent, trait, traitState, tempoCount}]`. Single-enemy fights use
// the same array with one entry; for them the battle also carries the older flat
// mirror fields (enemyHp, statuses.enemy, enemyIntent, trait ...) so saves, tools
// and tests written against that shape keep working. The mirror is written after
// every action and, for one-enemy fights only, read back before the next one.
const MIRROR_KEYS = ['enemyId', 'enemyName', 'enemyHp', 'enemyMaxHp', 'enemyScript', 'enemyScriptIndex', 'enemyIntent', 'trait', 'traitState', 'tempoCount'];

function enemyFromMirror(b, base = {}) {
  return {
    ...base,
    uid: base.uid || 'e0',
    id: b.enemyId,
    name: b.enemyName,
    look: base.look ?? getEnemyDef(b.enemyId)?.look ?? null,
    hp: b.enemyHp,
    maxHp: b.enemyMaxHp ?? b.enemyHp,
    statuses: b.statuses?.enemy || {},
    script: b.enemyScript || [],
    scriptIndex: b.enemyScriptIndex || 0,
    intent: b.enemyIntent ?? null,
    trait: b.trait ?? null,
    traitState: b.traitState || {},
    tempoCount: b.tempoCount || 0
  };
}

// Read-only view of the roster (never mutates the battle).
export function battleEnemies(b) {
  if (!b) return [];
  if (!Array.isArray(b.enemies)) return 'enemyHp' in b ? [enemyFromMirror(b)] : [];
  if (b.enemies.length === 1 && 'enemyHp' in b) return [enemyFromMirror(b, b.enemies[0])];
  return b.enemies;
}

export function livingEnemies(b) {
  return battleEnemies(b).filter(e => e.hp > 0);
}

function syncIn(b) {
  if (!b) return;
  const list = battleEnemies(b);
  if (list.length) b.enemies = list;
}

function syncOut(b) {
  if (!b || !Array.isArray(b.enemies)) return;
  if (b.enemies.length === 1) {
    const e = b.enemies[0];
    Object.assign(b, { enemyId: e.id, enemyName: e.name, enemyHp: e.hp, enemyMaxHp: e.maxHp, enemyScript: e.script, enemyScriptIndex: e.scriptIndex, enemyIntent: e.intent, trait: e.trait, traitState: e.traitState, tempoCount: e.tempoCount });
    b.statuses.enemy = e.statuses;
  } else {
    for (const k of MIRROR_KEYS) delete b[k];
    delete b.statuses.enemy;
  }
}

const alive = b => b.enemies.filter(e => e.hp > 0);
const allDead = b => b.enemies.every(e => e.hp <= 0);
const addStatus = (e, key, n) => { e.statuses[key] = (e.statuses[key] || 0) + n; };

// Effects that act on one chosen enemy. `all: true` turns them into area effects.
const TARGET_EFFECTS = new Set(['attack', 'weak', 'vuln', 'smoke', 'flash', 'burn', 'burnMultiply', 'detonate', 'purgeEnemyStatus', 'attackFromBlock', 'attackScaledByUpgradedHand']);
const TARGET_CONDITIONS = new Set(['enemy_smoke', 'enemy_flash', 'enemy_smoke_or_flash', 'enemy_vuln', 'enemy_burn']);
function effectNeedsTarget(e) {
  if (!e || e.all) return false;
  if (TARGET_EFFECTS.has(e.type)) return true;
  if (e.type === 'conditional') return TARGET_CONDITIONS.has(e.condition) || effectNeedsTarget(e.effect);
  if (e.type === 'repeat') return effectNeedsTarget(e.effect);
  return false;
}
function cardEffects(card) {
  const def = CARDS[card.id];
  return card.up && def.upgradeEffects?.length ? def.upgradeEffects : def.effects;
}
// True when the card must be aimed at one enemy (implied while only one is alive).
export function cardNeedsTarget(idOrCard, up = false) {
  const card = typeof idOrCard === 'string' ? { id: idOrCard, up } : idOrCard;
  if (!CARDS[card.id]) return false;
  return cardEffects(card).some(effectNeedsTarget);
}
export function cardHitsAll(idOrCard, up = false) {
  const card = typeof idOrCard === 'string' ? { id: idOrCard, up } : idOrCard;
  if (!CARDS[card.id]) return false;
  return cardEffects(card).some(e => e.all);
}

// Discovered cards cost 0 until played or the turn ends.
function cardCost(c) {
  if (c.free) return 0;
  const def = CARDS[c.id];
  return c.up && def.upgradeCost !== undefined ? def.upgradeCost : def.cost;
}

function nextUid(state) {
  return `u${state.uidCounter++}`;
}

export function legalActions(state) {
  if (!state) return [];
  const actions = [];
  if (state.phase === 'map') {
    const avail = availableNodes({ ...state, mode: 'season' });
    for (const n of avail) actions.push({ type: 'enter', key: n.key });
  } else if (state.phase === 'combat') {
    const b = state.battle;
    if (!b) return [];
    if (b.pendingDiscover) return b.pendingDiscover.options.map(id => ({ type: 'discover', id }));
    const living = livingEnemies(b);
    for (const c of b.hand) {
      if (c.id in STATUS_CARDS) continue;
      if (!(b.energy >= cardCost(c) && b.playsThisTurn < MAX_PLAYS_PER_TURN)) continue;
      if (living.length > 1 && cardNeedsTarget(c)) for (const e of living) actions.push({ type: 'play', uid: c.uid, target: e.uid });
      else actions.push({ type: 'play', uid: c.uid });
    }
    if (b.energy >= 1 && !b.stanceSwitchUsedThisTurn) actions.push({ type: 'stance' });
    actions.push({ type: 'end' });
  } else if (state.phase === 'reward') {
    actions.push({ type: 'reward', id: null });
    if (state.battle?.rewardPool) {
      for (const id of state.battle.rewardPool) actions.push({ type: 'reward', id });
    }
  } else if (state.phase === 'shop') {
    actions.push({ type: 'leave' });
    const shop = state.shop;
    if (shop) {
      for (let i = 0; i < shop.cards.length; i++) {
        const item = shop.cards[i];
        if (state.money >= shopPrice(item)) actions.push({ type: 'buy', id: item.id, index: i });
      }
      const rmCost = removePrice(state);
      if (state.money >= rmCost) {
        for (const c of state.deck) {
          if (canRemoveCard(state, c.uid)) actions.push({ type: 'remove', uid: c.uid });
        }
      }
      for (const category of ['attack', 'skill']) {
        const quote = categoryUpgradeQuote(state, category);
        if (!quote.used && quote.count > 0 && state.money >= quote.price) actions.push({ type:'upgradeCategory', category });
      }
    }
  } else if (state.phase === 'rest') {
    actions.push({ type: 'rest', choice: 'heal' });
    actions.push({ type: 'rest', choice: 'maxHp' });
    for (const c of state.deck) {
      if (!c.up && CARDS[c.id]?.upgradeEffects?.length) {
        actions.push({ type: 'rest', choice: 'upgrade', uid: c.uid });
      }
    }
  } else if (state.phase === 'event') {
    for (const ch of state.event.choices) actions.push({ type: 'event', choice: ch.id });
  } else if (state.phase === 'intermission') {
    actions.push({ type: 'nextAct' });
  }
  return actions;
}

function canRemoveCard(state, uid) {
  const deck = state.deck;
  if (deck.length <= 5) return false;
  const card = deck.find(c => c.uid === uid);
  if (!card) return false;
  const remaining = deck.filter(c => c.uid !== uid);
  return remaining.some(c => CARDS[c.id]?.type === 'attack');
}

export function observe(state) {
  if (!state) return null;
  if (state.phase === 'combat' && state.battle) {
    const b = state.battle;
    const intents = describeIntents(state);
    const enemies = battleEnemies(b).map(e => ({
      uid: e.uid, id: e.id, name: e.name, look: e.look, hp: e.hp, maxHp: e.maxHp, alive: e.hp > 0,
      smoke: e.statuses.smoke || 0, flash: e.statuses.flash || 0, weak: e.statuses.weak || 0, vuln: e.statuses.vuln || 0,
      block: e.statuses.block || 0, strength: e.statuses.strength || 0, burn: e.statuses.burn || 0,
      intent: intents[e.uid] || null, trait: e.trait?.id || null
    }));
    return {
      kind: 'combat',
      playerHp: state.hp,
      playerMaxHp: state.maxHp,
      energy: b.energy,
      stance: b.stance,
      enemy: enemies.find(e => e.alive) || enemies[0] || null,
      enemies,
      playerStatuses: b.statuses.player,
      playerBlock: b.playerBlock,
      hand: b.hand.map(c => { const def = CARDS[c.id]; return { uid: c.uid, id: c.id, name: def.name, cost: cardCost(c), text: c.up ? def.upgradeText || def.text : def.text, needsTarget: !!def.effects && cardNeedsTarget(c) }; }),
      drawPileCount: b.drawPile.length,
      discardPileCount: b.discardPile.length,
      exhaustPileCount: b.exhaustPile.length,
      powers: b.powers,
      turn: b.turn
    };
  }
  if (state.phase === 'map') {
    return { kind: 'map', act: state.act, map: state.map, currentNode: state.currentNode, completed: state.completed, hp: state.hp, maxHp: state.maxHp, money: state.money };
  }
  return state;
}

// One enemy's intent. `pending` is firepower granted this turn by allies that
// act earlier (e.g. a spotter's rally), so the preview matches the real hit.
function intentText(b, e, pending = 0) {
  if (!e.intent) return null;
  const parts = [];
  // Actions resolve in order, so a buff listed first already raises the hit after it.
  let strength = (e.statuses.strength || 0) + pending;
  if (b.field === 'overtime' && b.turn >= 5) strength += 2;
  for (const act of e.intent) {
    if (act.type === 'hit') parts.push(`攻击${enemyHitBase(b, act.n, act.times) + strength}×${act.times}`);
    else if (act.type === 'buff') { strength += act.n; parts.push(`强化火力+${act.n}`); }
    else if (act.type === 'rally') { strength += act.n; parts.push(`全队火力+${act.n}`); }
    else if (act.type === 'heal') parts.push(`治疗伤势最重的队友${act.n}`);
    else if (act.type === 'guard') parts.push(`为队友布防${act.n}`);
    else if (act.type === 'block') parts.push(`布防${act.n}`);
    else if (act.type === 'jam') parts.push(`塞入${act.n || 1}张「${STATUS_CARDS[act.id]?.name || act.id}」`);
    else if (act.type === 'weak') parts.push(`施加压制${act.n}`);
    else if (act.type === 'vuln') parts.push(`施加易伤${act.n}`);
    else if (act.type === 'aim') parts.push('瞄准（下回合重狙）');
    else if (act.type === 'snipe') {
      const full = enemyHitBase(b, act.n, 1) + strength;
      parts.push(e.statuses.aim ? `重狙${full}（闪光可打断）` : `仓促射击${Math.ceil(act.n / 3) + strength}（瞄准已被打断）`);
    }
    else if (act.type === 'cleanse') parts.push('清除自身负面状态');
  }
  return parts.join('，');
}

// Intent text per living enemy uid, in acting order.
export function describeIntents(state) {
  const out = {};
  if (state?.phase !== 'combat' || !state.battle) return out;
  const b = state.battle;
  let pending = 0;
  for (const e of livingEnemies(b)) {
    out[e.uid] = intentText(b, e, pending);
    for (const a of e.intent || []) if (a.type === 'rally') pending += a.n;
  }
  return out;
}

export function describeIntent(state) {
  if (state?.phase !== 'combat' || !state.battle) return null;
  const living = livingEnemies(state.battle);
  const texts = describeIntents(state);
  if (living.length <= 1) return living[0] ? texts[living[0].uid] ?? null : null;
  return living.map(e => `${e.name}：${texts[e.uid] || '未知'}`).join('；');
}

export function preview(state, uid) {
  if (state.phase !== 'combat' || !state.battle) return null;
  const card = state.battle.hand.find(c => c.uid === uid);
  if (!card) return null;
  const def = CARDS[card.id];
  return {
    card: { uid, id: card.id, name: def.name, cost: cardCost(card), text: card.up && def.upgradeText ? def.upgradeText : def.text },
    stance: state.battle.stance,
    needsTarget: cardNeedsTarget(card),
    hitsAll: cardHitsAll(card)
  };
}

function stanceModifiers(b) {
  if (b.stance === 'cover' && !b.blockPlayedThisTurn) return { blockBonus: 3 };
  if (b.stance === 'push' && !b.attackPlayedThisTurn) return { attackBonus: 3 };
  return {};
}

export function act(state, action) {
  if (!state || !action) return { state, error: '无效输入' };
  if (state.phase === 'result') return { state, error: '运行已结束' };
  const next = deepClone(state);
  next.rev = state.rev + 1;
  syncIn(next.battle);
  const err = applyAction(next, action);
  if (err) return { state, error: err };
  syncOut(next.battle);
  return { state: next };
}

function applyAction(state, action) {
  switch (action.type) {
    case 'enter': return enterNode(state, action);
    case 'play': return playCard(state, action);
    case 'stance': return manualStance(state);
    case 'discover': return chooseDiscover(state, action);
    case 'end': return endTurn(state);
    case 'reward': return chooseReward(state, action);
    case 'buy': return buyCard(state, action);
    case 'remove': return removeCard(state, action);
    case 'upgradeCategory': return upgradeCategory(state, action);
    case 'leave': return leaveShop(state);
    case 'rest': return restAction(state, action);
    case 'event': return eventChoice(state, action);
    case 'nextAct': return startNextAct(state);
    default: return '未知操作';
  }
}

function enterNode(state, action) {
  if (state.phase !== 'map') return '当前不在地图阶段';
  const avail = availableNodes({ ...state, mode: 'season' });
  const node = avail.find(n => n.key === action.key);
  if (!node) return '节点不可用';
  state.currentNode = node.key;
  if (node.kind === 'battle' || node.kind === 'elite' || node.kind === 'boss') {
    const err = startBattle(state, node);
    if (err) return err;
    pushLog(state, 'enter_battle', { node: node.key, enemy: node.enemy });
  } else if (node.kind === 'shop') {
    state.phase = 'shop';
    state.shop = generateShop(state);
    state.freeRemovalUsed = false;
    pushLog(state, 'enter_shop');
  } else if (node.kind === 'rest') {
    state.phase = 'rest';
  } else if (node.kind === 'event') {
    state.phase = 'event';
    state.event = generateEvent(state);
  }
  return null;
}

function createEnemy(state, member, index, label) {
  const def = getEnemyDef(member.id);
  const e = {
    uid: `e${index}`,
    id: member.id,
    name: label ? `${def.name}${label}` : def.name,
    look: def.look || null,
    hp: def.hp,
    maxHp: def.hp,
    statuses: {},
    script: def.ordered ? deepClone(def.script) : shuffledEnemyScript(def.script, state),
    scriptIndex: member.offset || 0,
    intent: null,
    trait: def.trait ? deepClone(def.trait) : null,
    traitState: {},
    tempoCount: 0
  };
  if (def.startBlock) e.statuses.block = def.startBlock;
  return e;
}

function startBattle(state, node) {
  const group = GROUPS[node.enemy];
  const members = group ? group.members : [{ id: node.enemy }];
  if (!members.length || members.some(m => !getEnemyDef(m.id))) return '敌人未找到';
  const deck = state.deck.map(c => ({ uid: c.uid, id: c.id, up: c.up }));
  shuffle(deck, state);
  const hand = [];
  for (let i = 0; i < 5 && deck.length; i++) hand.push(deck.shift());
  // Repeated member types get A/B/C suffixes so the player can tell them apart.
  const counts = {};
  for (const m of members) counts[m.id] = (counts[m.id] || 0) + 1;
  const seen = {};
  const enemies = members.map((m, i) => {
    const label = counts[m.id] > 1 ? ' ' + 'ABC'[(seen[m.id] = (seen[m.id] || 0) + 1) - 1] : '';
    return createEnemy(state, m, i, label);
  });
  state.battle = {
    encounter: node.enemy,
    groupName: group ? group.name : null,
    enemies,
    turn: 1,
    energy: 3,
    stance: 'cover',
    stanceSwitchUsedThisTurn: false,
    attackPlayedThisTurn: false,
    blockPlayedThisTurn: false,
    upgradeEnergyUsedThisTurn: false,
    stanceChangedThisTurn: false,
    playsThisTurn: 0,
    hand,
    drawPile: deck,
    discardPile: [],
    exhaustPile: [],
    powers: [],
    powerStacks: {},
    powerCards: [],
    statuses: { player: {} },
    rewardPool: null,
    rewardTaken: false,
    playerBlock: 0,
    field: node.field || null
  };
  state.phase = 'combat';
  const b = state.battle;
  if (b.field === 'smoky') for (const e of enemies) addStatus(e, 'smoke', 2);
  const opening=hand.slice();
  if (b.field === 'eco') { b.energy += 1; drawCards(state, 1); }
  applyRelicsAtBattleStart(state);
  if(state.phase!=='combat')return null;
  for(const card of opening){if(!hand.some(c=>c.uid===card.uid))continue;applyDrawAffliction(state,card);if(state.phase!=='combat')return null;}
  for (const e of enemies) nextEnemyIntent(e);
  pushLog(state, 'battle_start', { enemy: node.enemy });
  return null;
}

function nextEnemyIntent(e) {
  const script = e.script;
  if (!script.length) { e.intent = e.intent || null; return; }
  const idx = e.scriptIndex % script.length;
  e.scriptIndex++;
  e.intent = script[idx];
}

function chooseDiscover(state, action) {
  const b = state.battle;
  if (state.phase !== 'combat' || !b?.pendingDiscover) return '当前没有可发现的牌';
  if (!b.pendingDiscover.options.includes(action.id)) return '不是可选的牌';
  b.pendingDiscover = null;
  if (b.hand.length < MAX_HAND) b.hand.push({ uid: nextUid(state), id: action.id, up: false, free: true, temp: true });
  pushLog(state, 'discover', { id: action.id });
  return null;
}

function discoverOptions(state, pool) {
  const regional = REGION_CARD_IDS[TEAMS[state.team]?.region] || REGION_CARD_IDS.AM;
  const ids = [...SHARED_CARD_IDS, ...regional].filter(id => {
    const d = CARDS[id];
    if (d.tag === 'discover' || d.type === 'power') return false;
    return pool === 'any' || d.type === pool;
  });
  const out = [];
  while (out.length < 3 && out.length < ids.length) {
    const id = ids[Math.floor(nextRand(state) * ids.length)];
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// Deployed turrets always shoot the living enemy with the lowest current HP
// (leftmost on ties): deterministic, consumes no RNG, and finishes weakened foes.
function turretTarget(b) {
  let best = null;
  for (const e of alive(b)) if (!best || e.hp < best.hp) best = e;
  return best;
}

// End-of-player-turn automation: deployed turrets fire, barriers add block.
function turretDamage(b, d) { return d.n + 3 * (b.powerStacks.turret_core || 0); }
function fireTurret(state, d) {
  const b = state.battle;
  const t = turretTarget(b);
  if (!t) return;
  dealDamageToEnemy(state, t, turretDamage(b, d));
  checkEnemyHpTraits(state, t);
}
function runDeployables(state) {
  const b = state.battle;
  for (const d of b.deployables || []) {
    if (d.kind === 'turret') fireTurret(state, d);
    else b.playerBlock += d.n;
    d.turns--;
    if (allDead(b)) break;
  }
  b.deployables = (b.deployables || []).filter(d => d.turns > 0);
}

function playCard(state, action) {
  if (state.phase !== 'combat') return '不在战斗阶段';
  const b = state.battle;
  if (b.pendingDiscover) return '请先选择发现的牌';
  if (b.playsThisTurn >= MAX_PLAYS_PER_TURN) return '本回合打出牌数已达上限';
  const idx = b.hand.findIndex(c => c.uid === action.uid);
  if (idx === -1) return '手牌中没有该牌';
  const card = b.hand[idx];
  const def = CARDS[card.id];
  if (!def) return '未知卡牌';
  if (def.type === 'status') return '状态牌不能打出';
  const cost = cardCost(card);
  if (b.energy < cost) return '能量不足';

  const living = alive(b);
  let target = null;
  if (cardNeedsTarget(card)) {
    if (action.target != null) {
      target = living.find(e => e.uid === action.target);
      if (!target) return '目标无效';
    } else if (living.length === 1) target = living[0];
    else return '请选择目标';
  } else if (action.target != null) {
    target = living.find(e => e.uid === action.target) || null;
  }

  const preAttackPlayed = b.attackPlayedThisTurn;
  const preBlockPlayed = b.blockPlayedThisTurn;
  const preStanceChanged = b.stanceChangedThisTurn;
  const mods = stanceModifiers(b);
  const context = {
    preAttackPlayed,
    preBlockPlayed,
    preStanceChanged,
    preCount: b.playsThisTurn,
    cardId: card.id,
    attackBonusUsed: false,
    blockBonusUsed: false,
    target: target || living[0] || null
  };

  b.energy -= cost;
  b.hand.splice(idx, 1);
  b.playsThisTurn++;
  for(const held of b.hand){const rule=CURSE_RULES[held.id];if(rule?.trigger==='onPlayLoseHp'){state.hp=Math.max(0,state.hp-rule.n);if(!state.hp){finishBattleLoss(state);return null;}}}

  const effects = card.up && def.upgradeEffects?.length ? def.upgradeEffects : def.effects;
  for (const eff of effects) {
    applyEffect(state, eff, card, mods, context);
    if(state.phase!=='combat')return null;
  }

  if (def.type === 'power') {
    const strength = def.power === 'inflame' || def.power === 'footwork' ? (card.up ? 3 : 2) : 1;
    if (!b.powers.includes(def.power)) {
      b.powers.push(def.power);
      b.powerStacks[def.power] = strength;
    } else {
      b.powerStacks[def.power] += strength;
    }
    b.powerCards.push(card);
    // Power card is removed from rotation, not discarded or exhausted
  } else if (def.exhaust || card.temp || effects.some(e => e.type === 'exhaustSelf')) {
    delete card.free;
    b.exhaustPile.push(card);
    if (b.powerStacks.dark_embrace) drawCards(state, b.powerStacks.dark_embrace);
    if (b.powerStacks.feel_no_pain) b.playerBlock += 3 * b.powerStacks.feel_no_pain;
  } else {
    b.discardPile.push(card);
  }

  if (card.up && b.powers.includes('upgrade_core') && !b.upgradeEnergyUsedThisTurn) {
    b.energy++;
    b.upgradeEnergyUsedThisTurn = true;
  }

  // Update per-turn flags after card resolution
  const isAttack = def.type === 'attack' || def.effects.some(e => e.type === 'attack' || (e.type === 'conditional' && e.effect.type === 'attack'));
  const isBlock = def.effects.some(e => e.type === 'block' || (e.type === 'conditional' && e.effect.type === 'block'));
  if (isAttack) b.attackPlayedThisTurn = true;
  if (isBlock) b.blockPlayedThisTurn = true;
  if (effects.some(e => e.type === 'stanceSwitch')) b.stanceChangedThisTurn = true;

  for (const e of alive(b)) {
    if (e.trait?.id === 'enrageOnSkill' && def.type === 'skill') addStatus(e, 'strength', e.trait.n);
    if (e.trait?.id === 'tempo' && ++e.tempoCount >= e.trait.n) {
      e.tempoCount = 0;
      addStatus(e, 'strength', 2);
      addStatus(e, 'block', 8);
      pushLog(state, 'trait', { id: 'tempo', enemy: e.uid });
    }
  }

  if (allDead(b)) {
    finishBattleWin(state);
    return null;
  }
  pushLog(state, 'play_card', { uid: card.uid, id: card.id, target: target?.uid || null });
  return null;
}

function applyEffect(state, eff, sourceCard, mods, context) {
  const b = state.battle;
  // Area version: resolve the effect once per living enemy, left to right.
  // Per-card bonuses (stance, first hit) apply to every enemy the sweep hits.
  if (eff.all) {
    const saved = context.target;
    const snap = { attackBonusUsed: context.attackBonusUsed, highgroundUsed: context.highgroundUsed };
    let after = snap;
    for (const e of alive(b)) {
      Object.assign(context, snap, { target: e });
      applyEffect(state, { ...eff, all: false }, sourceCard, mods, context);
      after = { attackBonusUsed: context.attackBonusUsed, highgroundUsed: context.highgroundUsed };
      if (state.phase !== 'combat') break;
    }
    Object.assign(context, after, { target: saved && saved.hp > 0 ? saved : alive(b)[0] || saved });
    return;
  }
  const t = context.target && context.target.hp > 0 ? context.target : null;
  switch (eff.type) {
    case 'attack': {
      if (!t) break;
      let baseDamage = eff.n;
      let bonus = 0;
      if (!context.attackBonusUsed) {
        if (mods.attackBonus) bonus += mods.attackBonus;
        if (b.powers.includes('attack_core') && !context.preAttackPlayed) {
          bonus += 3 * (b.powerStacks.attack_core || 1);
        }
        if (bonus > 0) context.attackBonusUsed = true;
      }
      const times = eff.times || 1;
      const clutchBonus = (b.powers.includes('clutch_core') && ((t.statuses.smoke || 0) > 0 || (t.statuses.flash || 0) > 0)) ? 2 * (b.powerStacks.clutch_core || 1) : 0;
      let fieldBonus = 0;
      if (b.field === 'corridor' && times > 1) fieldBonus += 1;
      if (b.field === 'longrange' && baseDamage >= 10) fieldBonus += 3;
      let firstHitBonus = 0;
      if (b.field === 'highground' && !context.preAttackPlayed && !context.highgroundUsed) { firstHitBonus = 3; context.highgroundUsed = true; }
      if (context.cardId === 'TK01') fieldBonus += 3 * (b.powerStacks.knife_master || 0);
      if (b.powerStacks.combo_core && context.preCount >= 2) fieldBonus += 3 * b.powerStacks.combo_core;
      for (let i = 0; i < times; i++) {
        let dmg = baseDamage + (b.powerStacks.inflame || 0) + fieldBonus;
        if (i === 0 && bonus > 0) dmg += bonus;
        if (i === 0) dmg += firstHitBonus;
        if (clutchBonus > 0) dmg += clutchBonus;
        dealDamageToEnemy(state, t, dmg);
        checkEnemyHpTraits(state, t);
        if (t.hp <= 0) break;
        if (t.trait?.id === 'thorns') {
          damagePlayerDirect(state, t.trait.n);
          if (state.phase !== 'combat') return;
        }
      }
      break;
    }
    case 'block': {
      let blk = eff.n;
      let bonus = 0;
      if (!context.blockBonusUsed) {
        if (mods.blockBonus) bonus += mods.blockBonus;
        if (b.powers.includes('defense_core') && !context.preBlockPlayed) {
          bonus += 3 * (b.powerStacks.defense_core || 1);
        }
        if (bonus > 0) context.blockBonusUsed = true;
      }
      b.playerBlock += blk + bonus + (b.powerStacks.footwork || 0);
      break;
    }
    case 'smoke': {
      if (!t) break;
      let n = eff.n;
      if (b.powers.includes('smoke_core') && !b.smokeBonusUsedThisTurn) {
        n += 2;
        b.smokeBonusUsedThisTurn = true;
      }
      if (b.field === 'smoky' && !b.fieldSmokeUsedThisTurn) { n += 1; b.fieldSmokeUsedThisTurn = true; }
      addStatus(t, 'smoke', n);
      break;
    }
    case 'flash': {
      if (!t) break;
      let n = eff.n;
      if (b.powers.includes('flash_core') && !b.flashBonusUsedThisTurn) {
        n += 2;
        b.flashBonusUsedThisTurn = true;
      }
      addStatus(t, 'flash', n);
      if (t.statuses.aim) { t.statuses.aim = 0; pushLog(state, 'aim_broken', { enemy: t.uid }); }
      break;
    }
    case 'weak':
      if (t) addStatus(t, 'weak', eff.n);
      break;
    case 'vuln':
      if (t) addStatus(t, 'vuln', eff.n);
      break;
    case 'draw':
      drawCards(state, eff.n);
      break;
    case 'energy':
      b.energy += eff.n;
      break;
    case 'heal':
      state.hp = Math.min(state.hp + eff.n, state.maxHp);
      break;
    case 'maxHp':
      state.maxHp += eff.n;
      state.hp = Math.min(state.hp + eff.n, state.maxHp);
      break;
    case 'money':
      state.money += eff.n;
      break;
    case 'exhaustSelf':
      // Handled in playCard after effects
      break;
    case 'stanceSwitch':
      switchStance(state);
      b.stanceChangedThisTurn = true;
      context.preStanceChanged = true;
      delete mods.attackBonus;
      delete mods.blockBonus;
      Object.assign(mods, stanceModifiers(b));
      break;
    case 'addCardToDiscard':
      for (let i = 0; i < eff.n; i++) {
        b.discardPile.push({ uid: nextUid(state), id: eff.id, up: false });
      }
      break;
    case 'addCardToHand':
      for (let i = 0; i < eff.n; i++) {
        if (b.hand.length < MAX_HAND) {
          b.hand.push({ uid: nextUid(state), id: eff.id, up: false });
        }
      }
      break;
    case 'purgePlayerStatus':
      b.statuses.player[eff.id] = Math.max(0, (b.statuses.player[eff.id] || 0) - eff.n);
      break;
    case 'purgeEnemyStatus':
      if (t) t.statuses[eff.id] = Math.max(0, (t.statuses[eff.id] || 0) - eff.n);
      break;
    case 'upgradeRandomInHand': {
      const candidates = b.hand.filter(c => !c.up && CARDS[c.id]?.upgradeEffects?.length);
      if (candidates.length) {
        const chosen = candidates[Math.floor(nextRand(state) * candidates.length)];
        chosen.up = true;
      }
      break;
    }
    case 'upgradeAllInHand':
      for (const c of b.hand) {
        if (!c.up && CARDS[c.id]?.upgradeEffects?.length) c.up = true;
      }
      break;
    case 'upgradeAllInCombatDeck': {
      for (const c of [...b.drawPile, ...b.discardPile, ...b.hand]) {
        if (!c.up && CARDS[c.id]?.upgradeEffects?.length) c.up = true;
      }
      break;
    }
    case 'attackScaledByUpgradedHand': {
      const upgraded = b.hand.filter(c => c.up && CARDS[c.id]).length;
      applyEffect(state, {type:'attack', n:eff.base + eff.per * Math.min(eff.cap, upgraded)}, sourceCard, mods, context);
      break;
    }
    case 'burn':
      if (t) addStatus(t, 'burn', eff.n);
      break;
    case 'burnMultiply':
      if (t) t.statuses.burn = (t.statuses.burn || 0) * eff.n;
      break;
    case 'detonate': {
      if (!t) break;
      const stacks = t.statuses.burn || 0;
      t.statuses.burn = 0;
      if (stacks > 0) applyEffect(state, { type: 'attack', n: stacks * eff.per }, sourceCard, mods, context);
      break;
    }
    case 'deploy':
      (b.deployables ||= []).push({ kind: eff.kind, n: eff.n, turns: eff.turns });
      break;
    case 'fireTurrets':
      for (const d of b.deployables || []) {
        if (d.kind !== 'turret') continue;
        fireTurret(state, d);
        if (allDead(b)) break;
      }
      break;
    case 'attackFromBlock':
      applyEffect(state, { type: 'attack', n: b.playerBlock * (eff.mult || 1) }, sourceCard, mods, context);
      break;
    case 'discover':
      b.pendingDiscover = { options: discoverOptions(state, eff.pool) };
      if (!b.pendingDiscover.options.length) b.pendingDiscover = null;
      break;
    case 'strength':
      if (!b.powers.includes('inflame')) b.powers.push('inflame');
      b.powerStacks.inflame = (b.powerStacks.inflame || 0) + eff.n;
      break;
    case 'overload':
      b.overloadNext = (b.overloadNext || 0) + eff.n;
      break;
    case 'conditional': {
      if (checkCondition(state, eff.condition, context)) {
        applyEffect(state, eff.effect, sourceCard, mods, context);
      }
      break;
    }
    case 'repeat': {
      for (let i = 0; i < eff.times; i++) {
        applyEffect(state, eff.effect, sourceCard, mods, context);
      }
      break;
    }
    default:
      // Unknown effect type ignored, but content should not have any.
      break;
  }
}

function checkCondition(state, cond, context) {
  const b = state.battle;
  const t = context.target && context.target.hp > 0 ? context.target : null;
  const st = t ? t.statuses : {};
  switch (cond) {
    case 'enemy_intends_attack':
      return alive(b).some(e => (e.intent || []).some(a => a.type === 'hit'));
    case 'enemy_smoke':
      return (st.smoke || 0) > 0;
    case 'enemy_flash':
      return (st.flash || 0) > 0;
    case 'enemy_smoke_or_flash':
      return (st.smoke || 0) > 0 || (st.flash || 0) > 0;
    case 'prev_played_attack':
      return context.preAttackPlayed;
    case 'first_attack_this_turn':
      return !context.preAttackPlayed;
    case 'first_block_this_turn':
      return !context.preBlockPlayed;
    case 'stance_cover':
      return b.stance === 'cover';
    case 'stance_push':
      return b.stance === 'push';
    case 'stance_changed_this_turn':
      return context.preStanceChanged;
    case 'combo':
      return context.preCount > 0;
    case 'enemy_vuln':
      return (st.vuln || 0) > 0;
    case 'enemy_burn':
      return (st.burn || 0) > 0;
    default:
      return false;
  }
}

function dealDamageToEnemy(state, e, dmg) {
  const b = state.battle;
  let final = dmg;
  if (b.statuses.player.weak > 0) {
    final = Math.floor(final * 0.75);
  }
  if (e.statuses.vuln > 0) {
    final = Math.floor(final * 1.5);
  }
  if (e.statuses.block > 0) {
    const blocked = Math.min(e.statuses.block, final);
    e.statuses.block -= blocked;
    final -= blocked;
  }
  e.hp = Math.max(0, e.hp - final);
  if (e.hp <= 0) pushLog(state, 'enemy_down', { enemy: e.uid });
}

// Battlefield modifiers that change a single enemy hit before strength.
function enemyHitBase(b, n, times) {
  let base = n;
  if (b.field === 'corridor' && times > 1) base += 1;
  if (b.field === 'longrange' && n >= 10) base += 3;
  return base;
}

// Damage that ignores smoke/flash/weak (e.g. counter-fire); block still absorbs it.
function damagePlayerDirect(state, n) {
  const b = state.battle;
  const blocked = Math.min(b.playerBlock, n);
  b.playerBlock -= blocked;
  state.hp = Math.max(0, state.hp - (n - blocked));
  if (state.hp <= 0) finishBattleLoss(state);
}

// Passive traits that react to an enemy's HP dropping.
function checkEnemyHpTraits(state, e) {
  const trait = e.trait;
  if (!trait || e.hp <= 0) return;
  if (trait.id === 'berserk' && !e.traitState.berserk && e.hp <= e.maxHp / 2) {
    e.traitState.berserk = true;
    addStatus(e, 'strength', trait.n);
    pushLog(state, 'trait', { id: 'berserk', enemy: e.uid });
  }
  if (trait.id === 'phase2' && !e.traitState.phase2 && e.hp <= e.maxHp / 2) {
    e.traitState.phase2 = true;
    for (const k of ['weak', 'vuln', 'smoke', 'flash']) e.statuses[k] = 0;
    addStatus(e, 'block', 12);
    addStatus(e, 'strength', 2);
    const def = getEnemyDef(e.id);
    e.script = deepClone(def.phase2);
    e.intent = e.script[0];
    e.scriptIndex = 1;
    pushLog(state, 'trait', { id: 'phase2', enemy: e.uid });
  }
}

function dealDamageToPlayer(state, e, baseDamage) {
  const b = state.battle;
  let dmg = baseDamage + (e.statuses.strength || 0);
  // Push stance bonus to incoming damage: +2 raw damage per hit before smoke/flash/block
  if (b.stance === 'push') {
    dmg += 2;
  }
  if (e.statuses.weak > 0) {
    dmg = Math.floor(dmg * 0.75);
  }
  if (b.statuses.player.vuln > 0) {
    dmg = Math.floor(dmg * 1.5);
  }
  const smoke = e.statuses.smoke || 0;
  if (smoke > 0) {
    dmg = Math.max(0, dmg - smoke);
  }
  const flash = e.statuses.flash || 0;
  if (flash > 0) {
    dmg = Math.max(0, dmg - 3 * flash);
    e.statuses.flash = 0;
  }
  if (b.playerBlock > 0) {
    const blocked = Math.min(b.playerBlock, dmg);
    b.playerBlock -= blocked;
    dmg -= blocked;
  }
  state.hp = Math.max(0, state.hp - dmg);
}

function drawCards(state, n) {
  const b = state.battle;
  for (let i = 0; i < n; i++) {
    if (b.hand.length >= MAX_HAND) break;
    if (b.drawPile.length === 0) {
      if (b.discardPile.length === 0) break;
      b.drawPile = b.discardPile;
      b.discardPile = [];
      shuffle(b.drawPile, state);
    }
    const card=b.drawPile.shift();b.hand.push(card);applyDrawAffliction(state,card);
    if(state.phase!=='combat')break;
  }
}

function applyDrawAffliction(state,card){
 const b=state.battle,rule=CURSE_RULES[card.id]||EXTRA_STATUS_RULES[card.id];if(!rule)return;
 if(rule.trigger==='onDrawLoseEnergy')b.energy=Math.max(0,b.energy-rule.n);
 if(rule.trigger==='onDrawWeak')b.statuses.player.weak=(b.statuses.player.weak||0)+rule.n;
 if(rule.trigger==='onDrawVuln')b.statuses.player.vuln=(b.statuses.player.vuln||0)+rule.n;
 if(rule.trigger==='onDrawLoseHp'){state.hp=Math.max(0,state.hp-rule.n);if(!state.hp)finishBattleLoss(state);}
 if(rule.trigger==='onDrawDiscard')for(let i=0;i<rule.n;i++){
  const options=b.hand.filter(c=>c.uid!==card.uid);if(!options.length)break;
  const chosen=options[Math.floor(nextRand(state)*options.length)];b.hand.splice(b.hand.findIndex(c=>c.uid===chosen.uid),1);b.discardPile.push(chosen);
 }
}

function manualStance(state) {
  if (state.phase !== 'combat') return '不在战斗阶段';
  const b = state.battle;
  if (b.pendingDiscover) return '请先选择发现的牌';
  if (b.energy < 1) return '能量不足';
  if (b.stanceSwitchUsedThisTurn) return '本回合已切换过姿态';
  b.energy--;
  b.stanceSwitchUsedThisTurn = true;
  switchStance(state);
  b.stanceChangedThisTurn = true;
  pushLog(state, 'stance_switch');
  return null;
}

function switchStance(state) {
  const b = state.battle;
  b.stance = b.stance === 'cover' ? 'push' : 'cover';
}

function endTurn(state) {
  if (state.phase !== 'combat') return '不在战斗阶段';
  const b = state.battle;
  if (b.pendingDiscover) return '请先选择发现的牌';

  // Discard hand, apply status card damage
  for (const card of b.hand) {
    const rule=CURSE_RULES[card.id];
    if(rule?.trigger==='endTurnLoseHp'){state.hp=Math.max(0,state.hp-rule.n);if(!state.hp){finishBattleLoss(state);return null;}}
    if (card.id in STATUS_CARDS) {
      const dmgMap = { ST01: 1, ST02: 2, ST03: 3 };
      state.hp = Math.max(0, state.hp - (dmgMap[card.id] || 0));
      if (state.hp <= 0) {
        finishBattleLoss(state);
        return null;
      }
    }
  }
  const kept = [];
  for (const card of b.hand) {
    if (CARDS[card.id]?.retain) kept.push(card);
    else if (card.temp) b.exhaustPile.push(card);
    else b.discardPile.push(card);
  }
  b.hand = kept;

  runDeployables(state);
  if (allDead(b)) { finishBattleWin(state); return null; }
  // Burn ticks on each enemy at the start of the enemy turn and ignores block.
  for (const e of alive(b)) {
    if (!(e.statuses.burn > 0)) continue;
    e.hp = Math.max(0, e.hp - e.statuses.burn);
    e.statuses.burn--;
    if (e.hp <= 0) pushLog(state, 'enemy_down', { enemy: e.uid });
    checkEnemyHpTraits(state, e);
  }
  if (allDead(b)) { finishBattleWin(state); return null; }

  // Player turn ends: decrement player weak only
  if (b.statuses.player.weak > 0) b.statuses.player.weak--;

  // Enemy vuln decays before enemy turn
  for (const e of alive(b)) if (e.statuses.vuln > 0) e.statuses.vuln--;

  executeEnemyTurn(state);
  if (state.phase !== 'combat') return null;

  // Player vuln decays after enemy turn
  if (b.statuses.player.vuln > 0) b.statuses.player.vuln--;

  // Enemy turn ends: decrement enemy weak/smoke (vuln already handled)
  for (const e of alive(b)) {
    if (e.statuses.weak > 0) e.statuses.weak--;
    if (e.statuses.smoke > 0) e.statuses.smoke--;
  }

  // Prepare next player turn
  b.attackPlayedThisTurn = false;
  b.blockPlayedThisTurn = false;
  b.stanceChangedThisTurn = false;
  b.stanceSwitchUsedThisTurn = false;
  b.playsThisTurn = 0;
  b.smokeBonusUsedThisTurn = false;
  b.flashBonusUsedThisTurn = false;
  b.fieldSmokeUsedThisTurn = false;
  b.upgradeEnergyUsedThisTurn = false;
  b.turn++;
  b.energy = Math.max(0, 3 - (b.overloadNext || 0));
  b.overload = b.overloadNext || 0;
  b.overloadNext = 0;
  if (!b.powers.includes('barricade')) {
    b.playerBlock = 0;
  }
  applyTurnStartPowers(state);
  if (state.phase !== 'combat') return null;
  if (allDead(b)) { finishBattleWin(state); return null; }
  drawCards(state, 5);
  for (const e of alive(b)) nextEnemyIntent(e);
  pushLog(state, 'end_turn', { turn: b.turn });
  return null;
}

// Support actions pick their ally when they resolve.
function mostWounded(b) {
  let best = null;
  for (const e of alive(b)) if (!best || e.maxHp - e.hp > best.maxHp - best.hp) best = e;
  return best;
}
function guardTarget(b, self) {
  const others = alive(b).filter(e => e !== self);
  if (!others.length) return self;
  return others.reduce((m, e) => (e.hp < m.hp ? e : m));
}

function executeEnemyTurn(state) {
  const b = state.battle;
  if (b.field === 'overtime' && b.turn >= 5) for (const e of alive(b)) addStatus(e, 'strength', 2);
  // Each living enemy acts left to right with its revealed intent.
  for (const e of b.enemies) {
    if (e.hp <= 0 || !e.intent) continue;
    for (const action of e.intent) {
      if (state.phase !== 'combat') return;
      if (e.hp <= 0) break;
      if (action.type === 'hit') {
        for (let i = 0; i < action.times; i++) {
          dealDamageToPlayer(state, e, enemyHitBase(b, action.n, action.times));
          if (state.hp <= 0) {
            finishBattleLoss(state);
            return;
          }
        }
      } else if (action.type === 'block') {
        addStatus(e, 'block', action.n);
      } else if (action.type === 'guard') {
        addStatus(guardTarget(b, e), 'block', action.n);
      } else if (action.type === 'heal') {
        const t = mostWounded(b);
        if (t) t.hp = Math.min(t.maxHp, t.hp + action.n);
      } else if (action.type === 'rally') {
        for (const ally of alive(b)) addStatus(ally, 'strength', action.n);
      } else if (action.type === 'jam') {
        const n = action.n || 1;
        for (let i = 0; i < n; i++) {
          b.discardPile.push({ uid: nextUid(state), id: action.id, up: false });
        }
      } else if (action.type === 'weak') {
        b.statuses.player.weak = (b.statuses.player.weak || 0) + action.n;
      } else if (action.type === 'buff') {
        // Permanent for this fight: every later hit gains this much damage.
        addStatus(e, 'strength', action.n);
      } else if (action.type === 'vuln') {
        b.statuses.player.vuln = (b.statuses.player.vuln || 0) + action.n;
      } else if (action.type === 'aim') {
        e.statuses.aim = 1;
      } else if (action.type === 'snipe') {
        const aimed = (e.statuses.aim || 0) > 0;
        e.statuses.aim = 0;
        dealDamageToPlayer(state, e, aimed ? enemyHitBase(b, action.n, 1) : Math.ceil(action.n / 3));
        if (state.hp <= 0) { finishBattleLoss(state); return; }
      } else if (action.type === 'cleanse') {
        for (const k of ['weak', 'vuln', 'smoke', 'flash']) e.statuses[k] = 0;
      }
    }
    if (e.trait?.id === 'ritual') addStatus(e, 'strength', e.trait.n);
  }
}

function finishBattleWin(state) {
  const b = state.battle;
  for (const e of b.enemies || []) e.hp = Math.max(0, e.hp);
  const node = state.map.nodes.find(n => n.key === state.currentNode);
  const moneyReward = node?.kind === 'boss' ? 50 : node?.kind === 'elite' ? 35 : 20;
  state.money += moneyReward;

  // Generate reward pool (unique cards)
  const weights = { common: 10, uncommon: 4, rare: 1 };
  const regional = REGION_CARD_IDS[TEAMS[state.team]?.region] || REGION_CARD_IDS.AM;
  const available = [...SHARED_CARD_IDS, ...regional];
  // Build-direction cards are weighted like regional ones so every reward
  // screen tends to offer a real choice between directions.
  const weightOf = id => weights[CARDS[id].rarity] * (CARDS[id].region || ARCHETYPES[CARDS[id].tag] ? 3 : 1);
  const pool = [];
  while (pool.length < 3) {
    // Prefer a card whose tag differs from the ones already offered.
    const fresh = available.filter(id => !pool.includes(id) && !pool.some(p => CARDS[p].tag === CARDS[id].tag));
    const candidates = fresh.length ? fresh : available.filter(id => !pool.includes(id));
    const total = candidates.reduce((s, id) => s + weightOf(id), 0);
    let roll = nextRand(state) * total;
    let chosen = candidates[0];
    for (const id of candidates) {
      roll -= weightOf(id);
      if (roll <= 0) {
        chosen = id;
        break;
      }
    }
    pool.push(chosen);
  }
  b.rewardPool = pool;
  b.rewardTaken = false;

  // Apply R01 heal
  if (state.relics.some(r => r.id === 'R01')) {
    state.hp = Math.min(state.hp + 8, state.maxHp);
  }

  state.phase = 'reward';
  pushLog(state, 'battle_won', { enemy: b.encounter || b.enemies?.[0]?.id || b.enemyId });
}

function finishBattleLoss(state) {
  state.phase = 'result';
  state.result = 'loss';
  state.stats.losses++;
  pushLog(state, 'battle_lost');
}

function chooseReward(state, action) {
  if (state.phase !== 'reward') return '不在奖励阶段';
  const b = state.battle;
  if (!b || b.rewardTaken) return '奖励已领取';
  if (action.id !== null && action.id !== undefined) {
    if (!b.rewardPool.includes(action.id)) return '无效奖励';
    state.deck.push({ uid: nextUid(state), id: action.id, up: false });
  }
  b.rewardTaken = true;
  const wasBoss = state.currentNode && state.map.nodes.find(n => n.key === state.currentNode)?.kind === 'boss';
  if (wasBoss) {
    grantRandomRelic(state);
  }
  state.battle = null;
  completeNode(state);
  if (wasBoss) {
    state.hp = state.maxHp;
    state.checkpoint = {
      deck: deepClone(state.deck),
      relics: deepClone(state.relics),
      maxHp: state.maxHp,
      money: state.money,
      act: state.act
    };
    if (state.act < 3) {
      state.phase = 'intermission';
    } else {
      state.phase = 'result';
      state.result = 'win';
      state.stats.wins++;
    }
  } else {
    state.phase = 'map';
  }
  return null;
}

function completeNode(state) {
  if (state.currentNode && !state.completed.includes(state.currentNode)) {
    state.completed.push(state.currentNode);
  }
  const node = state.map.nodes.find(n => n.key === state.currentNode);
  if (node && ['shop', 'rest', 'event'].includes(node.kind)) {
    if (state.relics.some(r => r.id === 'R08')) {
      state.money += 15;
    }
  }
}

function grantRandomRelic(state) {
  const ids = Object.keys(RELICS);
  const id = ids[Math.floor(nextRand(state) * ids.length)];
  if (state.relics.some(r => r.id === id)) {
    state.money += 100;
    pushLog(state, 'duplicate_relic', { id });
    return;
  }
  state.relics.push({ id, name: RELICS[id].name, desc: RELICS[id].desc });
  if (id === 'R07') {
    state.maxHp += 8;
    state.hp += 8;
  } else if (id === 'R10') {
    const basicIds = CARD_IDS.filter(cid => CARDS[cid].tag === 'basic');
    if (basicIds.length) {
      const cardId = basicIds[Math.floor(nextRand(state) * basicIds.length)];
      state.deck.push({ uid: nextUid(state), id: cardId, up: false });
    }
  }
  pushLog(state, 'relic_gained', { id });
}

function generateShop(state) {
  const cards = [];
  const regional = REGION_CARD_IDS[TEAMS[state.team]?.region] || REGION_CARD_IDS.AM;
  const available = [...SHARED_CARD_IDS, ...regional];
  for (let i = 0; i < 5; i++) {
    const choices=available.filter(id=>!cards.some(card=>card.id===id));
    const id = choices[Math.floor(nextRand(state) * choices.length)];
    cards.push({ id, price: priceOf(id) });
  }
  // One random item is on sale each visit (half price), so shops differ.
  const saleIndex = Math.floor(nextRand(state) * cards.length);
  cards[saleIndex].sale = true;
  cards[saleIndex].price = Math.floor(cards[saleIndex].price / 2);
  return { cards, categoryUpgradeUsed:false };
}

export function categoryUpgradeQuote(state, category) {
  if (!['attack', 'skill'].includes(category)) return {count:0, price:0, used:false};
  const targets = state.deck.filter(c => !c.up && CARDS[c.id]?.type === category && CARDS[c.id]?.upgradeEffects?.length);
  const price = targets.length ? 60 + targets.reduce((sum, c) => sum + ({common:28, uncommon:42, rare:56}[CARDS[c.id].rarity] || 28), 0) : 0;
  return {count:targets.length, price, used:!!state.shop?.categoryUpgradeUsed};
}

export function shopPrice(item) {
  return item.price ?? priceOf(item.id);
}

function priceOf(cardId) {
  const rarity = CARDS[cardId].rarity;
  return rarity === 'rare' ? 150 : rarity === 'uncommon' ? 100 : 50;
}

function removePrice(state) {
  if (state.relics.some(r => r.id === 'R09') && !state.freeRemovalUsed) {
    return 0;
  }
  return 75;
}

function buyCard(state, action) {
  if (state.phase !== 'shop') return '不在商店';
  const idx = action.index;
  const item = state.shop.cards[idx];
  if (!item) return '无效索引';
  const cost = shopPrice(item);
  if (state.money < cost) return '金币不足';
  state.money -= cost;
  state.deck.push({ uid: nextUid(state), id: item.id, up: false });
  state.shop.cards.splice(idx, 1);
  return null;
}

function removeCard(state, action) {
  if (state.phase !== 'shop') return '不在商店';
  if (!canRemoveCard(state, action.uid)) return '无法移除该牌';
  const cost = removePrice(state);
  if (state.money < cost) return '金币不足';
  const idx = state.deck.findIndex(c => c.uid === action.uid);
  if (idx === -1) return '牌不在牌组中';
  state.money -= cost;
  state.deck.splice(idx, 1);
  if (cost === 0 && state.relics.some(r => r.id === 'R09')) {
    state.freeRemovalUsed = true;
  }
  return null;
}

function upgradeCategory(state, action) {
  if (state.phase !== 'shop' || !state.shop) return '不在商店';
  if (!['attack', 'skill'].includes(action.category)) return '无效类别';
  const quote = categoryUpgradeQuote(state, action.category);
  if (quote.used) return '本次补给已购买过批量升级';
  if (quote.count === 0) return '没有可升级的卡牌';
  if (state.money < quote.price) return '金币不足';
  state.money -= quote.price;
  for (const card of state.deck) {
    if (!card.up && CARDS[card.id]?.type === action.category && CARDS[card.id]?.upgradeEffects?.length) card.up = true;
  }
  state.shop.categoryUpgradeUsed = true;
  pushLog(state, 'upgrade_category', {category:action.category, count:quote.count, price:quote.price});
  return null;
}

function leaveShop(state) {
  if (state.phase !== 'shop') return '不在商店';
  completeNode(state);
  state.phase = 'map';
  state.shop = null;
  return null;
}

function restAction(state, action) {
  if (state.phase !== 'rest') return '不在休息阶段';
  if (action.choice === 'heal') {
    state.hp = Math.min(state.hp + Math.floor(state.maxHp * 0.3), state.maxHp);
  } else if (action.choice === 'maxHp') {
    state.maxHp += 8;
    state.hp = Math.min(state.hp + 8, state.maxHp);
  } else if (action.choice === 'upgrade') {
    if (!action.uid) {
      const candidates = state.deck.filter(c => !c.up && CARDS[c.id]?.upgradeEffects?.length);
      if (!candidates.length) return '无可升级的牌';
      const chosen = candidates[Math.floor(nextRand(state) * candidates.length)];
      chosen.up = true;
    } else {
      const card = state.deck.find(c => c.uid === action.uid);
      if (!card || card.up || !CARDS[card.id]?.upgradeEffects?.length) return '无效升级目标';
      card.up = true;
    }
  } else {
    return '无效休息选择';
  }
  completeNode(state);
  state.phase = 'map';
  return null;
}

function generateEvent(state) {
  const events = [
    { id: 'ev1', text: '你发现了一处废弃的战术装备。', choices: [{ id: 'take', text: '拆走装备（失去6点生命，获得随机遗物）' }, { id: 'leave', text: '离开' }] },
    { id: 'ev2', text: '一位老将提出指导训练。', choices: [{ id: 'train', text: '接受训练（升级一张随机牌）' }, { id: 'skip', text: '拒绝' }] },
    { id: 'ev3', text: '你找到一个补给箱。', choices: [{ id: 'heal', text: '使用医疗补给（恢复15点生命）' }, { id: 'money', text: '拿走钱（获得50金币）' }] },
    { id: 'ev4', text: '临时训练赛给了你一次检验新战术的机会。', choices: [{ id: 'scrim', text: '高强度训练（失去8点生命，随机升级一张牌）' }, { id: 'rest', text: '恢复体能（花20金币，回复8点生命）' }] },
    { id: 'ev5', text: '赞助商提出两份不同的赛季合同。', choices: [{ id: 'cash', text: '密集商务活动（最大生命-4，获得70金币）' }, { id: 'fans', text: '粉丝见面会（花50金币，最大生命+4）' }] },
    { id: 'ev6', text: '分析师发现了一份旧赛季的战术数据库。', choices: [{ id: 'scout', text: '购买情报（花35金币，获得随机遗物）' }, { id: 'sell', text: '出售情报（失去6点生命，获得30金币）' }] },
    { id: 'ev7', text: '一份高风险合作合同摆在桌上。', choices: [{ id: 'accept', text: '获得随机遗物，并加入一张随机俱乐部隐患' }, { id: 'decline', text: '谢绝合作' }] }
  ];
  return events[Math.floor(nextRand(state) * events.length)];
}

function eventChoice(state, action) {
  if (state.phase !== 'event') return '不在事件阶段';
  const ev = state.event;
  const choice = ev.choices.find(c => c.id === action.choice);
  if (!choice) return '无效选择';
  if (ev.id === 'ev1' && action.choice === 'take') {
    state.hp = Math.max(1, state.hp - 6);
    grantRandomRelic(state);
  } else if (ev.id === 'ev2' && action.choice === 'train') {
    const candidates = state.deck.filter(c => !c.up && CARDS[c.id]?.upgradeEffects?.length);
    if (candidates.length) {
      candidates[Math.floor(nextRand(state) * candidates.length)].up = true;
    }
  } else if (ev.id === 'ev3' && action.choice === 'heal') {
    state.hp = Math.min(state.hp + 15, state.maxHp);
  } else if (ev.id === 'ev3' && action.choice === 'money') {
    state.money += 50;
  } else if (ev.id === 'ev4' && action.choice === 'scrim') {
    state.hp = Math.max(1, state.hp - 8);
    const candidates = state.deck.filter(c => !c.up && CARDS[c.id]?.upgradeEffects?.length);
    if (candidates.length) candidates[Math.floor(nextRand(state) * candidates.length)].up = true;
  } else if (ev.id === 'ev4' && action.choice === 'rest') {
    if (state.money < 20) return '金币不足';
    state.money -= 20;
    state.hp = Math.min(state.maxHp, state.hp + 8);
  } else if (ev.id === 'ev5' && action.choice === 'cash') {
    state.maxHp = Math.max(1, state.maxHp - 4);
    state.hp = Math.min(state.hp, state.maxHp);
    state.money += 70;
  } else if (ev.id === 'ev5' && action.choice === 'fans') {
    if (state.money < 50) return '金币不足';
    state.money -= 50;
    state.maxHp += 4;
    state.hp += 4;
  } else if (ev.id === 'ev6' && action.choice === 'scout') {
    if (state.money < 35) return '金币不足';
    state.money -= 35;
    grantRandomRelic(state);
  } else if (ev.id === 'ev6' && action.choice === 'sell') {
    state.hp = Math.max(1, state.hp - 6);
    state.money += 30;
  } else if (ev.id === 'ev7' && action.choice === 'accept') {
    grantRandomRelic(state);
    const curse=CURSES[Math.floor(nextRand(state)*CURSES.length)];
    state.deck.push({uid:nextUid(state),id:curse.id,up:false});
    pushLog(state,'curse_gained',{id:curse.id});
  }
  completeNode(state);
  state.phase = 'map';
  state.event = null;
  return null;
}

function startNextAct(state) {
  if (state.phase !== 'intermission') return '不在幕间阶段';
  if (state.act >= 3) return '已是最终幕';
  state.act++;
  state.hp = state.maxHp;
  state.map = buildMap(state.seed, state.act);
  state.currentNode = null;
  state.completed = [];
  state.checkpoint = null;
  state.phase = 'map';
  pushLog(state, 'act_start', { act: state.act });
  return null;
}

function applyRelicsAtBattleStart(state) {
  const b = state.battle;
  for (const rel of state.relics) {
    switch (rel.id) {
      case 'R02': drawCards(state, 1); break;
      case 'R03': b.energy += 1; break;
      case 'R04': for (const e of alive(b)) addStatus(e, 'smoke', 3); break;
      case 'R05': for (const e of alive(b)) addStatus(e, 'flash', 3); break;
      case 'R12': b.energy += 2; break;
    }
  }
}

function applyTurnStartPowers(state) {
  const b = state.battle;
  for (const p of b.powers) {
    const stacks = b.powerStacks[p] || 1;
    if (p === 'tactical_core') {
      drawCards(state, 1 * stacks);
    } else if (p === 'tactical_master') {
      b.energy += 2 * stacks;
    } else if (p === 'final_push') {
      b.playerBlock += 3 * stacks;
    } else if (p === 'burn_core') {
      for (const e of alive(b)) addStatus(e, 'burn', 3 * stacks);
    }
  }
  for (const rel of state.relics) {
    if (rel.id === 'R06') drawCards(state, 1);
    else if (rel.id === 'R11') b.playerBlock += 2;
  }
}
