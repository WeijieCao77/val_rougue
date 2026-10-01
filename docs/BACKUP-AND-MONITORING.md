# 备份、错误上报与信箱（2026-09-28）

内测前的两项保障：在线数据库自动备份（含离线拉取到电脑），以及客户端/服务端错误上报和玩家「信箱」。全部只用 Node 24 自带能力，不加 npm 依赖、不加付费服务。

## 一、管理密码 ADMIN_TOKEN

后台 `/admin/`、备份下载等管理接口都靠一个环境变量 `ADMIN_TOKEN` 保护。

- **没设置 `ADMIN_TOKEN`**：`/admin/` 和所有 `/api/admin/*` 一律返回 404，管理功能整体关闭。
- **设置方法（Railway）**：服务 Val_Rogue → Variables → 新增 `ADMIN_TOKEN`，值填你自己定的管理密码，保存后 Railway 会自动重新部署。
  - 文档和仓库里只写占位符，例如 `ADMIN_TOKEN=<你的管理密码>`。**不要把真实密码写进仓库、文档、提交信息或聊天记录。**
  - 可以是自己好记的密码；服务端做了防猜测锁定（见下）。越长越安全，建议至少 12 位。
- **防猜测**：
  - 同一个 IP 15 分钟内输错 5 次 → 这个 IP 被锁 15 分钟（返回 429「密码错误次数过多，请 15 分钟后再试」），锁定期间输对也进不去。
  - 全站 1 小时内累计输错 50 次 → 所有管理接口锁 1 小时（返回 429「后台因多次密码错误已暂时锁定」）。成功登录不会清零全站计数。
  - 比较使用 sha256 摘要 + 常量时间比较；服务端从不记录提交的密码，IP 只以加盐哈希参与计数。
- **后台页面**：浏览器打开 `https://valrougue-production.up.railway.app/admin/`，输入「管理密码」。密码只保存在当前标签页（sessionStorage），关闭标签页即清除。玩家页面上没有任何后台入口。

## 二、自动备份

### 服务器端（Railway 上自动运行）
- 代码：`online/backup.mjs`，在 `server.mjs` 启动时开启；不需要外部 cron。
- 时机：启动约 2 分钟后，如果最近 24 小时内没有备份，就立即做一份；之后每小时检查一次，最新一份满约 1 天就再做一份。
- 方法：SQLite `VACUUM INTO` 写出一份一致的、压缩过的快照（WAL 模式下读写不被阻塞，只在复制期间占用主线程，目前数据量下远小于 1 秒）。先写临时文件再改名，半截文件不会被当成备份。
- 位置：`${DATA_DIR}/backups/online-YYYYMMDD-HHMM.db`（时间为 UTC）。
- 每次备份在日志里写一行：`数据库备份完成：文件名（大小，耗时，检查 ok，保留 N 份，删除 M 份）`。
- `backups/latest.json`：最新快照的文件名、时间、字节数、完整性检查结果、每张表的行数（行数是从快照本身读出来的，同时证明快照能打开）。
- 设置环境变量 `BACKUPS=off` 可以关闭自动备份（仅用于排查问题）。

### 保留策略
- 每天只保留当天最新的一份；保留最近 **7 天** 的每日快照；
- 另外保留最近 **4 个星期日**（UTC）的快照作为周备份；
- 其余自动删除。正常情况下磁盘上最多约 11 份。

### 离线拷贝到电脑
- 接口：`GET /api/admin/backup/latest`，请求头 `Authorization: Bearer <管理密码>`，返回最新快照的 gzip 流（文件名在 `X-Backup-File` 头里）。后台页面的「下载最新备份」按钮也是调用它。
- `POST /api/admin/backup/run` 可以立即做一份（后台页面「立即备份」按钮）。
- 电脑端脚本（二选一，都**不会**自己注册计划任务）：
  - Windows PowerShell 5.1：
    `powershell -NoProfile -ExecutionPolicy Bypass -File tools\pull-backup.ps1 -Destination D:\val-backups -TokenFile C:\Users\<你>\val-admin-token.txt`
  - Node：
    `node tools/pull-backup.mjs --dest D:\val-backups --token-file C:\Users\<你>\val-admin-token.txt`
  - 密码来源：`-TokenFile`/`--token-file` 指定的文件（只含密码一行），否则环境变量 `VAL_ADMIN_TOKEN`（Node 版还接受 `ADMIN_TOKEN`）。密码文件放在仓库以外的地方，例如用户目录；不要放进仓库。
  - 默认地址是线上网址，可用 `-Url`/`--url` 改成别的。
  - 保存为 `online-YYYYMMDD.db.gz`（本地日期，同一天再拉会覆盖当天的文件），下载后完整解压一遍并确认是 SQLite 文件，然后只保留最新 30 份。任何失败都以非零退出码结束，不会留下半截文件。
