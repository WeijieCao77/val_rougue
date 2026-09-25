// Season "rules 1" catalog for the Wa demo: region traits, the sponsor signing day
// (opening choice), difficulty levels, club equipment and tactical supplies.
// Pure data + text. The engine implements every effect; texts describe what happens,
// never how to build. Designed after the *ideas* behind Slay the Spire's starter
// relics, Neow, Ascension, relics and potions — not copies of their effects or numbers.
import {SKINS} from './content.js';

// Runs created with rules >= 1 get traits, the opening, equipment and supplies.
// Older saves and server records without `rules` replay exactly as before.
export const RULES_VERSION = 4;
// Rules 3 (2026-09-24): group fights, weak/strong encounter pools, three boss
// candidates per act, keyword cards. Rules 1 stays accepted so its records replay.
// Rules 4 (2026-09-25): rules 3 with an easier first act (ENEMY_TUNING_V4) after
// players died before the act-1 boss. Rules 1 and 3 records replay unchanged.
export const RULES_VERSIONS = [1, 3, 4];
export const ROLES = ['决斗','哨位','控场','先锋','自由人'];

// Numbers live here so the engine, PvP and the displayed text never disagree.
export const TRAIT_TUNING = {
 CN:{roles:3,energy:2,draw:1},
 AM:{nth:2,bonus:3,vuln:1,perHit:true},
 EMEA:{block:2,draw:1},
 PAC:{every:3,energy:1,draw:0}
};
const T = TRAIT_TUNING;
export const REGION_TRAITS = {
 CN:{name:'团队协同',icon:'team',text:`每回合打出第 ${T.CN.roles} 种不同定位（决斗／哨位／控场／先锋／自由人）的选手牌时，获得 ${T.CN.energy} 行动点并抽 ${T.CN.draw} 张牌。每回合一次。`},
 AM:{name:'连续进攻',icon:'chain',text:`每回合第 ${T.AM.nth} 张带伤害效果的牌：${T.AM.perHit?'每段':'首段'}伤害 +${T.AM.bonus}，结算后对手易伤 ${T.AM.vuln} 回合。`},
 EMEA:{name:'压制反打',icon:'counter',text:`对手处于压制时，你每次获得布防额外 +${T.EMEA.block}。每回合第一次让对手陷入压制时，抽 ${T.EMEA.draw} 张牌。`},
 PAC:{name:'临时战术',icon:'improv',text:`你的每个回合开始时，手牌加入 1 张临时牌（补枪与临时部署轮流）。本场每打出 ${T.PAC.every} 张临时牌，获得 ${T.PAC.energy} 行动点${T.PAC.draw?`并抽 ${T.PAC.draw} 张牌`:''}。`}
};

// Cumulative: level N includes every rule of levels 1..N.
export const ASCENSION_LEVELS = [
 {level:0,text:'标准赛季规则。'},
 {level:1,text:'路线图上出现更多高压强敌。'},
 {level:2,text:'普通对手的攻击伤害 +10%。'},
 {level:3,text:'强敌的攻击伤害 +15%。'},
 {level:4,text:'Boss 的攻击伤害 +10%。'},
 {level:5,text:'俱乐部活动「粉丝见面会」回复由 30% 降为 20%。'},
 {level:6,text:'开局声望降低 10%（最大声望不变）。'},
 {level:7,text:'普通对手的防线 +10%。'},
 {level:8,text:'强敌与 Boss 的防线 +10%。'},
 {level:9,text:'开局牌组加入 1 张随机俱乐部隐患。'},
 {level:10,text:'Boss 开局获得 3 层火力。'}
];
export const MAX_ASCENSION = 10;

