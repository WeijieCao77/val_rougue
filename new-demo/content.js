// new-demo/content.js
// Tactical action pool with all effects described from structured data.
import { REGIONAL_CARDS } from './regional-cards.js';
import { CURSES, EXTRA_STATUSES } from '../afflictions.js';

export const CARDS = {};
export const CARD_IDS = [];
export const STATUS_CARDS = {};

// ----------------------------- Effect helpers -----------------------------
const atk = (n, times = 1) => ({ type: 'attack', n, times });
const block = (n) => ({ type: 'block', n });
const draw = (n) => ({ type: 'draw', n });
const energy = (n) => ({ type: 'energy', n });
const smoke = (n) => ({ type: 'smoke', n });
const flash = (n) => ({ type: 'flash', n });
const weak = (n) => ({ type: 'weak', n });
const vuln = (n) => ({ type: 'vuln', n });
const heal = (n) => ({ type: 'heal', n });
const maxHp = (n) => ({ type: 'maxHp', n });
const money = (n) => ({ type: 'money', n });
const exhaustSelf = () => ({ type: 'exhaustSelf' });
const stanceSwitch = () => ({ type: 'stanceSwitch' });
const addCardToDiscard = (id, n = 1) => ({ type: 'addCardToDiscard', id, n });
const addCardToHand = (id, n = 1) => ({ type: 'addCardToHand', id, n });
const purgePlayerStatus = (id, n = 1) => ({ type: 'purgePlayerStatus', id, n });
const purgeEnemyStatus = (id, n = 1) => ({ type: 'purgeEnemyStatus', id, n });
const upgradeRandomInHand = () => ({ type: 'upgradeRandomInHand' });
const upgradeAllInHand = () => ({ type: 'upgradeAllInHand' });
const upgradeAllInCombatDeck = () => ({ type: 'upgradeAllInCombatDeck' });
const attackScaledByUpgradedHand = (base, per, cap) => ({ type: 'attackScaledByUpgradedHand', base, per, cap });
const conditional = (condition, effect) => ({ type: 'conditional', condition, effect });
const repeat = (times, effect) => ({ type: 'repeat', times, effect });
const burn = (n) => ({ type: 'burn', n });
const burnMultiply = (n) => ({ type: 'burnMultiply', n });
const detonate = (per) => ({ type: 'detonate', per });
const deploy = (kind, n, turns) => ({ type: 'deploy', kind, n, turns });
const fireTurrets = () => ({ type: 'fireTurrets' });
const attackFromBlock = (mult = 1) => ({ type: 'attackFromBlock', mult });
const discover = (pool) => ({ type: 'discover', pool });
const strength = (n) => ({ type: 'strength', n });
const overload = (n) => ({ type: 'overload', n });
// Area versions: resolve once for every living enemy.
const atkAll = (n, times = 1) => ({ type: 'attack', n, times, all: true });
const smokeAll = (n) => ({ type: 'smoke', n, all: true });
const flashAll = (n) => ({ type: 'flash', n, all: true });
const burnAll = (n) => ({ type: 'burn', n, all: true });
// X-cost helpers: X is the energy spent when the card is played.
// xRepeat resolves the effect (X + plus) times; xMul multiplies its amount by (X + plus).
const xRepeat = (effect, plus = 0) => ({ type: 'xRepeat', effect, plus });
const xMul = (effect, plus = 0) => ({ type: 'xMul', effect, plus });
const nextTurn = (energyN, drawN, plus = 0) => ({ type: 'nextTurnX', energy: energyN, draw: drawN, plus });

const xLabel = plus => (plus ? `(X+${plus})` : 'X');

// ----------------------------- Effect formatting -----------------------------
export function formatEffects(effects) {
  if (!effects || effects.length === 0) return '';
  const parts = [];
  for (const eff of effects) {
    if (eff.type === 'xRepeat') {
      const inner = formatEffects([eff.effect]);
      parts.push(`${inner}，共${xLabel(eff.plus)}次`);
      continue;
    }
    if (eff.type === 'xMul') {
      const e = eff.effect;
      const x = xLabel(eff.plus);
      const target = e.all ? '所有敌人' : '';
      const text = { block: `获得${e.n}×${x}点布防`, burn: `给予${target}${e.n}×${x}层燃烧`, smoke: `给予${target}${e.n}×${x}层烟雾`, draw: `抽${e.n}×${x}张牌`, energy: `获得${e.n}×${x}点能量`, attack: `${e.all ? '对所有敌人' : ''}造成${e.n}×${x}点伤害` }[e.type];
      parts.push(text || formatEffects([e]));
      continue;
    }
    if (eff.type === 'nextTurnX') {
      const x = xLabel(eff.plus);
      const bits = [];
      if (eff.energy) bits.push(`获得${eff.energy === 1 ? '' : eff.energy + '×'}${x}点能量`);
      if (eff.draw) bits.push(`多抽${eff.draw === 1 ? '' : eff.draw + '×'}${x}张牌`);
      parts.push(`下回合开始时${bits.join('并')}`);
      continue;
    }
    if (eff.all) {
      const single = formatEffects([{ ...eff, all: false }]);
      parts.push(single.startsWith('造成') ? '对所有敌人' + single : single.replace('给予', '给予所有敌人'));
      continue;
    }
    switch (eff.type) {
      case 'attack':
        parts.push(eff.times > 1 ? `造成${eff.n}点伤害${eff.times}次` : `造成${eff.n}点伤害`);
        break;
      case 'block':
        parts.push(`获得${eff.n}点布防`);
        break;
      case 'smoke':
        parts.push(`给予${eff.n}层烟雾`);
        break;
      case 'flash':
        parts.push(`给予${eff.n}层闪光`);
        break;
      case 'weak':
        parts.push(`给予${eff.n}层压制`);
        break;
      case 'vuln':
        parts.push(`给予${eff.n}层易伤`);
        break;
      case 'draw':
        parts.push(`抽${eff.n}张牌`);
        break;
      case 'energy':
        parts.push(`获得${eff.n}点能量`);
        break;
      case 'heal':
        parts.push(`恢复${eff.n}点生命`);
        break;
      case 'maxHp':
        parts.push(`最大生命+${eff.n}`);
        break;
      case 'money':
        parts.push(`获得${eff.n}金币`);
        break;
      case 'exhaustSelf':
        parts.push('消耗');
        break;
      case 'burn':
        parts.push(`给予${eff.n}层燃烧`);
        break;
      case 'burnMultiply':
        parts.push(`敌人燃烧层数×${eff.n}`);
        break;
      case 'detonate':
        parts.push(`引爆：造成燃烧层数×${eff.per}点伤害并清空燃烧`);
        break;
      case 'deploy':
        parts.push(eff.kind === 'turret' ? `部署哨戒炮：回合结束时造成${eff.n}点伤害，持续${eff.turns}回合` : `部署屏障无人机：回合结束时获得${eff.n}点布防，持续${eff.turns}回合`);
        break;
      case 'fireTurrets':
        parts.push('所有哨戒炮立即开火一次');
        break;
      case 'attackFromBlock':
        parts.push(eff.mult > 1 ? `造成等同于布防×${eff.mult}的伤害` : '造成等同于当前布防的伤害');
        break;
      case 'discover':
        parts.push(`发现一张${{ attack: '攻击', skill: '技能', any: '' }[eff.pool] || ''}牌（本回合0费，打出后消耗）`);
        break;
      case 'strength':
        parts.push(`本场获得${eff.n}层火力`);
        break;
      case 'overload':
        parts.push(`过载${eff.n}`);
        break;
      case 'stanceSwitch':
        parts.push('切换姿态');
        break;
      case 'addCardToDiscard':
        parts.push(`将${eff.n}张「${CARDS[eff.id]?.name || eff.id}」加入弃牌堆`);
        break;
      case 'addCardToHand':
        parts.push(`将${eff.n}张「${CARDS[eff.id]?.name || eff.id}」加入手牌`);
        break;
      case 'purgePlayerStatus': {
        const name = { weak: '压制', vuln: '易伤', smoke: '烟雾', flash: '闪光' }[eff.id] || eff.id;
        parts.push(`清除自身${eff.n}层${name}`);
        break;
      }
      case 'purgeEnemyStatus': {
        const name = { weak: '压制', vuln: '易伤', smoke: '烟雾', flash: '闪光', block: '布防' }[eff.id] || eff.id;
        parts.push(`移除敌人${eff.n}${eff.id === 'block' ? '点' : '层'}${name}`);
        break;
      }
      case 'upgradeRandomInHand':
        parts.push('本场随机升级1张手牌');
        break;
      case 'upgradeAllInHand':
        parts.push('本场升级其余全部手牌');
        break;
      case 'upgradeAllInCombatDeck':
        parts.push('本场升级全部战术牌');
        break;
      case 'attackScaledByUpgradedHand':
        parts.push(`伤害${eff.base}；其余每张升级手牌+${eff.per}（最多${eff.cap}张）`);
        break;
      case 'conditional':
        parts.push(`若${conditionText(eff.condition)}，${formatEffects([eff.effect])}`);
        break;
      case 'repeat':
        parts.push(`${formatEffects([eff.effect])}重复${eff.times}次`);
        break;
      default:
        parts.push(eff.type);
    }
  }
  return parts.join('，');
}

function conditionText(cond) {
  const map = {
    enemy_intends_attack: '敌人意图攻击',
    enemy_smoke: '敌人有烟雾',
    enemy_flash: '敌人有闪光',
    enemy_smoke_or_flash: '敌人有烟雾或闪光',
    prev_played_attack: '本回合已打出攻击牌',
    first_attack_this_turn: '本回合尚未打出攻击牌',
    first_block_this_turn: '本回合尚未打出技能牌',
    stance_cover: '处于掩护姿态',
    stance_push: '处于前压姿态',
    stance_changed_this_turn: '本回合切换过姿态',
    combo: '连击（本回合已打出过其他牌）',
    enemy_vuln: '敌人有易伤',
    enemy_burn: '敌人正在燃烧'
  };
  return map[cond] || cond;
}