- 设置密码文件的方法（在 PowerShell 里，把占位符换成真实密码，只做一次）：
  `Set-Content -Path $HOME\val-admin-token.txt -Value '<你的管理密码>' -NoNewline -Encoding ascii`
- 定时拉取需要在 Windows「任务计划程序」中注册（由维护者征得用户同意后操作），例如每天一次运行上面的 PowerShell 命令。

### 校验备份
`node tools/restore-check.mjs D:\val-backups\online-20260928.db.gz`（也接受未压缩的 `.db`）：以只读方式打开快照，运行 `PRAGMA quick_check`，打印每张表的行数；检查不是 `ok` 或无法打开时退出码为 1。

### 在 Railway 上恢复
1. 先确认要恢复的快照没问题：在电脑上运行 `restore-check.mjs`，看行数是否合理。
2. 停止服务：Railway 服务 Settings → 暂停／把副本数设为 0（或在部署页 Remove 当前部署），确保没有进程在写数据库。
3. 打开服务的 shell（或挂载同一卷的临时服务），进入 `/data`：
   - 保留现场：`mv online.db online.db.broken-<日期>`，同时把 `online.db-wal`、`online.db-shm` 一起改名或删除（**旧的 -wal/-shm 必须移走**，否则 SQLite 会把它们套到新文件上）。
   - 放入快照：服务器上自己的快照直接 `cp backups/online-YYYYMMDD-HHMM.db online.db`；从电脑上传的 `.db.gz` 先 `gunzip -c online-YYYYMMDD.db.gz > online.db`。
4. 恢复服务（重新部署或把副本数改回 1）。启动时会自动把快照切换成 WAL 模式，账号、存档、房间、同步数据和报告都会回到快照时的状态。
5. 验证：
   - `curl https://valrougue-production.up.railway.app/healthz` 返回 `{"status":"ok"}`；
   - 在服务 shell 里运行 `node tools/restore-check.mjs /data/online.db`（服务停止时运行；运行中也可以，只读）；
   - 用一个已有账号打开 PvP 页面，确认构筑还在；后台「概况」和「备份」能正常显示。
6. 快照之后产生的新数据会丢失（最多约 1 天）。确认一切正常后再删除 `online.db.broken-*`。

## 三、错误上报

### 客户端（`shared/error-report.js`）
- 首页、登峰赛季、战术试炼、好友 PvP 都会加载；瓦版打包进 `app.js`，其余页面直接导入。
- 捕获 `window` 的 `error` 和 `unhandledrejection`，也可以手动 `reportError(err, context)`。
- 发送到 `POST /api/report/error`（`keepalive`）：错误信息、堆栈（最多约 4 KB）、页面（wa/new/pvp/landing）、版本号（更新日志最新版本）、路径（不含查询参数）、UA、视口，以及每个页面提供的粗略游戏状态（界面／阶段、第几幕／第几层、回合等）。
- **不会发送**：令牌、localStorage 内容、昵称。上下文只保留数字、布尔值和短字符串，名字里带 token/secret/key/name/nick/auth 等的字段直接丢弃。
- 同一错误（信息 + 第一行堆栈）10 分钟内只报一次；每次打开页面最多报 10 条；模块本身不会抛错、不会递归。忽略 `Script error.`、`ResizeObserver loop` 这类浏览器噪音。

### 服务端（`online/report-api.mjs`）
- 数据存在同一个 `online.db` 的 `reports` 表（本模块自行 `CREATE TABLE IF NOT EXISTS`，不改动存储的 schema 版本）。
- 错误按「类型 + 页面 + 信息 + 第一行堆栈」算指纹（数字和行列号归一化），同一天同一指纹只占一行，累加 `count`，记录出现过的版本。
- IP 只存加盐 sha256（盐存在 `meta` 表，或用环境变量 `REPORT_SALT`）。
- 限流（每 IP）：错误 10 分钟 30 条，来信 10 分钟 5 封，来信状态查询 10 分钟 60 次。请求体上限 16 KB。
- 90 天前的记录自动清理。
- **服务端错误**：`online/api.mjs` 的 `sendError` 是所有 500 的出口（在线接口、进度同步、爬塔核验线程失败都经过这里），这里通过 `online/server-errors.mjs` 把错误记为 `server-error`，带方法和路径（不含查询参数）。