export const OPENING_OPTIONS = {
 hp8:{kind:'free',title:'体能赞助',text:'最大声望 +8，当前声望 +8。'},
 money80:{kind:'free',title:'签约奖金',text:'资金 +80。'},
 remove1:{kind:'free',title:'阵容精简',text:'从牌组中选择 1 张牌永久移除。'},
 train1:{kind:'free',title:'季前集训',text:'选择 1 张牌完成训练（升级）。'},
 recruit23:{kind:'free',title:'青训推荐',text:'从 3 名 2–3 费选手中招募 1 名。'},
 hpForGear:{kind:'trade',title:'高强度商业赛',text:'失去 10% 最大声望（向上取整），获得 1 件随机罕见装备。'},
 curseForStar:{kind:'trade',title:'豪门注资',text:'加入 1 张随机俱乐部隐患；资金 +150，并从 3 名 3 费选手中招募 1 名。'},
 moneyForTrain:{kind:'trade',title:'全员加练',text:'失去全部资金，选择 2 张牌完成训练。'},
 trainRandom:{kind:'basic',title:'常规合同',text:'随机训练 1 张初始牌。'}
};
export const OPENING_FREE = ['hp8','money80','remove1','train1','recruit23'];
export const OPENING_TRADE = ['hpForGear','curseForStar','moneyForTrain'];