function powerDesc(powerId) {
  const map = {
    tactical_core: '每回合开始时抽1张牌',
    attack_core: '每回合第一次攻击伤害+3',
    defense_core: '每回合第一次布防+3',
    smoke_core: '每回合第一次给予烟雾+2',
    flash_core: '每回合第一次给予闪光+2',
    tactical_master: '每回合获得2点额外能量',
    clutch_core: '敌人有烟雾或闪光时，攻击伤害+2',
    final_push: '每回合开始获得3点布防',
    upgrade_core: '每回合首次打出升级牌后，返还1点能量',
    barricade: '布防在回合交替时不会清零',
    inflame: '本场每次攻击伤害+2',
    footwork: '本场每次布防+2',
    dark_embrace: '每消耗一张牌，抽1张牌',
    knife_master: '你的飞刀伤害+3',
    feel_no_pain: '每消耗一张牌，获得3点布防',
    burn_core: '每回合开始时给予所有敌人3层燃烧',
    turret_core: '你的哨戒炮每次开火伤害+3',
    combo_core: '每回合第3张及之后的牌，攻击伤害+3'
  };
  return map[powerId] || '';
}

// ----------------------------- Card definition helper -----------------------------
// Keyword cards (2026-09-24):
//   ethereal: exhausted at end of turn if still in hand (虚无)
//   innate:   always in the opening hand (固有)
//   x:        costs all current energy; X-effects scale with the energy spent (X 费)
//   growth:   { type, n } - each play this combat adds n to that effect on this copy (成长)
const GROWTH_NAMES = { attack: '伤害', block: '布防', burn: '燃烧层数', smoke: '烟雾层数' };
function growthOf(card, up) {
  return (up && card.upgradeGrowth) || card.growth || null;
}
// Effects of one copy after `grow` plays of a growth card (combat-only).
export function grownEffects(effects, growth, grow) {
  if (!growth || !grow) return effects;
  const bump = e => {
    if (e.type === growth.type && typeof e.n === 'number') return { ...e, n: e.n + growth.n * grow };
    if (e.effect) return { ...e, effect: bump(e.effect) };
    return e;
  };
  return effects.map(bump);
}
function keywordText(card, effects, up) {
  let text = formatEffects(effects);
  if (card.x) text = `X 费：${text}`;
  if (card.innate) text = `固有。${text}`;
  const growth = growthOf(card, up);
  if (growth) text += `。成长：每打出一次，这张牌本场${GROWTH_NAMES[growth.type] || growth.type}+${growth.n}`;
  if (card.ethereal) text += '。虚无';
  if (card.retain) text += '。保留';
  return text;
}
// Card text for one combat copy (shows growth already gained this combat).
export function cardTextFor(id, up = false, grow = 0) {
  const card = CARDS[id];
  if (!card) return STATUS_CARDS[id]?.text || '';
  if (card.type === 'power') return up && card.upgradeText ? card.upgradeText : card.text;
  const base = up && card.upgradeEffects?.length ? card.upgradeEffects : card.effects;
  return keywordText(card, grownEffects(base, growthOf(card, up), grow), up);
}
export function cardGrowth(id, up = false) {
  return CARDS[id] ? growthOf(CARDS[id], up) : null;
}

function def(card) {
  if (card.retain) card.keywords = [...(card.keywords || []), '保留'];
  if (card.ethereal) card.keywords = [...(card.keywords || []), '虚无'];
  if (card.innate) card.keywords = [...(card.keywords || []), '固有'];
  if (card.x) card.keywords = [...(card.keywords || []), 'X 费'];
  if (card.growth) card.keywords = [...(card.keywords || []), '成长'];
  if (card.type === 'status') {
    // For status cards, no effects, just fixed text.
    STATUS_CARDS[card.id] = card;
  } else {
    // Generate text from effects, unless power then use powerDesc.
    if (card.type === 'power') {
      card.text = `能力：${powerDesc(card.power)}`;
      card.upgradeText = card.upgradePowerText;
    } else {
      card.text = keywordText(card, card.effects, false);
      if (card.upgradeEffects && card.upgradeEffects.length) {
        card.upgradeText = keywordText(card, card.upgradeEffects, true);
      } else {
        card.upgradeText = undefined;
      }
    }
    CARDS[card.id] = card;
    if (!card.token) CARD_IDS.push(card.id);
  }
}