## 四、信箱（玩家来信）

- 入口「信箱」（信封图标）：登峰赛季封面与对局顶栏（菜单里也有）、战术试炼封面链接行与对局顶栏、好友 PvP 顶栏。
- **只对作者私有**：没有公开留言板、投票或排行，其他玩家看不到任何来信。
- 「写信给作者」：标题（可不填）、正文（最多 1000 字）、类别（问题／建议／平衡／其他）、「附带当前游戏状态（不含账号信息）」（默认勾选，附带粗略状态和最近 3 条错误信息）、「寄出」。成功后显示「信已寄出，作者会认真看。」
- 「我寄出的信」：这台设备寄出的信，只存在本浏览器的 localStorage（每个页面分开，最多 30 封）。每封信寄出时服务端返回一个不可猜测的回执（服务端只存它的 sha256），打开列表时用回执查询作者标记的状态：已寄出／作者已读／已采纳／已修复（作者标「忽略」时玩家看到「作者已读」）。
- 后台可把来信标为 已读／采纳／已修复／忽略。

## 五、后台 `/admin/`

- 只有设置了 `ADMIN_TOKEN` 才存在；不在静态白名单里，也不从任何玩家页面链接（`tests/static-routes.test.mjs` 检查）。
- 内容（2026-10-01 改版，面向不懂技术的作者，手机可看，每节有一行「这是什么」）：
  - 「玩家概况」：现在在线、今日／昨日／近 7 天／近 30 天玩家、今日新玩家、累计玩家、存档码账号数、平均每人每日游玩时长、今日局数（开始／结束／通关）；
  - 「每日趋势」：最近 30 天的每日玩家与新玩家、游玩时长、各版本玩家三张折线图（内联 SVG，悬停或点按看当天数字），以及按天表格（含账号表推出的「新账号」，统计开始前的日子也有）；
  - 「留存」：最近 14 个首日的第二天、第七天回来人数；「玩家走到哪一步」：两个版本的漏斗；「玩家都死在哪」：输给谁、输在第几层、队伍／赛区与难度分布、手机与电脑、浏览器；「好友 PvP」：对局数、参与玩家、平均回合、再来一局；
  - 「出错情况」：每组一句话（哪个页面、出错几次、约几位玩家遇到、首次／最近时间、版本），堆栈等放在「技术详情」里；「来信」不变；「备份」显示「最新备份：时间 · 大小 · 正常」，表行数（中文表名）放在「技术详情」里；「存档码（按账号 ID 查找）」不变。
- 错误组的「约几位玩家」：`reports.ip_hashes`（2026-10-01 新增的列，启动时自动 `ALTER TABLE`）记录每天每组最多 100 个不同的加盐 IP 哈希。
- 接口：`GET /api/admin/analytics?days=7|30|90`（见下节）、`GET /api/admin/stats`、`GET /api/admin/reports?kind=&page=&since=24h|7d|30d|<毫秒>&resolved=`、`PATCH /api/admin/reports`（`{fingerprint, resolved}` 或 `{id, status}`）、`GET /api/admin/backup/latest`、`POST /api/admin/backup/run`。

## 六、玩家统计（2026-10-01）

后台「玩家概况」的数据来源。参考噜噜卡的统计侧车（访客编号 + 会话编号 + 事件），但直接存在同一个 `online.db`，不加依赖。

### 客户端（`shared/play-analytics.js`）
- 首页、登峰赛季（打包进 `app.js`）、战术试炼、好友 PvP 都会加载。
- **访客编号**：每个浏览器一个随机编号（localStorage `pa-visitor-v1`，各页面共用）。**会话编号**：30 分钟没有任何动作就换新的。
- **设备**：只发「手机／平板／电脑」（由屏幕宽度和是否触屏判断）和粗略的浏览器类别（Chrome／Safari／微信内置／QQ／Edge／Firefox／三星／其他），服务器不存 UA 原文。
- **事件**：`page_view`（打开页面）、`heartbeat`（页面在前台时每 60 秒一次，用来算游玩时长和「现在在线」）、`run_start`（版本、队伍／赛区代码、难度）、`fight_end`（第几幕、第几层、普通／强敌／决战、胜负、对手编号、回合数）、`run_end`（通关／失败／放弃、幕、层、胜场、用时分钟、失败时的对手编号）、`unlock_tier_up`（解锁到第几批）、`achievement`（成就编号）、`pvp_match_start`（第几局、是否再来一局）、`pvp_match_end`（胜负／平局、回合数）、`save_code_created`、`save_code_login`、`mailbox_sent`（只有类别）。
- 开局／战斗结束／一局结束由各版本把当前局面喂给 `observeRun` 推出来（状态记在 `pa-run-v1`，刷新页面不会重复记）；从云存档载入的半截对局不算新开局。存档码、信箱、成就模块没有 import，通过 `pa:track` DOM 事件上报。
- 发送：攒成一批，最多每 30 秒发一次（开局、结束等事件会尽快发出），页面隐藏或关闭时用 `keepalive` 发出；队列最多 200 条（先丢心跳）；每批最多 50 条；模块不会抛错。
- **不会发送**：存档码、令牌、昵称、来信内容、localStorage 内容。登录了存档码的浏览器会在 `Authorization` 头里带账号令牌，服务器据此只在 `visitors.account` 记下账号 ID（方便以后对照），事件内容里没有它。
- 战术试炼的事件只含队伍代码（breach 等内部代码）、对手编号和数字，不含无畏契约相关名称（`tests/analytics.test.mjs` 检查）。

