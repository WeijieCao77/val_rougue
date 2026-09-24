// new-demo/events.js — original event scenes for the new demo. Numbers are
// this game's own tuning. Option effects are data ("ops", see
// ../shared-event-core.js), so the text on each button is generated from the
// same numbers the engine applies.
export const EVENT_POOLS = {
  1: ['ev1', 'coach', 'ev5', 'ev7', 'scrim', 'rookie', 'board', 'drink', 'netcafe'],
  2: ['lab', 'press', 'market', 'injury', 'camp', 'rival', 'leak', 'clone', 'vam'],
  3: ['pact', 'allnight', 'clearance', 'ace', 'storm', 'gift', 'burnout', 'auction', 'overclock']
};

const leave = { id: 'leave', title: '离开', ops: [] };

export const EVENTS = {
  // ----------------------------- 第一幕 · 资格赛 -----------------------------
  ev1: { title: '尘封的装备箱', scene: '训练基地的器材间里，一只贴着旧封条的装备箱卡在货架最底层。锁扣早就锈死了，硬撬难免挂彩。',
    options: [{ id: 'take', title: '硬撬开', ops: [{ hp: -7 }, { equip: { fallback: 50 } }] }, leave] },
  coach: { title: '老教练的下午', scene: '一位退役多年的老教练在场边看完你们一局训练，把帽檐往上一推：“给我一个下午。”',
    options: [
      { id: 'drill', title: '单点加练', ops: [{ hp: -5 }, { pick: 'upgrade' }] },
      { id: 'watch', title: '付费旁听复盘', ops: [{ money: -40 }, { upgradeRandom: 1 }] },
      leave] },
  ev5: { title: '两份赞助合同', scene: '赞助商把两份合同推到桌上：一份是密集的商务行程，一份要你们自掏腰包办粉丝活动。',
    options: [
      { id: 'cash', title: '密集商务活动', ops: [{ maxHp: -4 }, { money: 70 }] },
      { id: 'fans', title: '自费粉丝见面会', ops: [{ money: -50 }, { maxHp: 4 }] },
      leave] },
  ev7: { title: '高风险合作', scene: '一家背景复杂的外设厂商愿意提供顶级装备，合同附录里却有几条看不太懂的条款。',
    options: [{ id: 'accept', title: '签下合同', ops: [{ equip: { fallback: 50 } }, { curse: true }] }, { id: 'decline', title: '谢绝合作', ops: [] }] },
  scrim: { title: '临时训练赛', scene: '一支陌生队伍临时约训练赛，对面打法凶得反常。打满全场会很累，也最能看出战术漏洞。',
    options: [
      { id: 'scrim', title: '打满高强度', ops: [{ hp: -8 }, { upgradeRandom: 1 }] },
      { id: 'recover', title: '改做体能恢复', ops: [{ money: -20 }, { hp: 12 }] },
      leave] },
  rookie: { title: '门口的新人', scene: '一名新人抱着外设在训练室门口等了三个小时。枪法很亮眼，只是和队伍完全没磨合过。',
    options: [
      { id: 'sign', title: '直接签下', ops: [{ card: 'uncommon' }, { curse: 'CU01' }] },
      { id: 'paid', title: '付费试训一周', ops: [{ money: -45 }, { card: 'uncommon' }] },
      leave] },
  board: { title: '擦掉的战术板', scene: '分析师把整面战术板擦得干干净净：“有一套打法该换了，你来决定是哪一套。”',
    options: [
      { id: 'rework', title: '推倒重来', ops: [{ pick: 'transform' }] },
      { id: 'trim', title: '通宵删减打法', ops: [{ hp: -8 }, { pick: 'remove' }] },
      leave] },
  drink: { title: '实验批次饮料', scene: '赞助商送来一箱新口味功能饮料，罐身上印着“实验批次，请勿外传”。',
    options: [
      { id: 'drink', title: '开一罐试试', ops: [{ gamble: { p: 0.6, win: [{ hp: 15 }], lose: [{ hp: -6 }] } }] },
      { id: 'sell', title: '整箱转卖', ops: [{ money: 35 }] }] },
  netcafe: { title: '网吧对赌', scene: '网吧老板认出了你：“一局定胜负，押 40 金币，赢了翻倍还多。敢不敢？”',
    options: [
      { id: 'bet', title: '押上 40', ops: [{ money: -40 }, { gamble: { p: 0.5, win: [{ money: 100 }], lose: [] } }] },
      leave] },

  // ----------------------------- 第二幕 · 晋级赛 -----------------------------
  lab: { title: '装备实验室', scene: '工程师递来一副还没量产的战术目镜：“数据归你，副作用我不负责。”',
    options: [
      { id: 'wear', title: '戴上原型机', ops: [{ maxHp: -6 }, { equip: { fallback: 60 } }] },
      { id: 'data', title: '只买测试数据', ops: [{ money: -60 }, { upgradeRandom: 2 }] },
      leave] },
  press: { title: '赛前发布会', scene: '记者的问题一个比一个尖锐。台下的镜头都在等你说一句够劲的话。',
    options: [
      { id: 'trash', title: '当众放狠话', ops: [{ card: 'rare' }, { curse: 'CU02' }] },
      { id: 'calm', title: '低调应对，早点收工', ops: [{ hp: 10 }] }] },
  market: { title: '停车场的后备箱', scene: '地下停车场里，一个戴鸭舌帽的人掀开后备箱：“正规渠道买不到的货，也收你们不想要的东西。”',
    options: [
      { id: 'buy', title: '买一件装备', ops: [{ money: -90 }, { equip: { fallback: 90 } }] },
      { id: 'sell', title: '卖掉一套打法', ops: [{ pick: 'remove' }, { money: 45 }] },
      leave] },
  injury: { title: '手腕伤病', scene: '队医看完片子皱起眉：“打封闭马上能上，但身体底子会被透支。”',
    options: [
      { id: 'shot', title: '打封闭上场', ops: [{ hp: 25 }, { maxHp: -5 }] },
      { id: 'rehab', title: '系统理疗', ops: [{ money: -60 }, { healPct: 0.3 }] },
      leave] },
  camp: { title: '封闭集训', scene: '俱乐部租下山里的集训基地，十天不碰手机。怎么练，由你定。',
    options: [
      { id: 'hell', title: '地狱周', ops: [{ upgradeRandom: 2 }, { curse: true }] },
      { id: 'steady', title: '专项突破', ops: [{ hp: -10 }, { pick: 'upgrade' }] },
      { id: 'off', title: '放三天假', ops: [{ hp: 20 }] }] },
  rival: { title: '强队约战', scene: '对面的王牌小队发来私信：“敢不敢打一场真格的？赢了，我们的备用装备归你。”',
    options: [
      { id: 'fight', title: '应战', ops: [{ fight: 'elite', bonus: [{ equip: { fallback: 60 } }, { money: 30 }] }] },
      { id: 'decline', title: '婉拒', ops: [] }] },
  leak: { title: '战术泄露', scene: '你们的一份内部战术文档出现在论坛首页，下一场对手显然也看到了。',
    options: [
      { id: 'rewrite', title: '连夜改战术', ops: [{ hp: -8 }, { pick: 'transform' }] },
      { id: 'pr', title: '花钱公关删帖', ops: [{ money: -50 }] },
      { id: 'ignore', title: '置之不理', ops: [{ curse: 'CU08' }] }] },
  clone: { title: '复刻招牌打法', scene: '复盘时教练组发现，你们最拿手的那套打法值得练成肌肉记忆。',
    options: [
      { id: 'drill', title: '请陪练团队', ops: [{ money: -50 }, { pick: 'duplicate' }] },
      { id: 'cram', title: '自己硬练', ops: [{ curse: 'CU01' }, { pick: 'duplicate' }] },
      leave] },
  vam: { title: '对赌协议', scene: '赞助商提出对赌：下一阶段表现达标，奖金翻倍；不达标，倒扣一笔。',
    options: [
      { id: 'sign', title: '签下对赌', ops: [{ gamble: { p: 0.55, win: [{ money: 120 }], lose: [{ money: -40 }] } }] },
      { id: 'refuse', title: '拒签', ops: [] }] },

  // ----------------------------- 第三幕 · 总决赛 -----------------------------
  pact: { title: '决赛前夜的交易', scene: '一位神秘投资人坐在酒店大堂等你：“我能让你们在决赛多一张底牌。代价嘛，是你们的身体。”',
    options: [
      { id: 'accept', title: '接受交易', ops: [{ maxHp: -10 }, { equip: { fallback: 80 } }, { upgradeRandom: 2 }] },
      { id: 'refuse', title: '起身离开', ops: [] }] },
  allnight: { title: '通宵训练赛', scene: '凌晨两点，三支队伍还在语音里排队约训练赛。今晚的时间只够做一件事。',
    options: [
      { id: 'grind', title: '打到天亮', ops: [{ hp: -15 }, { upgradeRandom: 3 }] },
      { id: 'focus', title: '只磨一套', ops: [{ pick: 'upgrade' }] },
      { id: 'sleep', title: '早点睡', ops: [{ hp: 20 }] }] },
  clearance: { title: '黑市清仓', scene: '熟悉的鸭舌帽又出现了：“最后一批货，清完这季我就不干了。”',
    options: [
      { id: 'buy', title: '买下压箱货', ops: [{ money: -100 }, { equip: { fallback: 100 } }] },
      { id: 'sell', title: '高价回收一套打法', ops: [{ pick: 'remove' }, { money: 60 }] },
      leave] },
  ace: { title: '王牌单挑', scene: '对面的王牌点名要和你们单独打一场：“输的人把这季的奖金吐一半。”',
    options: [
      { id: 'fight', title: '接下挑战', ops: [{ fight: 'elite', bonus: [{ upgradeRandom: 2 }, { money: 40 }] }] },
      { id: 'decline', title: '不接', ops: [] }] },
  storm: { title: '舆论风暴', scene: '决赛前一条旧视频被翻了出来，评论区一夜之间炸开了锅。总得有个回应。',
    options: [
      { id: 'spin', title: '借势营销', ops: [{ money: 100 }, { curse: 'CU02' }, { curse: 'CU02' }] },
      { id: 'silent', title: '闭门冷处理', ops: [{ hp: -12 }] },
      { id: 'pay', title: '花钱撤热搜', ops: [{ money: -80 }] }] },
  gift: { title: '老将的笔记本', scene: '一位即将退役的老将把一本翻烂的战术笔记塞给你：“要么拿走本子，要么我陪你们练一晚。”',
    options: [
      { id: 'notes', title: '收下笔记', ops: [{ card: 'rare' }] },
      { id: 'spar', title: '请他陪练', ops: [{ hp: -8 }, { pick: 'duplicate' }] }] },
  burnout: { title: '状态透支', scene: '连续三周高强度赛程，队员握鼠标的手开始发抖。',
    options: [
      { id: 'push', title: '咬牙硬撑', ops: [{ maxHp: -6 }, { upgradeRandom: 2 }] },
      { id: 'lighten', title: '减负精简', ops: [{ money: -40 }, { pick: 'remove' }] },
      { id: 'rest', title: '全队休整', ops: [{ healPct: 0.3 }] }] },
  auction: { title: '幸运物拍卖', scene: '慈善拍卖会上，一只据说“陪一支夺冠队伍走完整个赛季”的旧背包起拍价 60 金币，里面装了什么没人知道。',
    options: [
      { id: 'bid', title: '举牌', ops: [{ money: -60 }, { gamble: { p: 0.5, win: [{ equip: { fallback: 120 } }], lose: [] } }] },
      leave] },
  overclock: { title: '设备超频', scene: '技术员压低声音：“外设能调到极限，就是保不齐关键时刻出故障。”',
    options: [
      { id: 'max', title: '拉满超频', ops: [{ upgradeRandom: 3 }, { curse: 'CU11' }] },
      { id: 'tune', title: '常规调试', ops: [{ money: -40 }, { upgradeRandom: 1 }] },
      leave] }
};

// Supply crates (补给箱): bigger crates are rarer, hold more money and are
// likelier to contain equipment. money = [base, extra spread]; bonus is paid
// when the crate holds no equipment (or every piece is already owned).
export const CRATE_LOOT = {
  small: { money: [20, 10], equip: 0.7, bonus: 25 },
  medium: { money: [40, 15], equip: 0.85, bonus: 35 },
  large: { money: [65, 20], equip: 1, bonus: 50 }
};