// ----------------------------- Permanent cards -----------------------------
const defs = [
  // Basic universal actions (18)
  { id:'TA01', name:'基础补枪', cost:1, type:'attack', tag:'basic', rarity:'common', effects:[atk(6)], upgradeEffects:[atk(8)] },
  { id:'TA02', name:'基础架点', cost:1, type:'skill', tag:'basic', rarity:'common', effects:[block(5)], upgradeEffects:[block(8)] },
  { id:'TA03', name:'基础烟雾', cost:1, type:'skill', tag:'utility', rarity:'common', effects:[smoke(2)], upgradeEffects:[smoke(3)] },
  { id:'TA04', name:'基础闪光', cost:1, type:'skill', tag:'utility', rarity:'common', effects:[flash(2)], upgradeEffects:[flash(3)] },
  { id:'TA05', name:'快速补枪', cost:0, type:'attack', tag:'basic', rarity:'common', effects:[atk(4)], upgradeEffects:[atk(6)] },
  { id:'TA06', name:'快速架点', cost:0, type:'skill', tag:'basic', rarity:'common', effects:[block(3)], upgradeEffects:[block(5)] },
  { id:'TA07', name:'战术观察', cost:1, type:'skill', tag:'basic', rarity:'common', effects:[draw(1)], upgradeEffects:[draw(2)] },
  { id:'TA08', name:'谨慎推进', cost:1, type:'skill', tag:'basic', rarity:'common', effects:[block(5), draw(2)], upgradeEffects:[block(8), draw(2)] },
  { id:'TA09', name:'快速换弹', cost:0, type:'skill', tag:'basic', rarity:'common', effects:[draw(1)], upgradeEffects:[draw(2)] },
  { id:'TA10', name:'正面突击', cost:2, type:'attack', tag:'basic', rarity:'common', effects:[atk(11), weak(1)], upgradeEffects:[atk(15), weak(2)] },
  { id:'TA11', name:'巩固防线', cost:2, type:'skill', tag:'basic', rarity:'uncommon', effects:[weak(2), block(15)], upgradeEffects:[weak(3), block(19)] },
  { id:'TA12', name:'烟墙掩护', cost:1, type:'skill', tag:'basic', rarity:'common', effects:[smoke(3), block(3)], upgradeEffects:[smoke(4), block(4)] },
  { id:'TA13', name:'闪光突破', cost:1, type:'attack', tag:'basic', rarity:'common', effects:[flash(1), atk(4)], upgradeEffects:[flash(2), atk(6)] },
  { id:'TA14', name:'队伍集结', cost:0, type:'skill', tag:'basic', rarity:'common', effects:[block(2)], upgradeEffects:[block(4)] },
  { id:'TA15', name:'快速转点', cost:0, type:'skill', tag:'basic', rarity:'common', effects:[draw(1)], upgradeEffects:[draw(2)] },
  { id:'TA16', name:'基础侦察', cost:1, type:'skill', tag:'utility', rarity:'common', effects:[draw(2)], upgradeEffects:[draw(3)] },
  { id:'TA17', name:'基础封锁', cost:1, type:'skill', tag:'utility', rarity:'common', effects:[smoke(3)], upgradeEffects:[smoke(4)] },
  { id:'TA18', name:'基础恢复', cost:1, type:'skill', tag:'basic', rarity:'common', effects:[heal(4)], upgradeEffects:[heal(7)] },

  // Firefight & damage components (14)
  { id:'TA19', name:'精准补枪', cost:1, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(9)], upgradeEffects:[atk(13)] },
  { id:'TA20', name:'双发补枪', cost:2, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(8,2)], upgradeEffects:[atk(11,2)] },
  { id:'TA21', name:'致命补枪', cost:3, type:'attack', tag:'damage', rarity:'rare', effects:[atk(21), conditional('enemy_smoke_or_flash', atk(13)), draw(1)], upgradeEffects:[atk(26), conditional('enemy_smoke_or_flash', atk(16)), draw(1)] },
  { id:'TA22', name:'破片手雷', cost:1, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(5), vuln(2)], upgradeEffects:[atk(7), vuln(2)] },
  { id:'TA23', name:'燃烧瓶', cost:2, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(19), weak(1), exhaustSelf()], exhaust: true, upgradeEffects:[atk(23), weak(2), exhaustSelf()] },
  { id:'TA24', name:'扫射压制', cost:2, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(7,3)], upgradeEffects:[atk(8,3)] },
  { id:'TA25', name:'爆头一击', cost:2, type:'attack', tag:'damage', rarity:'rare', effects:[atk(24)], upgradeEffects:[atk(32)] },
  { id:'TA26', name:'残局收割', cost:1, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(8), conditional('enemy_smoke', atk(8))], upgradeEffects:[atk(10), conditional('enemy_smoke', atk(10))] },
  { id:'TA27', name:'穿墙射击', cost:1, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(9), draw(1)], upgradeEffects:[atk(10), draw(2)] },
  { id:'TA28', name:'警戒射击', cost:1, type:'attack', tag:'damage', rarity:'common', effects:[atk(7)], upgradeEffects:[atk(10)] },
  { id:'TA29', name:'预瞄点射', cost:1, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(6), block(3)], upgradeEffects:[atk(8), block(4)] },
  { id:'TA30', name:'反架点', cost:2, type:'attack', tag:'damage', rarity:'rare', effects:[purgeEnemyStatus('block', 12), atk(19), exhaustSelf()], exhaust: true, upgradeEffects:[purgeEnemyStatus('block', 18), atk(23), exhaustSelf()] },
  { id:'TA31', name:'快攻连射', cost:1, type:'attack', tag:'damage', rarity:'common', effects:[atk(4,2)], upgradeEffects:[atk(6,2)] },
  { id:'TA32', name:'重火力压制', cost:3, type:'attack', tag:'damage', rarity:'rare', effects:[atk(23), weak(2), block(7)], upgradeEffects:[atk(31), weak(2), block(9)] },

  // Tactical utility (12)
  { id:'TA33', name:'烟雾弹', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[smoke(4)], upgradeEffects:[smoke(6)] },
  { id:'TA34', name:'闪光弹', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[flash(4)], upgradeEffects:[flash(6)] },
  { id:'TA35', name:'侦察无人机', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[draw(2), block(2)], upgradeEffects:[draw(3), block(3)] },
  { id:'TA36', name:'区域封锁', cost:2, type:'skill', tag:'utility', rarity:'uncommon', effects:[smoke(5), block(7)], upgradeEffects:[smoke(7), block(9)] },
  { id:'TA37', name:'诱饵陷阱', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[vuln(2), block(4)], upgradeEffects:[vuln(3), block(6)] },
  { id:'TA38', name:'信息干扰', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[weak(2), draw(1)], upgradeEffects:[weak(3), draw(1)] },
  { id:'TA39', name:'突破烟雾', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[smoke(2), atk(4)], upgradeEffects:[smoke(3), atk(6)] },
  { id:'TA40', name:'闪光掩护', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[flash(2), block(4)], upgradeEffects:[flash(3), block(6)] },
  { id:'TA41', name:'烟闪协同', cost:2, type:'attack', tag:'utility', rarity:'rare', effects:[conditional('enemy_smoke_or_flash', atk(16))], upgradeEffects:[conditional('enemy_smoke_or_flash', atk(22))] },
  { id:'TA42', name:'战术雷达', cost:0, type:'skill', tag:'utility', rarity:'uncommon', effects:[draw(1), block(1)], upgradeEffects:[draw(2), block(2)] },
  { id:'TA43', name:'道具回收', cost:1, type:'skill', tag:'utility', rarity:'rare', effects:[draw(2), energy(2)], upgradeEffects:[draw(3), energy(2)] },
  { id:'TA44', name:'全息诱饵', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[weak(3)], upgradeEffects:[weak(5)] },

  // Cover & push stance (8)
  { id:'TA45', name:'进入掩护', cost:1, type:'skill', tag:'stance', rarity:'uncommon', effects:[stanceSwitch(), block(8)], upgradeEffects:[stanceSwitch(), block(12)] },
  { id:'TA46', name:'前压突破', cost:1, type:'attack', tag:'stance', rarity:'uncommon', effects:[stanceSwitch(), atk(8)], upgradeEffects:[stanceSwitch(), atk(12)] },
  { id:'TA47', name:'掩护烟雾', cost:2, type:'skill', tag:'stance', rarity:'uncommon', effects:[stanceSwitch(), smoke(3), block(5)], upgradeEffects:[stanceSwitch(), smoke(4), block(8)] },
  { id:'TA48', name:'前压闪光', cost:2, type:'attack', tag:'stance', rarity:'uncommon', effects:[stanceSwitch(), flash(2), atk(8)], upgradeEffects:[stanceSwitch(), flash(3), atk(12)] },
  { id:'TA49', name:'阵地巩固', cost:1, type:'skill', tag:'stance', rarity:'rare', effects:[conditional('stance_cover', block(14))], upgradeEffects:[conditional('stance_cover', block(20))] },
  { id:'TA50', name:'突破重围', cost:1, type:'attack', tag:'stance', rarity:'rare', effects:[conditional('stance_push', atk(14))], upgradeEffects:[conditional('stance_push', atk(20))] },
  { id:'TA51', name:'姿态重置', cost:0, type:'skill', tag:'stance', rarity:'common', effects:[stanceSwitch(), draw(1)], upgradeEffects:[stanceSwitch(), draw(2)] },
  { id:'TA52', name:'姿态协调', cost:1, type:'skill', tag:'stance', rarity:'rare', effects:[stanceSwitch(), block(5), draw(1)], upgradeEffects:[stanceSwitch(), block(8), draw(2)] },

  // Core powers (7)
  { id:'TA53', name:'战术核心', cost:2, type:'power', tag:'core', rarity:'rare', power:'tactical_core', effects:[], upgradeEffects:[] },
  { id:'TA54', name:'攻击核心', cost:2, type:'power', tag:'core', rarity:'rare', power:'attack_core', effects:[], upgradeEffects:[] },
  { id:'TA55', name:'防御核心', cost:2, type:'power', tag:'core', rarity:'rare', power:'defense_core', effects:[], upgradeEffects:[] },
  { id:'TA56', name:'烟雾核心', cost:2, type:'power', tag:'core', rarity:'rare', power:'smoke_core', effects:[], upgradeEffects:[] },
  { id:'TA57', name:'闪光核心', cost:2, type:'power', tag:'core', rarity:'rare', power:'flash_core', effects:[], upgradeEffects:[] },
  { id:'TA58', name:'战术大师', cost:3, type:'power', tag:'core', rarity:'rare', power:'tactical_master', effects:[], upgradeEffects:[] },
  { id:'TA59', name:'残局核心', cost:2, type:'power', tag:'core', rarity:'rare', power:'clutch_core', effects:[], upgradeEffects:[] },

  // Hybrid connectors (8)
  { id:'TA60', name:'烟中补枪', cost:1, type:'attack', tag:'hybrid', rarity:'uncommon', effects:[atk(6), conditional('enemy_smoke', atk(6))], upgradeEffects:[atk(8), conditional('enemy_smoke', atk(8))] },
  { id:'TA61', name:'闪后补枪', cost:1, type:'attack', tag:'hybrid', rarity:'uncommon', effects:[atk(6), conditional('enemy_flash', atk(6))], upgradeEffects:[atk(8), conditional('enemy_flash', atk(8))] },
  { id:'TA62', name:'布防反击', cost:1, type:'attack', tag:'hybrid', rarity:'uncommon', effects:[atk(7), conditional('prev_played_attack', block(4))], upgradeEffects:[atk(9), conditional('prev_played_attack', block(6))] },
  { id:'TA63', name:'道具补枪', cost:0, type:'attack', tag:'hybrid', rarity:'uncommon', effects:[atk(3), draw(1)], upgradeEffects:[atk(6), draw(1)] },
  { id:'TA64', name:'战术换防', cost:1, type:'skill', tag:'hybrid', rarity:'uncommon', effects:[block(6), stanceSwitch()], upgradeEffects:[block(9), stanceSwitch()] },
  { id:'TA65', name:'补枪换防', cost:2, type:'attack', tag:'hybrid', rarity:'rare', effects:[atk(14), block(8)], upgradeEffects:[atk(19), block(12)] },
  { id:'TA66', name:'烟闪循环', cost:1, type:'skill', tag:'hybrid', rarity:'uncommon', effects:[smoke(2), flash(2)], upgradeEffects:[smoke(3), flash(3)] },
  { id:'TA67', name:'姿态补枪', cost:1, type:'attack', tag:'hybrid', rarity:'uncommon', effects:[atk(8), conditional('stance_changed_this_turn', atk(4))], upgradeEffects:[atk(10), conditional('stance_changed_this_turn', atk(6))] },

  // Response & management (8)
  { id:'TA68', name:'战术休整', cost:1, type:'skill', tag:'response', rarity:'uncommon', effects:[heal(6), draw(1)], upgradeEffects:[heal(9), draw(1)] },
  { id:'TA69', name:'净化', cost:0, type:'skill', tag:'response', rarity:'common', effects:[purgePlayerStatus('weak',2)], upgradeEffects:[purgePlayerStatus('weak',3)] },
  { id:'TA70', name:'意志坚定', cost:0, type:'skill', tag:'response', rarity:'common', effects:[purgePlayerStatus('vuln',2)], upgradeEffects:[purgePlayerStatus('vuln',3)] },
  { id:'TA71', name:'全效净化', cost:1, type:'skill', tag:'response', rarity:'uncommon', effects:[purgePlayerStatus('weak',99), purgePlayerStatus('vuln',99), draw(1)], upgradeEffects:[purgePlayerStatus('weak',99), purgePlayerStatus('vuln',99), draw(2)] },
  { id:'TA72', name:'破防闪光', cost:1, type:'skill', tag:'response', rarity:'uncommon', effects:[purgeEnemyStatus('block',99), draw(1)], upgradeEffects:[purgeEnemyStatus('block',99), draw(2)] },
  { id:'TA73', name:'紧急调度', cost:0, type:'skill', tag:'response', rarity:'uncommon', effects:[draw(3), exhaustSelf()], exhaust: true, upgradeEffects:[draw(4), exhaustSelf()] },
  { id:'TA74', name:'临时补给', cost:0, type:'skill', tag:'response', rarity:'common', effects:[energy(2), exhaustSelf()], upgradeEffects:[energy(3), exhaustSelf()], exhaust: true },
  { id:'TA75', name:'最终动员', cost:3, type:'power', tag:'response', rarity:'rare', power:'final_push', effects:[], upgradeEffects:[] },

  // Temporary in-combat upgrades and payoffs (8). Permanent deck copies never change here.
  { id:'TA76', name:'战术笔记', cost:1, type:'skill', tag:'response', rarity:'common', effects:[block(5), upgradeRandomInHand()], upgradeEffects:[block(5), upgradeAllInHand()] },
  { id:'TA77', name:'集体复盘', cost:1, type:'skill', tag:'response', rarity:'rare', effects:[draw(1), block(5), upgradeAllInHand(), exhaustSelf()], upgradeEffects:[draw(2), block(5), upgradeAllInHand(), exhaustSelf()], exhaust:true },
  { id:'TA78', name:'赛前统筹', cost:2, upgradeCost:1, type:'skill', tag:'core', rarity:'rare', effects:[upgradeAllInCombatDeck(), exhaustSelf()], upgradeEffects:[upgradeAllInCombatDeck(), exhaustSelf()], exhaust:true },
  { id:'TA79', name:'临场加练', cost:0, type:'skill', tag:'response', rarity:'uncommon', effects:[upgradeRandomInHand(), exhaustSelf()], upgradeEffects:[draw(1), upgradeRandomInHand(), exhaustSelf()], exhaust:true },
  { id:'TA80', name:'烟中回看', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[conditional('enemy_smoke', upgradeRandomInHand()), smoke(3), block(2)], upgradeEffects:[conditional('enemy_smoke', upgradeRandomInHand()), smoke(4), block(4)] },
  { id:'TA81', name:'精练攻势', cost:1, type:'attack', tag:'hybrid', rarity:'uncommon', effects:[attackScaledByUpgradedHand(5,2,4)], upgradeEffects:[attackScaledByUpgradedHand(7,2,4)] },
  { id:'TA82', name:'连夜复盘', cost:1, type:'skill', tag:'response', rarity:'rare', effects:[draw(2), upgradeRandomInHand(), exhaustSelf()], upgradeEffects:[draw(3), upgradeRandomInHand(), exhaustSelf()], exhaust:true },
  { id:'TA83', name:'精练体系', cost:2, type:'power', tag:'core', rarity:'rare', power:'upgrade_core', effects:[], upgradeEffects:[] },

  // FPS tactical ability cards (4)
  { id:'TA84', name:'长期工事', cost:3, upgradeCost:2, type:'power', tag:'response', rarity:'rare', power:'barricade', effects:[], upgradeEffects:[] },
  { id:'TA85', name:'火力训练', cost:1, type:'power', tag:'response', rarity:'uncommon', power:'inflame', effects:[], upgradeEffects:[], upgradePowerText:'能力：本场每次攻击伤害+3' },
  { id:'TA86', name:'架点训练', cost:1, type:'power', tag:'response', rarity:'uncommon', power:'footwork', effects:[], upgradeEffects:[], upgradePowerText:'能力：本场每次布防+3' },
  { id:'TA87', name:'消耗复盘', cost:2, upgradeCost:1, type:'power', tag:'response', rarity:'rare', power:'dark_embrace', effects:[], upgradeEffects:[] },

  // Archetype packages (burn / deploy / combo & knives / fortify / overload / execute / discover).
  // These give rewards real build directions; numbers are this project's own tuning.
  { id:'TA88', name:'燃烧瓶投掷', cost:1, type:'skill', tag:'burn', rarity:'common', effects:[burn(4)], upgradeEffects:[burn(6)] },
  { id:'TA89', name:'火墙封路', cost:1, type:'skill', tag:'burn', rarity:'common', effects:[burn(2), block(6)], upgradeEffects:[burn(3), block(8)] },
  { id:'TA90', name:'点燃补枪', cost:1, type:'attack', tag:'burn', rarity:'common', effects:[atk(5), burn(2)], upgradeEffects:[atk(7), burn(3)] },
  { id:'TA91', name:'助燃剂', cost:1, type:'skill', tag:'burn', rarity:'uncommon', effects:[burnMultiply(2), exhaustSelf()], exhaust:true, upgradeEffects:[burnMultiply(3), exhaustSelf()] },
  { id:'TA92', name:'引爆', cost:2, type:'attack', tag:'burn', rarity:'rare', effects:[detonate(2)], upgradeEffects:[detonate(3)] },
  { id:'TA93', name:'纵火专家', cost:2, type:'power', tag:'burn', rarity:'rare', power:'burn_core', effects:[], upgradeEffects:[] },
  { id:'TA94', name:'余烬追击', cost:0, type:'attack', tag:'burn', rarity:'uncommon', effects:[atk(3), conditional('enemy_burn', atk(5))], upgradeEffects:[atk(4), conditional('enemy_burn', atk(7))] },

  { id:'TA95', name:'哨戒炮', cost:2, type:'skill', tag:'deploy', rarity:'common', effects:[deploy('turret', 5, 3)], upgradeEffects:[deploy('turret', 7, 3)] },
  { id:'TA96', name:'屏障无人机', cost:1, type:'skill', tag:'deploy', rarity:'common', effects:[deploy('barrier', 5, 2)], upgradeEffects:[deploy('barrier', 7, 2)] },
  { id:'TA97', name:'蜂群炮台', cost:1, type:'skill', tag:'deploy', rarity:'uncommon', effects:[deploy('turret', 3, 2), vuln(1)], upgradeEffects:[deploy('turret', 4, 3), vuln(1)] },
  { id:'TA98', name:'集火指令', cost:1, type:'skill', tag:'deploy', rarity:'uncommon', effects:[fireTurrets(), draw(1)], upgradeEffects:[fireTurrets(), fireTurrets()] },
  { id:'TA99', name:'炮台大师', cost:2, type:'power', tag:'deploy', rarity:'rare', power:'turret_core', effects:[], upgradeEffects:[] },
  { id:'TA100', name:'自动炮台阵', cost:3, type:'skill', tag:'deploy', rarity:'rare', effects:[deploy('turret', 8, 4)], upgradeEffects:[deploy('turret', 11, 4)] },

  { id:'TA101', name:'飞刀雨', cost:1, type:'skill', tag:'combo', rarity:'common', effects:[addCardToHand('TK01', 2)], upgradeEffects:[addCardToHand('TK01', 3)] },
  { id:'TA102', name:'刀锋大师', cost:1, type:'power', tag:'combo', rarity:'rare', power:'knife_master', effects:[], upgradeEffects:[] },
  { id:'TA103', name:'连续交火', cost:1, type:'attack', tag:'combo', rarity:'common', effects:[atk(6), conditional('combo', atk(6))], upgradeEffects:[atk(8), conditional('combo', atk(8))] },
  { id:'TA104', name:'补位掩护', cost:0, type:'skill', tag:'combo', rarity:'common', effects:[block(3), conditional('combo', draw(1))], upgradeEffects:[block(5), conditional('combo', draw(1))] },
  { id:'TA105', name:'一穿三', cost:2, type:'attack', tag:'combo', rarity:'rare', effects:[atk(5,3), conditional('combo', atk(4,3))], upgradeEffects:[atk(6,3), conditional('combo', atk(5,3))] },
  { id:'TA106', name:'节奏大师', cost:2, type:'power', tag:'combo', rarity:'rare', power:'combo_core', effects:[], upgradeEffects:[] },

  { id:'TA107', name:'以守代攻', cost:1, type:'attack', tag:'fortify', rarity:'uncommon', effects:[attackFromBlock(1)], upgradeEffects:[attackFromBlock(1)], upgradeCost:0 },
  { id:'TA108', name:'铁壁', cost:2, type:'skill', tag:'fortify', rarity:'uncommon', effects:[block(14), draw(1)], upgradeEffects:[block(18), draw(1)] },
  { id:'TA109', name:'痛觉屏蔽', cost:1, type:'power', tag:'fortify', rarity:'uncommon', power:'feel_no_pain', effects:[], upgradeEffects:[] },
  { id:'TA110', name:'弃子战术', cost:1, type:'skill', tag:'fortify', rarity:'common', effects:[block(7), addCardToHand('TK02', 1)], upgradeEffects:[block(10), addCardToHand('TK02', 1)] },

  { id:'TA111', name:'全火力倾泻', cost:1, type:'attack', tag:'overload', rarity:'uncommon', effects:[atk(15), overload(1)], upgradeEffects:[atk(20), overload(1)] },
  { id:'TA112', name:'超频架点', cost:0, type:'skill', tag:'overload', rarity:'uncommon', effects:[block(10), overload(1)], upgradeEffects:[block(14), overload(1)] },
  { id:'TA113', name:'孤注一掷', cost:2, type:'attack', tag:'overload', rarity:'rare', effects:[atk(30), overload(2)], upgradeEffects:[atk(38), overload(2)] },
  { id:'TA114', name:'肾上腺素', cost:1, type:'skill', tag:'overload', rarity:'uncommon', effects:[strength(2), energy(1), overload(1), exhaustSelf()], exhaust:true, upgradeEffects:[strength(3), energy(1), overload(1), exhaustSelf()] },

  { id:'TA115', name:'弱点处决', cost:1, type:'attack', tag:'execute', rarity:'uncommon', effects:[atk(7), conditional('enemy_vuln', atk(7))], upgradeEffects:[atk(9), conditional('enemy_vuln', atk(9))] },
  { id:'TA116', name:'架枪等待', cost:1, type:'skill', tag:'execute', rarity:'common', retain:true, effects:[block(7), conditional('enemy_intends_attack', block(4))], upgradeEffects:[block(9), conditional('enemy_intends_attack', block(5))] },
  { id:'TA117', name:'留枪', cost:1, type:'attack', tag:'execute', rarity:'common', retain:true, effects:[atk(10)], upgradeEffects:[atk(14)] },

  { id:'TA118', name:'战术研判', cost:1, type:'skill', tag:'discover', rarity:'uncommon', effects:[discover('attack')], upgradeEffects:[discover('attack'), draw(1)] },
  { id:'TA119', name:'情报共享', cost:0, type:'skill', tag:'discover', rarity:'uncommon', effects:[discover('skill'), exhaustSelf()], exhaust:true, upgradeEffects:[discover('any'), exhaustSelf()] },
  { id:'TA120', name:'临场指挥', cost:1, type:'skill', tag:'discover', rarity:'rare', effects:[discover('any'), block(4)], upgradeEffects:[discover('any'), block(8)] },

  // Area answers for group fights (hit every living enemy; no target needed).
  { id:'TA121', name:'扫射全场', cost:1, type:'attack', tag:'damage', rarity:'common', effects:[atkAll(7)], upgradeEffects:[atkAll(10)] },
  { id:'TA122', name:'烟幕覆盖', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[smokeAll(2), block(3)], upgradeEffects:[smokeAll(3), block(5)] },
  { id:'TA123', name:'燃烧地带', cost:1, type:'skill', tag:'burn', rarity:'uncommon', effects:[burnAll(3)], upgradeEffects:[burnAll(5)] },
  { id:'TA124', name:'闪光齐爆', cost:1, type:'skill', tag:'utility', rarity:'common', effects:[flashAll(2)], upgradeEffects:[flashAll(3)] },

  // Keyword cards (2026-09-24). Numbers are this project's own tuning.
  // 虚无: strong for the cost, but lost for this combat if not played this turn.
  { id:'TA125', name:'幽灵突进', cost:1, type:'attack', tag:'damage', rarity:'common', ethereal:true, effects:[atk(11)], upgradeEffects:[atk(15)] },
  { id:'TA126', name:'临时掩体', cost:1, type:'skill', tag:'basic', rarity:'common', ethereal:true, effects:[block(10)], upgradeEffects:[block(14)] },
  { id:'TA127', name:'灵光一现', cost:0, type:'skill', tag:'response', rarity:'uncommon', ethereal:true, effects:[draw(2)], upgradeEffects:[draw(3)] },
  { id:'TA128', name:'瞬时压制', cost:1, type:'skill', tag:'utility', rarity:'uncommon', ethereal:true, effects:[vuln(2), weak(2)], upgradeEffects:[vuln(3), weak(3)] },
  { id:'TA129', name:'残影连射', cost:2, type:'attack', tag:'damage', rarity:'rare', ethereal:true, effects:[atk(8,3)], upgradeEffects:[atk(10,3)] },
  // 固有: always in the opening hand.
  { id:'TA130', name:'开局预瞄', cost:1, type:'attack', tag:'execute', rarity:'common', innate:true, effects:[atk(7), vuln(1)], upgradeEffects:[atk(9), vuln(2)] },
  { id:'TA131', name:'先手烟幕', cost:1, type:'skill', tag:'utility', rarity:'common', innate:true, effects:[smoke(3), block(4)], upgradeEffects:[smoke(4), block(6)] },
  { id:'TA132', name:'战前简报', cost:0, type:'skill', tag:'response', rarity:'uncommon', innate:true, exhaust:true, effects:[draw(2), exhaustSelf()], upgradeEffects:[draw(3), exhaustSelf()] },
  { id:'TA133', name:'先发制人', cost:1, type:'attack', tag:'damage', rarity:'uncommon', innate:true, effects:[atk(5,2)], upgradeEffects:[atk(7,2)] },
  { id:'TA134', name:'前置炮位', cost:1, type:'skill', tag:'deploy', rarity:'uncommon', innate:true, effects:[deploy('turret', 4, 3)], upgradeEffects:[deploy('turret', 6, 3)] },
  // X 费: spends all current energy.
  { id:'TA135', name:'弹幕倾泻', cost:0, x:true, type:'attack', tag:'damage', rarity:'uncommon', effects:[xRepeat(atkAll(5))], upgradeEffects:[xRepeat(atkAll(7))] },
  { id:'TA136', name:'全面布防', cost:0, x:true, type:'skill', tag:'fortify', rarity:'common', effects:[xMul(block(5))], upgradeEffects:[xMul(block(5), 1)] },
  { id:'TA137', name:'燃烧弹齐射', cost:0, x:true, type:'skill', tag:'burn', rarity:'uncommon', effects:[xMul(burn(3))], upgradeEffects:[xMul(burn(3), 1)] },
  { id:'TA138', name:'蓄势待发', cost:0, x:true, type:'skill', tag:'overload', rarity:'rare', exhaust:true, effects:[nextTurn(1, 1), exhaustSelf()], upgradeEffects:[nextTurn(1, 1, 1), exhaustSelf()] },
  { id:'TA139', name:'压枪连点', cost:0, x:true, type:'attack', tag:'damage', rarity:'common', effects:[xRepeat(atk(7))], upgradeEffects:[xRepeat(atk(7), 1)] },
  // 成长: every play makes this copy stronger for the rest of the combat.
  { id:'TA140', name:'实战磨炼', cost:1, type:'attack', tag:'damage', rarity:'uncommon', growth:{ type:'attack', n:4 }, upgradeGrowth:{ type:'attack', n:6 }, effects:[atk(7)], upgradeEffects:[atk(8)] },
  { id:'TA141', name:'逐步加固', cost:1, type:'skill', tag:'fortify', rarity:'common', growth:{ type:'block', n:3 }, upgradeGrowth:{ type:'block', n:4 }, effects:[block(6)], upgradeEffects:[block(8)] },
  { id:'TA142', name:'越烧越旺', cost:1, type:'skill', tag:'burn', rarity:'uncommon', growth:{ type:'burn', n:2 }, upgradeGrowth:{ type:'burn', n:3 }, effects:[burn(3)], upgradeEffects:[burn(4)] },
  { id:'TA143', name:'默契养成', cost:0, type:'attack', tag:'combo', rarity:'common', growth:{ type:'attack', n:2 }, upgradeGrowth:{ type:'attack', n:3 }, effects:[atk(3)], upgradeEffects:[atk(4)] },
  { id:'TA144', name:'战术复读', cost:2, type:'attack', tag:'damage', rarity:'rare', growth:{ type:'attack', n:2 }, upgradeGrowth:{ type:'attack', n:3 }, effects:[atk(5,2), draw(1)], upgradeEffects:[atk(6,2), draw(1)] }
];

