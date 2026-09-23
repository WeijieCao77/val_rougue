// new-demo/content.js
// Tactical action pool with all effects described from structured data.

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

// ----------------------------- Effect formatting -----------------------------
function formatEffects(effects) {
  if (!effects || effects.length === 0) return '';
  const parts = [];
  for (const eff of effects) {
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
    stance_changed_this_turn: '本回合切换过姿态'
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
    dark_embrace: '每消耗一张牌，抽1张牌'
  };
  return map[powerId] || '';
}

// ----------------------------- Card definition helper -----------------------------
function def(card) {
  if (card.type === 'status') {
    // For status cards, no effects, just fixed text.
    STATUS_CARDS[card.id] = card;
  } else {
    // Generate text from effects, unless power then use powerDesc.
    if (card.type === 'power') {
      card.text = `能力：${powerDesc(card.power)}`;
      card.upgradeText = card.upgradePowerText;
    } else {
      card.text = formatEffects(card.effects);
      if (card.upgradeEffects && card.upgradeEffects.length) {
        card.upgradeText = formatEffects(card.upgradeEffects);
      } else {
        card.upgradeText = undefined;
      }
    }
    CARDS[card.id] = card;
    CARD_IDS.push(card.id);
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
  { id:'TA10', name:'正面突击', cost:2, type:'attack', tag:'basic', rarity:'common', effects:[atk(8), weak(1)], upgradeEffects:[atk(11), weak(2)] },
  { id:'TA11', name:'巩固防线', cost:2, type:'skill', tag:'basic', rarity:'uncommon', effects:[weak(2), block(11)], upgradeEffects:[weak(3), block(14)] },
  { id:'TA12', name:'烟墙掩护', cost:1, type:'skill', tag:'basic', rarity:'common', effects:[smoke(3), block(3)], upgradeEffects:[smoke(4), block(4)] },
  { id:'TA13', name:'闪光突破', cost:1, type:'attack', tag:'basic', rarity:'common', effects:[flash(1), atk(4)], upgradeEffects:[flash(2), atk(6)] },
  { id:'TA14', name:'队伍集结', cost:0, type:'skill', tag:'basic', rarity:'common', effects:[block(2)], upgradeEffects:[block(4)] },
  { id:'TA15', name:'快速转点', cost:0, type:'skill', tag:'basic', rarity:'common', effects:[draw(1)], upgradeEffects:[draw(2)] },
  { id:'TA16', name:'基础侦察', cost:1, type:'skill', tag:'utility', rarity:'common', effects:[draw(2)], upgradeEffects:[draw(3)] },
  { id:'TA17', name:'基础封锁', cost:1, type:'skill', tag:'utility', rarity:'common', effects:[smoke(3)], upgradeEffects:[smoke(4)] },
  { id:'TA18', name:'基础恢复', cost:1, type:'skill', tag:'basic', rarity:'common', effects:[heal(4)], upgradeEffects:[heal(7)] },

  // Firefight & damage components (14)
  { id:'TA19', name:'精准补枪', cost:1, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(9)], upgradeEffects:[atk(13)] },
  { id:'TA20', name:'双发补枪', cost:2, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(6,2)], upgradeEffects:[atk(8,2)] },
  { id:'TA21', name:'致命补枪', cost:3, type:'attack', tag:'damage', rarity:'rare', effects:[atk(16), conditional('enemy_smoke_or_flash', atk(10)), draw(1)], upgradeEffects:[atk(20), conditional('enemy_smoke_or_flash', atk(12)), draw(1)] },
  { id:'TA22', name:'破片手雷', cost:1, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(5), vuln(2)], upgradeEffects:[atk(7), vuln(2)] },
  { id:'TA23', name:'燃烧瓶', cost:2, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(14), weak(1), exhaustSelf()], exhaust: true, upgradeEffects:[atk(17), weak(2), exhaustSelf()] },
  { id:'TA24', name:'扫射压制', cost:2, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(5,3)], upgradeEffects:[atk(6,3)] },
  { id:'TA25', name:'爆头一击', cost:2, type:'attack', tag:'damage', rarity:'rare', effects:[atk(18)], upgradeEffects:[atk(24)] },
  { id:'TA26', name:'残局收割', cost:1, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(8), conditional('enemy_smoke', atk(8))], upgradeEffects:[atk(10), conditional('enemy_smoke', atk(10))] },
  { id:'TA27', name:'穿墙射击', cost:1, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(9), draw(1)], upgradeEffects:[atk(10), draw(2)] },
  { id:'TA28', name:'警戒射击', cost:1, type:'attack', tag:'damage', rarity:'common', effects:[atk(7)], upgradeEffects:[atk(10)] },
  { id:'TA29', name:'预瞄点射', cost:1, type:'attack', tag:'damage', rarity:'uncommon', effects:[atk(6), block(3)], upgradeEffects:[atk(8), block(4)] },
  { id:'TA30', name:'反架点', cost:2, type:'attack', tag:'damage', rarity:'rare', effects:[purgeEnemyStatus('block', 12), atk(14), exhaustSelf()], exhaust: true, upgradeEffects:[purgeEnemyStatus('block', 18), atk(17), exhaustSelf()] },
  { id:'TA31', name:'快攻连射', cost:1, type:'attack', tag:'damage', rarity:'common', effects:[atk(4,2)], upgradeEffects:[atk(6,2)] },
  { id:'TA32', name:'重火力压制', cost:3, type:'attack', tag:'damage', rarity:'rare', effects:[atk(18), weak(2), block(5)], upgradeEffects:[atk(24), weak(2), block(7)] },

  // Tactical utility (12)
  { id:'TA33', name:'烟雾弹', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[smoke(4)], upgradeEffects:[smoke(6)] },
  { id:'TA34', name:'闪光弹', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[flash(4)], upgradeEffects:[flash(6)] },
  { id:'TA35', name:'侦察无人机', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[draw(2), block(2)], upgradeEffects:[draw(3), block(3)] },
  { id:'TA36', name:'区域封锁', cost:2, type:'skill', tag:'utility', rarity:'uncommon', effects:[smoke(5), block(5)], upgradeEffects:[smoke(7), block(7)] },
  { id:'TA37', name:'诱饵陷阱', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[vuln(2), block(4)], upgradeEffects:[vuln(3), block(6)] },
  { id:'TA38', name:'信息干扰', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[weak(2), draw(1)], upgradeEffects:[weak(3), draw(1)] },
  { id:'TA39', name:'突破烟雾', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[smoke(2), atk(4)], upgradeEffects:[smoke(3), atk(6)] },
  { id:'TA40', name:'闪光掩护', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[flash(2), block(4)], upgradeEffects:[flash(3), block(6)] },
  { id:'TA41', name:'烟闪协同', cost:2, type:'attack', tag:'utility', rarity:'rare', effects:[conditional('enemy_smoke_or_flash', atk(12))], upgradeEffects:[conditional('enemy_smoke_or_flash', atk(16))] },
  { id:'TA42', name:'战术雷达', cost:0, type:'skill', tag:'utility', rarity:'uncommon', effects:[draw(1), block(1)], upgradeEffects:[draw(2), block(2)] },
  { id:'TA43', name:'道具回收', cost:1, type:'skill', tag:'utility', rarity:'rare', effects:[draw(2), energy(2)], upgradeEffects:[draw(3), energy(2)] },
  { id:'TA44', name:'全息诱饵', cost:1, type:'skill', tag:'utility', rarity:'uncommon', effects:[weak(3)], upgradeEffects:[weak(5)] },

  // Cover & push stance (8)
  { id:'TA45', name:'进入掩护', cost:1, type:'skill', tag:'stance', rarity:'uncommon', effects:[stanceSwitch(), block(8)], upgradeEffects:[stanceSwitch(), block(12)] },
  { id:'TA46', name:'前压突破', cost:1, type:'attack', tag:'stance', rarity:'uncommon', effects:[stanceSwitch(), atk(8)], upgradeEffects:[stanceSwitch(), atk(12)] },
  { id:'TA47', name:'掩护烟雾', cost:2, type:'skill', tag:'stance', rarity:'uncommon', effects:[stanceSwitch(), smoke(3), block(4)], upgradeEffects:[stanceSwitch(), smoke(4), block(6)] },
  { id:'TA48', name:'前压闪光', cost:2, type:'attack', tag:'stance', rarity:'uncommon', effects:[stanceSwitch(), flash(2), atk(6)], upgradeEffects:[stanceSwitch(), flash(3), atk(9)] },
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
  { id:'TA65', name:'补枪换防', cost:2, type:'attack', tag:'hybrid', rarity:'rare', effects:[atk(10), block(6)], upgradeEffects:[atk(14), block(9)] },
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
  { id:'TA87', name:'消耗复盘', cost:2, upgradeCost:1, type:'power', tag:'response', rarity:'rare', power:'dark_embrace', effects:[], upgradeEffects:[] }
];

