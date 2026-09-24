// new-demo/engine.js
import { buildMap, availableNodes } from './season-map.js';
import { CARDS, CARD_IDS, REGION_CARD_IDS, SHARED_CARD_IDS, STATUS_CARDS, TEAMS, ENEMIES, RELICS, ARCHETYPES } from './content.js';
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
    for (const c of b.hand) {
      if (c.id in STATUS_CARDS) continue;
      if (b.energy >= cardCost(c) && b.playsThisTurn < MAX_PLAYS_PER_TURN) actions.push({ type: 'play', uid: c.uid });
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
    return {
      kind: 'combat',
      playerHp: state.hp,
      playerMaxHp: state.maxHp,
      energy: b.energy,
      stance: b.stance,
      enemy: {
        id: b.enemyId,
        name: b.enemyName,
        hp: b.enemyHp,
        maxHp: b.enemyMaxHp,
        smoke: b.statuses.enemy.smoke || 0,
        flash: b.statuses.enemy.flash || 0,
        weak: b.statuses.enemy.weak || 0,
        vuln: b.statuses.enemy.vuln || 0,
        block: b.statuses.enemy.block || 0,
        intent: describeIntent(state)
      },
      playerStatuses: b.statuses.player,
      playerBlock: b.playerBlock,
      hand: b.hand.map(c => { const def = CARDS[c.id]; return { uid: c.uid, id: c.id, name: def.name, cost: cardCost(c), text: c.up ? def.upgradeText || def.text : def.text }; }),
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

export function describeIntent(state) {
  if (state.phase !== 'combat' || !state.battle?.enemyIntent) return null;
  const parts = [];
  // Actions resolve in order, so a buff listed first already raises the hit after it.
  const b = state.battle;
  let strength = b.statuses.enemy.strength || 0;
  if (b.field === 'overtime' && b.turn >= 5) strength += 2;
  for (const act of b.enemyIntent) {
    if (act.type === 'hit') parts.push(`攻击${enemyHitBase(b, act.n, act.times) + strength}×${act.times}`);
    else if (act.type === 'buff') { strength += act.n; parts.push(`强化火力+${act.n}`); }
    else if (act.type === 'block') parts.push(`布防${act.n}`);
    else if (act.type === 'jam') parts.push(`塞入${act.n || 1}张「${STATUS_CARDS[act.id]?.name || act.id}」`);
    else if (act.type === 'weak') parts.push(`施加压制${act.n}`);
    else if (act.type === 'vuln') parts.push(`施加易伤${act.n}`);
    else if (act.type === 'aim') parts.push('瞄准（下回合重狙）');
    else if (act.type === 'snipe') {
      const full = enemyHitBase(b, act.n, 1) + strength;
      parts.push(b.statuses.enemy.aim ? `重狙${full}（闪光可打断）` : `仓促射击${Math.ceil(act.n / 3) + strength}（瞄准已被打断）`);
    }
    else if (act.type === 'cleanse') parts.push('清除自身负面状态');
  }
  return parts.join('，');
}

export function preview(state, uid) {
  if (state.phase !== 'combat' || !state.battle) return null;
  const card = state.battle.hand.find(c => c.uid === uid);
  if (!card) return null;
  const def = CARDS[card.id];
  return {
    card: { uid, id: card.id, name: def.name, cost: cardCost(card), text: card.up && def.upgradeText ? def.upgradeText : def.text },
    stance: state.battle.stance
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
  const err = applyAction(next, action);
  if (err) return { state, error: err };
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

function startBattle(state, node) {
  const def = getEnemyDef(node.enemy);
  if (!def) return '敌人未找到';
  const deck = state.deck.map(c => ({ uid: c.uid, id: c.id, up: c.up }));
  shuffle(deck, state);
  const hand = [];
  for (let i = 0; i < 5 && deck.length; i++) hand.push(deck.shift());
  state.battle = {
    enemyId: node.enemy,
    enemyName: def.name,
    enemyHp: def.hp,
    enemyMaxHp: def.hp,
    enemyScript: def.ordered ? deepClone(def.script) : shuffledEnemyScript(def.script, state),
    enemyScriptIndex: 0,
    enemyIntent: null,
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
    statuses: { player: {}, enemy: {} },
    rewardPool: null,
    rewardTaken: false,
    playerBlock: 0,
    field: node.field || null,
    trait: def.trait ? deepClone(def.trait) : null,
    traitState: {},
    tempoCount: 0
  };
  state.phase = 'combat';
  const b = state.battle;
  if (def.startBlock) b.statuses.enemy.block = def.startBlock;
  if (b.field === 'smoky') b.statuses.enemy.smoke = 2;
  const opening=hand.slice();
  if (b.field === 'eco') { b.energy += 1; drawCards(state, 1); }
  applyRelicsAtBattleStart(state);
  if(state.phase!=='combat')return null;
  for(const card of opening){if(!hand.some(c=>c.uid===card.uid))continue;applyDrawAffliction(state,card);if(state.phase!=='combat')return null;}
  nextEnemyIntent(state);
  pushLog(state, 'battle_start', { enemy: node.enemy });
  return null;
}

function nextEnemyIntent(state) {
  const b = state.battle;
  const script = b.enemyScript;
  const idx = b.enemyScriptIndex % script.length;
  b.enemyScriptIndex++;
  b.enemyIntent = script[idx];
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

// End-of-player-turn automation: deployed turrets fire, barriers add block.
function turretDamage(b, d) { return d.n + 3 * (b.powerStacks.turret_core || 0); }
function runDeployables(state) {
  const b = state.battle;
  for (const d of b.deployables || []) {
    if (d.kind === 'turret') { dealDamageToEnemy(state, turretDamage(b, d)); checkEnemyHpTraits(state); }
    else b.playerBlock += d.n;
    d.turns--;
    if (b.enemyHp <= 0) break;
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
    blockBonusUsed: false
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

  if (b.enemyHp > 0 && b.trait?.id === 'enrageOnSkill' && def.type === 'skill') {
    b.statuses.enemy.strength = (b.statuses.enemy.strength || 0) + b.trait.n;
  }
  if (b.enemyHp > 0 && b.trait?.id === 'tempo' && ++b.tempoCount >= b.trait.n) {
    b.tempoCount = 0;
    b.statuses.enemy.strength = (b.statuses.enemy.strength || 0) + 2;
    b.statuses.enemy.block = (b.statuses.enemy.block || 0) + 8;
    pushLog(state, 'trait', { id: 'tempo' });
  }

  if (b.enemyHp <= 0) {
    b.enemyHp = 0;
    finishBattleWin(state);
    return null;
  }
  pushLog(state, 'play_card', { uid: card.uid, id: card.id });
  return null;
}

function applyEffect(state, eff, sourceCard, mods, context) {
  const b = state.battle;
  switch (eff.type) {
    case 'attack': {
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
      const clutchBonus = (b.powers.includes('clutch_core') && ((b.statuses.enemy.smoke || 0) > 0 || (b.statuses.enemy.flash || 0) > 0)) ? 2 * (b.powerStacks.clutch_core || 1) : 0;
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
        dealDamageToEnemy(state, dmg);
        checkEnemyHpTraits(state);
        if (b.enemyHp <= 0) break;
        if (b.trait?.id === 'thorns') {
          damagePlayerDirect(state, b.trait.n);
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
      let n = eff.n;
      if (b.powers.includes('smoke_core') && !b.smokeBonusUsedThisTurn) {
        n += 2;
        b.smokeBonusUsedThisTurn = true;
      }
      if (b.field === 'smoky' && !b.fieldSmokeUsedThisTurn) { n += 1; b.fieldSmokeUsedThisTurn = true; }
      b.statuses.enemy.smoke = (b.statuses.enemy.smoke || 0) + n;
      break;
    }
    case 'flash': {
      let n = eff.n;
      if (b.powers.includes('flash_core') && !b.flashBonusUsedThisTurn) {
        n += 2;
        b.flashBonusUsedThisTurn = true;
      }
      b.statuses.enemy.flash = (b.statuses.enemy.flash || 0) + n;
      if (b.statuses.enemy.aim) { b.statuses.enemy.aim = 0; pushLog(state, 'aim_broken'); }
      break;
    }
    case 'weak':
      b.statuses.enemy.weak = (b.statuses.enemy.weak || 0) + eff.n;
      break;
    case 'vuln':
      b.statuses.enemy.vuln = (b.statuses.enemy.vuln || 0) + eff.n;
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
      b.statuses.enemy[eff.id] = Math.max(0, (b.statuses.enemy[eff.id] || 0) - eff.n);
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
      b.statuses.enemy.burn = (b.statuses.enemy.burn || 0) + eff.n;
      break;
    case 'burnMultiply':
      b.statuses.enemy.burn = (b.statuses.enemy.burn || 0) * eff.n;
      break;
    case 'detonate': {
      const stacks = b.statuses.enemy.burn || 0;
      b.statuses.enemy.burn = 0;
      if (stacks > 0) applyEffect(state, { type: 'attack', n: stacks * eff.per }, sourceCard, mods, context);
      break;
    }
    case 'deploy':
      (b.deployables ||= []).push({ kind: eff.kind, n: eff.n, turns: eff.turns });
      break;
    case 'fireTurrets':
      for (const d of b.deployables || []) {
        if (d.kind !== 'turret') continue;
        dealDamageToEnemy(state, turretDamage(b, d));
        checkEnemyHpTraits(state);
        if (b.enemyHp <= 0) break;
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
  switch (cond) {
    case 'enemy_intends_attack':
      return b.enemyIntent.some(a => a.type === 'hit');
    case 'enemy_smoke':
      return (b.statuses.enemy.smoke || 0) > 0;
    case 'enemy_flash':
      return (b.statuses.enemy.flash || 0) > 0;
    case 'enemy_smoke_or_flash':
      return (b.statuses.enemy.smoke || 0) > 0 || (b.statuses.enemy.flash || 0) > 0;
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
      return (b.statuses.enemy.vuln || 0) > 0;
    case 'enemy_burn':
      return (b.statuses.enemy.burn || 0) > 0;
    default:
      return false;
  }
}

function dealDamageToEnemy(state, dmg) {
  const b = state.battle;
  let final = dmg;
  if (b.statuses.player.weak > 0) {
    final = Math.floor(final * 0.75);
  }
  if (b.statuses.enemy.vuln > 0) {
    final = Math.floor(final * 1.5);
  }
  if (b.statuses.enemy.block > 0) {
    const blocked = Math.min(b.statuses.enemy.block, final);
    b.statuses.enemy.block -= blocked;
    final -= blocked;
  }
  b.enemyHp = Math.max(0, b.enemyHp - final);
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

// Passive traits that react to the enemy's HP dropping.
function checkEnemyHpTraits(state) {
  const b = state.battle;
  const trait = b.trait;
  if (!trait || b.enemyHp <= 0) return;
  if (trait.id === 'berserk' && !b.traitState.berserk && b.enemyHp <= b.enemyMaxHp / 2) {
    b.traitState.berserk = true;
    b.statuses.enemy.strength = (b.statuses.enemy.strength || 0) + trait.n;
    pushLog(state, 'trait', { id: 'berserk' });
  }
  if (trait.id === 'phase2' && !b.traitState.phase2 && b.enemyHp <= b.enemyMaxHp / 2) {
    b.traitState.phase2 = true;
    for (const k of ['weak', 'vuln', 'smoke', 'flash']) b.statuses.enemy[k] = 0;
    b.statuses.enemy.block = (b.statuses.enemy.block || 0) + 12;
    b.statuses.enemy.strength = (b.statuses.enemy.strength || 0) + 2;
    const def = getEnemyDef(b.enemyId);
    b.enemyScript = deepClone(def.phase2);
    b.enemyIntent = b.enemyScript[0];
    b.enemyScriptIndex = 1;
    pushLog(state, 'trait', { id: 'phase2' });
  }
}

function dealDamageToPlayer(state, baseDamage) {
  const b = state.battle;
  let dmg = baseDamage + (b.statuses.enemy.strength || 0);
  // Push stance bonus to incoming damage: +2 raw damage per hit before smoke/flash/block
  if (b.stance === 'push') {
    dmg += 2;
  }
  if (b.statuses.enemy.weak > 0) {
    dmg = Math.floor(dmg * 0.75);
  }
  if (b.statuses.player.vuln > 0) {
    dmg = Math.floor(dmg * 1.5);
  }
  const smoke = b.statuses.enemy.smoke || 0;
  if (smoke > 0) {
    dmg = Math.max(0, dmg - smoke);
  }
  const flash = b.statuses.enemy.flash || 0;
  if (flash > 0) {
    dmg = Math.max(0, dmg - 3 * flash);
    b.statuses.enemy.flash = 0;
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
  if (b.enemyHp <= 0) { b.enemyHp = 0; finishBattleWin(state); return null; }
  // Burn ticks at the start of the enemy turn and ignores block.
  if (b.statuses.enemy.burn > 0) {
    b.enemyHp = Math.max(0, b.enemyHp - b.statuses.enemy.burn);
    b.statuses.enemy.burn--;
    checkEnemyHpTraits(state);
    if (b.enemyHp <= 0) { finishBattleWin(state); return null; }
  }

  // Player turn ends: decrement player weak only
  if (b.statuses.player.weak > 0) b.statuses.player.weak--;

  // Enemy vuln decays before enemy turn
  if (b.statuses.enemy.vuln > 0) b.statuses.enemy.vuln--;

  executeEnemyTurn(state);
  if (state.phase !== 'combat') return null;

  // Player vuln decays after enemy turn
  if (b.statuses.player.vuln > 0) b.statuses.player.vuln--;

  // Enemy turn ends: decrement enemy weak/smoke (vuln already handled)
  if (b.statuses.enemy.weak > 0) b.statuses.enemy.weak--;
  if (b.statuses.enemy.smoke > 0) b.statuses.enemy.smoke--;

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
  drawCards(state, 5);
  nextEnemyIntent(state);
  pushLog(state, 'end_turn', { turn: b.turn });
  return null;
}

function executeEnemyTurn(state) {
  const b = state.battle;
  if (b.field === 'overtime' && b.turn >= 5) b.statuses.enemy.strength = (b.statuses.enemy.strength || 0) + 2;
  for (const action of b.enemyIntent) {
    if (state.phase !== 'combat') return;
    if (action.type === 'hit') {
      for (let i = 0; i < action.times; i++) {
        dealDamageToPlayer(state, enemyHitBase(b, action.n, action.times));
        if (state.hp <= 0) {
          finishBattleLoss(state);
          return;
        }
      }
    } else if (action.type === 'block') {
      b.statuses.enemy.block = (b.statuses.enemy.block || 0) + action.n;
    } else if (action.type === 'jam') {
      const n = action.n || 1;
      for (let i = 0; i < n; i++) {
        b.discardPile.push({ uid: nextUid(state), id: action.id, up: false });
      }
    } else if (action.type === 'weak') {
      b.statuses.player.weak = (b.statuses.player.weak || 0) + action.n;
    } else if (action.type === 'buff') {
      // Permanent for this fight: every later hit gains this much damage.
      b.statuses.enemy.strength = (b.statuses.enemy.strength || 0) + action.n;
    } else if (action.type === 'vuln') {
      b.statuses.player.vuln = (b.statuses.player.vuln || 0) + action.n;
    } else if (action.type === 'aim') {
      b.statuses.enemy.aim = 1;
    } else if (action.type === 'snipe') {
      const aimed = (b.statuses.enemy.aim || 0) > 0;
      b.statuses.enemy.aim = 0;
      dealDamageToPlayer(state, aimed ? enemyHitBase(b, action.n, 1) : Math.ceil(action.n / 3));
      if (state.hp <= 0) { finishBattleLoss(state); return; }
    } else if (action.type === 'cleanse') {
      for (const k of ['weak', 'vuln', 'smoke', 'flash']) b.statuses.enemy[k] = 0;
    }
  }
  if (b.trait?.id === 'ritual') b.statuses.enemy.strength = (b.statuses.enemy.strength || 0) + b.trait.n;
}

function finishBattleWin(state) {
  const b = state.battle;
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
  pushLog(state, 'battle_won', { enemy: b.enemyId });
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
      case 'R04': b.statuses.enemy.smoke = (b.statuses.enemy.smoke || 0) + 3; break;
      case 'R05': b.statuses.enemy.flash = (b.statuses.enemy.flash || 0) + 3; break;
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
      b.statuses.enemy.burn = (b.statuses.enemy.burn || 0) + 3 * stacks;
    }
  }
  for (const rel of state.relics) {
    if (rel.id === 'R06') drawCards(state, 1);
    else if (rel.id === 'R11') b.playerBlock += 2;
  }
}