// Tokens created during a fight (never offered as rewards).
export const TOKEN_CARDS = {
  TK01: { id:'TK01', name:'飞刀', cost:0, type:'attack', tag:'combo', rarity:'common', token:true, exhaust:true, effects:[atk(4), exhaustSelf()], upgradeEffects:[atk(6), exhaustSelf()] },
  TK02: { id:'TK02', name:'弃子', cost:0, type:'skill', tag:'fortify', rarity:'common', token:true, exhaust:true, effects:[draw(1), exhaustSelf()], upgradeEffects:[draw(2), exhaustSelf()] }
};

// Tokens first so card text that creates them can show their names.
for (const card of Object.values(TOKEN_CARDS)) def(card);
defs.forEach(c => def(c));
for (const card of REGIONAL_CARDS) def(card);
export const REGION_CARD_IDS = Object.fromEntries(['CN','AM','EMEA','PAC'].map(region => [region, REGIONAL_CARDS.filter(card => card.region === region).map(card => card.id)]));
export const SHARED_CARD_IDS = defs.map(card => card.id);
// Build direction shown on cards and used to keep reward choices varied.
export const ARCHETYPES = { burn:'燃烧', deploy:'部署', combo:'连击', fortify:'布防反击', overload:'过载爆发', execute:'易伤处决', discover:'发现' };