defs.forEach(c => def(c));

// ----------------------------- Status cards -----------------------------
def({ id:'ST01', name:'失误', cost:0, type:'status', tag:'status', rarity:'common', text:'不可打出。弃掉时受到1点伤害', effects:[] });
def({ id:'ST02', name:'犹豫', cost:0, type:'status', tag:'status', rarity:'common', text:'不可打出。弃掉时受到2点伤害', effects:[] });
def({ id:'ST03', name:'暴露', cost:0, type:'status', tag:'status', rarity:'common', text:'不可打出。弃掉时受到3点伤害', effects:[] });

// ----------------------------- Teams -----------------------------
export const TEAMS = {
  breach:   { id:'breach',   name:'突破',  desc:'初始牌组倾向高攻击与前压。', startingDeck:[['TA01',2],['TA05',1],['TA10',1],['TA19',1],['TA28',1],['TA46',1],['TA02',1],['TA06',1],['TA07',1]] },
  anchor:   { id:'anchor',   name:'架点',  desc:'初始牌组倾向布防与掩护。', startingDeck:[['TA02',2],['TA06',1],['TA11',1],['TA45',1],['TA08',1],['TA29',1],['TA65',1],['TA01',1],['TA07',1]] },
  utility:  { id:'utility',  name:'道具协同', desc:'初始牌组倾向烟雾闪光配合。', startingDeck:[['TA13',1],['TA39',1],['TA60',1],['TA61',1],['TA41',1],['TA04',1],['TA12',1],['TA40',1],['TA66',1],['TA07',1]] },
  rotation: { id:'rotation', name:'调度',  desc:'初始牌组倾向抽牌与能量。', startingDeck:[['TA01',1],['TA05',1],['TA28',1],['TA02',1],['TA08',1],['TA07',1],['TA09',1],['TA42',1],['TA74',1],['TA73',1]] }
};

