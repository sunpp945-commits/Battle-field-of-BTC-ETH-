# 藤骨战线

浏览器里的币安 USDⓈ-M 永续「多空战线」。纯静态页面，没有后端、没有密钥、没有声音。打开页面的人用自己的网络直接向币安要公开行情。

页顶可以搜索并切换币安 USDⓈ-M 永续。能连上 `fapi.binance.com` 时，列表来自公开的 `exchangeInfo`，并用全部 `ticker/24hr` 的成交额排序。如果接口返回 451，或浏览器因网络 / CORS 失败，就改用页内写好的常用永续，也可以直接输入 `SOLUSDT`、`DOGEUSDT` 这类名字。地址用短名，例如 `?coin=btc`、`?coin=eth`、`?coin=sol`，默认是 BTC。切换不必整页刷新。

## 页面上有什么

- 最新价、标记价、基差、24 小时涨跌和成交额
- 资金费率，以及距离下次结算的倒计时
- 持仓量（能拿到快照时）
- 币安全网账户多空比、币安 5 分钟主动买卖量比（这两项标明了来源）
- 近 60 秒主动买入对主动卖出的量能条
- 盘口深度：营地后面淡淡的一层，买盘在左，卖盘在右
- 主动成交变成弹丸；更重的量能变成炸弹或空投支援
- 强平（`forceOrder`）用崩裂环，和弹丸、炸弹、空投分开
- 连接状态：已连接、成交中断、快照失败，或两边都连不上

价格是永续合约，不是现货。Farside 的 ETF 数据浏览器拿不到，本页没有这一项。

## 量能规则

这些状态都在本页里用公开成交计算，**不是币安官方指标**。名义金额 = 成交价 × 数量。`aggTrade` 里买方是挂单方时，算主动卖出（空军，做空）；否则算主动买入（多军，做多）。时间按页面收到成交的时刻。

| 状态 | 条件 |
| --- | --- |
| 弹丸 | 单笔主动成交 ≥ 1.5 万美元，且 < 25 万美元。满 5 万美元画得更大 |
| 更小的成交 | 仍计入 60 秒量能。2 千到 1.5 万美元之间只抽样画出来 |
| 炸弹 | 单笔 ≥ 25 万美元且 < 100 万美元；或同一方在 3 秒内合计第一次跨过 70 万美元 |
| 空投支援 | 单笔 ≥ 100 万美元；或对方正在占优时，这一方在 5 秒内合计第一次跨过 150 万美元 |
| 占优 | 近 60 秒这一方占比 ≥ 58%，且两边合计 ≥ 50 万美元 |
| 占优计时 | 连续占优的秒数，例如「多军占优 8 秒」。变成胶着或被对方占优，计时归零 |
| 大获全胜 | 同一方连续占优满 20 秒。横幅大约停留 6 秒。之后必须先失去占优，再重新占优并再守满 20 秒，才会再次庆祝 |

3 秒量能炸弹有 4 秒冷却，下风空投有 10 秒冷却。单笔已经是炸弹或空投时，不再额外叠一次累计爆炸。

营地后面的深浅只表示当前可见盘口，不触发炸弹、空投或大获全胜。强平只来自 `forceOrder`，不重复计入量能（同一笔成交仍会在 `aggTrade` 里出现）。

## 画面对应

- 左侧绿色多军、多军营地：主动买入，做多。
- 右侧红色空军、空军营地：主动卖出，做空。空军在这里指空头一方，不是一支现实里的空军。
- 两边是戴头盔、持枪的小士兵，站在壕沟和被撕开的战线两侧。
- 主动成交变成飞过战线的弹道。炸弹在战线附近炸开。空投支援从空中落下。
- 大获全胜：占优的那一侧士兵举手，同时出现横幅。
- 强平：该侧前排倒下，并留下虚线崩裂环。
- 战线随近 60 秒买入占比左右移动。

士兵、营地、壕沟和爆炸都是为本页新画的。

## 这是公开页面

仓库里没有密钥、没有环境变量、没有统计脚本、没有账号。行情请求发生在访客自己的浏览器里。

访客的网络必须能够到达：

- `https://fapi.binance.com`
- `wss://fstream.binance.com`

中国大陆的网络经常到不了币安合约。有的网络会返回 HTTP 451。本页不提供代理，需要自行准备能访问上述地址的网络。

编写和检查时，当前这台机器访问 `fapi.binance.com` 得到 HTTP 451，响应里没有 CORS 头，所以浏览器里只能看成请求失败；同时 `wss://fstream.binance.com/market` 和 `/public` 可以收到行情。访客的网络不一定相同。

## 放到 GitHub Pages

1. 把这个目录推到仓库默认分支。
2. 仓库 Settings → Pages → Build and deployment → Deploy from a branch。
3. 选该分支，文件夹选 `/ (root)`，保存。
4. 打开 `https://<用户名>.github.io/<仓库名>/?coin=btc`。ETH 用 `?coin=eth`。

页面使用相对路径，可以放在仓库子路径下。仓库里有空的 `.nojekyll`，避免 Jekyll 改写静态文件。

## 本地打开

不要直接双击 `index.html`。模块脚本和接口请求需要一个本地静态服务：

```bash
python3 -m http.server 47321
```

然后打开 <http://127.0.0.1:47321/?coin=btc>。

检查：

```bash
node --test
node scripts/smoke.mjs
```

`node --test` 覆盖名义金额、分档、占优、20 秒大获全胜、炸弹和空投的边界。`scripts/smoke.mjs` 会起一个静态服务，确认页面和脚本能被取到，并扫描不该出现的素材名和音频接口。

## 原创画面

画面是自绘的奇幻战场：木营、旗帜、壕沟和戴盔小兵。只取中世纪两军对垒的感觉。

不使用 Plants vs. Zombies、PopCap、EA 的图像、标志、字体、音乐、音效或角色名，也没有使用该系列的剪影和官方素材。士兵、营地和弹道都是用画布现画的，不照搬其他网站的精灵。页面不包含任何音频，也没有静音开关。

## 数据从哪来

REST 快照，`https://fapi.binance.com`：

- `GET /fapi/v1/premiumIndex`
- `GET /fapi/v1/ticker/24hr`
- `GET /fapi/v1/openInterest`
- `GET /fapi/v1/depth?limit=20`
- `GET /futures/data/globalLongShortAccountRatio?period=5m&limit=1`
- `GET /futures/data/takerlongshortRatio?period=5m&limit=1`

WebSocket：

- 成交、标记价、资金费率、24 小时行情、强平：`wss://fstream.binance.com/market/stream?streams=<symbol>@aggTrade/<symbol>@markPrice@1s/<symbol>@forceOrder/<symbol>@ticker`
- 这条合并流如果接不通，改为同一主机上的 `/market/ws/<stream>`，强平这条不因为暂时没有爆仓而主动断开
- 20 档盘口：`wss://fstream.binance.com/public/stream?streams=<symbol>@depth20@100ms`
- 盘口备用：`wss://fstream.binance.com/public/ws/<symbol>@depth20@100ms`

2026-04-23 之后，币安把 U 本位合约行情拆到 `/public`、`/market`、`/private`。本页不使用旧的 `wss://fstream.binance.com/ws` 或 `/stream`。标记价、成交和强平属于 `/market`，深度属于 `/public`。

## 没有做的事

没有移植原来的本地 Python 服务、LaunchAgent、Tailscale，也没有 ETF 抓取。没有评论、没有弹幕后端。