// ----------------------------- Status cards -----------------------------
def({ id:'ST01', name:'失误', cost:0, type:'status', tag:'status', rarity:'common', text:'不可打出。弃掉时受到1点伤害', effects:[] });
def({ id:'ST02', name:'犹豫', cost:0, type:'status', tag:'status', rarity:'common', text:'不可打出。弃掉时受到2点伤害', effects:[] });
def({ id:'ST03', name:'暴露', cost:0, type:'status', tag:'status', rarity:'common', text:'不可打出。弃掉时受到3点伤害', effects:[] });
for(const status of EXTRA_STATUSES)def({id:status.id,name:status.name,cost:0,type:'status',tag:'status',rarity:'common',text:status.text,effects:[]});
for(const curse of CURSES)def({id:curse.id,name:curse.name,cost:0,type:'status',tag:'curse',rarity:'common',curse:true,text:curse.text+' 跨比赛保留，直到永久移除。',effects:[]});

// ----------------------------- Teams -----------------------------
export const TEAMS = {
  breach:   { id:'breach', region:'AM', name:'烈锋突击队 · 突破', desc:'多段交火与易伤联动。', startingDeck:[['TA01',1],['TA22',1],['TA29',1],['TA10',1],['TA19',1],['TA46',1],['TA02',3],['TA06',1]] },
  anchor:   { id:'anchor', region:'CN', name:'磐石守备队 · 架点', desc:'布防转攻与战术升级。', startingDeck:[['TA02',2],['TA06',1],['TA11',1],['TA45',1],['TA08',1],['TA29',1],['TA65',1],['TA01',1],['TA07',1]] },
  utility:  { id:'utility', region:'EMEA', name:'雾隐战术组 · 道具', desc:'烟闪控场与压制。', startingDeck:[['TA13',1],['TA39',1],['TA60',1],['TA61',1],['TA41',1],['TA02',2],['TA12',1],['TA40',1],['TA07',1]] },
  rotation: { id:'rotation', region:'PAC', name:'疾风调度组 · 调度', desc:'抽牌循环与姿态节奏。', startingDeck:[['TA01',1],['TA05',1],['TA28',1],['TA02',1],['TA08',1],['TA27',1],['TA02',1],['TA42',1],['TA74',1],['TA64',1]] }
};

// Team-exclusive passives ("队伍特质"): one per team, always active, with its own
// per-combat counter. They make the same map play differently per team.
// `max` is the counter's trigger point (shown as x/max); texts describe rules only.
export const TEAM_TRAITS = {
  momentum: { id:'momentum', team:'breach', name:'突击势能', unit:'势能', max:3,
    text:'每打出一张攻击牌获得1点势能（每场战斗重置）。势能达到3时清零，并使你打出的下一张攻击牌伤害翻倍。' },
  fortify: { id:'fortify', team:'anchor', name:'工事', unit:'工事', max:12,
    text:'敌方回合结束后，你剩余布防的一半（向上取整，最多12）保留为工事，并入下回合的布防。' },
  intel: { id:'intel', team:'utility', name:'情报', unit:'情报', max:6,
    text:'你每打出一次给予烟雾或闪光的效果获得1点情报（范围效果只算1次）。情报达到6时立即抽1张牌、获得1点能量，然后清零。' },
  dispatch: { id:'dispatch', team:'rotation', name:'机动调度', unit:'调度', max:1,
    text:'每回合第一次切换姿态（手动或由卡牌触发）时抽1张牌；若是手动切换，则不消耗能量。' }
};
for (const t of Object.values(TEAM_TRAITS)) TEAMS[t.team].trait = t.id;

