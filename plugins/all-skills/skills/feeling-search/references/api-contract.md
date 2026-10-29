# 感觉检索 · API 契约

服务端点默认 `https://xiximm.cloud`（可用 `FS_API_BASE` 覆盖）。
所有响应都是 `application/json`，支持 CORS。请求体上限 32 KB，`text` 最长 500 字。

> **计费状态（2026-10-28）：全部免费，不需要额度 token。**
> 下面表格里的「1 次额度」是**计费开启时**的口径，当前不生效。
> 免费模式只有限速 + 每日额度：每 IP 20 次/分钟；每天三条额度**各算各的桶**（北京时间零点重置，
> 超限 `429 free_daily_limit`，响应头 `X-FS-Free-Used` / `X-FS-Free-Limit`）：
> `POST /v2/analyze` 200 次、`GET /v2/images` 60 次、`GET /v2/styles/:id` 200 次。
> 免费期额度不再售卖，但 `GET /v2/quota?token=…` 仍可只读查历史余额（返回 `free_mode: true`，不扣次）；
> 不带 token 仍是 `404 billing_disabled`。
> 计费只在运营端显式设 `FS_PAID=1` 时恢复，调用方代码无需改动。
> 公开流量数据：`GET /v2/stats`（聚合，不含个人数据）。字段分三类 PV：`human_pv`（浏览器）/
> `agent_pv`（AI 智能体，含 MCP 客户端）/ `bot_pv`（爬虫）；来源有 `top_referrers`（含爬虫）与
> `top_referrers_human`（只算人类）；`by_surface` 含 `page` / `api` / `mcp`。

## 端点总览

| 端点 | 方法 | 计费 | 说明 |
|---|---|---|---|
| `/v2/dictionary` | GET | 免费 | 全量词表与风格表（顶层带 `version`，可据此判断要不要重拉） |
| `/v2/links?word=<词>` | GET | 免费 | 一个词的落点风格、共现词、对立词 |
| `/v2/words/{词}` | GET | 免费 | 同上，路径式写法 |
| `/v2/styles/{id}/words` | GET | 免费 | 一个风格挂了哪些词（标识词在前） |
| `/v2/links?style=<id>` | GET | 免费 | 同上 |
| `/v2/analyze` | POST | **1 次额度** | 一句描述 → 感受词 + 视觉风格 |
| `/v2/styles/{id}` | GET | **1 次额度** | 风格详情，含图片与出处 |
| `/v2/images?ids=a,b` | GET/POST | **1 次额度** | 批量取图，一次最多 5 个 |

v1 已于 2026-10-27 整体移除（感受层撤除），`/v1/*` 现在走平台默认 404，没有后继版本链接。

> 路径里的 `{词}` / `{id}` 是**占位符**，要换成真实值再发（`/v2/styles/minimalism`、`/v2/words/空灵`）。
> 原样发送模板（浏览器会把它编码成 `%7Bid%7D`）会回 `404 not_found`，并在 `message` 里给出改写示例。

限流：免费端点按 IP 滑动窗口，60 秒 20 次；超出回 429。

## POST /v2/analyze

请求：

```json
{ "text": "下雨天一个人走在便利店门口", "words": 8, "styles": 12 }
```

- `text` 必填，1–500 字
- `words` 可选，1–12，默认 8
- `styles` 可选，1–30，默认 12

参数校验在计费闸门**之前**：参数不合法直接 400，不扣额度。

响应（扁平结果；计费模式下会多一层 `result` 壳与交付回执）：

```json
{
  "ok": true,
  "input": { "text": "...", "lang": "zh", "chars": 14 },
  "words": [
    { "w": "冷光", "score": 1.0, "share": 17,
      "styles": ["photorealism", "luminism", "gothic-stained-glass"] }
  ],
  "styles": [
    { "id": "ice-crystal-pale", "name": "冰晶冷白", "en": "Ice Crystal Pale",
      "score": 0.2014, "hits": 2, "matched": ["白", "冷光"],
      "def": "霜白与极浅蓝的结晶冷调空间。", "parent": null }
  ],
  "excluded": [],
  "direct": [],
  "meta": { "version": "...", "engine": "lexicon", "matched_words": 7, "latency_ms": 1.2 }
}
```

字段含义：

- `words[].share` —— 这个词被几个风格使用。**≤6 是标识词**（风格专属），数字越大越泛
- `words[].score` —— 相对最高分的归一化值（0–1）
- `styles[].score` —— `Σ q² / √词条数 / 向量模长`，风格名直命额外 +1.5
- `styles[].matched` —— 这个风格命中了输入里的哪些词，解释结果用得上
- `direct` —— 输入里直接说出了风格名（中文名或英文名）时给出

## GET /v2/links?word=<词>

```json
{
  "ok": true, "word": "冷光", "share": 17, "marker": false,
  "gloss": "冷光、冷白、荧光、蓝白光、寒光、暖光、烛光",
  "explain": "色温高的均匀照明。高明度、蓝白相、对比低且无方向…",
  "english": "cold even light",
  "styles": [ { "id": "luminism", "name": "光度主义", "en": "Luminism", "def": "…" } ],
  "opposite": [], "co_occurs": []
}
```

