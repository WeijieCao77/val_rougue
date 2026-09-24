# Claude Code 项目交接（2026-09-23）

先读本文件和 `AGENTS.md`；具体规则、测试和历史决定再按下文链接查阅。用户希望节省 Claude/GPT token：把可独立交付的批量实现、卡牌内容、资料整理和测试初稿交给已授权的 DeepSeek 官方 API；Claude Code 负责需求判断、审查、集成、实际运行与视觉验收。不要把模型输出直接当作已完成。调用要有次数和输出上限，不在玩家打开游戏时调用模型，不打印、提交或写入网页任何密钥。

## 当前可确认状态

- 仓库：<https://github.com/WeijieCao77/val_rougue.git>。`main` 与 `codex/tactical-card-design` 均为提交 `f2f940ec6130d34a36703103cf72458cf5d32994`；2026-09-23 交接时工作区干净，两个分支都已推送 GitHub。
- Railway 部署 `e118bacf-d040-4208-b885-041c2c90e4dc` 状态为 `SUCCESS`，线上网页资源已核对。首页：<https://valrougue-production.up.railway.app/>；瓦 Demo：`/wa/`；新 Demo：`/new/`；好友 PvP：`/pvp/`。
- 旧尝试版完整保留在标签 `demo-d0.2.0-attempt-2026-09-22`（提交 `461e7d0948c8b478b8203b484466ce79ddc290a2`）。不要移动或删除这个标签。当前两版 Demo 是继续开发的版本，不是这个冻结标签。
- 最近一次改动（2026-09-24）：两版都做了多样性改造——对手原型（各有外观、打法和特性）、每场战场、状态图标徽章、关键词高亮、商店 NPC 场景；卡牌新增燃烧／部署／连击／布防反击／过载／易伤处决流派（新 Demo 另有“发现”），PvP 同步支持。详见 `docs/VARIETY-PASS-2026-09-24.md`。瓦 Demo 赛季存档键已轮换。尚无真人试玩反馈。

## 产品和边界

瓦 Demo 保留真实选手与赛区题材：四赛区各 **50 张选手牌＋25 张赛区战术牌**，另有不计入常规牌池的诅咒、状态等。爬塔构筑可在大关结算后保存到跨局历史库，每人共 10 个位置；满位必须由玩家主动确认替换或放弃保存。独立好友 PvP 使用房间码与**同幕**历史构筑，双方真人手动出牌；各自继承最大血量并以满血开局，金钱不变成战力。服务端重放爬塔动作核验构筑，隐藏对手手牌。新 Demo 使用原创战术卡，每支原创队伍 75 张常规牌，另有共享内容；**用户要求（2026-09-24）新 Demo 不得出现任何与无畏契约、其赛事或选手相关的内容**（名称、特工／技能、地图、武器皮肤、官方赛区名如美洲／EMEA／太平洋、大师赛／冠军赛等），也不链接瓦 Demo 或 PvP；内部代码 CN/AM/EMEA/PAC 只作不可见的键名。它是独立的单人爬塔版本，存档与瓦版隔离，不要误称它已有 PvP。

用户最重视的是**打牌的乐趣、战术选择、受规则约束的随机性和卡牌手感**。参考《杀戮尖塔》一代已经验证的机制和数值设计，但核对来源后适配，不能把本项目自定规则说成原作事实，也不能照搬美术素材。保留 FPS／无畏契约玩家熟悉的烟闪、架点、补枪等战术语境；具体真人肖像、角色和品牌素材的授权问题仍需审慎核实。卡牌费用只显示数字，禁止用“金／银／铜／黑铁”给真实选手分档。现阶段先做好游戏，不扩展 League、世界账号或商业化系统。

## 开发入口和关键文件

```bash
git clone https://github.com/WeijieCao77/val_rougue.git
cd val_rougue
git checkout codex/tactical-card-design
npm ci
npm run build
npm test
npm start
```