// ----------------------------- Enemies -----------------------------
// Each archetype has its own look, behaviour pattern and (often) a passive
// trait, so fights ask for different answers. Act 2/3 versions are scaled
// copies with the same identity; bosses are hand-authored per act.
const H = (n, times = 1) => ({ type: 'hit', n, times });
const BL = n => ({ type: 'block', n });
const BUFF = n => ({ type: 'buff', n });
const JAM = (id, n = 1) => ({ type: 'jam', id, n });
const WEAKP = n => ({ type: 'weak', n });
const VULNP = n => ({ type: 'vuln', n });
const AIM = () => ({ type: 'aim' });
const SNIPE = n => ({ type: 'snipe', n });
const CLEANSE = () => ({ type: 'cleanse' });
// Support intents for group members.
const HEAL = n => ({ type: 'heal', n });     // heal the most wounded living ally (may be itself)
const GUARD = n => ({ type: 'guard', n });   // block on the lowest-HP other ally (itself if alone)
const RALLY = n => ({ type: 'rally', n });   // every living ally, itself included, gains firepower
const SUMMON = (id, n) => ({ type: 'summon', id, n }); // bring back one escort if fewer than 2 live; else block n

export const TRAITS = {
  berserk: { name: '背水一战', icon: 'enrage', text: n => `生命首次降到一半以下时，获得${n}层火力。` },
  thorns: { name: '交叉火力', icon: 'thorns', text: n => `每次被你的攻击命中，反击你${n}点伤害（布防可挡）。` },
  enrageOnSkill: { name: '信息读取', icon: 'enrage', text: n => `你每打出一张技能牌，它获得${n}层火力。` },
  ritual: { name: '手感渐热', icon: 'strength', text: n => `每个敌方回合结束时，获得${n}层火力。` },
  tempo: { name: '控制节奏', icon: 'tempo', text: n => `你每打出${n}张牌，它获得2层火力与8点布防。` },
  phase2: { name: '决胜局', icon: 'enrage', text: () => '生命降到一半时清除自身负面状态，获得12点布防、2层火力，并换成全新打法。' },
  sniper: { name: '狙击位', icon: 'aim', text: () => '瞄准一回合后打出重狙；在它开枪前给予闪光可以打断瞄准，让这一枪只剩三分之一伤害。' },
  // Boss traits (2026-09-24 boss pool).
  modeShift: { name: '防御架势', icon: 'thorns', text: n => `累计失去${n}点生命时切换为防御架势：立即获得布防，下一个行动改为布防加攻击；架势持续到它的第2个回合结束，期间你的攻击每命中一次它反击你4点伤害。之后再切换所需的累计失血增加10。` },
  toxin: { name: '毒雾渗透', icon: 'status', text: n => `每个敌方回合结束时，将${n}张「犹豫」洗入你的抽牌堆。` },
  reactive: { name: '应激护盾', icon: 'block', text: n => `你每打出一张牌，它获得${n}点布防；它每次行动前清空自身布防。` },
  overwatch: { name: '全程监视', icon: 'aim', text: n => `你每回合打出第${n + 1}张及之后的每张牌时，它立即对你开火4点伤害（布防可挡）。` },
  command: { name: '战区指挥', icon: 'strength', text: () => '开局带2名护卫；护卫少于2名时，“调兵”会补回1名，护卫满员时改为布防。' }
};

const ACT1_BASE = {
  E01: { name:'新秀步枪组', look:'rookie', hp:54, script:[[H(11)],[BUFF(2),H(6)],[BL(6),H(8)]] },
  E02: { name:'远点狙击手', look:'sniper', hp:48, ordered:true, trait:{ id:'sniper' }, script:[[AIM(),BL(5)],[SNIPE(24)],[H(8)]] },
  E03: { name:'突破手双枪', look:'rusher', hp:56, trait:{ id:'berserk', n:4 }, script:[[H(4,3)],[H(11)],[BL(6),H(9)]] },
  E04: { name:'哨位架枪组', look:'sentinel', hp:50, startBlock:10, trait:{ id:'thorns', n:2 }, script:[[BL(6),H(6)],[H(13)],[BL(5),H(8)]] },
  E05: { name:'烟雾控场手', look:'controller', hp:52, script:[[WEAKP(1),JAM('ST01',2),H(6)],[H(12)],[VULNP(1),H(8)]] },
  E06: { name:'前哨侦察兵', look:'recon', hp:54, trait:{ id:'enrageOnSkill', n:1 }, script:[[H(9)],[BL(8),H(5)],[H(4,2)]] },
  EL01:{ name:'王牌突击手', look:'ace', hp:90, elite:true, trait:{ id:'ritual', n:1 }, script:[[H(13),JAM('ST03')],[H(6,3)],[BL(12),H(5)]] },
  EL02:{ name:'战术指挥官', look:'igl', hp:84, elite:true, ordered:true, script:[[BUFF(2),BL(10)],[H(9,2)],[CLEANSE(),BL(15),JAM('ST02')],[H(18)]] },
  B01: { name:'资格赛冠军卫队', look:'boss1', hp:120, boss:true, trait:{ id:'tempo', n:18 }, script:[[WEAKP(1),H(8)],[JAM('ST02',2),BL(12)],[H(5,3)],[H(14)]] },
  // Act-1 boss candidates (one of three is drawn per run by seed).
  B02: { name:'重装守门人', look:'bossWarden', hp:120, boss:true, ordered:true, trait:{ id:'modeShift', n:40 },
    script:[[BL(8),H(9)],[H(4,3)],[BUFF(2),BL(8)],[H(14)]], guardMode:[[BL(10),H(8)]] },
  B03: { name:'毒雾调度员', look:'bossToxin', hp:92, boss:true, trait:{ id:'toxin', n:1 },
    script:[[WEAKP(1),H(7)],[JAM('ST01',1),H(5,2)],[BL(10),H(7)],[VULNP(1),H(10)]] },

  // Group members (never met alone). Each group asks a different targeting question.
  M01: { name:'步枪手', look:'rookie', hp:24, member:true, script:[[H(6)],[H(4,2)],[BL(5),H(5)]] },
  M02: { name:'战地医疗兵', look:'controller', hp:26, member:true, script:[[HEAL(9),H(3)],[GUARD(8)],[H(6)]] },
  M03: { name:'观察手', look:'recon', hp:26, member:true, ordered:true, script:[[RALLY(1),H(3)],[RALLY(1),BL(6)]] },
  M04: { name:'冲锋手', look:'rusher', hp:22, member:true, script:[[H(8)],[H(4,2)],[H(10)]] },
  M05: { name:'自动炮塔', look:'sentinel', hp:22, member:true, ordered:true, script:[[JAM('ST01'),BL(5)],[H(10)]] },
  M06: { name:'交叉狙击手', look:'sniper', hp:26, member:true, ordered:true, trait:{ id:'sniper' }, script:[[AIM(),BL(4)],[SNIPE(18)]] },
  M07: { name:'王牌狙击手', look:'ace', hp:42, member:true, elite:true, ordered:true, trait:{ id:'sniper' }, script:[[AIM(),BL(6)],[SNIPE(20)],[H(8)]] },
  M08: { name:'护卫盾手', look:'sentinel', hp:44, member:true, elite:true, startBlock:10, trait:{ id:'thorns', n:2 }, script:[[GUARD(10),H(6)],[H(12)],[GUARD(8),H(7)]] },
  // Escorts of the act-2 commander boss (used through their A2_ copies).
  M09: { name:'统帅护卫', look:'sentinel', hp:30, member:true, script:[[GUARD(10),H(5)],[H(9)]] },
  M10: { name:'统帅步枪手', look:'rookie', hp:24, member:true, script:[[H(7)],[H(4,2)]] }
};

function scaleAction(a, k) {
  const r = n => Math.max(1, Math.round(n * k));
  if (['hit', 'block', 'snipe', 'heal', 'guard'].includes(a.type)) return { ...a, n: r(a.n) };
  if (a.type === 'buff' || a.type === 'rally') return { ...a, n: a.n + (k > 1.5 ? 2 : 1) };
  return { ...a };
}
// Difficulty pass (2026-09-24): the smart playtest bot lost almost no HP in
// ordinary fights, so act-1 numbers are raised per role before act scaling.
// Buff/rally sizes stay as authored; only damage, block, heals and HP move.
const DIFFICULTY = {
  normal: { hp: 1.35, dmg: 1.55 },
  member: { hp: 1.25, dmg: 1.35 },
  elite: { hp: 1.25, dmg: 1.45 },
  // Act-1 boss raised (was 1.4/1.45) for the 15-floor act: the longer climb gives
  // more card rewards, and the smart bot cleared act 1 in 63% of runs.
  // Boss pool pass (2026-09-24): with three act-1 candidates, weaker openers and
  // team retuning the bot cleared act 1 in ~65% of runs, so 1.5/1.5 -> 1.6/1.55.
  // 2026-09-25: players died before the act-1 boss; 1.6/1.55 -> 1.58/1.52 (with the early easing, the smart bot cleared act 1 in 85%).
  boss: { hp: 1.58, dmg: 1.52 }
};
// Early act-1 easing (2026-09-25, applied by the engine per fight): players died
// before the act-1 boss. Weak floors (1–4), the other fights up to floor `step`
// and elites up to floor `step` get these extra multipliers; later act-1 fights
// (`late`, `lateElite`) are eased less.
export const EARLY_EASE = { step: 8, weak: { hp: 0.85, dmg: 0.8 }, normal: { hp: 0.9, dmg: 0.88 }, elite: { hp: 0.75, dmg: 0.7 }, lateElite: { hp: 0.85, dmg: 0.82 }, late: { hp: 0.95, dmg: 0.93 } };
function roleOf(e) { return e.boss ? 'boss' : e.elite ? 'elite' : e.member ? 'member' : 'normal'; }
function tuneEnemy(e, t) {
  const keep = a => (a.type === 'buff' || a.type === 'rally' ? { ...a } : null);
  const tuneAct = a => keep(a) || scaleAction(a, t.dmg);
  return {
    ...e,
    hp: Math.round(e.hp * t.hp),
    startBlock: e.startBlock ? Math.round(e.startBlock * t.dmg) : undefined,
    script: e.script.map(turn => turn.map(tuneAct)),
    phase2: e.phase2 ? e.phase2.map(turn => turn.map(tuneAct)) : undefined,
    guardMode: e.guardMode ? e.guardMode.map(turn => turn.map(tuneAct)) : undefined
  };
}
const ACT1_ENEMIES = Object.fromEntries(Object.entries(ACT1_BASE).map(([id, e]) => [id, tuneEnemy(e, DIFFICULTY[roleOf(e)])]));

