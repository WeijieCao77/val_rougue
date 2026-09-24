// new-demo/engine.js
import { buildMap, availableNodes } from './season-map.js';
import { CARDS, CARD_IDS, REGION_CARD_IDS, SHARED_CARD_IDS, STATUS_CARDS, TEAMS, ENEMIES, GROUPS, RELICS, ARCHETYPES, TEAM_TRAITS, RELIC_IDS_BY_TIER, EQUIP_TIERS, SUPPLIES, SUPPLY_IDS, SUPPLY_SLOTS } from './content.js';
import { CURSES, CURSE_RULES, EXTRA_STATUS_RULES } from '../afflictions.js';
import { EVENTS, EVENT_POOLS, CRATE_LOOT } from './events.js';
import { opsReason, describeOps, applyOps, pickKind, pickCandidates } from '../shared-event-core.js';
import { freshUnknownOdds, resolveUnknown, blockedUnknownKinds, rollCrateSize } from '../shared-unknown-room.js';
import { ROUTE_STEPS } from '../shared-route-generator.js';
import { planCardUnlocks, unlockedFrom, tierOfId, validTier, UNLOCK_TIERS } from '../shared-unlock.js';

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

// ----------------------------- Difficulty levels -----------------------------
// Optional stacking challenge (0-10). Each level adds one rule on top of all
// lower ones; level 0 is the base game. Unlocked per team by winning a run.
export const MAX_ASCENSION = 10;
export const ASCENSION_RULES = [
  '基础难度，无附加规则。',
  '地图上出现更多精英战。',
  '普通敌人伤害 +10%。',
  '精英伤害 +15%。',
  '幕末决战对手伤害 +10%。',
  '休整回复由最大生命的30%降为20%。',
  '开局当前生命 -10%。',
  '普通敌人生命 +10%。',
  '精英与幕末决战对手生命 +10%。',
  '开局牌组加入1张随机隐患。',
  '幕末决战对手开局获得3层火力。'
];
const clampAscension = n => Math.max(0, Math.min(MAX_ASCENSION, Math.floor(Number(n) || 0)));

export function restHealAmount(state) {
  return Math.floor(state.maxHp * restHealRate(state)) + (hasRelic(state, 'R25') ? 10 : 0);
}
// Share of max HP that 休整 restores (野战医疗站 adds 10%).
export function restHealRate(state) {
  return ((state.ascension || 0) >= 5 ? 0.2 : 0.3) + (hasInvest(state, 'IN02') ? 0.1 : 0);
}

// ----------------------------- Economy (options.econ) -----------------------------
// Runs created with `econ` use unlock tiers (reduced card/equipment pools until
// unlocked), skip compensation, 战术投资 and shop rerolls. Runs without it keep
// the full pools and the older reward/shop rules.
export const SKIP_GOLD = 15;
export const REROLL_BASE = 20;
export const REROLL_STEP = 10;
export const INVESTMENTS = {
  IN01: { name: '情报网络', price: 200, icon: 'cards', desc: '战后奖励的可选卡牌多 1 张。' },
  IN02: { name: '野战医疗站', price: 160, icon: 'heal', desc: '休整回复额外 +最大生命的10%。' },
  IN03: { name: '扩编货架', price: 180, icon: 'coin', desc: '补给站的卡牌货架多 1 格。' },
  IN04: { name: '战前简报室', price: 220, icon: 'draw', desc: '每场战斗第一回合多抽 1 张牌。' },
  IN05: { name: '后勤车队', price: 150, icon: 'supply', desc: '精英战胜利后，多进行一次补给品掉落判定。' }
};
// Equipment batches opened by unlock tiers 1–5; everything else is in the base pool.
export const RELIC_UNLOCKS = [
  ['R16', 'R23', 'R33'],
  ['R17', 'R24', 'R37'],
  ['R19', 'R26', 'R30'],
  ['R20', 'R27', 'R46'],
  ['R29', 'R35', 'R49']
];
export const econOn = state => (state?.econ || 0) >= 1;
export function hasInvest(state, id) {
  return econOn(state) && !!state.invest?.includes(id);
}
const planCache = {}, poolCache = {};
// Team cards split into a base pool and five unlock batches (shared cards are always open).
export function teamUnlockPlan(team) {
  const def = TEAMS[team] || TEAMS.breach;
  const ids = REGION_CARD_IDS[def.region] || REGION_CARD_IDS.AM;
  return planCache[team] ||= planCardUnlocks(ids, { start: def.startingDeck.map(([id]) => id), rarityOf: id => CARDS[id].rarity, groupOf: id => (ARCHETYPES[CARDS[id].tag] ? CARDS[id].tag : null), salt: team });
}
function teamCardIds(state) {
  const ids = REGION_CARD_IDS[TEAMS[state.team]?.region] || REGION_CARD_IDS.AM;
  if (!econOn(state)) return ids;
  const key = `${state.team}:${state.unlockTier}`;
  return poolCache[key] ||= unlockedFrom(teamUnlockPlan(state.team), ids, state.unlockTier);
}
export function relicLocked(state, id) {
  return econOn(state) && tierOfId(RELIC_UNLOCKS, id) > (state.gearTier ?? UNLOCK_TIERS);
}
export function rerollPrice(state) {
  return (state.freeRerolls || 0) > 0 ? 0 : discounted(state, REROLL_BASE + REROLL_STEP * (state.shop?.rerolls || 0));
}
export function investPrice(state, id) {
  return discounted(state, INVESTMENTS[id].price);
}

// options: { ascension: 0-10, opening: true to start with the 赛前准备 choice }.
// Without options the run is the base game and starts on the map.
// ----------------------------- Equipment helpers -----------------------------
export function hasRelic(state, id) {
  return !!state?.relics?.some(r => r.id === id);
}
// Energy at the start of each turn: 3 plus boss gear marked `energy`.
export function baseEnergy(state) {
  return 3 + (state.relics || []).reduce((n, r) => n + (RELICS[r.id]?.energy || 0), 0);
}
function drawPerTurn(state) {
  return 5 + (hasRelic(state, 'R43') ? 1 : 0) - (hasRelic(state, 'R40') ? 1 : 0);
}
export function playLimit(state) {
  return hasRelic(state, 'R45') ? 6 : MAX_PLAYS_PER_TURN;
}
export function supplySlots(state) {
  return SUPPLY_SLOTS + (hasRelic(state, 'R38') ? 2 : 0);
}
// 供应商会员卡: every shop price -20%.
export function discounted(state, price) {
  return hasRelic(state, 'R36') ? Math.floor(price * 0.8) : price;
}