export const RARITY = {common:'普通',uncommon:'罕见',rare:'稀有',boss:'Boss 专属',shop:'市场专属'};
const skin = id => ({name:SKINS[id].name,rarity:'common',icon:'block',text:SKINS[id].text});
// Club equipment. SK01–SK03 are the original skins (kept in s.skins for PvP snapshots).
export const GEAR = {
 SK01:skin('SK01'),SK02:{...skin('SK02'),icon:'draw'},SK03:{...skin('SK03'),icon:'block'},
 GR01:{name:'防弹头盔',rarity:'common',icon:'block',text:'获得时：最大声望 +7，当前声望 +7。'},
 GR02:{name:'战术挂包',rarity:'common',icon:'draw',text:'每场比赛第一回合多抽 2 张牌。'},
 GR03:{name:'赛后理疗',rarity:'common',icon:'heal',text:'每赢下一场比赛，回复 3 声望。'},
 GR04:{name:'战术手套',rarity:'common',icon:'overload',text:'每场比赛第一回合行动点 +1。'},
 GR05:{name:'校准瞄具',rarity:'common',icon:'vuln',text:'每场比赛开始时，对手易伤 1 回合。'},
 GR06:{name:'闪光弹挂架',rarity:'common',icon:'weak',text:'每场比赛开始时，对手压制 1 回合。'},
 GR07:{name:'奖金分成',rarity:'common',icon:'coin',text:'每赢下一场比赛，额外获得 8 资金。'},
 GR08:{name:'沙袋掩体',rarity:'common',icon:'block',text:'每场比赛第一回合获得 8 布防。'},
 GR09:{name:'战术护膝',rarity:'common',icon:'block',text:'回合结束时若布防为 0，获得 4 布防。'},
 GR10:{name:'备用飞刀',rarity:'common',icon:'damage',text:'每场比赛第一回合，手牌加入 1 张飞刀（0 费，4 伤害，临时）。'},
 GR11:{name:'握把胶带',rarity:'common',icon:'strength',text:'每场比赛开始时获得 1 层火力（本场）。'},
 GR20:{name:'降噪耳机',rarity:'uncommon',icon:'block',text:'每场比赛第一次因对手攻击失去声望时，至多失去 1。'},
 GR21:{name:'战术计数器',rarity:'uncommon',icon:'tempo',counter:true,text:'每累计打出 10 张牌，获得 1 行动点（跨比赛累计）。'},
 GR22:{name:'战术记事本',rarity:'uncommon',icon:'retain',text:'回合结束时，保留手中费用最高的 1 张可打出的牌（同费取最左）。临时牌除外。'},
 GR23:{name:'连射扳机',rarity:'uncommon',icon:'strength',text:'每回合第 3 张带伤害效果的牌结算后，获得 1 层火力（本场）。'},
 GR24:{name:'指挥平板',rarity:'uncommon',icon:'damage',text:'每回合第 3 张不带伤害效果的牌结算后，对对手造成 5 伤害。'},
 GR25:{name:'理疗枕',rarity:'uncommon',icon:'heal',text:'粉丝见面会额外回复 10 声望。'},
 GR26:{name:'数据分析仪',rarity:'uncommon',icon:'cards',text:'比赛胜利后的招募候选多 1 名。'},
 GR27:{name:'战地医疗包',rarity:'uncommon',icon:'heal',text:'赢下比赛时，若声望不高于最大值的一半，回复 12 声望。'},
 GR28:{name:'教练哨子',rarity:'uncommon',icon:'heal',text:'Boss 战开始时回复 20 声望。'},
 GR40:{name:'双持训练',rarity:'rare',icon:'combo',text:'每回合第一张决斗牌的效果额外结算一次。'},
 GR41:{name:'燃烧弹挂袋',rarity:'rare',icon:'burn',text:'每当一张牌被消耗，对对手造成 3 伤害。'},
 GR42:{name:'复合装甲',rarity:'rare',icon:'block',text:'回合开始时布防最多失去 10 点，其余保留。'},
 GR43:{name:'应急预案',rarity:'rare',icon:'heal',text:'声望第一次降到 0 时，改为恢复至最大声望的 50%。之后失效。'},
 GR44:{name:'冷静呼吸',rarity:'rare',icon:'overload',text:'回合结束时未用完的行动点保留到下回合。'},
 GR45:{name:'战术耳麦',rarity:'rare',icon:'block',text:'每次失去声望时少失去 1。'},
 GR46:{name:'狙击镜',rarity:'rare',icon:'vuln',text:'对手易伤时，你的攻击伤害 +75%（而非 +50%）。'},
 GR60:{name:'会员积分卡',rarity:'shop',icon:'coin',text:'转会市场的所有价格 -25%（向下取整）。'},
 GR61:{name:'补给背包',rarity:'shop',icon:'supply',text:'补给品栏位 +2。'},
 GR62:{name:'队医随行',rarity:'shop',icon:'heal',text:'每次使用补给品时回复 5 声望。'},
 GR63:{name:'分析师工作台',rarity:'shop',icon:'strength',text:'强敌与 Boss 战开始时获得 2 层火力（本场）。'},
 BX01:{name:'赞助商超频合同',rarity:'boss',icon:'overload',text:'每回合行动点 +1。每场比赛开始时，对手获得 1 层火力。'},
 BX02:{name:'封闭训练协议',rarity:'boss',icon:'overload',text:'每回合行动点 +1。俱乐部活动不能再回复声望。'},
 BX03:{name:'信息封锁耳机',rarity:'boss',icon:'overload',text:'每回合行动点 +1。你看不到对手意图。'},
 BX04:{name:'全额奖金合同',rarity:'boss',icon:'overload',text:'每回合行动点 +1。赢下比赛不再获得资金。'},
 BX05:{name:'战术纪律守则',rarity:'boss',icon:'overload',text:'每回合行动点 +1。每回合最多打出 6 张牌。'},
 BX06:{name:'高强度赛程',rarity:'boss',icon:'overload',text:'每回合行动点 +1。每场比赛开始时，把 2 张疲劳洗入抽牌堆。'},
 BX07:{name:'精英选拔制',rarity:'boss',icon:'overload',text:'每回合行动点 +1。比赛胜利后的招募候选少 1 名。'},
 BX08:{name:'禁用补给协议',rarity:'boss',icon:'overload',text:'每回合行动点 +1。不能再获得补给品。'},
 BX09:{name:'冻结训练计划',rarity:'boss',icon:'overload',text:'每回合行动点 +1。俱乐部活动不能再训练。'},
 BX10:{name:'战术预判系统',rarity:'boss',icon:'retain',text:'回合结束时不再弃置手牌（比赛干扰与俱乐部隐患除外）。'},
 BX11:{name:'深度数据库',rarity:'boss',icon:'draw',text:'每回合多抽 2 张牌。每回合结束时直接失去 1 声望。'}
};
// ---- Economy rules 1 (s.econ): unlock tiers, skip compensation, club investments,
// market rerolls. Seasons without `econ` (older saves and server records) replay as before.
export const ECON_VERSION = 1;
// Equipment batches opened by unlock tiers 1–5 (everything else is in the base pool).
export const GEAR_UNLOCKS = [
 ['GR09','GR23','GR41'],
 ['GR10','GR24','GR63'],
 ['GR11','GR22','GR44'],
 ['GR05','GR21','BX10'],
 ['GR46','GR40','BX11']
];
// Skipping a recruit: 15 funds, or one free reroll of a later market's transfer list.
export const SKIP_FUNDS = 15;
export const REROLL_BASE = 20;
export const REROLL_STEP = 10;
// Club investments: one random offer per market visit, each bought once per season.
export const INVESTMENTS = {
 IV01:{name:'球探网络',price:200,icon:'cards',text:'比赛胜利后的招募候选多 1 名。'},
 IV02:{name:'康复中心',price:160,icon:'heal',text:'粉丝见面会额外回复最大声望的 10%。'},
 IV03:{name:'经纪人团队',price:180,icon:'coin',text:'转会市场的转会名单多 1 个货位。'},
 IV04:{name:'赛前分析室',price:220,icon:'draw',text:'每场比赛第一回合多抽 1 张牌。'},
 IV05:{name:'后勤车队',price:150,icon:'supply',text:'强敌比赛胜利后，多进行一次补给品掉落判定。'}
};
export const ENERGY_GEAR = ['BX01','BX02','BX03','BX04','BX05','BX06','BX07','BX08','BX09'];
export const gearName = id => GEAR[id]?.name || SKINS[id]?.name || id;