// ----------------------------- Enemies (at least 12 distinct teams across acts) -----------------------------
export const ENEMIES = {
  // Act 1
  E01: { name:'基础进攻小队', hp:40, script:[[{type:'hit',n:7,times:1}],[{type:'hit',n:9,times:1}],[{type:'block',n:4},{type:'hit',n:7,times:1}]] },
  E02: { name:'信息压制小队', hp:44, script:[[{type:'hit',n:6,times:1}],[{type:'jam',id:'ST01',n:1},{type:'hit',n:6,times:1}],[{type:'hit',n:10,times:1}]] },
  E03: { name:'多段突击小队', hp:48, script:[[{type:'hit',n:3,times:3}],[{type:'hit',n:8,times:1}],[{type:'block',n:5},{type:'hit',n:7,times:1}]] },
  E04: { name:'防守反击小队', hp:46, script:[[{type:'block',n:8},{type:'hit',n:5,times:1}],[{type:'hit',n:12,times:1}],[{type:'jam',id:'ST03',n:1},{type:'hit',n:7,times:1}]] },
  E05: { name:'纪律控制小队', hp:52, script:[[{type:'weak',n:1}],[{type:'hit',n:10,times:1}],[{type:'block',n:8},{type:'hit',n:8,times:1}]] },
  EL01:{ name:'高压强敌小队', hp:72, elite:true, script:[[{type:'hit',n:9,times:1},{type:'jam',id:'ST03',n:1}],[{type:'hit',n:4,times:3}],[{type:'block',n:12},{type:'jam',id:'ST02',n:1}]] },
  B01: { name:'资格赛冠军卫队', hp:110, boss:true, script:[[{type:'weak',n:1},{type:'hit',n:6,times:1}],[{type:'jam',id:'ST02',n:2},{type:'block',n:10}],[{type:'hit',n:4,times:3}],[{type:'hit',n:12,times:1}]] },

  // Act 2
  A2_E01: { name:'第二幕基础进攻小队', hp:48, script:[[{type:'hit',n:10,times:1}],[{type:'hit',n:12,times:1}],[{type:'block',n:6},{type:'hit',n:7,times:1}]] },
  A2_E02: { name:'第二幕信息压制小队', hp:52, script:[[{type:'hit',n:10,times:1}],[{type:'jam',id:'ST01',n:1},{type:'hit',n:8,times:1}],[{type:'hit',n:13,times:1}]] },
  A2_E03: { name:'第二幕多段突击小队', hp:56, script:[[{type:'hit',n:4,times:3}],[{type:'hit',n:11,times:1}],[{type:'block',n:7},{type:'hit',n:8,times:1}]] },
  A2_E04: { name:'第二幕防守反击小队', hp:54, script:[[{type:'block',n:11},{type:'hit',n:5,times:1}],[{type:'hit',n:16,times:1}],[{type:'jam',id:'ST03',n:1},{type:'hit',n:9,times:1}]] },
  A2_E05: { name:'第二幕纪律控制小队', hp:60, script:[[{type:'weak',n:1}],[{type:'hit',n:14,times:1}],[{type:'block',n:9},{type:'hit',n:9,times:1}]] },
  A2_EL01:{ name:'第二幕强敌小队', hp:72, elite:true, script:[[{type:'hit',n:11,times:1},{type:'jam',id:'ST03',n:1}],[{type:'hit',n:5,times:3}],[{type:'block',n:14},{type:'jam',id:'ST02',n:1}]] },
  A2_B01:{ name:'晋级赛冠军卫队', hp:110, boss:true, script:[[{type:'weak',n:1},{type:'hit',n:8,times:1}],[{type:'jam',id:'ST02',n:2},{type:'block',n:12}],[{type:'hit',n:5,times:3}],[{type:'hit',n:16,times:1}]] },

  // Act 3
  A3_E01: { name:'第三幕基础进攻小队', hp:64, script:[[{type:'hit',n:13,times:1}],[{type:'hit',n:16,times:1}],[{type:'block',n:8},{type:'hit',n:10,times:1}]] },
  A3_E02: { name:'第三幕信息压制小队', hp:70, script:[[{type:'hit',n:13,times:1}],[{type:'jam',id:'ST01',n:2},{type:'hit',n:11,times:1}],[{type:'hit',n:17,times:1}]] },
  A3_E03: { name:'第三幕多段突击小队', hp:76, script:[[{type:'hit',n:5,times:3}],[{type:'hit',n:15,times:1}],[{type:'block',n:9},{type:'hit',n:11,times:1}]] },
  A3_E04: { name:'第三幕防守反击小队', hp:72, script:[[{type:'block',n:14},{type:'hit',n:7,times:1}],[{type:'hit',n:20,times:1}],[{type:'jam',id:'ST03',n:2},{type:'hit',n:12,times:1}]] },
  A3_E05: { name:'第三幕纪律控制小队', hp:82, script:[[{type:'weak',n:2}],[{type:'hit',n:18,times:1}],[{type:'block',n:12},{type:'hit',n:12,times:1}]] },
  A3_EL01:{ name:'第三幕强敌小队', hp:96, elite:true, script:[[{type:'hit',n:14,times:1},{type:'jam',id:'ST03',n:2}],[{type:'hit',n:6,times:3}],[{type:'block',n:18},{type:'jam',id:'ST02',n:2}]] },
  A3_B01:{ name:'总决赛冠军卫队', hp:145, boss:true, script:[[{type:'hit',n:12,times:1},{type:'jam',id:'ST03',n:1}],[{type:'weak',n:1},{type:'hit',n:5,times:3}],[{type:'block',n:16},{type:'jam',id:'ST01',n:2}],[{type:'hit',n:20,times:1}]] }
};

