import {REGIONS,REGIONAL_ROWS,REGIONAL_TACTICS} from './regions.js';
import {EXPANSION_ROWS,EXPANSION_TACTICS} from './regional-expansion.js';
import {CURSES,CURSE_RULES,EXTRA_STATUSES,EXTRA_STATUS_RULES} from './afflictions.js';
import {EXTRA_ENEMIES} from './season-map.js';
export {REGIONS};
export {CURSE_RULES};
export const VERSION = 'D0.1.0';
// Effects are shared by rules, descriptions and previews. Player roles are design assignments.
const hit = (n, times = 1) => ({type:'hit', n, times});
const block = n => ({type:'block', n});
const weak = n => ({type:'weak', n});
const draw = n => ({type:'draw', n});
const token = id => ({type:'token', id});
const power = (key, n) => ({type:'power', key, n});
const rows = [
  ['CN01','glacier','决斗',0,[hit(3)],[hit(5)]],
  ['CN02','SpiritZ1','决斗',1,[hit(5),token('TK01')],[hit(8),token('TK01')]],
  ['CN03','Kai','决斗',1,[hit(7)],[hit(10)]],
  ['CN04','Life','决斗',1,[hit(4,2)],[hit(5,2)]],
  ['CN05','Rarga','决斗',2,[{...hit(12),ifWeak:4}],[{...hit(16),ifWeak:4}]],
  ['CN06','ZmjjKK','决斗',3,[hit(24)],[hit(30)]],
  ['CN07','yosemite','哨位',1,[block(6)],[block(9)]],
  ['CN08','Yuicaw','哨位',1,[block(4),token('TK02')],[block(7),token('TK02')]],
  ['CN09','vo0kashu','哨位',2,[block(14)],[block(18)]],
  ['CN10','Coco','控场',0,[weak(1)],[weak(2)],'exhaust'],
  ['CN11','LuoK1ng','控场',1,[block(3),weak(1)],[block(5),weak(1)]],
  ['CN12','Smoggy','控场',1,[weak(1),draw(1)],[weak(2),draw(1)]],
  ['CN13','BerLIN','先锋',0,[draw(1)],[draw(2)],'exhaust'],
  ['CN14','nobody','先锋',1,[draw(2)],[draw(3)]],
  ['CN15','SiuFatBB','先锋',1,[{type:'vulnerable',n:2}],[{type:'vulnerable',n:3}],'exhaust'],
  ['CN16','CHICHOO','哨位',1,[power('duel',3)],[power('duel',4)],'power'],
  ['CN17','Haodong','控场',2,[power('init',5)],[power('init',7)],'power'],
  ['CN18','AAAAY','先锋',3,[power('energy',1)],[power('energy',1),power('extraDraw',1)],'power'],
  ['ST01','信息干扰','比赛干扰',null,[],null,'exhaustEnd'],
  ['ST02','节奏受阻','比赛干扰',1,[],null,'exhaust'],
  ['ST03','疲劳','比赛干扰',null,[]],
  ['CU01','磨合不足','俱乐部隐患',null,[]],
  ['CU02','舆论压力','俱乐部隐患',null,[]],
  ...CURSES.slice(2).map(c=>[c.id,c.name,'俱乐部隐患',null,[]]),
  ...EXTRA_STATUSES.map(c=>[c.id,c.name,'比赛干扰',null,[],null,c.id==='ST04'?'exhaustEnd':'discard']),
  ['TK01','补枪','临时行动',0,[hit(3)],null,'temporary'],
  ['TK02','临时部署','临时行动',0,[block(3)],null,'temporary'],
 ['TK03','飞刀','临时行动',0,[hit(4)],null,'temporary'],
];
for(const region of Object.values(REGIONS)){
 const prefix={CN:'CN',AM:'AM',EMEA:'EU',PAC:'PA'}[region.id];
 region.pool.push(...EXPANSION_ROWS.filter(row=>row[0].startsWith(prefix)&&!row[0].startsWith(prefix+'T')).map(row=>row[0]));
 region.pool.push(...EXPANSION_ROWS.filter(row=>row[0].startsWith(prefix+'T')).map(row=>row[0]));
}
export const CARDS = Object.fromEntries([...rows,...REGIONAL_ROWS,...EXPANSION_ROWS].map(([id,name,role,cost,effects,upgraded,zone='discard']) =>
  [id,{id,name,role,cost,effects,upgraded,zone,player:/^(CN|AM|EU|PA)\d{2}$/.test(id),trainable:/^(CN|AM|EU|PA)(\d{2}|T\d{2})$/.test(id)}]
));
export const PLAYER_IDS = rows.filter(r=>r[0].startsWith('CN')).map(r=>r[0]);
// Presentation only: these motifs never add rules or identify a player's real agent pool.
// Every number still comes from effects(); all source/adaptation notes are player-readable.
export const TACTICS = {
 ...REGIONAL_TACTICS,
 ...EXPANSION_TACTICS,
 ...Object.fromEntries(CURSES.slice(2).map(c=>[c.id,{title:c.name,scene:c.text,origin:'赛季风险 · 原创适配',note:'全赛区共享隐患；只由风险事件加入，不能从普通奖励获得。'}])),
 ...Object.fromEntries(EXTRA_STATUSES.map(c=>[c.id,{title:c.name,scene:c.text,origin:'比赛干扰 · 原创适配',note:'临时状态仅在本场战斗生效，赛后移除。'}])),
 TK03:{title:'飞刀',scene:'手里还剩一把飞刀，随时补一刀。',origin:'临时行动 · 飞刀',note:'由飞刀类战术生成的 0 费临时牌。'},
 CN01:{title:'抢线点射',scene:'准星先到拐角，第一枪抢到身位。',origin:'枪法 · 抢线',verbs:{hit:'抢线开枪'},note:'通用枪法场景；不额外获得首杀奖励。'},
 CN02:{title:'拉枪接力',scene:'一人拉开枪线，队友跟上补枪。',origin:'配合 · 补枪',verbs:{hit:'拉出交火',token:'留下补枪机会'},note:'补枪需另打生成的临时牌，不会自动追加伤害。'},
 CN03:{title:'首枪破点',scene:'准星停在头线，迎着枪声打开缺口。',origin:'枪法 · 突破',verbs:{hit:'抢下首轮交火'},note:'首枪是战术名称；任何回合都能打出，不要求本回合第一张。'},
 CN04:{title:'急停转火',scene:'急停一枪，拉回准星再接一枪。',origin:'枪法 · 连续转火',verbs:{hit:'连续转火'},note:'两段攻击分别结算；没有新增敌人数或击杀触发。'},
 CN05:{title:'抓住破绽',scene:'对手被压在掩体后，立刻拉出补上火力。',origin:'配合 · 压制后接枪',verbs:{hit:'抓时机出枪'},note:'只有对手已有压制时才增加基础伤害；不要求低血量。'},
 CN06:{title:'冠军锋芒',scene:'关键交火，把整条枪线握在手中。',origin:'赛场 · 冠军致意',verbs:{hit:'强势突破'},note:'致意 ZmjjKK 的 2024 全球冠军赛 MVP 荣誉；这句场景是原创，不复述某个具体回合。',source:'https://valorantesports.com/en-US/news/closing-out-vct-2024-celebrating-growth-and-our-community'},
 CN07:{title:'绊线封路',scene:'零的绊线横过入口，打乱冲点脚步。',origin:'零 · 绊线',verbs:{block:'绊线阻止进点'},note:'借用 Trapwire 的限制移动与暴露目标意象，结算为布防；不会额外反伤、眩晕或抽牌。',source:'https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/'},
 CN08:{title:'冰域拖延',scene:'贤者的减速球铺开，第二颗先留在手中。',origin:'贤者 · 减速球',verbs:{block:'减速拖住进攻',token:'留出第二次封路'},note:'减速在这里折算为布防，不另扣对手行动次数；第二颗球要打出生成的临时牌才生效。',source:'https://playvalorant.com/en-us/agents/sage/'},
 CN09:{title:'冰墙封口',scene:'贤者升起冰墙，让入口的火力先撞上墙。',origin:'贤者 · 冰墙',verbs:{block:'冰墙承接火力'},note:'墙体不作为独立单位；仅增加布防，按统一时机清空。',source:'https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/'},
 CN10:{title:'腐坏逼退',scene:'暮蝶抛出腐坏球，逼得对手暂缓前压。',origin:'暮蝶 · 腐坏球',verbs:{weak:'腐坏逼退，形成压制'},note:'Meddle 原作造成暂时腐坏；本牌取逼退与犹豫的场景，抽象为压制。不会扣当前或最大防线，也没有持续掉血。',source:'https://playvalorant.com/en-us/agents/clove/'},
 CN11:{title:'毒幕分割',scene:'蝰蛇拉起毒幕，切开入口两侧的枪线。',origin:'蝰蛇 · 毒幕',verbs:{block:'毒幕掩护队友',weak:'分割枪线，形成压制'},note:'取 Toxic Screen 分割视野与阻滞进攻的场景；不新增中毒、腐坏、持续伤害或跨比赛隐患。',source:'https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-02/'},
 CN12:{title:'暗魇抢位',scene:'幽影的暗魇穿过掩体，队友趁势调整站位。',origin:'幽影 · 暗魇',verbs:{weak:'近视干扰，形成压制',draw:'借机调整战术'},note:'Paranoia 限制视野；抽牌表示队伍获得后续选择，不表示技能侦察或揭示敌人。',source:'https://playvalorant.com/en-us/agents/omen/'},
 CN13:{title:'侦察探点',scene:'猎枭的侦察箭落位，为下一步提供情报。',origin:'猎枭 · 侦察箭',verbs:{draw:'侦察获得情报'},note:'情报转为抽牌；不改变已公开的意图，也不查看抽牌顺序。',source:'https://playvalorant.com/en-us/agents/sova/'},
 CN14:{title:'无人机清点',scene:'猎枭的无人机先探拐角，队友跟进选择路线。',origin:'猎枭 · 无人机',verbs:{draw:'无人机探路'},note:'Owl Drone 的探点价值抽象为抽牌；没有自动标记增伤或额外布防。',source:'https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-4-08/'},
 CN15:{title:'穿墙闪击',scene:'铁臂的闪光穿墙炸开，接枪窗口就在眼前。',origin:'铁臂 · 穿墙闪光',verbs:{vulnerable:'闪光创造接枪窗口'},note:'Flashpoint 原作致盲；本牌把接枪窗口抽象为易伤，不代表原作闪光自带增伤。不会跳过对手行动。',source:'https://playvalorant.com/en-us/agents/breach/'},
 CN16:{title:'交叉拉枪',scene:'侧翼持续牵扯，让突破手更容易打开第一枪。',origin:'团队 · 交叉枪线',verbs:{duel:'建立交叉枪线'},note:'持续战术，只增强每回合第一张决斗牌的第一段攻击。'},
 CN17:{title:'信息联防',scene:'前点每次报出信息，后点就能及时补位。',origin:'团队 · 补位协防',verbs:{init:'建立信息联防'},note:'持续战术在每回合第一张先锋牌之后触发，不追溯此前已经打出的牌。'},
 CN18:{title:'赛场调度',scene:'把每个人的行动排进节奏，让下一轮更从容。',origin:'团队 · 指挥调度',verbs:{energy:'统一行动节奏',extraDraw:'扩充战术预案'},note:'行动点与升级后的额外抽牌从下一回合开始；多张能力仍按原规则叠加。'},
 ST01:{title:'视野受限',scene:'暗魇掠过，眼前的战术暂时无法执行。',origin:'幽影 · 视野干扰',note:'近视造成的短时信息损失抽象为一张废牌；本回合末消耗，不施加额外压制。',source:'https://playvalorant.com/en-us/agents/omen/'},
 ST02:{title:'冰域滞留',scene:'踩入减速区域，只能花一步重新调整身位。',origin:'贤者 · 减速干扰',note:'减速抽象为花行动点处理的干扰牌；打出才消耗，未处理会参与本场洗牌。',source:'https://playvalorant.com/en-us/agents/sage/'},
 ST03:{title:'长局疲态',scene:'拉锯战拖得太久，准星和报点都慢了半拍。',origin:'比赛 · 疲劳',note:'仅占用抽牌，不另降低攻击数值；赛后移除。'},
 CU01:{title:'沟通错拍',scene:'一声进、一声退，五个人没踩上同一拍。',origin:'俱乐部 · 磨合隐患',note:'这是虚构俱乐部情境，不评价任何真实选手。跨比赛保留，直到永久移除。'},
 CU02:{title:'赛后风波',scene:'上一场的讨论还没平息，压力又回到赛场。',origin:'俱乐部 · 舆论隐患',note:'这是虚构俱乐部情境。声望损失不属于攻击，布防不能抵消。'},
 TK01:{title:'紧跟补枪',scene:'沿着队友打开的枪线，把这次机会接住。',origin:'配合 · 临时接枪',verbs:{hit:'跟进补枪'},note:'只有打出才造成伤害；打出或回合末消耗。'},
 TK02:{title:'续投减速',scene:'第二颗减速球落下，继续拖住入口的脚步。',origin:'贤者 · 后续减速球',verbs:{block:'续投减速封路'},note:'来自冰域拖延的临时行动；打出才增加布防，未用则在回合末消耗。',source:'https://playvalorant.com/en-us/agents/sage/'},
};
export const displayText = text => String(text).replaceAll('格挡','布防').replaceAll('虚弱','压制');
export const SKINS = {
  SK01:{name:'磨砂黑',text:'开局站位：每场比赛第一个自己的回合，获得 3 布防。'},
  SK02:{name:'信号线',text:'战术接力：每场第一次打出 0 费选手牌后，抽 1 张。临时行动不触发。'},
  SK03:{name:'守望涂层',text:'补上防守空隙：每回合第一次打出哨位牌后，额外获得 2 布防。'},
};
const jam = (id,n=1) => ({type:'jam',id,n});
// Season-mode opponents (legacy tutorial ids E01–B01 above stay frozen for replays).
// Each archetype has a look, a behaviour pattern and often a passive trait.
const buff = n => ({type:'buff',n});
const aim = () => ({type:'aim'});
const snipe = n => ({type:'snipe',n});
const cleanse = () => ({type:'cleanse'});
const vulnP = n => ({type:'vuln',n});
export const TRAITS = {
 berserk:{name:'背水一战',icon:'enrage',text:n=>`防线首次降到一半以下时，获得${n}层火力。`},
 thorns:{name:'交叉火力',icon:'thorns',text:n=>`每次被你的攻击命中，反击你${n}点伤害（布防可挡）。`},
 enrageOnSkill:{name:'信息读取',icon:'enrage',text:n=>`你每打出一张不造成伤害的牌，它获得${n}层火力。`},
 ritual:{name:'手感渐热',icon:'strength',text:n=>`每个对手回合结束时，获得${n}层火力。`},
 tempo:{name:'控制节奏',icon:'tempo',text:n=>`你每打出${n}张牌，它获得2层火力与6点布防。`},
 phase2:{name:'决胜局',icon:'enrage',text:()=>'防线降到一半时清除自身负面状态，获得10点布防、2层火力，并换成全新打法。'},
 sniper:{name:'狙击位',icon:'aim',text:()=>'瞄准一回合后打出重狙；开枪前让它陷入压制可打断瞄准，这一枪只剩三分之一伤害。'}
};
export const FIELDS = {
 corridor:{name:'狭窄走廊',text:'所有多段攻击（双方）每段伤害 +1。'},
 longrange:{name:'开阔长廊',text:'单段基础伤害≥8的攻击（双方）伤害 +2。'},
 suppress:{name:'火力压制',text:'开局对手压制 2 回合。'},
 highground:{name:'高点优势',text:'你每回合第一张造成伤害的牌，首段伤害 +3。'},
 overtime:{name:'加时赛',text:'从第 5 回合起，对手每回合行动前获得 2 层火力。'},
 eco:{name:'经济局',text:'第一回合你多 1 行动点、多抽 1 张牌。'}
};
const SEASON_ACT1 = {
 // Tuned to hurt from the first fight (2026-09-24 user request: act 1 should not be easy).
 S_E01:{name:'新秀步枪组',look:'rookie',hp:40,script:[[hit(10)],[buff(1),hit(7)],[block(5),hit(8)]]},
 S_E02:{name:'远点狙击手',look:'sniper',hp:40,trait:{id:'sniper'},script:[[aim(),block(5)],[snipe(22)],[hit(8)]]},
 S_E03:{name:'突破手双枪',look:'rusher',hp:46,trait:{id:'berserk',n:3},script:[[hit(4,3)],[hit(10)],[block(6),hit(8)]]},
 S_E04:{name:'哨位架枪组',look:'sentinel',hp:42,startBlock:8,trait:{id:'thorns',n:2},script:[[block(6),hit(6)],[hit(13)],[block(5),hit(8)]]},
 S_E05:{name:'烟雾控场手',look:'controller',hp:44,script:[[weak(1),jam('ST01',2),hit(6)],[hit(11)],[vulnP(1),hit(8)]]},
 S_E06:{name:'前哨侦察兵',look:'recon',hp:46,trait:{id:'enrageOnSkill',n:1},script:[[hit(10)],[block(6),hit(7)],[hit(4,2)]]},
 S_EL01:{name:'王牌突击手',look:'ace',hp:72,elite:true,trait:{id:'ritual',n:1},script:[[hit(10),jam('ST03')],[hit(5,3)],[block(10),hit(6)]]},
 S_EL02:{name:'战术指挥官',look:'igl',hp:66,elite:true,script:[[buff(2),block(8)],[hit(8,2)],[cleanse(),block(12),jam('ST02')],[hit(16)]]},
 S_B01:{name:'大师赛冠军卫队',look:'boss1',hp:110,boss:true,growth:0,trait:{id:'tempo',n:16},script:[[weak(1),hit(9)],[jam('ST02',2),block(12)],[hit(5,3)],[hit(15)]]}
};
function scaleSeason(prefix,label,hpK,dmgK){
 const out={};
 const r=n=>Math.max(1,Math.round(n*dmgK));
 for(const [id,e] of Object.entries(SEASON_ACT1)){
  if(e.boss)continue;
  out[prefix+id]={...e,name:label+e.name,hp:Math.round(e.hp*hpK*(e.elite?0.93:1)),startBlock:e.startBlock?r(e.startBlock):undefined,
   // Ritual and skill-enrage already compound during a fight, so only flat traits grow per act.
   trait:e.trait?{...e.trait,n:e.trait.n&&!['ritual','enrageOnSkill'].includes(e.trait.id)?e.trait.n+(dmgK>1.4?2:1):e.trait.n}:undefined,
   script:e.script.map(turn=>turn.map(a=>['hit','block','snipe'].includes(a.type)?{...a,n:r(a.n)}:a.type==='buff'?{...a,n:a.n+1}:{...a}))};
 }
 return out;
}
const SEASON_ENEMIES = {
 ...SEASON_ACT1,
 ...scaleSeason('A2_','二幕·',1.25,1.15),
 A2_S_B01:{name:'晋级赛冠军卫队',look:'boss2',hp:110,boss:true,growth:0,script:[[block(12),hit(5)],[buff(1),hit(5,3)],[hit(8),jam('ST02',2)],[hit(16)]]},
 ...scaleSeason('A3_','决赛·',1.45,1.25),
 A3_S_B01:{name:'总决赛冠军卫队',look:'boss3',hp:115,boss:true,growth:0,trait:{id:'phase2'},
  script:[[hit(10),jam('ST03')],[weak(1),hit(4,3)],[block(12),jam('ST01',2)],[hit(15)]],
  phase2:[[buff(1),hit(7,2)],[hit(5,3),vulnP(1)],[block(12),hit(9)]]}
};
export const ENEMIES = {
 ...EXTRA_ENEMIES,
 E01:{name:'基础试训队',hp:28,script:[[hit(6)],[hit(8)],[block(4),hit(4)]]},
 E02:{name:'信息压制队',hp:34,script:[[hit(7)],[jam('ST01'),hit(5)],[hit(9)]]},
 E03:{name:'双核突击队',hp:40,script:[[hit(3,3)],[hit(7)],[block(5),hit(5)]]},
 E04:{name:'防守反击队',hp:38,script:[[block(8),hit(3)],[hit(12)],[jam('ST03'),hit(6)]]},
 E05:{name:'纪律控制队',hp:44,script:[[weak(1)],[hit(10)],[block(6),hit(6)]]},
 EL01:{name:'高压强敌队',hp:54,elite:true,script:[[hit(8),jam('ST03')],[hit(4,3)],[block(10),jam('ST02')]]},
 B01:{name:'大师赛种子队',hp:80,boss:true,script:[[hit(8),jam('ST01')],[hit(4,3)],[weak(1),hit(6)],[block(10),jam('ST02')]]},
 ...SEASON_ENEMIES,
};
export const ROUTE = ['基础试训','信息压制','赛程外的机会','双核突击','市场 / 俱乐部活动','普通 / 强敌','俱乐部活动','纪律控制','大师赛 · BOSS'];
export const START = ['CN03','CN07','CN11','CN14','CN16','CN03','CN07','CN03','CN07','CN14'];
export function effects(card) { return card.up ? CARDS[card.id].upgraded : CARDS[card.id].effects; }
export function cardName(card) { return CARDS[card.id].name + (card.up?' +':''); }
// Short face text and full hover text use the same effects, including upgrades.
export function compactLines(card) {
 if(CURSE_RULES[card.id])return ['不能打出',CURSE_RULES[card.id].text];
 if(EXTRA_STATUS_RULES[card.id])return ['不能打出',EXTRA_STATUS_RULES[card.id].text];
 const special={ST01:['不能打出'],ST02:['打出以清除此牌'],ST03:['不能打出','本场循环'],CU01:['不能打出','跨比赛保留'],CU02:['不能打出','留手至回合末：','直接失去 2 声望']};
 if(special[card.id])return special[card.id];
 const lines=effects(card).flatMap(function line(e){
  if(e.type==='combo')return line(e.effect).map((l,i)=>i?l:`连击：${l}`);
  if(e.type==='hit'&&(e.ifVuln||e.ifBurn))return [`伤害 ${e.n}${e.times>1?` × ${e.times}`:''}`,e.ifVuln?`对手易伤：+${e.ifVuln}`:`对手燃烧：+${e.ifBurn}`];
  if(e.type==='burn')return [`燃烧 ${e.n}`];
  if(e.type==='burnMultiply')return [`燃烧层数 ×${e.n}`];
  if(e.type==='detonate')return [`引爆：燃烧×${e.per}伤害`];
  if(e.type==='deploy')return [e.kind==='turret'?`部署哨戒炮 ${e.n}×${e.turns}回合`:`部署屏障 ${e.n}布防×${e.turns}回合`];
  if(e.type==='fireTurrets')return ['哨戒炮立即开火'];
  if(e.type==='bodyslam')return ['伤害=当前布防'];
  if(e.type==='strength')return [`本场火力 +${e.n}`];
  if(e.type==='overload')return [`过载 ${e.n}`];
  if(e.key==='knife')return ['本场飞刀：',`伤害 +${e.n}`];
  if(e.key==='comboAtk')return ['每回合第3张起：',`攻击 +${e.n}`];
  if(e.key==='burnTick')return ['每回合开始：',`燃烧 ${e.n}`];
  if(e.type==='hit')return [`伤害 ${e.n}${e.times>1?` × ${e.times}`:''}`,...(e.ifWeak?[`对手有压制：基础伤害 +${e.ifWeak}`]:[])];
  if(e.type==='block')return [`布防 ${e.n}`];
  if(e.type==='weak')return [`对手压制 ${e.n} 回合`];
  if(e.type==='vulnerable')return [`对手易伤 ${e.n} 回合`];
  if(e.type==='draw')return [`抽 ${e.n} 张牌`];
  if(e.type==='token')return [`生成 ${e.id==='TK01'?'补枪':e.id==='TK03'?'飞刀':'续投减速'} ×1`];
  if(e.key==='duel')return ['每回合首张决斗：',`首段伤害 +${e.n}`];
  if(e.key==='init')return ['每回合首张先锋后：',`布防 +${e.n}`];
  if(e.key==='energy')return ['下回合起，每回合：',`行动点 +${e.n}`];
  if(e.key==='extraDraw')return [`额外抽 ${e.n} 张`];
  return [];
 });
 if(CARDS[card.id].zone==='retain')lines.push('保留');
 return lines.length<=3?lines:[lines[0],lines[1],lines.slice(2).join(' · ')];
}
export function cardKeywords(card) {
 const t=CARDS[card.id],list=[],es=effects(card)||[];
 if(es.some(e=>e.type==='block'||e.key==='init'))list.push(['布防','每点抵消 1 点攻击伤害；下次己方回合开始清空。']);
 if(es.some(e=>e.type==='weak'||e.ifWeak))list.push(['压制','攻击伤害降低 25%；每段向下取整，受影响一方行动结束后减少 1 回合。']);
 if(es.some(e=>e.type==='vulnerable'))list.push(['易伤','受到攻击伤害增加 50%；每段向下取整，对手行动结束后减少 1 回合。']);
 if(es.some(e=>e.type==='token')){const e=es.find(e=>e.type==='token');list.push([e.id==='TK01'?'补枪':'续投减速',`生成到手中的 0 费临时牌：${e.id==='TK01'?'造成 3 伤害':'获得 3 布防'}。打出或回合末消耗，手牌满时不生成。`]);}
 if(t.zone==='power')list.push(['持续能力','打出后本场持续生效，不再洗回；多张可叠加，只影响之后的触发。']);
 if(t.zone==='exhaust')list.push(['消耗','打出后进入消耗区，本场不再抽到。没打出时正常弃置；赛季牌组中的原牌下场恢复。']);
 if(t.zone==='temporary')list.push(['临时','打出或回合末进入消耗区，本场不再抽到；不加入赛季牌组。']);
 if(t.zone==='exhaustEnd')list.push(['回合末消耗','留在手中到回合结束时，进入消耗区，而不是弃牌堆。']);
 const flat=es.flatMap(e=>e.type==='combo'?[e,e.effect]:[e]);
 if(flat.some(e=>e.type==='combo'))list.push(['连击','本回合已经打出过其他牌时，才会触发“连击：”后面的效果。']);
 if(flat.some(e=>['burn','burnMultiply','detonate'].includes(e.type)||e.key==='burnTick'||e.ifBurn))list.push(['燃烧','对手回合开始前失去等同层数的防线（无视布防），然后 -1 层。']);
 if(flat.some(e=>['deploy','fireTurrets'].includes(e.type)))list.push(['部署','哨戒炮在你的回合结束时自动开火；屏障在回合结束时提供布防。持续指定回合数。']);
 if(flat.some(e=>e.type==='overload'))list.push(['过载','下回合行动点减少等量。']);
 if(flat.some(e=>e.type==='strength'))list.push(['火力','本场你每一段攻击伤害 +层数。']);
 if(t.zone==='retain')list.push(['保留','回合结束时不会被弃掉，留在手中。']);
 if(t.id.startsWith('CU'))list.push(['俱乐部隐患','跨比赛保留。可在俱乐部团建等节点永久移除；直接失去声望不能用布防抵消。']);
 return list;
}
export function describe(card) {
 const t=CARDS[card.id];
 if(CURSE_RULES[card.id])return CURSE_RULES[card.id].text+' 跨比赛保留，直到永久移除。';
 if(EXTRA_STATUS_RULES[card.id])return EXTRA_STATUS_RULES[card.id].text;
 const special={ST01:'不能打出。占用抽牌；回合结束时消耗。',ST02:'打出以调整身位，然后消耗。未打出则进入弃牌堆。',ST03:'不能打出。弃掉后继续参与本场洗牌。赛后移除。',CU01:'不能打出。跨比赛留在牌组，直到永久移除。',CU02:'不能打出。回合末仍在手中：直接失去 2 声望，布防无效。跨比赛保留。'};
 if(special[card.id]) return special[card.id];
 const text=effects(card).map(function part(e){
  if(e.type==='combo') return `连击：${part(e.effect)}`;
  if(e.type==='hit') return `造成 ${e.n} 伤害${e.times>1?` × ${e.times} 次`:''}${e.ifWeak?`；对手有压制时基础伤害 +${e.ifWeak}`:''}${e.ifVuln?`；对手易伤时基础伤害 +${e.ifVuln}`:''}${e.ifBurn?`；对手燃烧时基础伤害 +${e.ifBurn}`:''}`;
  if(e.type==='burn') return `给予对手 ${e.n} 层燃烧`;
  if(e.type==='burnMultiply') return `对手燃烧层数 ×${e.n}`;
  if(e.type==='detonate') return `引爆：造成燃烧层数 ×${e.per} 的伤害并清空燃烧`;
  if(e.type==='deploy') return e.kind==='turret'?`部署哨戒炮：回合结束时造成 ${e.n} 伤害，持续 ${e.turns} 回合`:`部署屏障无人机：回合结束时获得 ${e.n} 布防，持续 ${e.turns} 回合`;
  if(e.type==='fireTurrets') return '所有哨戒炮立即开火一次';
  if(e.type==='bodyslam') return '造成等同于当前布防的伤害';
  if(e.type==='strength') return `本场获得 ${e.n} 层火力`;
  if(e.type==='overload') return `过载 ${e.n}（下回合行动点 -${e.n}）`;
  if(e.type==='block') return `获得 ${e.n} 布防`;
  if(e.type==='weak') return `对手压制 ${e.n} 回合（攻击 −25%）`;
  if(e.type==='vulnerable') return `对手易伤 ${e.n} 回合（受到攻击 +50%）`;
  if(e.type==='draw') return `抽 ${e.n} 张牌`;
  if(e.type==='token') return `生成 1 张${CARDS[e.id].name}·${TACTICS[e.id].title}（0 费，${e.id==='TK01'?'3 伤害':e.id==='TK03'?'4 伤害':'3 布防'}，临时）`;
  return ({knife:`本场你的飞刀伤害 +${e.n}`,comboAtk:`本场每回合第 3 张及之后的牌，攻击伤害 +${e.n}`,burnTick:`本场每回合开始时给予对手 ${e.n} 层燃烧`,duel:`本场每回合第一张决斗牌的第一段攻击 +${e.n}`,init:`本场每回合第一张先锋打出后，获得 ${e.n} 布防`,energy:`从下一回合起，每回合行动点 +${e.n}`,extraDraw:`从下一回合起，每回合额外抽 ${e.n} 张`})[e.key];
 }).join('；');
 return text + (t.zone==='exhaust'?'。打出后消耗。':t.zone==='temporary'?'。打出或回合末消耗。':t.zone==='power'?'。能力：本场持续生效，不再洗回。':t.zone==='retain'?'。保留：回合末不弃置。':'。');
}