export function createRun(seed = String(Date.now()), team = 'breach', options = {}) {
  const teamDef = TEAMS[team] || TEAMS.breach;
  const ascension = clampAscension(options.ascension);
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
    checkpoint: null,
    ascension,
    supplies: [],
    supplyChance: 40,
    playedCount: 0
  };
  if (options.econ) {
    const tier = n => (validTier(n) ? n : UNLOCK_TIERS);
    Object.assign(state, { econ: 1, unlockTier: tier(options.unlockTier), gearTier: tier(options.gearTier), invest: [], freeRerolls: 0, fightsWon: 0 });
  }
  state.map = buildMap(seed, 1, ascension);
  if (ascension >= 6) state.hp = state.maxHp - Math.floor(state.maxHp * 0.1);
  if (ascension >= 9) {
    const curse = CURSES[Math.floor(nextRand(state) * CURSES.length)];
    state.deck.push({ uid: nextUid(state), id: curse.id, up: false });
  }
  if (options.opening) {
    state.phase = 'opening';
    state.opening = generateOpening(state);
  }
  pushLog(state, 'run_start', { ascension });
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
  // A new piece of equipment with every slot full must be resolved first.
  if (state.pendingRelics?.length) {
    actions.push({ type: 'declineRelic' });
    state.relics.forEach((_, index) => actions.push({ type: 'replaceRelic', index }));
    return actions;
  }
  if (state.phase === 'opening') {
    for (const o of state.opening?.options || []) actions.push({ type: 'opening', choice: o.id });
  } else if (state.phase === 'openingPick') {
    const pick = state.opening?.pick;
    if (pick?.kind === 'card') {
      actions.push({ type: 'openingPick', id: null });
      for (const id of pick.cards) actions.push({ type: 'openingPick', id });
    } else if (pick?.kind === 'remove') {
      for (const c of state.deck) if (canRemoveCard(state, c.uid)) actions.push({ type: 'openingPick', uid: c.uid });
    } else if (pick?.kind === 'upgrade') {
      for (const c of state.deck) if (!c.up && CARDS[c.id]?.upgradeEffects?.length) actions.push({ type: 'openingPick', uid: c.uid });
    }
  } else if (state.phase === 'map') {
    const avail = availableNodes({ ...state, mode: 'season' });
    for (const n of avail) actions.push({ type: 'enter', key: n.key });
  } else if (state.phase === 'combat') {
    const b = state.battle;
    if (!b) return [];
    if (b.pendingDiscover) return b.pendingDiscover.options.map(id => ({ type: 'discover', id }));
    const living = livingEnemies(b);
    for (const c of b.hand) {
      if (c.id in STATUS_CARDS) continue;
      if (!(b.energy >= cardCost(c) && b.playsThisTurn < playLimit(state))) continue;
      if (living.length > 1 && cardNeedsTarget(c)) for (const e of living) actions.push({ type: 'play', uid: c.uid, target: e.uid });
      else actions.push({ type: 'play', uid: c.uid });
    }
    if (b.energy >= manualStanceCost(b) && !b.stanceSwitchUsedThisTurn) actions.push({ type: 'stance' });
    (state.supplies || []).forEach((id, index) => {
      const sp = SUPPLIES[id];
      if (!sp) return;
      if (sp.target === 'enemy' && living.length > 1) for (const e of living) actions.push({ type: 'useSupply', index, target: e.uid });
      else actions.push({ type: 'useSupply', index });
    });
    actions.push({ type: 'end' });
  } else if (state.phase === 'reward') {
    const pending = state.battle?.rewardSupply;
    if (pending) {
      if ((state.supplies || []).length < supplySlots(state)) actions.push({ type: 'takeSupply' });
      else state.supplies.forEach((_, index) => actions.push({ type: 'takeSupply', replace: index }));
    }
    if (econOn(state)) actions.push({ type: 'reward', id: null, comp: 'gold' }, { type: 'reward', id: null, comp: 'reroll' });
    else actions.push({ type: 'reward', id: null });
    if (state.battle?.rewardPool) {
      for (const id of state.battle.rewardPool) actions.push({ type: 'reward', id });
    }
  } else if (state.phase === 'shop') {
    actions.push({ type: 'leave' });
    const shop = state.shop;
    if (shop) {
      for (let i = 0; i < shop.cards.length; i++) {
        const item = shop.cards[i];
        if (state.money >= shopPrice(item, state)) actions.push({ type: 'buy', id: item.id, index: i });
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
      if (state.relics.length < RELIC_SLOTS) (shop.relics || []).forEach((item, index) => { if (state.money >= shopPrice(item, state)) actions.push({ type: 'buyRelic', index }); });
      if ((state.supplies || []).length < supplySlots(state)) (shop.supplies || []).forEach((item, index) => { if (state.money >= shopPrice(item, state)) actions.push({ type: 'buySupply', index }); });
      if (econOn(state)) {
        if (shop.invest && state.money >= investPrice(state, shop.invest)) actions.push({ type: 'buyInvest' });
        if (state.money >= rerollPrice(state)) actions.push({ type: 'rerollShop' });
      }
    }
  } else if (state.phase === 'rest') {
    if (!hasRelic(state, 'R42')) actions.push({ type: 'rest', choice: 'heal' });
    actions.push({ type: 'rest', choice: 'maxHp' });
    for (const c of state.deck) {
      if (!c.up && CARDS[c.id]?.upgradeEffects?.length) {
        actions.push({ type: 'rest', choice: 'upgrade', uid: c.uid });
      }
    }
  } else if (state.phase === 'event') {
    actions.push(...eventActions(state));
  } else if (state.phase === 'crate') {
    actions.push({ type: 'crate', choice: state.crate?.opened ? 'leave' : 'open' });
  } else if (state.phase === 'intermission') {
    actions.push({ type: 'nextAct' });
  } else if (state.phase === 'bossRelic') {
    actions.push({ type: 'bossRelic', id: null });
    for (const id of state.bossRelic?.options || []) actions.push({ type: 'bossRelic', id });
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
      squad: b.squad ? { ...b.squad } : null,
      supplies: (state.supplies || []).slice(),
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
// `actual` (from incomingDamage) replaces hit numbers with the damage that lands.
function intentText(b, e, pending = 0, actual = null) {
  if (!e.intent) return null;
  const parts = [];
  // Actions resolve in order, so a buff listed first already raises the hit after it.
  let strength = (e.statuses.strength || 0) + pending;
  if (b.field === 'overtime' && b.turn >= 5) strength += 2;
  for (const [i, act] of e.intent.entries()) {
    const hits = actual?.[i];
    if (hits?.length && (act.type === 'hit' || act.type === 'snipe')) {
      const same = hits.every(n => n === hits[0]);
      if (act.type === 'hit') parts.push(same ? `攻击${hits[0]}×${hits.length}` : `攻击${hits.join('+')}`);
      else parts.push(e.statuses.aim ? `重狙${hits[0]}（闪光可打断）` : `仓促射击${hits[0]}（瞄准已被打断）`);
      continue;
    }
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

// Damage the coming enemy turn actually deals, mirroring executeEnemyTurn and
// dealDamageToPlayer: battlefield, strength (incl. buffs/rallies earlier in the
// turn and overtime), our push stance, enemy weak, our vulnerable (incl. vuln
// applied earlier in the turn), smoke and the one-shot flash. Our block is NOT
// subtracted. byEnemy[uid] = {hits, total, acts} where acts[i] lists the hits
// of intent action i.
export function incomingDamage(state) {
  const out = { total: 0, byEnemy: {} };
  const b = state?.battle;
  if (state?.phase !== 'combat' || !b) return out;
  const living = livingEnemies(b);
  const overtime = b.field === 'overtime' && b.turn >= 5 ? 2 : 0;
  const sim = new Map(living.map(e => [e.uid, {
    strength: (e.statuses.strength || 0) + overtime,
    weak: (e.statuses.weak || 0) > 0,
    smoke: e.statuses.smoke || 0,
    flash: e.statuses.flash || 0,
    aim: (e.statuses.aim || 0) > 0
  }]));
  let vuln = (b.statuses.player.vuln || 0) > 0;
  const hit = (m, base) => {
    let dmg = base + m.strength;
    if (b.stance === 'push') dmg += 2;
    if (m.weak) dmg = Math.floor(dmg * 0.75);
    if (vuln) dmg = Math.floor(dmg * 1.5);
    if (m.smoke > 0) dmg = Math.max(0, dmg - m.smoke);
    if (m.flash > 0) { dmg = Math.max(0, dmg - 3 * m.flash); m.flash = 0; }
    return dmg;
  };
  for (const e of living) {
    if (!e.intent) continue;
    const m = sim.get(e.uid);
    const acts = [];
    const hits = [];
    for (const a of e.intent) {
      const these = [];
      if (a.type === 'hit') for (let i = 0; i < a.times; i++) these.push(hit(m, enemyHitBase(b, a.n, a.times)));
      else if (a.type === 'snipe') { these.push(hit(m, m.aim ? enemyHitBase(b, a.n, 1) : Math.ceil(a.n / 3))); m.aim = false; }
      else if (a.type === 'buff') m.strength += a.n;
      else if (a.type === 'rally') for (const x of sim.values()) x.strength += a.n;
      else if (a.type === 'vuln' && a.n > 0) vuln = true;
      else if (a.type === 'aim') m.aim = true;
      else if (a.type === 'cleanse') { m.weak = false; m.smoke = 0; m.flash = 0; }
      acts.push(these.length ? these : null);
      hits.push(...these);
    }
    const total = hits.reduce((n, x) => n + x, 0);
    out.byEnemy[e.uid] = { hits, acts, total };
    out.total += total;
  }
  return out;
}

// Intent text per living enemy with the damage numbers that will actually land.
export function describeIntentsActual(state) {
  const out = {};
  if (state?.phase !== 'combat' || !state.battle) return out;
  const b = state.battle;
  const inc = incomingDamage(state);
  for (const e of livingEnemies(b)) out[e.uid] = intentText(b, e, 0, inc.byEnemy[e.uid]?.acts || []);
  return out;
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
  if (state.pendingRelics?.length && !['replaceRelic', 'declineRelic'].includes(action.type)) return { state, error: '请先处理新装备：替换一件或放弃' };
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
    case 'eventPick': return eventPick(state, action);
    case 'eventBack': return eventBack(state);
    case 'crate': return crateAction(state, action);
    case 'nextAct': return startNextAct(state);
    case 'opening': return chooseOpening(state, action);
    case 'useSupply': return useSupply(state, action);
    case 'discardSupply': return discardSupply(state, action);
    case 'takeSupply': return takeSupply(state, action);
    case 'buyRelic': return buyRelic(state, action);
    case 'buySupply': return buySupply(state, action);
    case 'bossRelic': return chooseBossRelic(state, action);
    case 'sellRelic': return sellRelic(state, action);
    case 'replaceRelic': return replaceRelic(state, action);
    case 'declineRelic': return declineRelic(state);
    case 'openingPick': return chooseOpeningPick(state, action);
    case 'rerollShop': return rerollShop(state);
    case 'buyInvest': return buyInvest(state);
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
    return enterUnknown(state, node);
  } else if (node.kind === 'crate') {
    enterCrate(state);
  }
  return null;
}

// Difficulty-level multipliers for one enemy (1 = unchanged).
function ascensionMods(state, def) {
  const a = state.ascension || 0;
  const role = def.boss ? 'boss' : def.elite ? 'elite' : 'normal';
  const dmg = role === 'normal' ? (a >= 2 ? 1.1 : 1) : role === 'elite' ? (a >= 3 ? 1.15 : 1) : (a >= 4 ? 1.1 : 1);
  const hp = role === 'normal' ? (a >= 7 ? 1.1 : 1) : (a >= 8 ? 1.1 : 1);
  return { dmg, hp, strength: role === 'boss' && a >= 10 ? 3 : 0 };
}
function scaleScript(script, k) {
  if (k === 1) return deepClone(script);
  return script.map(turn => turn.map(a => (a.type === 'hit' || a.type === 'snipe' ? { ...a, n: Math.round(a.n * k) } : { ...a })));
}

function createEnemy(state, member, index, label) {
  const def = getEnemyDef(member.id);
  const mods = ascensionMods(state, def);
  // 热身赛 opening bonus: enemies of the next few fights start weakened.
  const warm = state.warmup > 0 ? 0.7 : 1;
  const bounty = def.elite && hasRelic(state, 'R47') ? 1.25 : 1;
  const hp = Math.max(1, Math.round(Math.round(def.hp * mods.hp * bounty) * warm));
  const script = scaleScript(def.script, mods.dmg);
  const e = {
    uid: `e${index}`,
    id: member.id,
    name: label ? `${def.name}${label}` : def.name,
    look: def.look || null,
    hp,
    maxHp: hp,
    statuses: {},
    script: def.ordered ? script : shuffledEnemyScript(script, state),
    scriptIndex: member.offset || 0,
    intent: null,
    trait: def.trait ? deepClone(def.trait) : null,
    traitState: {},
    tempoCount: 0
  };
  if (mods.dmg !== 1) e.dmgMul = mods.dmg;
  if (def.startBlock) e.statuses.block = def.startBlock;
  if (mods.strength) e.statuses.strength = mods.strength;
  return e;
}

function startBattle(state, node) {
  const group = GROUPS[node.enemy];
  const members = group ? group.members : [{ id: node.enemy }];
  if (!members.length || members.some(m => !getEnemyDef(m.id))) return '敌人未找到';
  const deck = state.deck.map(c => ({ uid: c.uid, id: c.id, up: c.up }));
  shuffle(deck, state);
  const hand = [];
  for (let i = 0; i < drawPerTurn(state) && deck.length; i++) hand.push(deck.shift());
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
    energy: baseEnergy(state),
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
    field: node.field || null,
    squad: initSquad(state.team)
  };
  if (state.warmup > 0) { state.warmup--; state.battle.warmup = true; }
  state.phase = 'combat';
  const b = state.battle;
  if (b.field === 'smoky') for (const e of enemies) addStatus(e, 'smoke', 2);
  const opening=hand.slice();
  if (b.field === 'eco') { b.energy += 1; drawCards(state, 1); }
  applyRelicsAtBattleStart(state);
  if(state.phase!=='combat')return null;
  if (hasInvest(state, 'IN04')) { drawCards(state, 1); if (state.phase !== 'combat') return null; } // 战前简报室
  for(const card of opening){if(!hand.some(c=>c.uid===card.uid))continue;applyDrawAffliction(state,card);if(state.phase!=='combat')return null;}
  afterTurnDraw(state);
  if (state.phase !== 'combat') return null;
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

// Flat per-hit attack bonus from equipment and supplies.
function gearAttackBonus(state) {
  const b = state.battle;
  let n = b.tempAttack || 0;
  if (hasRelic(state, 'R19')) n += 1;
  if (hasRelic(state, 'R21') && state.hp <= state.maxHp / 2) n += 3;
  return n;
}

// ----------------------------- Team traits -----------------------------
// b.squad holds the per-combat state of the team's exclusive passive.
function initSquad(team) {
  const id = TEAMS[team]?.trait;
  if (!id || !TEAM_TRAITS[id]) return null;
  if (id === 'momentum') return { id, n: 0, armed: false };
  if (id === 'fortify') return { id, kept: 0 };
  if (id === 'intel') return { id, n: 0 };
  return { id, used: false };
}
const squadIs = (b, id) => b?.squad?.id === id;
function manualStanceCost(b) {
  return squadIs(b, 'dispatch') && !b.squad.used ? 0 : 1;
}
// 机动调度: the first stance switch of the turn draws a card.
function onStanceSwitched(state) {
  const b = state.battle;
  if (!squadIs(b, 'dispatch') || b.squad.used) return;
  b.squad.used = true;
  drawCards(state, 1);
  pushLog(state, 'squad', { id: 'dispatch' });
}
// 情报: every smoke/flash application (area effects count once).
function gainIntel(state) {
  const b = state.battle;
  if (!squadIs(b, 'intel')) return;
  b.squad.n++;
  if (b.squad.n >= TEAM_TRAITS.intel.max) {
    b.squad.n = 0;
    b.energy += 1;
    drawCards(state, 1);
    pushLog(state, 'squad', { id: 'intel' });
  }
}

function playCard(state, action) {
  if (state.phase !== 'combat') return '不在战斗阶段';
  const b = state.battle;
  if (b.pendingDiscover) return '请先选择发现的牌';
  if (b.playsThisTurn >= playLimit(state)) return '本回合打出牌数已达上限';
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
    target: target || living[0] || null,
    // 突击势能: an armed charge doubles every hit of the next attack card.
    doubleDamage: def.type === 'attack' && squadIs(b, 'momentum') && b.squad.armed
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
  // 双发扳机 (first attack card each turn) and 双倍弹药 (next card): resolve again.
  let replays = 0;
  if (def.type === 'attack' && !preAttackPlayed && hasRelic(state, 'R30')) replays++;
  if (b.replayNext) { b.replayNext = false; replays++; }
  for (let r = 0; r < replays && !allDead(b); r++) {
    if (!(context.target && context.target.hp > 0)) context.target = alive(b)[0] || null;
    for (const eff of effects) {
      applyEffect(state, eff, card, mods, context);
      if (state.phase !== 'combat') return null;
    }
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
    if (hasRelic(state, 'R24')) {
      const pool = alive(b);
      if (pool.length) { const t = pool[Math.floor(nextRand(state) * pool.length)]; t.hp = Math.max(0, t.hp - 3); if (t.hp <= 0) pushLog(state, 'enemy_down', { enemy: t.uid }); checkEnemyHpTraits(state, t); }
    }
  } else {
    b.discardPile.push(card);
  }

  // Equipment counters.
  if (def.type === 'attack') {
    b.attacksThisTurn = (b.attacksThisTurn || 0) + 1;
    if (b.attacksThisTurn === 3) {
      if (hasRelic(state, 'R22')) b.playerBlock += 4;
      if (hasRelic(state, 'R23')) applyEffect(state, { type: 'strength', n: 1 }, card, mods, context);
    }
  }
  state.playedCount = (state.playedCount || 0) + 1;
  if (hasRelic(state, 'R20') && state.playedCount % 10 === 0) b.energy++;

  if (def.type === 'attack' && squadIs(b, 'momentum')) {
    if (context.doubleDamage) b.squad.armed = false;
    if (++b.squad.n >= TEAM_TRAITS.momentum.max) {
      b.squad.n = 0;
      b.squad.armed = true;
      pushLog(state, 'squad', { id: 'momentum' });
    }
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
    const intel = eff.type === 'smoke' || eff.type === 'flash';
    if (intel) context.sweep = true;
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
    if (intel) { context.sweep = false; if (state.phase === 'combat') gainIntel(state); }
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
        dmg += gearAttackBonus(state);
        if (context.doubleDamage) dmg *= 2;
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
      b.playerBlock += blk + bonus + (b.powerStacks.footwork || 0) + (hasRelic(state, 'R18') ? 1 : 0);
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
      if (!context.sweep) gainIntel(state);
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
      if (!context.sweep) gainIntel(state);
      break;
    }
    case 'weak':
      if (t) addStatus(t, 'weak', eff.n);
      break;
    case 'vuln':
      if (t) addStatus(t, 'vuln', eff.n + (hasRelic(state, 'R27') ? 1 : 0));
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
      onStanceSwitched(state);
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
      if (t) addStatus(t, 'burn', eff.n + (hasRelic(state, 'R33') ? 2 : 0));
      break;
    // Supply-only effects.
    case 'tempAttack':
      b.tempAttack = (b.tempAttack || 0) + eff.n;
      break;
    case 'rawBlock':
      b.playerBlock += eff.n;
      break;
    case 'cleansePlayer':
      b.statuses.player.weak = 0;
      b.statuses.player.vuln = 0;
      break;
    case 'disarm':
      if (t) { t.statuses.strength = 0; t.statuses.block = 0; }
      break;
    case 'silenceEnemies':
      for (const e of alive(b)) e.intent = null;
      break;
    case 'replayNext':
      b.replayNext = true;
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
    e.script = scaleScript(def.phase2, e.dmgMul || 1);
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
  if (dmg > 1 && !b.vestUsed && hasRelic(state, 'R31')) { dmg = 1; b.vestUsed = true; }
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
  const cost = manualStanceCost(b);
  if (b.energy < cost) return '能量不足';
  if (b.stanceSwitchUsedThisTurn) return '本回合已切换过姿态';
  b.energy -= cost;
  b.stanceSwitchUsedThisTurn = true;
  switchStance(state);
  b.stanceChangedThisTurn = true;
  onStanceSwitched(state);
  pushLog(state, 'stance_switch', { cost });
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
  // 快速弹匣: the priciest playable card stays in hand.
  let magazine = null;
  if (hasRelic(state, 'R26')) for (const card of b.hand) {
    if (!CARDS[card.id] || card.temp || CARDS[card.id].retain) continue;
    if (!magazine || cardCost({ ...card, free: false }) > cardCost({ ...magazine, free: false })) magazine = card;
  }
  for (const card of b.hand) {
    if (!card.temp) delete card.free;
    if (CARDS[card.id]?.retain || card === magazine) kept.push(card);
    else if (card.temp) b.exhaustPile.push(card);
    else b.discardPile.push(card);
  }
  b.hand = kept;
  const leftover = hasRelic(state, 'R32') ? b.energy : 0;

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
  if (allDead(b)) { finishBattleWin(state); return null; }

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
  b.attacksThisTurn = 0;
  b.tempAttack = 0;
  b.replayNext = false;
  b.energy = Math.max(0, baseEnergy(state) - (b.overloadNext || 0)) + leftover;
  b.overload = b.overloadNext || 0;
  b.overloadNext = 0;
  if (!b.powers.includes('barricade')) {
    // 工事: half of the block that survived the enemy turn stays (rounded up, max 12).
    const kept = squadIs(b, 'fortify') ? Math.min(TEAM_TRAITS.fortify.max, Math.ceil(b.playerBlock / 2)) : 0;
    if (squadIs(b, 'fortify')) b.squad.kept = kept;
    // 加固工事组件: block only drops by 15.
    b.playerBlock = hasRelic(state, 'R46') ? Math.max(kept, b.playerBlock - 15) : kept;
  }
  if (squadIs(b, 'dispatch')) b.squad.used = false;
  applyTurnStartPowers(state);
  if (state.phase !== 'combat') return null;
  if (allDead(b)) { finishBattleWin(state); return null; }
  drawCards(state, drawPerTurn(state));
  if (state.phase !== 'combat') return null;
  afterTurnDraw(state);
  if (state.phase !== 'combat') return null;
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
        if (hasRelic(state, 'R16')) {
          e.hp = Math.max(0, e.hp - 3);
          if (e.hp <= 0) { pushLog(state, 'enemy_down', { enemy: e.uid }); break; }
          checkEnemyHpTraits(state, e);
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
  if (!hasRelic(state, 'R48')) state.money += moneyReward;
  // Elite wins always carry equipment (悬赏猎手合同 adds a second piece).
  b.rewardRelics = [];
  if (node?.kind === 'elite') {
    for (let i = 0; i < (hasRelic(state, 'R47') ? 2 : 1); i++) { const id = grantRandomRelic(state); if (id) b.rewardRelics.push(id); }
  }
  rollSupplyDrop(state);
  // 后勤车队: elite wins roll the supply drop a second time.
  if (node?.kind === 'elite' && hasInvest(state, 'IN05')) rollSupplyDrop(state);
  if (econOn(state)) state.fightsWon = (state.fightsWon || 0) + 1;

  // Generate reward pool (unique cards)
  const weights = { common: 10, uncommon: 4, rare: 1 };
  const available = [...SHARED_CARD_IDS, ...teamCardIds(state)];
  const rewardSize = 3 + (hasInvest(state, 'IN01') ? 1 : 0);
  // Build-direction cards are weighted like regional ones so every reward
  // screen tends to offer a real choice between directions.
  const weightOf = id => weights[CARDS[id].rarity] * (CARDS[id].region || ARCHETYPES[CARDS[id].tag] ? 3 : 1);
  const pool = [];
  while (pool.length < rewardSize) {
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

  if (hasRelic(state, 'R01')) {
    state.hp = Math.min(state.hp + 8, state.maxHp);
  }

  state.phase = 'reward';
  pushLog(state, 'battle_won', { enemy: b.encounter || b.enemies?.[0]?.id || b.enemyId });
}

function finishBattleLoss(state) {
  // 急救自注射器: the first lethal blow of the run leaves you at half health.
  const injector = state.relics.find(r => r.id === 'R34' && !r.used);
  if (injector && state.hp <= 0) {
    injector.used = true;
    state.hp = Math.floor(state.maxHp / 2);
    pushLog(state, 'relic_trigger', { id: 'R34' });
    return;
  }
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
  } else if (econOn(state)) {
    // Skip compensation: gold by default, or one free reroll of a later shop's card shelf.
    if (action.comp === 'reroll') state.freeRerolls = (state.freeRerolls || 0) + 1;
    else if (action.comp === undefined || action.comp === 'gold') state.money += SKIP_GOLD;
    else return '无效补偿';
    pushLog(state, 'reward_skipped', { comp: action.comp || 'gold' });
  }
  b.rewardTaken = true;
  if (state.eventBonus) { applyOps(state, state.eventBonus, EVENT_CTX); state.eventBonus = null; }
  const wasBoss = state.currentNode && state.map.nodes.find(n => n.key === state.currentNode)?.kind === 'boss';
  state.battle = null;
  completeNode(state);
  if (wasBoss) {
    state.hp = state.maxHp;
    if (state.act < 3) {
      // 幕末决战奖励：从决战专属装备中三选一（可跳过）。
      const pool = RELIC_IDS_BY_TIER.boss.filter(id => !hasRelic(state, id) && !relicLocked(state, id));
      state.bossRelic = { options: pickDistinct(pool, 3, () => nextRand(state)) };
      state.phase = 'bossRelic';
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
  if (node && ['shop', 'rest', 'event', 'crate'].includes(node.kind) && node.revealed !== 'battle') {
    if (state.relics.some(r => r.id === 'R08')) {
      state.money += 15;
    }
  }
}

// Random equipment by tier (普通50 / 罕见33 / 稀有17), never one already owned.
// Returns the id, or null (and 100 gold) when every piece is owned.
function rollRelicId(state, exclude = []) {
  const tiers = ['common', 'uncommon', 'rare'];
  const open = t => RELIC_IDS_BY_TIER[t].filter(id => !hasRelic(state, id) && !exclude.includes(id) && !relicLocked(state, id));
  const avail = tiers.filter(t => open(t).length);
  if (!avail.length) return null;
  const total = avail.reduce((n, t) => n + EQUIP_TIERS[t].weight, 0);
  let roll = nextRand(state) * total;
  let tier = avail[avail.length - 1];
  for (const t of avail) { roll -= EQUIP_TIERS[t].weight; if (roll < 0) { tier = t; break; } }
  const ids = open(tier);
  return ids[Math.floor(nextRand(state) * ids.length)];
}
function grantRandomRelic(state) {
  const id = rollRelicId(state, state.pendingRelics || []);
  if (!id) {
    state.money += 100;
    pushLog(state, 'duplicate_relic', {});
    return null;
  }
  acquireRelic(state, id);
  return id;
}

// ----------------------------- Equipment slots -----------------------------
// At most 6 pieces (决战专属 included). A new piece with every slot full waits in
// `pendingRelics` until the player replaces one (sold for gold) or declines it.
export const RELIC_SLOTS = 6;
export const RELIC_SELL_VALUE = { common: 15, uncommon: 25, rare: 40, shop: 25, boss: 50 };
export function relicSellValue(id) {
  return RELIC_SELL_VALUE[RELICS[id]?.tier] || 0;
}
function acquireRelic(state, id) {
  if (state.relics.length < RELIC_SLOTS && !(state.pendingRelics || []).length) { grantRelicById(state, id); return true; }
  (state.pendingRelics ||= []).push(id);
  return false;
}
function removeRelicAt(state, index) {
  const [gone] = state.relics.splice(index, 1);
  state.money += relicSellValue(gone.id);
  pushLog(state, 'relic_sold', { id: gone.id });
  return gone;
}
function sellRelic(state, action) {
  if (state.phase === 'result') return '运行已结束';
  if (state.phase === 'combat') return '战斗中不能出售装备';
  if (!(action.index in state.relics)) return '无效装备槽';
  removeRelicAt(state, action.index);
  return null;
}
function replaceRelic(state, action) {
  const id = state.pendingRelics?.[0];
  if (!id) return '没有待处理的新装备';
  if (!(action.index in state.relics)) return '无效装备槽';
  removeRelicAt(state, action.index);
  state.pendingRelics.shift();
  grantRelicById(state, id);
  return null;
}
function declineRelic(state) {
  if (!state.pendingRelics?.length) return '没有待处理的新装备';
  state.pendingRelics.shift();
  return null;
}

function grantRelicById(state, id) {
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
  } else if (id === 'R50') {
    for (let i = 0; i < 4; i++) {
      const candidates = state.deck.filter(c => !c.up && CARDS[c.id]?.upgradeEffects?.length);
      if (!candidates.length) break;
      candidates[Math.floor(nextRand(state) * candidates.length)].up = true;
    }
  }
  pushLog(state, 'relic_gained', { id });
}

// The card shelf: 5 cards (6 with 扩编货架), one of them at half price.
function generateShopCards(state) {
  const cards = [];
  const available = [...SHARED_CARD_IDS, ...teamCardIds(state)];
  const size = 5 + (hasInvest(state, 'IN03') ? 1 : 0);
  for (let i = 0; i < size; i++) {
    const choices=available.filter(id=>!cards.some(card=>card.id===id));
    const id = choices[Math.floor(nextRand(state) * choices.length)];
    cards.push({ id, price: priceOf(id) });
  }
  // One random item is on sale each visit (half price), so shops differ.
  const saleIndex = Math.floor(nextRand(state) * cards.length);
  cards[saleIndex].sale = true;
  cards[saleIndex].price = Math.floor(cards[saleIndex].price / 2);
  return cards;
}
function generateShop(state) {
  const cards = generateShopCards(state);
  // Equipment shelf: two random pieces plus one 补给站专属; supplies: three.
  const relics = [];
  for (let i = 0; i < 2; i++) { const id = rollRelicId(state, relics.map(r => r.id)); if (id) relics.push({ id, price: RELIC_PRICES[RELICS[id].tier] }); }
  const shopOnly = RELIC_IDS_BY_TIER.shop.filter(id => !hasRelic(state, id) && !relicLocked(state, id));
  if (shopOnly.length) { const id = shopOnly[Math.floor(nextRand(state) * shopOnly.length)]; relics.push({ id, price: RELIC_PRICES.shop }); }
  const supplies = [];
  for (let i = 0; i < 3; i++) { const id = rollSupplyId(state); supplies.push({ id, price: SUPPLY_PRICES[SUPPLIES[id].rarity] }); }
  const shop = { cards, relics, supplies, categoryUpgradeUsed:false };
  if (econOn(state)) {
    // One 战术投资 offer per visit (never one already bought).
    const open = Object.keys(INVESTMENTS).filter(id => !state.invest.includes(id));
    shop.invest = open.length ? open[Math.floor(nextRand(state) * open.length)] : null;
    shop.rerolls = 0;
  }
  return shop;
}
function rerollShop(state) {
  if (state.phase !== 'shop' || !state.shop) return '不在补给站';
  if (!econOn(state)) return '此补给站不能刷新';
  const price = rerollPrice(state);
  if (state.money < price) return '金币不足';
  if (price === 0) state.freeRerolls--;
  else { state.money -= price; state.shop.rerolls = (state.shop.rerolls || 0) + 1; }
  state.shop.cards = generateShopCards(state);
  pushLog(state, 'shop_reroll', { price });
  return null;
}
function buyInvest(state) {
  if (state.phase !== 'shop' || !state.shop) return '不在补给站';
  const id = state.shop.invest;
  if (!econOn(state) || !id) return '没有可购买的投资';
  if (state.invest.includes(id)) return '已经投资过';
  const cost = investPrice(state, id);
  if (state.money < cost) return '金币不足';
  state.money -= cost;
  state.invest.push(id);
  state.shop.invest = null;
  pushLog(state, 'invest', { id, price: cost });
  return null;
}
const RELIC_PRICES = { common: 140, uncommon: 190, rare: 250, shop: 160 };
const SUPPLY_PRICES = { common: 45, uncommon: 70, rare: 95 };

function buyRelic(state, action) {
  if (state.phase !== 'shop' || !state.shop) return '不在补给站';
  const item = state.shop.relics?.[action.index];
  if (!item) return '无效索引';
  const cost = shopPrice(item, state);
  if (state.money < cost) return '金币不足';
  if (state.relics.length >= RELIC_SLOTS) return '装备槽已满，请先出售一件装备';
  state.money -= cost;
  state.shop.relics.splice(action.index, 1);
  grantRelicById(state, item.id);
  return null;
}
function buySupply(state, action) {
  if (state.phase !== 'shop' || !state.shop) return '不在补给站';
  const item = state.shop.supplies?.[action.index];
  if (!item) return '无效索引';
  if (state.supplies.length >= supplySlots(state)) return '补给品栏位已满';
  const cost = shopPrice(item, state);
  if (state.money < cost) return '金币不足';
  state.money -= cost;
  state.shop.supplies.splice(action.index, 1);
  state.supplies.push(item.id);
  return null;
}

// ----------------------------- Supplies -----------------------------
const SUPPLY_WEIGHTS = { common: 65, uncommon: 25, rare: 10 };
function rollSupplyId(state) {
  const total = SUPPLY_IDS.reduce((n, id) => n + SUPPLY_WEIGHTS[SUPPLIES[id].rarity], 0);
  let roll = nextRand(state) * total;
  for (const id of SUPPLY_IDS) { roll -= SUPPLY_WEIGHTS[SUPPLIES[id].rarity]; if (roll < 0) return id; }
  return SUPPLY_IDS[0];
}
// Drop chance starts at 40%: -10 after a drop, +10 after a miss.
function rollSupplyDrop(state) {
  const b = state.battle;
  const chance = state.supplyChance ?? 40;
  if (nextRand(state) * 100 < chance) {
    state.supplyChance = Math.max(0, chance - 10);
    const id = rollSupplyId(state);
    if ((state.supplies ||= []).length < supplySlots(state)) { state.supplies.push(id); b.rewardSupplyTaken = id; if (econOn(state)) (b.rewardSuppliesTaken ||= []).push(id); }
    else if (b.rewardSupply) b.rewardSupplyNext = id; // a second find waits behind the first
    else b.rewardSupply = id;
  } else {
    state.supplyChance = Math.min(100, chance + 10);
  }
}
function takeSupply(state, action) {
  const b = state.battle;
  if (state.phase !== 'reward' || !b?.rewardSupply) return '没有待领取的补给品';
  if (action.replace != null) {
    if (!(action.replace in state.supplies)) return '无效栏位';
    state.supplies[action.replace] = b.rewardSupply;
  } else {
    if (state.supplies.length >= supplySlots(state)) return '补给品栏位已满';
    state.supplies.push(b.rewardSupply);
  }
  b.rewardSupplyTaken = b.rewardSupply;
  if (econOn(state)) (b.rewardSuppliesTaken ||= []).push(b.rewardSupply);
  b.rewardSupply = b.rewardSupplyNext || null;
  delete b.rewardSupplyNext;
  return null;
}
function discardSupply(state, action) {
  if (state.phase === 'result') return '运行已结束';
  if (!(state.supplies && action.index in state.supplies)) return '无效栏位';
  state.supplies.splice(action.index, 1);
  return null;
}
export function supplyNeedsTarget(id) {
  return SUPPLIES[id]?.target === 'enemy';
}
function useSupply(state, action) {
  if (state.phase !== 'combat') return '只能在战斗中使用';
  const b = state.battle;
  if (b.pendingDiscover) return '请先选择发现的牌';
  const id = state.supplies?.[action.index];
  const sp = SUPPLIES[id];
  if (!sp) return '无效栏位';
  const living = alive(b);
  let target = null;
  if (sp.target === 'enemy') {
    if (action.target != null) { target = living.find(e => e.uid === action.target); if (!target) return '目标无效'; }
    else if (living.length === 1) target = living[0];
    else return '请选择目标';
  }
  state.supplies.splice(action.index, 1);
  // Supplies are not cards: no stance, first-attack or trait bonuses.
  const context = { preAttackPlayed: true, preBlockPlayed: true, preStanceChanged: b.stanceChangedThisTurn, preCount: b.playsThisTurn, cardId: id, attackBonusUsed: true, blockBonusUsed: true, target: target || living[0] || null, doubleDamage: false };
  for (const eff of sp.effects) {
    applyEffect(state, eff, { id, up: false }, {}, context);
    if (state.phase !== 'combat') return null;
  }
  pushLog(state, 'use_supply', { id, target: target?.uid || null });
  if (allDead(b)) finishBattleWin(state);
  return null;
}

// ----------------------------- Boss equipment -----------------------------
function chooseBossRelic(state, action) {
  if (state.phase !== 'bossRelic' || !state.bossRelic) return '当前没有决战奖励';
  if (action.id != null) {
    if (!state.bossRelic.options.includes(action.id)) return '不是可选的装备';
    acquireRelic(state, action.id);
  }
  state.bossRelic = null;
  state.checkpoint = { deck: deepClone(state.deck), relics: deepClone(state.relics), maxHp: state.maxHp, money: state.money, act: state.act };
  state.phase = 'intermission';
  return null;
}

export function categoryUpgradeQuote(state, category) {
  if (!['attack', 'skill'].includes(category)) return {count:0, price:0, used:false};
  const targets = state.deck.filter(c => !c.up && CARDS[c.id]?.type === category && CARDS[c.id]?.upgradeEffects?.length);
  const price = targets.length ? 60 + targets.reduce((sum, c) => sum + ({common:28, uncommon:42, rare:56}[CARDS[c.id].rarity] || 28), 0) : 0;
  return {count:targets.length, price, used:!!state.shop?.categoryUpgradeUsed};
}

export function shopPrice(item, state = null) {
  const base = item.price ?? priceOf(item.id);
  return state ? discounted(state, base) : base;
}

function priceOf(cardId) {
  const rarity = CARDS[cardId].rarity;
  return rarity === 'rare' ? 150 : rarity === 'uncommon' ? 100 : 50;
}

export function removePrice(state) {
  if (state.relics.some(r => r.id === 'R09') && !state.freeRemovalUsed) {
    return 0;
  }
  return discounted(state, 75);
}

function buyCard(state, action) {
  if (state.phase !== 'shop') return '不在商店';
  const idx = action.index;
  const item = state.shop.cards[idx];
  if (!item) return '无效索引';
  const cost = shopPrice(item, state);
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
    if (hasRelic(state, 'R42')) return '无休整合同：休整点不能回复生命';
    state.hp = Math.min(state.hp + restHealAmount(state), state.maxHp);
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

// ----------------------------- Unknown rooms, crates, events -----------------------------
// All randomness below uses the run RNG, so the same seed and actions always
// resolve the same room, crate and event outcome.
const cardDef = id => CARDS[id] || STATUS_CARDS[id] || null;
const cardPoolFor = state => [...SHARED_CARD_IDS, ...teamCardIds(state)];

const EVENT_CTX = {
  labels: { hp: '生命', money: '金币', equip: '战术装备', equipNone: '已全部拥有时', curse: '俱乐部隐患', upgrade: '升级', tier: { common: '普通牌', uncommon: '罕见牌', rare: '稀有牌' } },
  rand: state => nextRand(state),
  newCard: (state, id, up) => ({ uid: nextUid(state), id, up: !!up }),
  cardName: id => cardDef(id)?.name || id,
  upgradeable: (state, c) => !c.up && !!CARDS[c.id]?.upgradeEffects?.length,
  removable: (state, c) => canRemoveCard(state, c.uid),
  transformable: (state, c) => !!cardDef(c.id) && (!!STATUS_CARDS[c.id]?.curse || canRemoveCard(state, c.uid)),
  duplicable: (state, c) => !!CARDS[c.id] && CARDS[c.id].type !== 'status',
  isCurse: (state, c) => !!STATUS_CARDS[c.id]?.curse,
  curseIds: CURSES.map(c => c.id),
  randomCardAvailable: (state, tier) => cardPoolFor(state).some(id => CARDS[id].rarity === tier),
  randomCard: (state, tier) => {
    const ids = cardPoolFor(state).filter(id => CARDS[id].rarity === tier);
    return ids.length ? ids[Math.floor(nextRand(state) * ids.length)] : null;
  },
  transformInto: (state, c) => {
    const ids = cardPoolFor(state).filter(id => id !== c.id);
    return ids[Math.floor(nextRand(state) * ids.length)];
  },
  // Uses the equipment tier odds; with every slot full the piece waits in
  // pendingRelics for the player to replace or decline, as elsewhere.
  gainEquip: state => {
    const id = rollRelicId(state, state.pendingRelics || []);
    if (!id) return null;
    acquireRelic(state, id);
    return RELICS[id].name;
  }
};

function enterUnknown(state, node) {
  if (!state.unknownOdds || state.unknownOdds.act !== state.act) state.unknownOdds = freshUnknownOdds(state.act);
  const { kind, odds } = resolveUnknown(state.unknownOdds, nextRand(state), blockedUnknownKinds(node.step, ROUTE_STEPS.shop, ROUTE_STEPS.crate));
  state.unknownOdds = odds;
  node.revealed = kind;
  pushLog(state, 'unknown_room', { node: node.key, kind });
  if (kind === 'battle') {
    const enemy = node.ambush || (state.act === 1 ? 'E02' : `A${state.act}_E02`);
    const err = startBattle(state, { enemy, field: null });
    if (err) return err;
    pushLog(state, 'enter_battle', { node: node.key, enemy });
  } else if (kind === 'shop') {
    state.phase = 'shop';
    state.shop = generateShop(state);
    state.freeRemovalUsed = false;
    pushLog(state, 'enter_shop');
  } else if (kind === 'crate') {
    enterCrate(state);
  } else {
    state.phase = 'event';
    state.event = generateEvent(state);
  }
  return null;
}

function enterCrate(state) {
  state.phase = 'crate';
  state.crate = { size: rollCrateSize(nextRand(state)), opened: false, result: null };
}

function crateAction(state, action) {
  if (state.phase !== 'crate' || !state.crate) return '不在补给箱';
  if (action.choice === 'open') {
    if (state.crate.opened) return '补给箱已经打开';
    const loot = CRATE_LOOT[state.crate.size];
    const money = loot.money[0] + Math.floor(nextRand(state) * (loot.money[1] + 1));
    state.money += money;
    const result = { money, equip: null, bonusMoney: 0 };
    if (nextRand(state) < loot.equip) result.equip = EVENT_CTX.gainEquip(state);
    if (!result.equip) { result.bonusMoney = loot.bonus; state.money += loot.bonus; }
    state.crate.opened = true;
    state.crate.result = result;
    pushLog(state, 'crate_opened', { size: state.crate.size, ...result });
    return null;
  }
  if (action.choice === 'leave') {
    if (!state.crate.opened) return '先打开补给箱';
    state.crate = null;
    completeNode(state);
    state.phase = 'map';
    return null;
  }
  return '无效操作';
}

// Picks an event from the act's pool that has not been seen this run; once the
// act pool is exhausted, its events can appear again.
function generateEvent(state) {
  const pool = EVENT_POOLS[state.act] || EVENT_POOLS[1];
  state.seenEvents ||= [];
  let fresh = pool.filter(id => !state.seenEvents.includes(id));
  if (!fresh.length) { state.seenEvents = state.seenEvents.filter(id => !pool.includes(id)); fresh = pool; }
  const id = fresh[Math.floor(nextRand(state) * fresh.length)];
  state.seenEvents.push(id);
  return { id, act: state.act };
}

// If every option is closed (e.g. nothing left to upgrade at full health), the
// player may simply walk away so a run can never get stuck in an event.
const WALK_AWAY = { id: 'walkAway', title: '离开', ops: [] };
function eventOptionList(state) {
  const options = EVENTS[state.event?.id]?.options || [];
  return options.length && options.every(o => opsReason(state, o.ops, EVENT_CTX)) ? [...options, WALK_AWAY] : options;
}
function eventOption(state, id) {
  return eventOptionList(state).find(o => o.id === id) || null;
}

function eventActions(state) {
  const ev = state.event;
  const def = EVENTS[ev?.id];
  if (!def) return [];
  if (ev.pending) {
    const opt = eventOption(state, ev.pending);
    return [...pickCandidates(state, pickKind(opt.ops), EVENT_CTX).map(c => ({ type: 'eventPick', uid: c.uid })), { type: 'eventBack' }];
  }
  return eventOptionList(state).filter(o => !opsReason(state, o.ops, EVENT_CTX)).map(o => ({ type: 'event', choice: o.id }));
}

// Everything the event screen needs: scene, options with generated effect text
// and the reason an option is unavailable, plus the pending card pick.
export function describeEvent(state) {
  const ev = state?.event;
  const def = EVENTS[ev?.id];
  if (!def) return null;
  const pending = ev.pending ? eventOption(state, ev.pending) : null;
  return {
    id: ev.id, title: def.title, scene: def.scene,
    options: eventOptionList(state).map(o => ({ id: o.id, title: o.title, effects: describeOps(o.ops, EVENT_CTX), reason: opsReason(state, o.ops, EVENT_CTX), pick: pickKind(o.ops) })),
    pending: pending ? { id: pending.id, title: pending.title, effects: describeOps(pending.ops, EVENT_CTX), kind: pickKind(pending.ops), candidates: pickCandidates(state, pickKind(pending.ops), EVENT_CTX).map(c => c.uid) } : null
  };
}

function eventChoice(state, action) {
  if (state.phase !== 'event' || !state.event) return '不在事件阶段';
  if (state.event.pending) return '请先选择一张牌，或返回事件';
  if (!EVENTS[state.event.id]) return '未知事件';
  const opt = eventOption(state, action.choice);
  if (!opt) return '无效选择';
  const reason = opsReason(state, opt.ops, EVENT_CTX);
  if (reason) return reason;
  if (pickKind(opt.ops)) { state.event.pending = opt.id; return null; }
  return resolveEventOption(state, opt, null);
}

function eventPick(state, action) {
  if (state.phase !== 'event' || !state.event?.pending) return '当前无需选牌';
  const opt = eventOption(state, state.event.pending);
  const card = pickCandidates(state, pickKind(opt.ops), EVENT_CTX).find(c => c.uid === action.uid);
  if (!card) return '这张牌不能选择';
  const reason = opsReason(state, opt.ops, EVENT_CTX);
  if (reason) return reason;
  return resolveEventOption(state, opt, card);
}

function eventBack(state) {
  if (state.phase !== 'event' || !state.event?.pending) return '当前无需返回';
  delete state.event.pending;
  return null;
}

function resolveEventOption(state, opt, picked) {
  const { log, fight } = applyOps(state, opt.ops, EVENT_CTX, picked);
  pushLog(state, 'event_choice', { id: state.event.id, choice: opt.id, log });
  state.event = null;
  if (fight) {
    const prefix = state.act === 1 ? '' : `A${state.act}_`;
    const ids = ['EL01', 'EL02'].map(id => prefix + id).filter(id => ENEMIES[id]);
    const enemy = ids[Math.floor(nextRand(state) * ids.length)];
    const err = startBattle(state, { enemy, field: null });
    if (err) return err;
    state.eventBonus = fight.bonus;
    pushLog(state, 'enter_battle', { node: state.currentNode, enemy, fromEvent: true });
    return null;
  }
  completeNode(state);
  state.phase = 'map';
  return null;
}

// ----------------------------- 赛前准备 (opening choice) -----------------------------
// Four options per run, drawn by seed: two free small bonuses, one trade-off
// with a bigger reward and the always-offered 热身赛. Cards offered by the
// card-choice options are fixed when the options are generated.
export const OPENING_POOLS = {
  free: {
    maxhp: '最大生命 +8',
    gold: '获得 100 金币',
    remove: '从牌组中删除 1 张牌',
    upgrade: '升级牌组中的 1 张牌',
    uncommon: '从 3 张罕见牌中选 1 张加入牌组'
  },
  trade: {
    hpForRare: '失去 10% 最大生命，从 3 张稀有牌中选 1 张加入牌组',
    curseForRelic: '牌组加入 1 张随机隐患，获得 1 件随机装备',
    goldForRelics: '失去全部金币，获得 2 件随机装备'
  },
  steady: { warmup: '热身赛：接下来 3 场战斗中，敌人开局生命 -30%' }
};

function localRng(str) {
  const box = { rngState: hashSeed(str) };
  return () => nextRand(box);
}
function pickDistinct(list, n, rand) {
  const pool = list.slice();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
function teamCardPool(state, rarity) {
  return [...SHARED_CARD_IDS, ...teamCardIds(state)].filter(id => CARDS[id].rarity === rarity);
}

function generateOpening(state) {
  const rand = localRng(`${state.seed}|opening|${state.team}`);
  const free = pickDistinct(Object.keys(OPENING_POOLS.free), 2, rand);
  const trade = pickDistinct(Object.keys(OPENING_POOLS.trade), 1, rand);
  const options = [
    ...free.map(id => ({ id, group: 'free', text: OPENING_POOLS.free[id] })),
    ...trade.map(id => ({ id, group: 'trade', text: OPENING_POOLS.trade[id] })),
    { id: 'warmup', group: 'steady', text: OPENING_POOLS.steady.warmup }
  ];
  for (const o of options) {
    if (o.id === 'uncommon') o.cards = pickDistinct(teamCardPool(state, 'uncommon'), 3, rand);
    if (o.id === 'hpForRare') o.cards = pickDistinct(teamCardPool(state, 'rare'), 3, rand);
  }
  return { options, pick: null, chosen: null };
}

// A random (tier-weighted) piece the run does not own yet.
function grantNewRelic(state) {
  grantRandomRelic(state);
}

function finishOpening(state) {
  state.phase = 'map';
  state.opening.pick = null;
  pushLog(state, 'opening', { choice: state.opening.chosen });
}

function chooseOpening(state, action) {
  if (state.phase !== 'opening' || !state.opening) return '不在赛前准备阶段';
  const option = state.opening.options.find(o => o.id === action.choice);
  if (!option) return '无效选择';
  state.opening.chosen = option.id;
  switch (option.id) {
    case 'maxhp': state.maxHp += 8; state.hp += 8; break;
    case 'gold': state.money += 100; break;
    case 'remove':
      if (!state.deck.some(c => canRemoveCard(state, c.uid))) break;
      state.phase = 'openingPick'; state.opening.pick = { kind: 'remove' }; return null;
    case 'upgrade':
      if (!state.deck.some(c => !c.up && CARDS[c.id]?.upgradeEffects?.length)) break;
      state.phase = 'openingPick'; state.opening.pick = { kind: 'upgrade' }; return null;
    case 'uncommon':
      state.phase = 'openingPick'; state.opening.pick = { kind: 'card', cards: option.cards.slice() }; return null;
    case 'hpForRare': {
      const loss = Math.floor(state.maxHp * 0.1);
      state.maxHp -= loss;
      state.hp = Math.min(state.hp, state.maxHp);
      state.phase = 'openingPick'; state.opening.pick = { kind: 'card', cards: option.cards.slice() }; return null;
    }
    case 'curseForRelic': {
      const curse = CURSES[Math.floor(nextRand(state) * CURSES.length)];
      state.deck.push({ uid: nextUid(state), id: curse.id, up: false });
      pushLog(state, 'curse_gained', { id: curse.id });
      grantNewRelic(state);
      break;
    }
    case 'goldForRelics': state.money = 0; grantNewRelic(state); grantNewRelic(state); break;
    case 'warmup': state.warmup = 3; break;
    default: return '无效选择';
  }
  finishOpening(state);
  return null;
}

function chooseOpeningPick(state, action) {
  if (state.phase !== 'openingPick' || !state.opening?.pick) return '当前没有待选的牌';
  const pick = state.opening.pick;
  if (pick.kind === 'card') {
    if (action.id != null) {
      if (!pick.cards.includes(action.id)) return '不是可选的牌';
      state.deck.push({ uid: nextUid(state), id: action.id, up: false });
    }
  } else if (pick.kind === 'remove') {
    if (!canRemoveCard(state, action.uid)) return '无法移除该牌';
    state.deck.splice(state.deck.findIndex(c => c.uid === action.uid), 1);
  } else if (pick.kind === 'upgrade') {
    const card = state.deck.find(c => c.uid === action.uid);
    if (!card || card.up || !CARDS[card.id]?.upgradeEffects?.length) return '无效升级目标';
    card.up = true;
  }
  finishOpening(state);
  return null;
}

function startNextAct(state) {
  if (state.phase !== 'intermission') return '不在幕间阶段';
  if (state.act >= 3) return '已是最终幕';
  state.act++;
  state.hp = state.maxHp;
  state.map = buildMap(state.seed, state.act, state.ascension || 0);
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
      case 'R13': b.playerBlock += 10; break;
      case 'R14': for (const e of alive(b)) addStatus(e, 'vuln', 1 + (hasRelic(state, 'R27') ? 1 : 0)); break;
      case 'R15': state.hp = Math.min(state.maxHp, state.hp + 2); break;
      case 'R28': drawCards(state, 2); break;
      case 'R37': if (b.hand.length < MAX_HAND) b.hand.push({ uid: nextUid(state), id: 'TK01', up: false }); break;
      case 'R43':
        for (let i = 0; i < 2; i++) b.drawPile.splice(Math.floor(nextRand(state) * (b.drawPile.length + 1)), 0, { uid: nextUid(state), id: 'ST01', up: false });
        break;
      case 'R44': state.hp = Math.max(1, state.hp - 5); break;
    }
    if (state.phase !== 'combat') return;
  }
  // 预案卡: the priciest card in the opening hand costs 0 this turn.
  if (hasRelic(state, 'R29')) {
    let best = null;
    for (const c of b.hand) if (CARDS[c.id] && (!best || cardCost(c) > cardCost(best))) best = c;
    if (best && cardCost(best) > 0) best.free = true;
  }
}

// Start-of-turn gear that looks at the freshly drawn hand.
function afterTurnDraw(state) {
  const b = state.battle;
  if (hasRelic(state, 'R35') && !b.hand.some(c => CARDS[c.id]?.type === 'attack') && b.hand.length < MAX_HAND) {
    const idx = b.drawPile.findIndex(c => CARDS[c.id]?.type === 'attack');
    if (idx >= 0) b.hand.push(b.drawPile.splice(idx, 1)[0]);
  }
  if (hasRelic(state, 'R49') && b.hand.length) {
    const i = Math.floor(nextRand(state) * b.hand.length);
    b.discardPile.push(b.hand.splice(i, 1)[0]);
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
    else if (rel.id === 'R17' && b.turn % 3 === 0) b.energy += 1;
  }
}