要求 Node.js 24.x。本地默认端口 4177（或 `PORT` 指定）；首页可选择两版。`npm run build` 会生成 `app.js`、`style.css` 等浏览器产物，编辑瓦版 `ui-source.js`、CSS 或规则后要重建，并将生成文件一同提交。

| 领域 | 先看这些文件 |
| --- | --- |
| 瓦版界面与地图 | `ui-source.js`、`wa-map-redesign.css`、`season-map.js` |
| 新版界面、战斗与地图 | `new-demo/ui.js`、`new-demo/engine.js`、`new-demo/content.js`、`new-demo/season-map.js`、`new-demo/map-redesign.css` |
| PvP 和持久化 | `online/api.mjs`、`online/duel.mjs`、`online/store.mjs`、`online/client.js`、`server.mjs` |
| 构建与验证 | `tools/build-browser.mjs`、`tests/`、`package.json` |

最近一次 `npm run build` 成功、`npm test` **137 通过、0 失败**，两版地图也在桌面和 390 像素宽手机视口检查过。这些测试不等于已证明游戏平衡或好玩。Railway 使用 `/data` 持久卷、`DATA_DIR=/data`、单实例；PostgreSQL 适配未在真实生产数据库验收，改存储前应查 `docs/ONLINE-SETUP.md` 并核对当前服务端配置。

## 资料阅读顺序与过时信息

1. `AGENTS.md`：当前工作纪律、产品约定和凭据边界。
2. `docs/ROUTE-PACING-15-STOPS.md`：当前地图结构、随机性和地图视觉调整。
3. `docs/VARIETY-PASS-2026-09-24.md`、`docs/NEW-DEMO-FUN-AUDIT.md`、`docs/NEW-DEMO-PLAYTEST-2026-09-23.md`：新 Demo 可玩性诊断与自动试玩数据；结论仍待真实玩家验证。试玩脚本在 `tools/playtest-new-demo.mjs`、`tools/playtest-wa.mjs`。
4. `docs/STAGE-SNAPSHOT-PVP.md`、`docs/WA-PVP-RULES.md`：历史构筑和 PvP 规则。
5. `docs/CARD-ROLE-AND-MOTION-AUDIT-2026-09-23.md`、`docs/STS1-CARD-DESIGN-REPORT.md`：卡牌与表现参考。

部分历史文档（尤其 `MEMORY.md`、`docs/DUAL-DEMO-DELIVERY.md`、`docs/ONLINE-SETUP.md`）仍写有“新 Demo 仅本地”“生产 `/new/` 404”或每幕 11／12 站等旧状态。这些已被用户后来的上线要求和当前实现覆盖：**现在 `/new/` 在线可玩；自 2026-09-24 起每幕 15 站＋第 16 层 Boss（地图版本 2）**。阅读旧报告时区分当时状态与当前事实，必要时再核对代码和线上网页。

## 下一步

先收集用户对可滚动地图和新 Demo 平衡调整的真人试玩反馈。已知遗留：自动试玩中四队强弱不均（EMEA·道具明显最强，烟闪减伤可能过强），普通战仍偏快；瓦 Demo 尚未做同类试玩。更大的未解决问题是玩家认为游戏不够好玩、卡牌差异和高费牌决策不足、动画与 3D／像素小人不够理想，以及移动端手感。不要靠增加层数或随机概率掩盖问题。建议做几局真实首幕试玩，记录每场有意义的出牌选择、路线选择、卡组成长和失败原因，再据此调整卡牌与敌人。任何平衡结论都需要实际试玩数据支持；现有自动测试主要证明流程与规则没有回归。

更新时先让 DeepSeek 承担边界清楚的实现／测试初稿，再审核并亲自跑构建、测试和浏览器验收。用户已授权修改后直接推到 GitHub 并部署网页供自己内测；上线后仍须核对部署状态与线上文件，不能只凭 `git push` 宣称发布成功。