### 服务端（`online/analytics-api.mjs`）
- `POST /api/analytics`：同源；请求体 ≤ 16 KB；每批 ≤ 50 条；事件名和每个事件允许的字段、类型、取值范围都有白名单，不在白名单里的一律丢掉。限流：每个 IP（加盐哈希，只在内存里）10 分钟 240 批，每个访客 10 分钟 60 批。
- 表（本模块 `CREATE TABLE IF NOT EXISTS`，不改存储的 schema 版本）：
  - `events`：除心跳外的原始事件（时间、日期、访客、会话、页面、事件名、版本、字段 JSON、设备、账号），索引 (day)、(visitor, day)、(name, day)。**保留 180 天**。
  - `daily_visitors`：每日汇总，每人每天每个页面一行（游玩秒数、最后活动时间、设备）。心跳只累加这里（每次 60 秒，同一人同一页面 50 秒内只算一次），不单独存行。**保留 400 天**。
  - `visitors`：每个访客一行（首次日期、最近日期、设备、浏览器、账号 ID），用于新玩家、累计玩家和留存。
  - `meta.analytics_since`：统计开始日期（第一次启动的那天）。之前的日子没有数据，后台会写明「统计从 YYYY-MM-DD 开始」；累计卡片里另外给出账号表、存档码表推出的数字。
- 日期按北京时间（`ANALYTICS_TZ_OFFSET`，单位分钟，默认 480）。「玩家」= 打开过三个游戏页面之一的访客；只看首页的单独计数。
- `GET /api/admin/analytics?days=7|30|90`：与其他后台接口相同的密码和锁定规则。

### 负载与容量（本地 `node tools/analytics-load-check.mjs`，设 `TRUST_PROXY=1`）
- 300 位访客 × 每 30 秒一批（模拟 10 分钟，6000 次请求）：全部 204，本机约 5000 批/秒，p95 约 60 ms；真实情况 300 人同时在线也只有约 10 批/秒。
- 1000 位每日玩家（每人约 20 分钟、1 局、8 场战斗）：约 12 条事件／人／天，数据库每天增长约 2.8 MB；原始事件保留 180 天约 0.5 GB（汇总表很小）。玩家多了以后可以缩短 `EVENTS_KEEP_DAYS`。

## 七、测试

- `tests/backup-reports.test.mjs`：快照行数一致、latest.json、轮换规则、启动后调度、管理接口 404/401/200 + gzip、单 IP 与全站锁定、拉取脚本（保留份数、错误密码失败）、错误上报（入库、分组、限流、同源）、来信（类别、上下文过滤、长度与限流、回执与状态）、服务端错误钩子、90 天清理、`/admin/` 仅在设置密码时存在。
- `tests/error-report-client.test.mjs`：fetch 失败或不存在时不抛错、去重、每页上限、不递归、上下文过滤、模块无 import、文案不含无畏契约／PvP 相关词。
- `tests/analytics.test.mjs`：事件与字段白名单、批量信封校验、大小／方法／同源／限流、账号只从令牌在服务端关联、每日汇总与指标（在线、日活、新玩家、时长、留存、漏斗、死亡位置、PvP）、180／400 天清理、后台接口 401／429／404、客户端（编号、会话、设备、批量、不抛错、不带令牌、`observeRun` 跨刷新只记一次、`trackOnce`）、战术试炼事件不含无畏契约词。
- `tests/static-routes.test.mjs`：新文件在白名单里；`/admin` 不在白名单、不被玩家页面链接。