- `marker` —— 是否标识词（`share ≤ 6`）
- `gloss` —— **词袋**：近义词 + 易混词混在一起，首词是本词。做模糊匹配时会带进反义，慎用
- `explain` —— 属性路描述：定义 / 视觉 / 触觉 / 情绪极性 / 搭配对象 / 近义边界

## GET /v2/styles/{id}/words

```json
{ "ok": true, "style": { "id": "cyberpunk", "name": "赛博朋克", "en": "Cyberpunk", "def": "…" },
  "count": 16,
  "words": [ { "w": "义体", "share": 3, "marker": true }, … ] }
```

标识词（`marker: true`）排在最前，是区分这个风格的关键。

## 图片字段

`style` 与 `images` 返回的图都带：

| 字段 | 说明 |
|---|---|
| `thumb` / `full` | 320px / 960px，绝对地址 |
| `kind` | `work` 有出处的真作品（CC0）· `synthetic` AI 生成示意 · `placeholder` 占位 |
| `credit` / `license` / `source_url` | 展示出处时直接用 |

**`placeholder` 不要当风格样本引用。** 960px 大图一张约 170 KB，`/v2/images` 一次上限 5 个。

## 计费

只在 `analyze` / `styles/{id}` / `images` 三个端点上计费，每次 1 次额度。
两条支付轨道共用额度表：

| 轨道 | 币种 | 适用 |
|---|---|---|
| x402 | USDC，$0.10/次（另有 $2.00/20 次包） | 海外 / 链上 Agent |
| 支付宝 AI 付 | 人民币，**0.10 元 / 1 次**（额度 90 天有效） | 国内 Agent |

两条轨道的价格量级不同：x402 单次 $0.10（另有 $2.00/20 次包），支付宝 0.10 元/次。
对外写价格时别混着说。

调用方式：

- 带额度 token：`X-FS-Quota: <token>` 请求头，本地扣次，不用重复支付
- 无额度：服务端回 **402**，响应体里带两条轨道的支付要求（x402 的 `accepts` 数组 / 支付宝订单信息）
- `X-FS-Rail: x402|alipay` 可强制只走一条

拿到额度 token 的方式（三条，选一条）：

1. **支付宝付款后领取**（推荐，独立端点、不重跑分析）
   `POST /v2/quota/claim`，两种给法：
   - **只给 `out_trade_no`**（推荐）：服务端主动向支付宝查单，已付即发额度，未付返 `402 not_paid`
   - **`payment_proof` + `trade_no`**（或 `Payment-Proof` 头）：宿主 SDK 回传凭证的场景
   返回 `{quota:{token,total,left,reset}, order:{…, verified_by}}`。
   **幂等**：同一订单重复领取返回同一个 token。
2. **带 `Payment-Proof` 重放** `/v2/analyze` → 响应头 `X-FS-Quota` 即 token（顺带返回分析结果）。
3. **x402（USDC）**：按 `PAYMENT-REQUIRED` 头签名付款，结算后响应头直接给 `X-FS-Quota`。

配套两个只读端点：

| 端点 | 作用 | 计费 |
|---|---|---|
| `GET /v2/quota`（`X-FS-Quota` 头或 `?token=`） | 查余额：`total/used/left/reset/expired/usable`，只读不扣次 | 免费 |
| `GET /v2/orders?out_trade_no=` | 查订单状态与是否已发额度，**不返回 token** | 免费 |

402 回执里的机器可读字段：`rails`、`agent_rails`（**只有 x402 能自动付**）、
`accepts`（x402 的链/金额/资产/收款地址）、`alipay.requires_human`、
`alipay.pay_url`、`alipay.claim`、`alipay.status_url`、`alipay.topup_url`。

## 错误码

| HTTP | error | 含义 |
|---|---|---|
| 400 | `empty_text` / `text_too_long` / `invalid_param` / `bad_json` / `missing_query` / `missing_id` / `missing_ids` / `invalid_id` | 请求参数问题 |
| 402 | `payment_required` | 需要支付（原因见 `reason`：`no_credentials` / `exhausted` / `expired` / `invalid_proof` …） |
| 404 | `word_not_found` / `style_not_found` / `not_found` / `unknown_order` / `unknown_token` | 查无此项 |
| 400 | `missing_token` / `missing_out_trade_no` / `invalid_proof` | 额度/订单参数缺失 |
| 409 | `amount_mismatch` / `resource_mismatch` / `order_check_failed` | 领取额度时的订单校验不通过 |
| 405 | `method_not_allowed` | 方法不支持（常见于用 GET 去戳 POST-only 的 `/v2/analyze`；**路径形状不对不再是 405**，模板占位符走 404） |
| 413 | `payload_too_large` / `too_many_ids` | 体积超限 |
| 429 | — | 触发限流 |
| 500 | `internal_error` | 服务端异常 |

客户端侧（`fs_api.py`）额外定义的错误码：`offline`（离线模式禁止联网）、
`no_cache_offline`（离线且无缓存）、`network_unreachable`。
