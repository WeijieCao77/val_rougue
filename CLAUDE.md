# Claude Code 项目交接（2026-09-25）

新会话先读本文件，再读 `AGENTS.md`、`docs/TASKS.md`。**用中文向用户汇报。** 本文件记录的是 2026-09-25 的当前事实；更早的文档中凡与本文冲突的，以本文和代码为准。

## 一、仓库与线上

- 仓库：<https://github.com/WeijieCao77/val_rougue.git>，工作分支 `codex/tactical-card-design`。每次上线把同一提交推到 `main` 和 `codex/tactical-card-design` 两个分支：
  `git push origin codex/tactical-card-design && git push origin codex/tactical-card-design:main`
- Railway 会从 `main` 自动部署，约 1–4 分钟生效。**上线后必须用 `curl` 核对线上文件确实是新版本**（例如 grep 新函数名或新文件返回 200），不能只凭推送就说已发布。
- 线上网址：首页 <https://valrougue-production.up.railway.app/>；瓦 Demo `/wa/`；新 Demo `/new/`；好友 PvP `/pvp/`。
- 网站没有公开发布，只有用户本人使用。用户主要**用手机在线上玩**，经常不在电脑前。**用户已授权所有操作**：做完就直接测试、推送、上线，不需要让用户在本地测试。
- 冻结标签 `demo-d0.2.0-attempt-2026-09-22` 不要移动或删除。
- 本地运行：`npm ci && npm run build && npm test && npm start`（Node 24，默认端口 4177）。编辑瓦版 `ui-source.js`、CSS 或规则后必须 `npm run build`，并把生成的 `app.js`、`style.css`、`art-gallery.html`、`character-stage.js` 一起提交。
- 2026-09-25 交接时：`npm test` **329 项全部通过**；工作区干净；所有后台代理和工作树都已清理。

## 二、用户的工作偏好（必须遵守）

- 所有汇报用简体中文。
- 做完直接上线并核对线上，然后汇报。可以同时开多个后台代理（Agent 工具 + `isolation: "worktree"`）并行处理互不重叠的任务。
- **控制内存**：机器 16 GB。每个代理同时最多 2 个试玩进程、1 个本地服务器、1 个浏览器实例，用完立即关闭；合并后清理工作树（`git worktree remove -f -f`、`git branch -D`）。
- 游戏设计立场：
  - 以《杀戮尖塔》一代为标杆，学精髓而不照搬；小丑牌也可借鉴部分机制。
  - 要有真实难度，但不能难到新手连第一幕 Boss 都见不到。
  - **不教玩家怎么玩**：不写"流派""推荐"等构筑指导，只描述效果。
  - 多样性和随机性是乐趣核心。
  - 界面走现代 FPS 战术风，干净，不花哨。
  - 所有内容融入 FPS 背景：不用"药水、遗物"这类奇幻词，改用补给品、装备等。
- **新 Demo 禁止出现任何与无畏契约相关的内容**：名称、赛事（VCT、大师赛、冠军赛）、选手、特工、技能、地图、武器皮肤、官方赛区名（美洲、EMEA、太平洋、中国作为联赛名），也不链接瓦 Demo 或 PvP。内部代码键 CN/AM/EMEA/PAC 可以保留，但不能显示给玩家。
- 瓦 Demo 保留真实选手与赛区题材。卡牌费用只显示数字，**禁止**用金／银／铜／黑铁或"选手等级"给真人分档；稀有度只表示"出现频率"。选手定位要有来源（vlr.gg 特工使用率），不能凭记忆改。
- 用户桌面有 `deepseek_api_key.txt`。`AGENTS.md` 希望把批量初稿交给 DeepSeek，但近期都是 Claude 代理直接实现。无论用不用，都不要打印、复制或提交任何密钥。

## 三、两个版本现状

**共同框架**
- 每幕 15 层地图，第 16 层 Boss，共三幕（地图版本 2）。固定层：第 1–2 层普通战，第 7 层商店，第 9 层补给箱，第 15 层休整；前 5 层不出精英。
- 未知房间进入时才揭晓（事件、战斗、商店或补给箱，带保底）；每幕 9 个事件。
- 敌人分弱池和强池，包含多敌人群战；每幕 Boss 从 3 个候选中按种子抽取，地图顶部提前显示。

**局外与局内系统**
- 专属特质、开局抉择、难度等级 0–10（按队伍／赛区逐级解锁）。
- 装备：约 45–49 件，最多 6 个槽，满了可以替换或出售。
- Boss 奖励三选一；补给品 3 个栏位；永久投资；商店刷新；跳过卡牌奖励有补偿。
- 解锁进度：5 级，每级加 8 张牌和 3 件装备。
- 成就：局内和生涯两类，每版 60 多项，奖励称号。
- 图鉴（见过才点亮）、战绩（最近 30 局）、局后结算、牌组和牌堆查看器。

**战斗**
- 状态图标徽章；意图显示实际伤害；战场修正。
- 敌人特性：狙击手瞄准、反击、背水一战、控制节奏等。
- 关键词：燃烧、部署、连击、过载、保留、发现（仅新 Demo）、虚无、固有、X 费、成长。

**表现与操作**
- 程序生成音效与打击感；程序生成 3D 小人（`shared/chibi-figure-source.js`）。
- 手机上点击出牌（不能拖），长按看详情；电脑上可以拖牌或点击。
- 随机效果结算后会弹窗，写明是哪张牌、数值怎么变。

