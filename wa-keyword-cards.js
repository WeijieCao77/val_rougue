// Rules-3 keyword tactic cards for the Wa demo: 虚无 (ethereal), 固有 (innate),
// X 费 (x) and 成长 (growth). Each region swaps five of its plainest tactic cards
// for five of these, so every region still offers 50 players + 25 tactics.
// The replaced cards stay defined (older runs and saved builds keep them); only
// rules-3 seasons use the new pools (see POOL_SWAPS and poolFor in content.js).
//
// Row: [id, name, role, cost, effects, upgraded, zone, flags]
// Effect extras: perX (value × X), xTimes (hit count = X), xPlus (X + n),
// grow (each earlier play of this copy this combat adds n), all (every opponent).
const hit = (n, times = 1, extra = {}) => ({type:'hit', n, times, ...extra});
const block = (n, extra = {}) => ({type:'block', n, ...extra});
const draw = n => ({type:'draw', n});
const weak = n => ({type:'weak', n});
const vuln = n => ({type:'vulnerable', n});
const T = '战术';
export const KEYWORD_ROWS = [
 // CN
 ['CNT26','开局站位',T,1,[block(6),draw(1)],[block(9),draw(1)],'discard',{innate:true}],
 ['CNT27','临场指挥',T,1,[block(9)],[block(12)],'discard',{ethereal:true}],
 ['CNT28','火力轮转',T,0,[hit(5,1,{xTimes:true})],[hit(7,1,{xTimes:true})],'discard',{x:true}],
 ['CNT29','阵地经验',T,1,[block(5,{grow:3})],[block(7,{grow:4})],'discard',{growth:true}],
 ['CNT30','默契配合',T,1,[hit(6,1,{grow:2})],[hit(8,1,{grow:3})],'discard',{growth:true}],
 // AM
 ['AMT26','首发突破',T,1,[hit(10),vuln(1)],[hit(13),vuln(1)],'discard',{innate:true}],
 ['AMT27','闪身枪',T,0,[hit(9)],[hit(12)],'discard',{ethereal:true}],
 ['AMT28','扫射清场',T,0,[hit(5,1,{xTimes:true,all:true})],[hit(5,1,{xTimes:true,xPlus:1,all:true})],'discard',{x:true}],
 ['AMT29','越打越热',T,1,[hit(7,1,{grow:4})],[hit(9,1,{grow:5})],'discard',{growth:true}],
 ['AMT30','突破节奏',T,2,[hit(4,2,{grow:2})],[hit(5,2,{grow:3})],'discard',{growth:true}],
 // EMEA
 ['EUT26','先手信息',T,1,[block(6),draw(1)],[block(9),draw(1)],'discard',{innate:true}],
 ['EUT27','雾中换位',T,1,[block(9)],[block(13)],'discard',{ethereal:true}],
 ['EUT28','持续燃烧',T,0,[{type:'burn',n:3,perX:true}],[{type:'burn',n:4,perX:true}],'discard',{x:true}],
 ['EUT29','余烬惯性',T,1,[hit(5,1,{grow:3}),{type:'burn',n:1}],[hit(7,1,{grow:4}),{type:'burn',n:1}],'discard',{growth:true}],
 ['EUT30','闪身撤离',T,0,[block(5),draw(1)],[block(7),draw(1)],'discard',{ethereal:true}],
 // PAC
 ['PAT26','预案在手',T,0,[{type:'token',id:'TK01'},{type:'token',id:'TK02'}],[{type:'token',id:'TK01'},{type:'token',id:'TK02'},draw(1)],'discard',{innate:true}],
 ['PAT27','即兴突击',T,1,[hit(12)],[hit(16)],'discard',{ethereal:true}],
 ['PAT28','全频超载',T,0,[hit(8,1,{xTimes:true}),{type:'overload',n:1}],[hit(10,1,{xTimes:true}),{type:'overload',n:1}],'discard',{x:true}],
 ['PAT29','临场磨合',T,0,[hit(3,1,{grow:2})],[hit(4,1,{grow:3})],'discard',{growth:true}],
 ['PAT30','战术库存',T,0,[{type:'token',id:'TK01',perX:true}],[{type:'token',id:'TK01',perX:true,xPlus:1}],'discard',{x:true}]
];
export const KEYWORD_RARITY = {
 CNT26:'common',CNT27:'common',CNT28:'uncommon',CNT29:'common',CNT30:'uncommon',
 AMT26:'common',AMT27:'uncommon',AMT28:'uncommon',AMT29:'common',AMT30:'uncommon',
 EUT26:'common',EUT27:'common',EUT28:'uncommon',EUT29:'uncommon',EUT30:'common',
 PAT26:'common',PAT27:'uncommon',PAT28:'rare',PAT29:'common',PAT30:'uncommon'
};
// Plain tactic cards each region gives up in rules-3 pools (no archetype tag).
export const POOL_SWAPS = {
 CN:['CNT02','CNT03','CNT09','CNT13','CNT15'],
 AM:['AMT06','AMT09','AMT11','AMT17','AMT21'],
 EMEA:['EUT01','EUT04','EUT06','EUT15','EUT23'],
 PAC:['PAT02','PAT06','PAT07','PAT08','PAT14']
};
const note = '赛区战术牌；数值与机制为本作原创设定，不代表任何真实选手或原作技能数据。';
const tactic = (title, scene) => ({title, scene, origin:'赛区战术', note});
export const KEYWORD_TACTICS = {
 CNT26:tactic('开局站位','开局前就排好五个人的站位。'),
 CNT27:tactic('临场指挥','指挥的一句话只在这一刻管用。'),
 CNT28:tactic('火力轮转','行动点全压进来，枪线一轮接一轮。'),
 CNT29:tactic('阵地经验','同一个点位守得越久，越知道怎么守。'),
 CNT30:tactic('默契配合','每配合一次，下一次就更快一步。'),
 AMT26:tactic('首发突破','第一波进攻早就写进了战术本。'),
 AMT27:tactic('闪身枪','拐角一闪而过，这一枪不开就没了。'),
 AMT28:tactic('扫射清场','把弹匣倒空，扫过每一个露头的人。'),
 AMT29:tactic('越打越热','枪越打越顺，准星越来越稳。'),
 AMT30:tactic('突破节奏','每冲一次点，队伍的节奏就更快。'),
 EUT26:tactic('先手信息','开局的道具早已排进计划。'),
 EUT27:tactic('雾中换位','烟还没散的时候换位，散了就来不及。'),
 EUT28:tactic('持续燃烧','把手里的道具全部扔进同一个点。'),
 EUT29:tactic('余烬惯性','火点每烧一次，下一次就烧得更旺。'),
 EUT30:tactic('闪身撤离','趁对面换弹的一瞬间撤出火线。'),
 PAT26:tactic('预案在手','上场前就备好了两套临时方案。'),
 PAT27:tactic('即兴突击','临场想到的打法，要么现在用，要么忘掉。'),
 PAT28:tactic('全频超载','所有设备同时开到最大，然后等它们冷却。'),
 PAT29:tactic('临场磨合','边打边磨合，每一次出手都更默契。'),
 PAT30:tactic('战术库存','把剩下的行动全换成备用补枪。')
};
