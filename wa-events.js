// wa-events.js — original club-life event scenes for the Wa demo. All people,
// teams and situations are fictional. Numbers are this game's own tuning; the
// option effects are data ("ops", see shared-event-core.js), so the text on
// every button is generated from the numbers the engine applies. Every event
// can also be declined ("skip") without cost.
export const WA_EVENT_POOLS = {
  1: ['sponsor', 'trial', 'scrim', 'risk', 'oldGear', 'analyst', 'fanBet', 'oldGuard', 'mentor'],
  2: ['training', 'gearLab', 'pressRoom', 'poach', 'wrist', 'bootcamp', 'rivalCall', 'copycat', 'vam'],
  3: ['rally', 'investor', 'allNight', 'darkMarket', 'aceDuel', 'storm', 'veteran', 'burnout', 'overclock']
};

export const WA_EVENTS = {
  // ----------------------------- 第一幕 · 资格挑战 -----------------------------
  sponsor: { title: '商业邀约', scene: '一家能量饮料品牌想包下俱乐部这周的社媒账号。曝光很可观，评论区可就不好说了。',
    options: [
      { id: 'accept', title: '整周合作', ops: [{ money: 70 }, { curse: 'CU02' }] },
      { id: 'clip', title: '只拍一条短视频', ops: [{ hp: -6 }, { money: 35 }] }] },
  trial: { title: '紧急试训', scene: '三名自由选手同时联系了经理。名单今天就得定，来不及好好磨合。',
    options: [{ id: 'accept', title: '安排试训', ops: [{ special: 'trial' }] }] },
  scrim: { title: '训练赛邀约', scene: '一支老牌俱乐部发来训练赛邀请，对方愿意付出场费，但要求打满五张图。',
    options: [
      { id: 'safe', title: '轻量公开训练', ops: [{ money: -20 }, { healPct: 0.15 }] },
      { id: 'risk', title: '打满商业训练赛', ops: [{ hp: -8 }, { money: 35 }] }] },
  risk: { title: '高风险合作', scene: '一家来路不明的赞助商开价很高，合同附件厚得像一本书，法务说至少要看三天。',
    options: [{ id: 'accept', title: '当场签约', ops: [{ money: 90 }, { curse: true }] }] },
  oldGear: { title: '仓库里的旧外设', scene: '搬训练室时翻出一整箱上赛季的外设和队服，有几件还挺新。',
    options: [
      { id: 'refit', title: '挑一套翻新', ops: [{ money: -25 }, { pick: 'upgrade' }] },
      { id: 'sell', title: '整箱打包卖掉', ops: [{ money: 35 }] }] },
  analyst: { title: '自由分析师', scene: '一名自由分析师把简历拍在桌上：“给我一周，我帮你们换掉一套过时的打法。”',
    options: [
      { id: 'hire', title: '正式聘用', ops: [{ money: -50 }, { pick: 'transform' }] },
      { id: 'tryout', title: '免费试用三天', ops: [{ transformRandom: 1 }] }] },
  fanBet: { title: '水友赛对赌', scene: '直播间里有观众起哄：押 40 资金打一局水友赛，赢了主播请全队吃夜宵，外加一笔奖金。',
    options: [{ id: 'bet', title: '押上 40', ops: [{ money: -40 }, { gamble: { p: 0.5, win: [{ money: 100 }], lose: [] } }] }] },
  oldGuard: { title: '老牌强队约战', scene: '一支老牌强队的教练打来电话：“来一场正式规格的练习赛？输了可别哭。”',
    options: [{ id: 'fight', title: '接受约战', ops: [{ fight: 'elite', bonus: [{ money: 30 }] }] }] },
  mentor: { title: '退役教练的下午', scene: '一位退役教练路过训练室，看了半小时录像，说可以留下来带一个下午。',
    options: [
      { id: 'drill', title: '单点加练', ops: [{ hp: -6 }, { pick: 'upgrade' }] },
      { id: 'watch', title: '付费旁听复盘', ops: [{ money: -40 }, { upgradeRandom: 1 }] }] },

  // ----------------------------- 第二幕 · 第一赛段 -----------------------------
  training: { title: '训练安排', scene: '赛段中期的空档只有两天，教练组想集中强化一个人。',
    options: [
      { id: 'paid', title: '常规强化', ops: [{ money: -40 }, { pick: 'upgrade' }] },
      { id: 'risky', title: '加练试验', ops: [{ pick: 'upgrade' }, { curse: 'CU01' }] }] },
  gearLab: { title: '外设实验室', scene: '合作厂商的实验室邀请你们试用一套还没发布的原型外设，只是长时间使用会很伤手。',
    options: [
      { id: 'wear', title: '试用原型机', ops: [{ maxHp: -6 }, { equip: { fallback: 50 } }] },
      { id: 'report', title: '只买测试报告', ops: [{ money: -50 }, { upgradeRandom: 2 }] }] },
  pressRoom: { title: '赛前发布会', scene: '发布会上有记者追问上一场的失利。台下的镜头都在等一句够劲的回应。',
    options: [
      { id: 'trash', title: '当众放狠话', ops: [{ card: 'star' }, { curse: 'CU02' }] },
      { id: 'calm', title: '低调应对，早点收工', ops: [{ hp: 12 }] }] },
  poach: { title: '挖角传闻', scene: '一家财力雄厚的俱乐部开出高价挖人，经理问你：放人拿钱，还是加薪留人？',
    options: [
      { id: 'release', title: '放人拿转会费', ops: [{ pick: 'remove' }, { money: 70 }] },
      { id: 'raise', title: '加薪留人', ops: [{ money: -50 }, { pick: 'upgrade' }] }] },
  wrist: { title: '手腕伤病', scene: '队医看完片子叹了口气：“打封闭马上能上，但身体底子会被透支。”',
    options: [
      { id: 'shot', title: '打封闭上场', ops: [{ hp: 25 }, { maxHp: -5 }] },
      { id: 'rehab', title: '系统理疗', ops: [{ money: -60 }, { healPct: 0.3 }] }] },
  bootcamp: { title: '海外集训', scene: '俱乐部争取到一次海外集训名额，十天里每天都能约到高水平训练赛。',
    options: [
      { id: 'hell', title: '地狱周', ops: [{ upgradeRandom: 2 }, { curse: true }] },
      { id: 'steady', title: '专项突破', ops: [{ hp: -10 }, { pick: 'upgrade' }] },
      { id: 'off', title: '顺便放个假', ops: [{ hp: 20 }] }] },
  rivalCall: { title: '强队约战', scene: '同赛段的一支强队私信约战：“正式规格，全程录像。敢来吗？”',
    options: [{ id: 'fight', title: '应战', ops: [{ fight: 'elite', bonus: [{ upgradeRandom: 1 }, { money: 30 }] }] }] },
  copycat: { title: '复刻打法', scene: '复盘录像时，教练组发现有一套配合值得练成全队的肌肉记忆。',
    options: [
      { id: 'paid', title: '请陪练团队', ops: [{ money: -60 }, { pick: 'duplicate' }] },
      { id: 'cram', title: '自己硬练', ops: [{ curse: 'CU01' }, { pick: 'duplicate' }] }] },
  vam: { title: '对赌协议', scene: '赞助商提出对赌：赛段表现达标，奖金翻倍；不达标，倒扣一笔。',
    options: [{ id: 'sign', title: '签下对赌', ops: [{ gamble: { p: 0.55, win: [{ money: 120 }], lose: [{ money: -40 }] } }] }] },

  // ----------------------------- 第三幕 · 第二赛段 -----------------------------
  rally: { title: '赛前动员', scene: '最后的赛段临近，是整顿队内的积弊，还是再接一笔赞助？',
    options: [
      { id: 'cleanse', title: '整顿团队', ops: [{ money: -60 }, { pick: 'cleanse' }, { healPct: 0.15 }] },
      { id: 'sponsor', title: '商业动员', ops: [{ money: 100 }, { curse: 'CU02' }, { curse: 'CU02' }] }] },
  investor: { title: '神秘投资人', scene: '一位投资人在酒店大堂等你：“我能让你们多一张底牌，代价是你们的身体。”',
    options: [{ id: 'accept', title: '接受注资', ops: [{ maxHp: -10 }, { equip: { fallback: 60 } }, { upgradeRandom: 2 }] }] },
  allNight: { title: '通宵训练赛', scene: '凌晨两点，还有三支队伍在排队约训练赛。今晚的时间只够做一件事。',
    options: [
      { id: 'grind', title: '打到天亮', ops: [{ hp: -15 }, { upgradeRandom: 3 }] },
      { id: 'focus', title: '只磨一套', ops: [{ pick: 'upgrade' }] },
      { id: 'sleep', title: '早点睡', ops: [{ hp: 20 }] }] },
  darkMarket: { title: '私下转会', scene: '一位中间人私下联系经理：窗口外的签约不走正规流程，但人确实能打。',
    options: [
      { id: 'star', title: '签下神秘外援', ops: [{ money: -90 }, { card: 'star', up: true }] },
      { id: 'sell', title: '高价出售一人', ops: [{ pick: 'remove' }, { money: 60 }] }] },
  aceDuel: { title: '王牌单挑', scene: '对面的王牌点名要和你们打一场：“输的人把这赛段的奖金吐一半。”',
    options: [{ id: 'fight', title: '接下挑战', ops: [{ fight: 'elite', bonus: [{ upgradeRandom: 2 }, { money: 40 }] }] }] },
  storm: { title: '舆论风暴', scene: '一条剪辑过的旧视频突然上了热搜，评论区一夜之间炸开了锅。',
    options: [
      { id: 'spin', title: '借势营销', ops: [{ money: 90 }, { curse: true }] },
      { id: 'apologize', title: '公开道歉并请假', ops: [{ money: -50 }, { healPct: 0.2 }] }] },
  veteran: { title: '老将的笔记本', scene: '一位即将退役的老将把一本翻烂的笔记塞给你：“要么拿走本子，要么我陪你们练一晚。”',
    options: [
      { id: 'notes', title: '收下笔记', ops: [{ card: 'star' }] },
      { id: 'spar', title: '请他陪练', ops: [{ hp: -8 }, { pick: 'duplicate' }] }] },
  burnout: { title: '状态透支', scene: '连续几周高强度赛程，队员握鼠标的手开始发抖。',
    options: [
      { id: 'push', title: '咬牙硬撑', ops: [{ maxHp: -6 }, { upgradeRandom: 2 }] },
      { id: 'lighten', title: '减负轮换', ops: [{ money: -40 }, { pick: 'remove' }] },
      { id: 'rest', title: '全队休整', ops: [{ healPct: 0.3 }] }] },
  overclock: { title: '设备超频', scene: '技术员压低声音：“外设能调到极限，就是保不齐关键时刻出故障。”',
    options: [
      { id: 'max', title: '拉满超频', ops: [{ upgradeRandom: 3 }, { curse: 'CU11' }] },
      { id: 'tune', title: '常规调试', ops: [{ money: -40 }, { upgradeRandom: 1 }] }] }
};

// Supply crates (补给箱): bigger crates are rarer, hold more money and are
// likelier to contain a skin. Without a skin the crate pays `bonus` money and,
// for medium and large crates,
// offers one free card upgrade instead. money = [base, extra spread].
export const WA_CRATE_LOOT = {
  small: { money: [15, 10], skin: 0.25, bonus: 10, upgrade: false },
  medium: { money: [25, 15], skin: 0.45, bonus: 20, upgrade: true },
  large: { money: [40, 20], skin: 0.7, bonus: 30, upgrade: true }
};