function scaledAct(prefix, label, hpK, dmgK) {
  const out = {};
  for (const [id, e] of Object.entries(ACT1_ENEMIES)) {
    if (e.boss) continue;
    out[prefix + id] = {
      ...e,
      name: label + e.name,
      hp: Math.round(e.hp * hpK * (e.elite ? 0.93 : 1)),
      startBlock: e.startBlock ? Math.round(e.startBlock * dmgK) : undefined,
      // Ritual already compounds every turn, so only flat traits grow per act.
      trait: e.trait ? { ...e.trait, n: e.trait.n && e.trait.id !== 'ritual' ? e.trait.n + (dmgK > 1.45 ? 2 : 1) : e.trait.n } : undefined,
      script: e.script.map(turn => turn.map(a => scaleAction(a, dmgK)))
    };
  }
  return out;
}

export const ENEMIES = {
  ...ACT1_ENEMIES,
  // Act 2/3 scaling sits on top of the act-1 difficulty pass, so it is milder
  // than before (was 1.35/1.25 and 1.75/1.5) to keep full runs winnable.
  // 2026-09-25: act-2 HP 1.45 -> 1.38 so more runs that clear the eased act 1 carry on (smart full clear was 20%).
  ...scaledAct('A2_', '二幕·', 1.38, 1.25),
  A2_B01: tuneEnemy({ name:'晋级赛冠军卫队', look:'boss2', hp:165, boss:true, ordered:true, script:[[BL(18),H(6)],[BUFF(2),H(7,3)],[H(10),JAM('ST02',2)],[H(20)]] }, { hp: 1.4, dmg: 1.4 }),
  // 15-floor acts (2026-09-24): act-3 HP 1.85 -> 1.95; more floors meant more
  // rewards and the bot's full-run clear rose to ~23%.
  ...scaledAct('A3_', '决赛·', 1.95, 1.45),
  // The two-phase final keeps its authored numbers bar a HP and damage cut: with the
  // full boss multiplier the bot lost 4 of 6 final fights.
  A3_B01: tuneEnemy({ name:'总决赛冠军卫队', look:'boss3', hp:165, boss:true, trait:{ id:'phase2' },
    script:[[H(14),JAM('ST03')],[WEAKP(1),H(6,3)],[BL(18),JAM('ST01',2)],[H(22)]],
    phase2:[[BUFF(2),H(10,2)],[H(8,3),VULNP(1)],[BL(20),H(12)]] }, { hp: 1.25, dmg: 1.3 }),
  // Act-2 boss candidates (same multipliers as the act-2 final).
  A2_B02: tuneEnemy({ name:'闪击突击王', look:'bossBlitz', hp:160, boss:true, ordered:true, trait:{ id:'reactive', n:4 },
    script:[[H(4,3)],[BUFF(2),H(5,2)],[H(3,5)],[H(14)]] }, { hp: 1.4, dmg: 1.4 }),
  A2_BC3: tuneEnemy({ name:'战区统帅', look:'bossMarshal', hp:110, boss:true, ordered:true, trait:{ id:'command' },
    script:[[SUMMON('A2_M09', 10)],[RALLY(1),H(8)],[H(5,2)],[SUMMON('A2_M10', 8),H(10)]] }, { hp: 1.4, dmg: 1.4 }),
  // Act-3 boss candidates (same multipliers as the act-3 final).
  A3_B02: tuneEnemy({ name:'情报先知', look:'bossOracle', hp:165, boss:true, trait:{ id:'overwatch', n:5 },
    script:[[H(12),VULNP(1)],[BL(16),BUFF(2)],[H(7,2)],[H(20)]] }, { hp: 1.25, dmg: 1.3 }),
  A3_B03: tuneEnemy({ name:'暗影猎手', look:'bossHunter', hp:185, boss:true, ordered:true, trait:{ id:'sniper' },
    script:[[AIM(),H(8)],[SNIPE(36)],[H(10,2),VULNP(1)],[BUFF(3),BL(14)]] }, { hp: 1.25, dmg: 1.3 })
};

// Boss pool: three candidates per act. The act's boss is fixed by the run seed
// when the act's map is built and is shown at the top of the map. `color` and
// `icon` give the map preview its identity; texts state rules only.
export const BOSSES = {
  B01: { act: 1, name: '资格赛冠军卫队', look: 'boss1', color: '#ffb300', icon: 'tempo', text: '你每打出18张牌，它获得2层火力与8点布防。' },
  B02: { act: 1, name: '重装守门人', look: 'bossWarden', color: '#4f8dff', icon: 'thorns', text: '累计失去40点生命就切换防御架势：获得布防，并在架势中反击你的每次攻击命中。' },
  B03: { act: 1, name: '毒雾调度员', look: 'bossToxin', color: '#6fdc5a', icon: 'status', text: '每个敌方回合结束时把1张「犹豫」洗入你的抽牌堆，并施加压制与易伤。' },
  A2_B01: { act: 2, name: '晋级赛冠军卫队', look: 'boss2', color: '#ffb300', icon: 'strength', text: '固定节奏：先大额布防，再强化连射，然后塞入异常牌，最后重击。' },
  A2_B02: { act: 2, name: '闪击突击王', look: 'bossBlitz', color: '#ff8a2a', icon: 'block', text: '你每打出一张牌，它获得4点布防；它每次行动前清空布防，多段攻击频繁。' },
  A2_B03: { act: 2, name: '战区统帅', look: 'bossMarshal', color: '#d9534f', icon: 'strength', text: '带2名护卫开局，护卫会为它布防；护卫少于2名时，它会调兵补回。' },
  A3_B01: { act: 3, name: '总决赛冠军卫队', look: 'boss3', color: '#ffb300', icon: 'enrage', text: '生命降到一半时清除负面状态、获得布防与火力，并换成全新打法。' },
  A3_B02: { act: 3, name: '情报先知', look: 'bossOracle', color: '#2fd0c0', icon: 'aim', text: '你每回合打出第6张及之后的每张牌时，它立即对你开火4点伤害。' },
  A3_B03: { act: 3, name: '暗影猎手', look: 'bossHunter', color: '#e8c04a', icon: 'aim', text: '瞄准一回合后重狙；开枪前给予闪光可打断瞄准。它还会施加易伤。' }
};
export const BOSS_IDS_BY_ACT = { 1: ['B01', 'B02', 'B03'], 2: ['A2_B01', 'A2_B02', 'A2_B03'], 3: ['A3_B01', 'A3_B02', 'A3_B03'] };

// Multi-enemy encounters. `offset` staggers ordered scripts so members of the
// same type do not all fire on the same turn. Act 2/3 versions reuse the
// scaled members (A2_M01 ...).
const ACT1_GROUPS = {
  G01: { name:'步枪火力组', members:[{ id:'M01' }, { id:'M02' }, { id:'M01' }] },
  G02: { name:'侦察突击组', members:[{ id:'M04' }, { id:'M03' }, { id:'M04' }] },
  G03: { name:'自动炮塔阵', members:[{ id:'M05', offset:0 }, { id:'M05', offset:1 }, { id:'M05', offset:0 }] },
  G04: { name:'交叉狙击组', members:[{ id:'M06', offset:0 }, { id:'M06', offset:1 }] },
  GE1: { name:'王牌狙击小组', elite:true, members:[{ id:'M08' }, { id:'M07' }] }
};
function groupsFor(prefix, label) {
  return Object.fromEntries(Object.entries(ACT1_GROUPS).map(([id, g]) => [prefix + id, { ...g, name: label + g.name, members: g.members.map(m => ({ ...m, id: prefix + m.id })) }]));
}
export const GROUPS = { ...ACT1_GROUPS, ...groupsFor('A2_', '二幕·'), ...groupsFor('A3_', '决赛·'),
  // Act-2 boss encounter: the commander in the middle with two escorts.
  A2_B03: { name:'战区统帅', boss:true, members:[{ id:'A2_M09' }, { id:'A2_BC3' }, { id:'A2_M10' }] } };
export const NORMAL_GROUP_IDS = ['G01', 'G02', 'G03', 'G04'];
export const ELITE_GROUP_IDS = ['GE1'];

// Battlefield modifiers rolled per ordinary/elite fight (not the first two stops or bosses).
export const FIELDS = {
  corridor: { name: '狭窄走廊', text: '所有多段攻击（双方）每段伤害 +1。' },
  longrange: { name: '开阔长廊', text: '单段基础伤害≥10的攻击（双方）伤害 +3。' },
  smoky: { name: '烟雾弥漫', text: '开局敌人获得2层烟雾；你每回合第一次给予烟雾时额外 +1 层。' },
  highground: { name: '高点优势', text: '你每回合第一张攻击牌伤害 +3。' },
  overtime: { name: '加时赛', text: '从第5回合起，敌人每回合开始时获得2层火力。' },
  eco: { name: '经济局', text: '第一回合你多1点能量、多抽1张牌。' }
};