// ----------------------------- Relics -----------------------------
export const RELICS = {
  R01: { id:'R01', name:'随队医生', desc:'战斗结束后恢复8点生命。' },
  R02: { id:'R02', name:'备用弹夹', desc:'每场战斗开始时抽1张牌。' },
  R03: { id:'R03', name:'战术平板', desc:'每场战斗开始时获得1点能量。' },
  R04: { id:'R04', name:'烟雾发生器', desc:'每场战斗开始时给予敌人3层烟雾。' },
  R05: { id:'R05', name:'闪光发生器', desc:'每场战斗开始时给予敌人3层闪光。' },
  R06: { id:'R06', name:'通讯耳机', desc:'每回合抽牌数+1（上限10）。' },
  R07: { id:'R07', name:'护甲板', desc:'获得时最大生命+8。' },
  R08: { id:'R08', name:'奖金加成', desc:'非战斗节点获得金币+15。' },
  R09: { id:'R09', name:'战术手册', desc:'商店首次删牌免费。' },
  R10: { id:'R10', name:'旧战术笔记', desc:'获得时随机获得一张基础牌。' },
  R11: { id:'R11', name:'冠军戒指', desc:'每回合开始时获得2点布防。' },
  R12: { id:'R12', name:'幸运护符', desc:'每场战斗开始时获得2点能量。' }
};

// ----------------------------- describe function -----------------------------
export function describe(card) {
  const c = CARDS[card.id] || STATUS_CARDS[card.id] || card;
  const typeMap = { attack:'攻击', skill:'技能', power:'能力', status:'状态' };
  const rarityMap = { common:'普通', uncommon:'罕见', rare:'稀有' };
  const tagMap = { basic:'基础通用', damage:'交火输出', utility:'战术道具', stance:'掩护前压', core:'构筑核心', hybrid:'混搭连接', response:'应对调度', status:'特殊' };
  const parts = [];
  parts.push(c.name);
  parts.push(`[${c.cost}费 ${typeMap[c.type]||c.type} ${tagMap[c.tag]||c.tag} ${rarityMap[c.rarity]||c.rarity}${c.exhaust?' 消耗':''}${c.upgradeEffects?.length?' 可升级':''}]`);
  parts.push(card.up && c.upgradeText ? c.upgradeText : c.text);
  return parts.join(' ');
}
