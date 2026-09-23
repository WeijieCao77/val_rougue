// new-demo/engine.js
import { buildMap, availableNodes } from './season-map.js';
import { CARDS, CARD_IDS, STATUS_CARDS, TEAMS, ENEMIES, RELICS } from './content.js';

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
    for (const c of b.hand) {
      if (c.id in STATUS_CARDS) continue;
      if (b.energy >= CARDS[c.id].cost) actions.push({ type: 'play', uid: c.uid });
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
        if (state.money >= priceOf(item.id)) actions.push({ type: 'buy', id: item.id, index: i });
      }
      const rmCost = removePrice(state);
      if (state.money >= rmCost) {
        for (const c of state.deck) {
          if (canRemoveCard(state, c.uid)) actions.push({ type: 'remove', uid: c.uid });
        }
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
      hand: b.hand.map(c => ({ uid: c.uid, id: c.id, name: CARDS[c.id].name, cost: CARDS[c.id].cost, text: c.up ? CARDS[c.id].upgradeText || CARDS[c.id].text : CARDS[c.id].text })),
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
  for (const act of state.battle.enemyIntent) {
    if (act.type === 'hit') parts.push(`攻击${act.n}×${act.times}`);
    else if (act.type === 'block') parts.push(`布防${act.n}`);
    else if (act.type === 'jam') parts.push(`施加${act.id}`);
    else if (act.type === 'weak') parts.push(`施加虚弱${act.n}`);
  }
  return parts.join('，');
}