**瓦 Demo（`/wa/`）**
- 四赛区，每区 50 张选手牌 + 25 张战术牌；选手牌有稀有度。
- 184/200 名选手有 vlr.gg 照片，来源记录在 `assets/player-sources.json`。
- 好友 PvP（`online/duel.mjs`）始终一对一，只带赛区特质，不带装备和补给品。
- 服务端会重放爬塔动作来核验构筑。规则改动用标记区分版本：`rules` 1/3/4、`mapVersion` 1/2、`econ` 1；**旧记录必须仍能按旧规则重放**，改瓦版规则时新增标记并补测试。
- 教学模式（createRun，旧 E01–B01 敌人）冻结，`tests/fixtures/legacy.json` 必须原样重放。

**新 Demo（`/new/`）**
- 四支原创队伍：烈锋突击队、磐石守备队、雾隐战术组、疾风调度组。每队 75 张专属牌，另有 144 张共享牌，共约 444 张；有稀有度。
- 存档与瓦版隔离；没有 PvP。

## 四、关键文件

| 领域 | 文件 |
| --- | --- |
| 瓦版规则与界面 | `engine.js`、`content.js`、`wa-rules.js`（规则版本与敌人调参）、`wa-events.js`、`wa-achievements.js`、`wa-keyword-cards.js`、`card-rarity.js`、`season-map.js`、`ui-source.js`、`wa-phone.css` |
| 新版 | `new-demo/engine.js`、`content.js`、`ui.js`、`season-map.js`、`events.js`、`economy.js`、`run-extras.js`、`achievements.js`、`tactical-card.js`、`phone.css`、`tactical-theme.css`、`arena.css` |
| 共享 | `shared-route-generator.js`、`shared-unknown-room.js`、`shared-event-core.js`、`shared-unlock.js`、`shared/status-icons.js`、`shared/run-meta.js`、`shared/achievements-core.js`、`shared/result-summary.js`、`shared/tap-play.js`、`shared/touch-feel.js`、`shared/sfx.js`、`shared/juice.js`、`shared/character-controller.js` |
| 在线 | `online/api.mjs`（爬塔重放核验）、`online/duel.mjs`、`online/client.js`、`server.mjs`（**静态文件是白名单**：新增前端文件必须在这里加路由） |
| 构建与测试 | `tools/build-browser.mjs`（瓦版模块列表与 CSS 拼接）、`tests/*.test.mjs` |
| 试玩机器人 | `tools/playtest-new-demo.mjs`、`tools/playtest-wa.mjs`（有 smart／casual／naive 三种策略，参数有 `--seeds --acts --unlock --policies` 等） |

## 五、平衡现状与机器人说明

- 2026-09-25 为下调难度，目标定为（难度 0、基础牌池）：
  - smart 机器人：首战失血 3–6，第一幕通关约 70–80%，三幕通关约 25–35%；
  - casual 机器人（模拟普通玩家）：至少 50% 的对局能打到第一幕 Boss。
  - 当时实测：新 Demo smart 第一幕 77%、三幕 23%，casual 到达 Boss 55%；瓦版 smart 第一幕 73%、三幕 25%，casual 到达 Boss 60%。详见 `docs/DIFFICULTY-AND-RESULTS-2026-09-25.md`。
- **机器人规则刚改过**：smart 机器人原来会读到真实抽牌顺序（相当于作弊）。现在改为：先在一份打乱了抽牌堆和随机种子的副本上规划，只打出第一张，再按真实局面重新规划。改动在 `tools/playtest-*.mjs` 的 `fogged`／`foggedTurn`。改完后 smart 的通关率会下降。交接前做了小样本试跑（难度 0、基础牌池、只跑第一幕）：
  - 新 Demo：第一幕通关 18/24（75%），前两场平均失血 5.7，在目标内。
  - 瓦 Demo：第一幕通关 8/15（53%），低于 70–80% 的目标。美洲、中国赛区各 1/4，EMEA 4/4，太平洋 2/3。样本太小。
  - **下一步第一件事**：用更大样本重测瓦版，例如 `node tools/playtest-wa.mjs --seeds 10 --acts 3 --unlock base`（很慢，每局 1–3 分钟，最多 2 路并行）。如果确实偏难，再调低第一幕。规则 4 已经上线，调数值要新增 `rules: 5` 标记，不能直接改规则 4 的数值，否则已记录的规则 4 对局会重放失败。
- 遗留问题：
  - 瓦版中国赛区偏弱（第一幕 Boss 和第二幕死得多）；
  - 新 Demo 烈锋突击队首战失血偏高；
  - 所有数据都来自机器人，需要用户真人反馈。

## 六、任务清单与下一步

- `docs/TASKS.md` 中已完成：A1–A3、1–9、11–13、15、16、R15、B6、B7、B10。之后又做完了成就系统、手机点击出牌、界面重叠修复、弹层关闭修复、难度下调、随机结果弹窗。
- 用户还没决定的：第 10 条"规则对齐尖塔"（新 Demo 敌方布防每回合清零、删牌逐次涨价、取消瓦版同名牌 3 张上限）；第 14 条"每日挑战"。
- 建议下一步：
  1. 用去掉作弊的 smart 机器人重测两版难度，必要时微调，然后上线；
  2. 收集用户真人试玩反馈，尤其是手机上的点击出牌、多敌人选目标、成就是否容易达成；
  3. 处理瓦版中国赛区和新 Demo 烈锋突击队的平衡。
- 每次改完：`npm run build` → `npm test` → 提交（提交信息末尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`）→ 推送两个分支 → `curl` 核对线上 → 中文汇报 → 更新 `docs/TASKS.md`。

## 七、过时资料提醒

`MEMORY.md`（仓库里的）、`docs/DUAL-DEMO-DELIVERY.md`、`docs/ONLINE-SETUP.md`、`docs/ROUTE-PACING-12-STOPS.md` 的旧版本，以及较早的审计报告中写的"新 Demo 仅本地""每幕 11／12 站""137 项测试"等都是旧状态。以本文件和代码为准。