// ----------------------------- Equipment (装备) -----------------------------
// Run-long passive gear. Internal key stays `RELICS` / `R..` ids for saves.
// tier: common / uncommon / rare (random drops weighted 50/33/17), shop (补给站专属),
// boss (幕末决战后三选一). `energy: 1` marks gear that raises energy every turn.
export const EQUIP_TIERS = {
  common: { name: '普通', weight: 50 },
  uncommon: { name: '罕见', weight: 33 },
  rare: { name: '稀有', weight: 17 },
  shop: { name: '补给站专属' },
  boss: { name: '决战专属' }
};
const EQ = (id, tier, name, desc, extra = {}) => [id, { id, tier, name, desc, ...extra }];
export const RELICS = Object.fromEntries([
  // Common
  EQ('R02', 'common', '备用弹夹', '每场战斗开始时抽1张牌。'),
  EQ('R03', 'common', '战术平板', '每场战斗开始时获得1点能量。'),
  EQ('R04', 'common', '烟雾发生器', '每场战斗开始时给予所有敌人3层烟雾。'),
  EQ('R07', 'common', '护甲板', '获得时最大生命+8。'),
  EQ('R08', 'common', '奖金加成', '离开事件、补给站、休整点时获得15金币。'),
  EQ('R10', 'common', '旧战术笔记', '获得时随机获得一张基础牌。'),
  EQ('R13', 'common', '沙袋掩体', '每场战斗第1回合获得10点布防。'),
  EQ('R14', 'common', '破片弹头', '每场战斗开始时给予所有敌人1层易伤。'),
  EQ('R15', 'common', '战地绷带', '每场战斗开始时回复2点生命。'),
  EQ('R16', 'common', '反应装甲', '敌人每次攻击你时，对它造成3点伤害（无视布防）。'),
  EQ('R17', 'common', '节拍器', '每场战斗每第3个回合开始时获得1点能量。'),
  EQ('R18', 'common', '握把胶带', '你的每次布防效果+1。'),
  EQ('R19', 'common', '枪口制退器', '你的攻击每段伤害+1。'),
  EQ('R20', 'common', '战术计步器', '每累计打出10张牌，获得1点能量（跨战斗累计）。'),
  // Uncommon
  EQ('R01', 'uncommon', '随队医生', '战斗胜利后回复8点生命。'),
  EQ('R05', 'uncommon', '闪光发生器', '每场战斗开始时给予所有敌人3层闪光。'),
  EQ('R11', 'uncommon', '冠军臂章', '每回合开始时获得2点布防。'),
  EQ('R21', 'uncommon', '肾上腺泵', '生命不高于最大生命一半时，你的攻击每段伤害+3。'),
  EQ('R22', 'uncommon', '交叉掩护', '每回合打出第3张攻击牌时，获得4点布防。'),
  EQ('R23', 'uncommon', '连射模块', '每回合打出第3张攻击牌时，本场战斗获得1层火力。'),
  EQ('R24', 'uncommon', '残骸引爆器', '你每消耗一张牌，对随机一名敌人造成3点伤害。'),
  EQ('R25', 'uncommon', '行军睡袋', '在休整点回复生命时额外回复10点。'),
  EQ('R26', 'uncommon', '快速弹匣', '回合结束时，手牌中费用最高的一张牌保留到下回合。'),
  EQ('R27', 'uncommon', '信号标记器', '你每次给予易伤时额外+1层。'),
  EQ('R28', 'uncommon', '战术背包', '每场战斗第1回合多抽2张牌。'),
  EQ('R29', 'uncommon', '预案卡', '每场战斗开始时，手牌中费用最高的一张牌本回合0费。'),
  // Rare
  EQ('R06', 'rare', '通讯耳机', '每回合开始时多抽1张牌。'),
  EQ('R12', 'rare', '应急能量包', '每场战斗开始时获得2点能量。'),
  EQ('R30', 'rare', '双发扳机', '每回合打出的第一张攻击牌，其效果额外结算一次。'),
  EQ('R31', 'rare', '抗冲击背心', '每场战斗中你第一次因敌人攻击失去生命时，改为只失去1点。'),
  EQ('R32', 'rare', '冷静头脑', '回合结束时未用完的能量保留到下回合。'),
  EQ('R33', 'rare', '燃烧弹改装', '你每次给予燃烧时额外+2层。'),
  EQ('R34', 'rare', '急救自注射器', '本局第一次生命归零时，改为回复至最大生命的一半（仅一次）。'),
  EQ('R35', 'rare', '战术沙盘', '回合开始抽牌后，若手牌中没有攻击牌，从抽牌堆取1张攻击牌加入手牌。'),
  // Shop exclusive
  EQ('R09', 'shop', '战术手册', '每次进入补给站，第一次删牌免费。'),
  EQ('R36', 'shop', '供应商会员卡', '补给站所有商品价格-20%。'),
  EQ('R37', 'shop', '战术折叠刀', '每场战斗开始时将1张「飞刀」加入手牌。'),
  EQ('R38', 'shop', '扩容战术背心', '补给品栏位+2。'),
  // Boss (幕末决战后三选一): strong, most with a cost.
  EQ('R40', 'boss', '超频战术背包', '每回合能量+1；每回合少抽1张牌。', { energy: 1 }),
  EQ('R41', 'boss', '静默通讯协议', '每回合能量+1；看不到对手意图。', { energy: 1 }),
  EQ('R42', 'boss', '无休整合同', '每回合能量+1；休整点不能回复生命。', { energy: 1 }),
  EQ('R43', 'boss', '全频战术耳麦', '每回合多抽1张牌；每场战斗开始时将2张「失误」洗入抽牌堆。'),
  EQ('R44', 'boss', '极限作战协议', '每回合能量+1；每场战斗开始时失去5点生命。', { energy: 1 }),
  EQ('R45', 'boss', '定量火力协议', '每回合能量+1；每回合最多打出6张牌。', { energy: 1 }),
  EQ('R46', 'boss', '加固工事组件', '回合开始时布防不再清空，只减少15点。'),
  EQ('R47', 'boss', '悬赏猎手合同', '精英战敌人生命+25%；精英战胜利后额外获得1件装备。'),
  EQ('R48', 'boss', '零薪合约', '每回合能量+1；战斗胜利不再获得金币。', { energy: 1 }),
  EQ('R49', 'boss', '过载处理器', '每回合能量+1；每回合开始抽牌后随机弃掉1张手牌。', { energy: 1 }),
  EQ('R50', 'boss', '战术复盘系统', '获得时随机升级牌组中的4张牌。')
]);
export const RELIC_IDS_BY_TIER = Object.fromEntries(Object.keys(EQUIP_TIERS).map(t => [t, Object.keys(RELICS).filter(id => RELICS[id].tier === t)]));

// ----------------------------- Supplies (补给品) -----------------------------
// One-use combat items. target: 'enemy' needs a chosen enemy when 2+ are alive.
// `effects` reuse card effect types; a few special types live in the engine.
export const SUPPLY_SLOTS = 3;
const SP = (id, rarity, name, desc, effects, target = 'none') => [id, { id, rarity, name, desc, effects, target }];
export const SUPPLIES = Object.fromEntries([
  SP('P01', 'common', '急救注射器', '回复12点生命。', [heal(12)]),
  SP('P02', 'common', '肾上腺素针', '本回合获得2点能量。', [energy(2)]),
  SP('P03', 'common', '电击手雷', '对所有敌人造成10点伤害。', [atkAll(10)]),
  SP('P04', 'common', '穿甲弹匣', '本回合你的攻击每段伤害+4。', [{ type: 'tempAttack', n: 4 }]),
  SP('P05', 'common', '烟雾罐', '给予一名敌人4层烟雾。', [smoke(4)], 'enemy'),
  SP('P06', 'common', '情报平板', '抽3张牌。', [draw(3)]),
  SP('P07', 'common', '防弹插板', '获得12点布防。', [{ type: 'rawBlock', n: 12 }]),
  SP('P08', 'common', '闪光弹', '给予一名敌人2层闪光。', [flash(2)], 'enemy'),
  SP('P09', 'common', '破甲弹', '给予一名敌人3层易伤。', [vuln(3)], 'enemy'),
  SP('P10', 'uncommon', '神经增强剂', '本场战斗获得2层火力。', [strength(2)]),
  SP('P11', 'uncommon', '止血凝胶', '回复8点生命，并清除自身压制与易伤。', [heal(8), { type: 'cleansePlayer' }]),
  SP('P12', 'uncommon', '干扰器', '清除一名敌人的全部火力与布防。', [{ type: 'disarm' }], 'enemy'),
  SP('P13', 'uncommon', '燃烧瓶', '给予所有敌人5层燃烧。', [burnAll(5)]),
  SP('P14', 'uncommon', '战术无人机', '部署一门哨戒炮：3回合内，每回合结束时对生命最低的敌人造成6点伤害。', [deploy('turret', 6, 3)]),
  SP('P15', 'uncommon', '抑制弹', '给予一名敌人2层压制。', [weak(2)], 'enemy'),
  SP('P16', 'rare', '战场补给包', '发现：从3张随机牌中选1张加入手牌，本回合0费。', [discover('any')]),
  SP('P17', 'rare', '静默信号弹', '本回合所有敌人不执行意图。', [{ type: 'silenceEnemies' }]),
  SP('P18', 'rare', '双倍弹药', '本回合你打出的下一张牌，其效果额外结算一次。', [{ type: 'replayNext' }])
]);
export const SUPPLY_IDS = Object.keys(SUPPLIES);

// ----------------------------- describe function -----------------------------
export function describe(card) {
  const c = CARDS[card.id] || STATUS_CARDS[card.id] || card;
  const typeMap = { attack:'攻击', skill:'技能', power:'能力', status:'状态' };
  const rarityMap = { common:'普通', uncommon:'罕见', rare:'稀有' };
  const tagMap = { basic:'基础通用', damage:'交火输出', utility:'战术道具', stance:'掩护前压', core:'构筑核心', hybrid:'混搭连接', response:'应对调度', status:'特殊', curse:'俱乐部隐患' };
  const parts = [];
  parts.push(c.name);
  parts.push(`[${c.cost}费 ${typeMap[c.type]||c.type} ${tagMap[c.tag]||c.tag} ${rarityMap[c.rarity]||c.rarity}${c.exhaust?' 消耗':''}${c.upgradeEffects?.length?' 可升级':''}]`);
  parts.push(card.up && c.upgradeText ? c.upgradeText : c.text);
  return parts.join(' ');
}