export const SUPPLY_RARITY_WEIGHTS = {common:65,uncommon:25,rare:10};
export const SUPPLIES = {
 SP01:{name:'急救注射器',rarity:'common',icon:'heal',text:'回复 10 声望。'},
 SP02:{name:'肾上腺素针',rarity:'uncommon',icon:'overload',text:'本回合行动点 +2。'},
 SP03:{name:'电击手雷',rarity:'common',icon:'damage',text:'对对手造成 12 伤害。'},
 SP04:{name:'穿甲弹匣',rarity:'common',icon:'strength',text:'本回合获得 4 层火力。'},
 SP05:{name:'战术平板',rarity:'common',icon:'draw',text:'抽 3 张牌。'},
 SP06:{name:'防弹插板',rarity:'common',icon:'block',text:'获得 12 布防。'},
 SP07:{name:'神经增强剂',rarity:'uncommon',icon:'strength',text:'获得 2 层火力（本场）。'},
 SP08:{name:'干扰器',rarity:'uncommon',icon:'enrage',text:'移除对手的全部火力与布防。'},
 SP09:{name:'能量饮料',rarity:'common',icon:'overload',text:'行动点 +1，抽 1 张牌。'},
 SP10:{name:'闪光弹',rarity:'common',icon:'weak',text:'对手压制 3 回合。'},
 SP11:{name:'破片手雷',rarity:'common',icon:'vuln',text:'对手易伤 3 回合。'},
 SP12:{name:'燃烧瓶',rarity:'uncommon',icon:'burn',text:'对手燃烧 6 层。'},
 SP13:{name:'烟雾弹',rarity:'uncommon',icon:'smoke',text:'获得 8 布防，对手压制 1 回合。'},
 SP14:{name:'战术重置',rarity:'uncommon',icon:'draw',text:'弃掉全部手牌，然后抽 5 张。'},
 SP15:{name:'哨戒炮套件',rarity:'rare',icon:'sentry',text:'部署哨戒炮：回合结束时造成 5 伤害，持续 3 回合。'},
 SP16:{name:'补枪弹药',rarity:'uncommon',icon:'damage',text:'手牌加入 3 张补枪（0 费，3 伤害，临时）。'},
 SP17:{name:'训练模拟卡',rarity:'rare',icon:'cards',text:'本场比赛中，当前手牌全部升级。'}
};
export const SUPPLY_PRICES = {common:25,uncommon:35,rare:50};
export const GEAR_PRICES = {common:95,uncommon:125,rare:160,shop:110};
export const BASE_SUPPLY_SLOTS = 3;
// Equipment slots (every item, including the original skins and Boss items, takes one).
export const GEAR_SLOTS = 6;
export const GEAR_SELL = {common:15,uncommon:25,rare:40,boss:50,shop:30};
// Rules-1 opponent tuning (multipliers on script damage / defensive line), applied on
// top of difficulty levels. Traits, the opening, equipment and supplies make runs
// stronger, so the opponents — not the new content — absorb that power.
// Keyed by act, then opponent kind.
// ENEMY_TUNING is for map version 1 (12-step acts; kept so old records replay).
export const ENEMY_TUNING = {
 1:{normal:{hp:1.42,dmg:1.45},elite:{hp:1.45,dmg:1.45},boss:{hp:1.45,dmg:1.4}},
 2:{normal:{hp:1.5,dmg:1.38},elite:{hp:1.5,dmg:1.38},boss:{hp:1.5,dmg:1.32}},
 3:{normal:{hp:1.7,dmg:1.52},elite:{hp:1.7,dmg:1.52},boss:{hp:1.7,dmg:1.47}}
};
// Map version 2 (15 floors + boss): more fights and rewards per act, so the
// opponents are re-tuned for the longer route.
// Act 1 is eased against version 1: ordinary fights are shorter (HP 1.42 -> 1.32)
// so opponents that grow in a fight (the recon's enrage) do not snowball over ~7
// fights, and elites (now ~1.2 per route instead of ~0.9) and the boss hit softer.
export const ENEMY_TUNING_V2 = {
 1:{normal:{hp:1.32,dmg:1.4},elite:{hp:1.35,dmg:1.35},boss:{hp:1.4,dmg:1.35}},
 2:{normal:{hp:1.5,dmg:1.38},elite:{hp:1.5,dmg:1.38},boss:{hp:1.5,dmg:1.32}},
 3:{normal:{hp:1.7,dmg:1.52},elite:{hp:1.7,dmg:1.52},boss:{hp:1.7,dmg:1.47}}
};
// Rules 3: tuning for the rules-3 encounter pools, boss pool and group fights.
export const ENEMY_TUNING_V3 = {
 1:{weak:{hp:1.25,dmg:1.4},normal:{hp:1.32,dmg:1.4},elite:{hp:1.35,dmg:1.35},boss:{hp:1.4,dmg:1.35}},
 2:{weak:{hp:1.35,dmg:1.25},normal:{hp:1.5,dmg:1.38},elite:{hp:1.5,dmg:1.38},boss:{hp:1.8,dmg:1.5,growth:2}},
 3:{weak:{hp:1.55,dmg:1.4},normal:{hp:1.7,dmg:1.52},elite:{hp:1.7,dmg:1.52},boss:{hp:1.9,dmg:1.6,growth:3}}
};
// Rules 4: the first half of act 1 is eased most. `normalEarly` / `eliteEarly`
// apply to act-1 fights on floors 1–EARLY_STEP (after the weak floors); later
// act-1 fights, the act-1 boss and acts 2–3 change less. Difficulty levels
// still multiply on top.
export const EARLY_STEP = 8;
export const ENEMY_TUNING_V4 = {
 1:{weak:{hp:1.08,dmg:1.2},normalEarly:{hp:1.12,dmg:1.15},normal:{hp:1.25,dmg:1.3},eliteEarly:{hp:1.1,dmg:1.1},elite:{hp:1.2,dmg:1.2},boss:{hp:1.3,dmg:1.25}},
 2:{weak:{hp:1.35,dmg:1.25},normal:{hp:1.5,dmg:1.38},elite:{hp:1.5,dmg:1.38},boss:{hp:1.8,dmg:1.5,growth:2}},
 3:{weak:{hp:1.55,dmg:1.4},normal:{hp:1.7,dmg:1.52},elite:{hp:1.7,dmg:1.52},boss:{hp:1.9,dmg:1.6,growth:3}}
};
