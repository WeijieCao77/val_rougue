// Shared PvE afflictions. The names and triggers are this game's adaptation,
// not a claim that Slay the Spire uses these exact effects or acquisition rates.
export const CURSES = [
 {id:'CU01',name:'磨合不足',trigger:'unplayable',n:0,text:'不能打出。占用抽牌与牌组空间。'},
 {id:'CU02',name:'舆论压力',trigger:'endTurnLoseHp',n:2,text:'回合末仍在手中：失去 2 声望／生命。'},
 {id:'CU03',name:'赞助干预',trigger:'onDrawLoseEnergy',n:1,text:'抽到时失去 1 行动点／能量。'},
 {id:'CU04',name:'合同纠纷',trigger:'onDrawDiscard',n:1,text:'抽到时随机弃掉另一张手牌。'},
 {id:'CU05',name:'媒体围堵',trigger:'onDrawWeak',n:1,text:'抽到时自身获得 1 回合压制。'},
 {id:'CU06',name:'赛程重压',trigger:'onDrawLoseHp',n:2,text:'抽到时直接失去 2 声望／生命。'},
 {id:'CU07',name:'信息暴露',trigger:'onDrawVuln',n:1,text:'抽到时自身获得 1 回合易伤。'},
 {id:'CU08',name:'战术泄露',trigger:'unplayable',n:0,text:'不能打出。占用抽牌与牌组空间。'},
 {id:'CU09',name:'心理阴影',trigger:'onPlayLoseHp',n:1,text:'留在手中时，每打出另一张牌失去 1 声望／生命。'},
 {id:'CU10',name:'疲劳复发',trigger:'endTurnLoseHp',n:1,text:'回合末仍在手中：失去 1 声望／生命。'},
 {id:'CU11',name:'设备故障',trigger:'onDrawLoseEnergy',n:1,text:'抽到时失去 1 行动点／能量。'},
 {id:'CU12',name:'队内分歧',trigger:'onDrawDiscard',n:2,text:'抽到时随机弃掉至多 2 张其他手牌。'},
 {id:'CU13',name:'训练失序',trigger:'onDrawWeak',n:2,text:'抽到时自身获得 2 回合压制。'},
 {id:'CU14',name:'禁赛风险',trigger:'onDrawLoseHp',n:4,text:'抽到时直接失去 4 声望／生命。'}
];
export const CURSE_RULES=Object.fromEntries(CURSES.map(c=>[c.id,c]));
export const EXTRA_STATUSES=[
 {id:'ST04',name:'能量泄漏',trigger:'onDrawLoseEnergy',n:1,text:'抽到时失去 1 行动点／能量；本场临时。'},
 {id:'ST05',name:'干扰脉冲',trigger:'onDrawDiscard',n:1,text:'抽到时随机弃掉另一张手牌；本场临时。'}
];
export const EXTRA_STATUS_RULES=Object.fromEntries(EXTRA_STATUSES.map(c=>[c.id,c]));
