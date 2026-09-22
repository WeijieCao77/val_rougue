# 在线对战服务端配置

## 环境要求
- Node.js 24.x
- 持久化存储：PostgreSQL（生产推荐）或本地文件（仅开发，生产需真实挂载卷）

## 环境变量
| 变量 | 必需 | 说明 |
|------|------|------|
| `DATABASE_URL` | 生产必需（若未提供 DATA_DIR） | PostgreSQL 连接串，格式 `postgres://user:pass@host/db` |
| `DATA_DIR` | 生产无 DATABASE_URL 时必需 | 文件存储目录，必须为真实挂载的持久卷（单实例） |
| `PORT` | 否 | 服务端口，默认 4177 |
| `NODE_ENV` | 否 | 生产环境设为 `production` |

## 安装与启动
```bash
npm ci
npm run build
npm start
```

## 生产部署
- 必须提供 `DATABASE_URL` 或 `DATA_DIR`，否则启动失败。
- 使用 `DATA_DIR` 时，必须挂载真实持久卷；服务仅支持单实例运行，不支持多进程共享文件存储。需要多实例或高可用请使用 PostgreSQL。
- 用户已授权瓦demo与PvP发布至main及现有Railway。生产使用`val_rougue-volume`挂载`/data`、`DATA_DIR=/data`、`NODE_ENV=production`，单实例。
- 新demo仅本地4180/new/可玩。生产强制返回404，不能用ENABLE_NEW_DEMO覆盖；本地可设ENABLE_NEW_DEMO=false关闭。
- `/runtime-config.js`提供无敏感信息的入口开关，两个主界面不显示线上新demo入口。

## 静态文件白名单
服务端仅允许以下精确路径（GET/HEAD）：
- `/` → `index.html`
- `/index.html` → `index.html`
- `/app.js` → `app.js`
- `/style.css` → `style.css`
- `/art-gallery.html` → `art-gallery.html`
- `/pvp/` → `online/index.html`
- `/pvp/client.js` → `online/client.js`
- `/pvp/style.css` → `online/style.css`
- `/pvp/content.js` → `content.js`
- `/pvp/helper.js` → `wa-online.js`
- `/pvp/regions.js` → `regions.js`
- `/pvp/season-map.js` → `season-map.js`
- `/new/` → `new-demo/index.html`
- `/new/engine.js` → `new-demo/engine.js`
- `/new/content.js` → `new-demo/content.js`
- `/new/ui.js` → `new-demo/ui.js`
- `/new/style.css` → `new-demo/style.css`
- `/new/season-map.js` → `new-demo/season-map.js`
- 图片资源：`/assets/(players|special|opponents)/<name>.(png|jpg|webp|svg)`

上述`/new/`路径仅非生产环境提供；生产全部返回404。其他路径返回 404。

## API 限流
- 匿名创建账户：按 IP 限流 30 次/分钟。
- 已认证请求：按 Bearer Token 限流，读 600 次/分钟，写 120 次/分钟。
- 同一 IP 的多个玩家不会互相影响。

## 数据恢复
服务端重启后自动从持久化存储加载状态，active 房间可继续对战。