export function preview(state, uid) {
  if (state.phase !== 'combat' || !state.battle) return null;
  const card = state.battle.hand.find(c => c.uid === uid);
  if (!card) return null;
  const def = CARDS[card.id];
  return {
    card: { uid, id: card.id, name: def.name, cost: def.cost, text: card.up && def.upgradeText ? def.upgradeText : def.text },
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
    case 'end': return endTurn(state);
    case 'reward': return chooseReward(state, action);
    case 'buy': return buyCard(state, action);
    case 'remove': return removeCard(state, action);
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
    enemyScript: shuffledEnemyScript(def.script, state),
    enemyScriptIndex: 0,
    enemyIntent: null,
    turn: 1,
    energy: 3,
    stance: 'cover',
    stanceSwitchUsedThisTurn: false,
    attackPlayedThisTurn: false,
    blockPlayedThisTurn: false,
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
    playerBlock: 0
  };
  applyRelicsAtBattleStart(state);
  state.phase = 'combat';
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

function playCard(state, action) {
  if (state.phase !== 'combat') return '不在战斗阶段';
  const b = state.battle;
  if (b.playsThisTurn >= MAX_PLAYS_PER_TURN) return '本回合打出牌数已达上限';
  const idx = b.hand.findIndex(c => c.uid === action.uid);
  if (idx === -1) return '手牌中没有该牌';
  const card = b.hand[idx];
  const def = CARDS[card.id];
  if (!def) return '未知卡牌';
  if (def.type === 'status') return '状态牌不能打出';
  if (b.energy < def.cost) return '能量不足';

  const preAttackPlayed = b.attackPlayedThisTurn;
  const preBlockPlayed = b.blockPlayedThisTurn;
  const preStanceChanged = b.stanceChangedThisTurn;
  const mods = stanceModifiers(b);
  const context = {
    preAttackPlayed,
    preBlockPlayed,
    preStanceChanged,
    attackBonusUsed: false,
    blockBonusUsed: false
  };

  b.energy -= def.cost;
  b.hand.splice(idx, 1);
  b.playsThisTurn++;

  const effects = card.up && def.upgradeEffects?.length ? def.upgradeEffects : def.effects;
  for (const eff of effects) {
    applyEffect(state, eff, card, mods, context);
  }

  if (def.type === 'power') {
    if (!b.powers.includes(def.power)) {
      b.powers.push(def.power);
      b.powerStacks[def.power] = 1;
    } else {
      b.powerStacks[def.power]++;
    }
    b.powerCards.push(card);
    // Power card is removed from rotation, not discarded or exhausted
  } else if (def.exhaust || effects.some(e => e.type === 'exhaustSelf')) {
    b.exhaustPile.push(card);
  } else {
    b.discardPile.push(card);
  }

  // Update per-turn flags after card resolution
  const isAttack = def.type === 'attack' || def.effects.some(e => e.type === 'attack' || (e.type === 'conditional' && e.effect.type === 'attack'));
  const isBlock = def.effects.some(e => e.type === 'block' || (e.type === 'conditional' && e.effect.type === 'block'));
  if (isAttack) b.attackPlayedThisTurn = true;
  if (isBlock) b.blockPlayedThisTurn = true;
  if (effects.some(e => e.type === 'stanceSwitch')) b.stanceChangedThisTurn = true;

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
      for (let i = 0; i < times; i++) {
        let dmg = baseDamage;
        if (i === 0 && bonus > 0) dmg += bonus;
        if (clutchBonus > 0) dmg += clutchBonus;
        dealDamageToEnemy(state, dmg);
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
      b.playerBlock += blk + bonus;
      break;
    }
    case 'smoke': {
      let n = eff.n;
      if (b.powers.includes('smoke_core') && !b.smokeBonusUsedThisTurn) {
        n += 2;
        b.smokeBonusUsedThisTurn = true;
      }
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
    case 'upgradeAllInCombatDeck': {
      for (const c of [...b.drawPile, ...b.discardPile, ...b.hand]) {
        if (!c.up && CARDS[c.id]?.upgradeEffects?.length) c.up = true;
      }
      break;
    }
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

function dealDamageToPlayer(state, baseDamage) {
  const b = state.battle;
  let dmg = baseDamage;
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
    b.hand.push(b.drawPile.shift());
  }
}

function manualStance(state) {
  if (state.phase !== 'combat') return '不在战斗阶段';
  const b = state.battle;
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

  // Discard hand, apply status card damage
  for (const card of b.hand) {
    if (card.id in STATUS_CARDS) {
      const dmgMap = { ST01: 1, ST02: 2, ST03: 3 };
      state.hp = Math.max(0, state.hp - (dmgMap[card.id] || 0));
      if (state.hp <= 0) {
        finishBattleLoss(state);
        return null;
      }
    }
  }
  b.discardPile.push(...b.hand);
  b.hand = [];

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
  b.turn++;
  b.energy = 3;
  b.playerBlock = 0;
  applyTurnStartPowers(state);
  drawCards(state, 5);
  nextEnemyIntent(state);
  pushLog(state, 'end_turn', { turn: b.turn });
  return null;
}

function executeEnemyTurn(state) {
  const b = state.battle;
  for (const action of b.enemyIntent) {
    if (state.phase !== 'combat') return;
    if (action.type === 'hit') {
      for (let i = 0; i < action.times; i++) {
        dealDamageToPlayer(state, action.n);
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
    }
  }
}

function finishBattleWin(state) {
  const b = state.battle;
  const node = state.map.nodes.find(n => n.key === state.currentNode);
  const moneyReward = node?.kind === 'boss' ? 50 : node?.kind === 'elite' ? 35 : 20;
  state.money += moneyReward;

  // Generate reward pool (unique cards)
  const weights = { common: 10, uncommon: 4, rare: 1 };
  const pool = [];
  while (pool.length < 3) {
    const total = CARD_IDS.reduce((s, id) => s + weights[CARDS[id].rarity], 0);
    let roll = nextRand(state) * total;
    let chosen = CARD_IDS[0];
    for (const id of CARD_IDS) {
      roll -= weights[CARDS[id].rarity];
      if (roll <= 0) {
        chosen = id;
        break;
      }
    }
    if (!pool.includes(chosen)) pool.push(chosen);
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
  for (let i = 0; i < 5; i++) {
    const id = CARD_IDS[Math.floor(nextRand(state) * CARD_IDS.length)];
    cards.push({ id, price: priceOf(id) });
  }
  return { cards };
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
  const cost = priceOf(item.id);
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
    { id: 'ev6', text: '分析师发现了一份旧赛季的战术数据库。', choices: [{ id: 'scout', text: '购买情报（花35金币，获得随机遗物）' }, { id: 'sell', text: '出售情报（失去6点生命，获得30金币）' }] }
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
    }
  }
  for (const rel of state.relics) {
    if (rel.id === 'R06') drawCards(state, 1);
    else if (rel.id === 'R11') b.playerBlock += 2;
  }
}
