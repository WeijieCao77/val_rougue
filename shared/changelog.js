// Player-facing update log, newest first. Each demo's cover shows its own log
// (changelogFor): the Wa demo gets 'wa' + 'pvp' + 'all' lines, the new demo only
// 'new' + 'all' — so 'all' lines must never mention Valorant, players or PvP.
// tag: 'wa' 瓦 Demo · 'new' 新 Demo · 'pvp' 好友 PvP · 'all' 两个版本
// When shipping something players will notice, add a line to the top entry
// (or a new entry with the next version and today's date).
export const CHANGELOG = [
  {
    version: 'v0.9.3', date: '2026-09-27', title: '进度同步',
    items: [
      ['all', '新增进度同步：用 6 位同步码把手机和电脑的进度连起来，之后自动同步。']
    ]
  },
  {
    version: 'v0.9.2', date: '2026-09-27', title: '解锁进度调整',
    items: [
      ['all', '卡牌与装备解锁由 5 批改为 4 批，每批所需经验 20／30／40／50；已解锁的内容全部保留。']
    ]
  },
  {
    version: 'v0.9.1', date: '2026-09-27', title: { wa: '选手照片更新', new: '封面更新日志' },
    items: [
      ['wa', '26 名选手换上 2026 赛季现役队服照片（中国赛区为官方定妆照）。'],
      ['all', '封面新增更新日志。']
    ]
  },
  {
    version: 'v0.9.0', date: '2026-09-26', title: { wa: '好友 PvP 重做', new: '手机战斗与卡牌说明' },
    items: [
      ['pvp', '对战界面整体重做：上下对坐的牌桌，拖牌出牌，打出的牌双方都在桌面中央完整展示。'],
      ['pvp', '回合结束时就摸好下回合手牌，对手回合里可以先看牌、先盘算。'],
      ['pvp', '新战报栏：从左侧滑出，每一步谁出了什么牌、造成了什么效果都能点开看。'],
      ['pvp', '新结算画面：胜利与失败有各自的动画与音效，附双方数据对比。'],
      ['pvp', '再来一局：双方同意后在同一房间直接开新局，先后手互换。'],
      ['pvp', '回合限时 75 秒，最后 20 秒出现燃烧的引线；连续 3 回合超时判负。'],
      ['pvp', '云端构筑库改为卡牌网格 + 费用分布 + 列表，可点开看大图与训练后版本。'],
      ['pvp', '修复：打完一幕后"存储失败"、PvP 页面空白、PvP 卡牌没有选手照片。'],
      ['wa', '补齐最后 16 名选手的真人照片，200 张选手牌全部有照片。'],
      ['all', '第一幕稍微加难一点。'],
      ['all', '逐张核对全部卡牌说明，修正与实际效果不符、用词不统一的地方（例如"基础伤害 +true"）。'],
      ['all', '手机战斗界面重排：一屏显示完整，所有手牌都在屏幕内，点牌时画面不再跳动，特效不再飞出屏幕。'],
      ['all', '卡牌说明改为鼠标停留约 1 秒才弹出，移开即关闭。'],
      ['all', '第一场战斗的前两个回合加入新手指引。']
    ]
  },
  {
    version: 'v0.8.0', date: '2026-09-25', title: '成就与手机操作',
    items: [
      ['all', '成就系统：局内成就与生涯成就，完成可获得称号。'],
      ['all', '手机改为点击出牌（点一下选中、再点一下打出），长按看详情。'],
      ['all', '随机训练、随机奖励会弹窗写明是哪张牌、数值怎么变。'],
      ['all', '第一幕难度下调，新手更容易见到第一幕决战。']
    ]
  },
  {
    version: 'v0.7.0', date: '2026-09-24', title: '赛程与构筑系统',
    items: [
      ['all', '每幕扩展为 15 层地图 + 第 16 层决战；未知房间、补给箱、事件池。'],
      ['all', '每幕决战从 3 个候选中抽取，地图顶部提前显示；敌人分弱组与强组，加入多人群战。'],
      ['all', '难度等级 0–10、专属特质、开局抉择、装备与补给品。'],
      ['all', '卡牌解锁进度、跳过奖励补偿、投资与商店刷新。'],
      ['all', '战绩、图鉴、局后结算、牌组与牌堆查看。'],
      ['all', '程序生成音效与打击感；状态改为图标徽章。'],
      ['wa', '卡牌稀有度（普通／罕见／稀有），只表示出现频率。'],
      ['wa', '新增 112 名扩展选手的照片。'],
      ['new', '战术卡牌重新设计；新增燃烧、部署、连击、过载、发现等关键词卡。']
    ]
  },
  {
    version: 'v0.6.0', date: '2026-09-23', title: '赛季路线与卡池扩充',
    items: [
      ['wa', '各赛区卡池扩充，赛季路线更多样；抽牌与弃牌加入动画。'],
      ['new', '新手引导、卡牌与像素角色改进。'],
      ['all', '战斗角色改为战术小人，出牌节奏调整。']
    ]
  }
];

export const TAG_LABELS = { wa: '瓦 Demo', new: '新 Demo', pvp: '好友 PvP', all: '两个版本' };
export const LATEST_VERSION = CHANGELOG[0].version;

// One demo's log: only its lines, entries without any dropped. PvP lines keep a tag
// in the Wa log; everything else there is implicitly about that demo.
export function changelogFor(demo) {
  const tags = demo === 'wa' ? ['wa', 'pvp', 'all'] : ['new', 'all'];
  // A title can differ per demo ({ wa, new }) when the headline item is demo-specific.
  const entries = CHANGELOG.map(r => ({ ...r, title: typeof r.title === 'string' ? r.title : r.title[demo], items: r.items.filter(([t]) => tags.includes(t)) })).filter(r => r.items.length);
  return { key: `changelog-seen-${demo}`, entries, labels: demo === 'wa' ? { pvp: '好友 PvP' } : {} };
}
