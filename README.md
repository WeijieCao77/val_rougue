# 登峰赛季

以电竞俱乐部为题材的肉鸽卡牌游戏，包含瓦 Demo 和新 Demo 两种玩法。招募选手或战术牌构筑牌组，在分叉赛季路线中选择比赛、转会、团建和粉丝活动，挑战三幕世界赛。

- 瓦 Demo 四大赛区各有 50 张选手牌＋25 张赛区战术牌；新 Demo 有 87 张共享牌＋四赛区各 75 张专属牌。
- 两版均有 14 张全局隐患与 5 张临时状态，不进入普通战斗奖励池。
- 三幕赛季，每幕 15 层路线＋第 16 层 Boss；四起点、分叉和汇合由种子生成。
- 战斗使用洗牌、抽牌、弃牌、消耗和能力牌机制；相同种子与动作可精确回放。
- 原有选手照片保留来源标注；新增选手暂用注明“非本人肖像”的原创概念头像。卡牌框、悬停说明、对战场地和路线图继续保留。
- 当前主要验证玩法框架，数值平衡仍需迭代。

## 本地运行

需要 Node.js 24，安装依赖后构建并启动。

```bash
npm ci
npm run build
npm test
npm start
```

打开 http://localhost:4177/，从开始菜单选择赛区并开始新赛季。Windows 也可运行 `启动Demo.cmd`。

## Railway 内测部署

仓库已包含 `railway.toml`，参照 [Railway 配置文档](https://docs.railway.com/config-as-code) 和 [健康检查文档](https://docs.railway.com/deployments/healthchecks)。

1. 在 Railway 创建项目，选择 Deploy from GitHub repo，连接 `WeijieCao77/val_rougue`。
2. 选择 `main` 分支，根目录使用 `/`，无需填写 `demo-v2`。
3. 配置文件指定 Railpack 构建、`npm run build`、`npm start` 与 `/healthz` 健康检查。
4. 部署成功后，在服务的 Networking / Public Networking 中生成域名，再分享给内测玩家。

服务器监听 `0.0.0.0`，自动读取 Railway 提供的 `PORT`。好友 PvP 账号与房间数据在生产环境应使用 `DATABASE_URL` 或持久化 `DATA_DIR`。

## 存档与内测反馈

爬塔当前局进度保存在当前浏览器、当前网站的 localStorage；本地 localhost 存档不会自动出现在 Railway 域名下。好友 PvP 的账号、历史卡组和房间使用服务器存储，与当前局浏览器存档分别管理。

反馈建议包含：游戏版本、赛区、种子、所在幕与节点、复现操作以及导出的对局记录。回放用于复现问题，不等同于跨设备云存档。

## 开发与测试

- 界面：`ui-source.js`；样式：`base-style.css`、`season-ui.css`。
- 配图与对手：`art-ui.js`、`weapon-frame.js`、`art-style.css`、`weapon-style.css` 和 `assets/`。方案与来源见 [美术说明](docs/ARTWORK.md)，游戏菜单可打开配图图鉴。
- 规则：`engine.js`；卡牌与赛区：`content.js`、`regions.js`、`regional-expansion.js`、`afflictions.js`；地图：`season-map.js`。新 Demo 对应文件在 `new-demo/`。
- 修改后执行 `npm run build`。`app.js` 与 `style.css` 是生成产物，随仓库提交，不能直接编辑。
- `npm test` 使用 Node 内置测试运行器，覆盖规则、路线、赛区、完整赛季状态流转、真实对局回放与 HTTP 部署入口。
- `tests/fixtures/` 仅包含冻结的游戏回归数据。四赛区真实试玩样本均在第一幕失败，不代表已验证整体平衡；强制获胜的流程测试也不代表真实通关。

开发期使用 DeepSeek 分担实现和检查，主代理审核并运行验证。线上游戏不调用模型；本地密钥、模型请求日志及内部报告不进入仓库。
