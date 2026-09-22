# 瓦demo发布记录

2026-09-22 用户授权瓦demo上线，新demo先本地试玩。

- 发布仓库 WeijieCao77/val_rougue，main自动部署到Railway Val_Rogue / production / val_rougue。
- 首次成功发布功能提交 c1b37d3；线上 https://valrougue-production.up.railway.app/，好友对战 /pvp/。
- 新demo本地 http://127.0.0.1:4180/new/，生产对页面、JS、CSS全部404，首页与PvP页隐藏入口；已分别用真实浏览器验收，0页面脚本错误。
- 持久卷 val_rougue-volume 挂载/data，DATA_DIR=/data、NODE_ENV=production，单实例文件存储。PG适配未连接实库，当前上线不使用PG。
- npm test 109通过，构建通过。线上新开赛按真实首幕动作游玩，全部奖励后历史库自动保存1份满血构筑，0页面错误。
- 线上两个独立浏览器账号完成建房、加入、双方准备、轮流出牌、刷新恢复与认输。
- 凭据仅保存在被忽略的本地报告或用户指定文件，没有上传生产服务器或GitHub；普通游戏不会调用DeepSeek。
- DeepSeek v4-pro负责隔离实现与测试初稿、返修；主代理审核、集成、实际执行测试与部署。
- 匿名账号恢复凭证需由玩家保管；已有旧规则单机存档可继续玩，生成PvP历史构筑需要重新开赛。
