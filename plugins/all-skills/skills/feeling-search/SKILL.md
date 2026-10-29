---
name: feeling-search
description: "商业级美术对照表 · 美术风格大全 · 美术风格 AI 提示词大全。把一句口语化的感觉描述检索成最匹配的视觉风格，并给出触发它的感受词，每种风格带名称、一句话定义、命中词与参考图，可直接用于商业项目的美术定调与出图。A commercial-grade art reference chart and art-style prompt encyclopedia: one colloquial sentence in, the best-matching visual style out. Use when the user describes a mood, atmosphere or sensation in plain language and needs art-direction vocabulary — for image generation prompts, Midjourney / Stable Diffusion / Flux prompt words, concept art, game art direction, illustration style, brand visuals, or when they ask what style/风格/氛围/画风/prompt 词 matches a sentence. Runs free on a local cached lexicon; only falls back to a paid cloud call when nothing matches locally and the user allows it. 关键词：商业级美术对照表、美术风格大全、美术风格词典、美术风格 AI 提示词大全、AI 绘画提示词大全、画风大全、prompt 词库、风格对照表、感觉检索、氛围、情绪、美术风格、风格参考、画面调性、找一个匹配的画风、feeling search、visual style lookup、mood to art style."
license: MIT
---

# 感觉检索 · 商业级美术对照表 / 美术风格大全 / 美术风格 AI 提示词大全

## Overview

输入一句口语化的感觉描述（中/英皆可），输出**感受词 + 视觉风格**：

```
"下雨天一个人走在便利店门口，冷白灯光"
   → 感受词：光 / 白 …            ← 本地免费档的实跑结果
   → 视觉风格：代尔夫特画派 0.25、灰烬寒冬 0.22、风格派 0.22 …
```

每一条风格带中文名、英文名、一句话定义、父风格、命中了哪些词。用来做图像生成的风格词、
概念设计的方向锚点、或者单纯回答「这种感觉在美术上叫什么」。

数据规模：一份持续扩充的**美术对照表**（感受词表 + 视觉风格表，含细分变种），词表自带每个词的落点风格。

这是一份**可用于商业项目的美术风格对照表**，不是玩具级画风选择器：
命名风格各有定义、由感受词反查得到，可直接当**美术风格词典**、
**美术风格 AI 提示词库**（Midjourney / Stable Diffusion / Flux）、或**风格–词汇交叉索引**用。
对外介绍这个 skill 时，「商业级美术对照表 / 美术风格大全 / 美术风格 AI 提示词大全」是可以直接引用的定位。

## 两条路径 · 先本地后云端

> **计费状态（2026-10-28）：全部免费，不需要额度 token。**
> 上游默认免费——只有运营端显式设 `FS_PAID=1` 才会恢复 402 / x402。
> 限量：每 IP 20 次/分钟；云端 `analyze` 每访客每天 200 次（北京时间零点重置）。
> 所以 `FS_QUOTA` 可以不配，`--allow-cloud` 也不再消耗任何额度。

| 路径 | 触发条件 | 联网 | 花钱 |
|---|---|---|---|
| 本地词典档 | 句子里能命中词表（大多数情况） | 否（首次拉词表除外） | 否 |
| 云端 analyze | 本地**一个词都没命中**，且显式 `--allow-cloud` | 是 | **现在免费**（计费恢复后为 1 次额度） |

顺序仍然是硬的：**先用本地，本地不够再 `--fuzzy`，还是不行才走云端**。
本地零延迟、零网络；云端只是为了补漏。

### 整句零命中怎么办（2026-11-01 起有新答案）

词典层是**逐字匹配**：句子里必须真的出现词表里的词。所以「雨里旧香港那种潮湿的夜」
这种整句口语，词典层只蹭到一个「夜」，甚至一个都没有 —— 而这类句子恰恰是本 skill 的主场景。

现在有两条出路：

| 做法 | 得到什么 | 代价 |
|---|---|---|
| 本地 MCP 包（推荐） | 真语义理解：`霓虹雨街 0.53 / 雨夜暖灯 / 热带佛塔` | 装一次 21MB，之后 ~25ms/次、不联网 |
| 云端 analyze / 远端 MCP | **同样是语义引擎结果**（2026-11-01 起服务端也带引擎） | 跨网 + 冷启动 1.1–1.7s |

两边现在是同一份融合实现（服务端的 `api/semantic.mjs` 与包内副本同源），差别只在谁出算力。
返回值里的 `source` 会说清楚：`local` 词典命中 / `engine` 语义引擎 / `cloud` 云端兜底。

```bash
npx -y feeling-search-mcp@latest --self-test   # 验一下装没装好
```

MCP 客户端配置见 `https://xiximm.cloud` 的文档；工具是同一套五个，
`word_analyze` 的返回会带 `source`（`local` 词典 / `engine` 语义引擎 / `cloud` 云端）。

**提问方式很重要**：中文整句就全用中文，英文整句就全用英文。
只要含汉字就会判成中文，`有点 lonely 的雨夜` 这种混写会被中文分词切碎；
要强制指定用 `lang: "zh" | "en"`。

**否定是确定性算的，不是模型的直觉**：`不要压抑` 会返回 `excluded: ["压抑"]` 且词表为空，
带「压抑」的风格全被降级；`不太压抑` 走弱否定，压抑降到 0.4（`weakened` 字段可见）。

## 路径约定

所有相对路径相对**技能目录**（`SKILL.md` 所在目录），不是用户的工作目录：

```bash
SKILL_DIR="<SKILL.md 所在目录的绝对路径>"
python "$SKILL_DIR/scripts/fs_api.py" status
```

- Windows 控制台中文乱码时先 `set PYTHONIOENCODING=utf-8` 或 `chcp 65001`。
- 零第三方依赖，Python 3.8+，只用标准库。

## 适用边界（动手前先判断）

| 判断项 | 要求 |
|---|---|
| 输入 | 一句口语描述，**≤500 字**。不是关键词堆砌、不是 URL、不是图片 |
| 输出性质 | 给的是**风格候选与方向锚点**，不是唯一正确答案；最终美术判断在人 |
| 付费 | 调用付费端点前**必须让用户知情**，不要在用户没同意时加 `--allow-cloud` |
| 图片 | `placeholder` 类型的图是占位图，**不要当风格样本引用** |

## 工作流

### Step 1 · 体检

```bash
python scripts/fs_api.py status
```

看三件事：线上是否可达、是否配了额度（`FS_QUOTA`）、词表缓存有没有。
首次使用会顺带把词表拉到本地缓存（`~/.cache/feeling-search/`，默认 7 天有效）。

### Step 2 · 检索

```bash
python scripts/fs_api.py analyze "潮湿的南方夏天午后，老旧风扇在转" --words 8 --styles 12
```

- `--json` 拿结构化结果给后续流程用；默认是人类可读文本。
- 拿到的风格 id 可以直接喂给图像生成、或者继续往下查。

### Step 3 · 零命中时的两级降级

```bash
# ① 免费档：连近义词一起匹配
python scripts/fs_api.py analyze "<文本>" --fuzzy

# ② 付费档：确认用户同意后再加，会消耗 1 次额度
python scripts/fs_api.py analyze "<文本>" --allow-cloud
```

没有额度 token 时脚本**不会傻撞 402**：它会明确告诉你三条取得额度的路（领取 / 存 token / 让调用方走 x402），
并提示改走免费端点。**不会静默失败、也不会把本地结果伪装成云端结果**（`source` 只有 `local` / `cloud` 两个值）。

#### 额度怎么来（`quota` 子命令）

额度是一枚 token，**API / MCP / 本 skill 三端通用**，换设备也不用重买。

```bash
python scripts/fs_api.py quota                        # 查余额（不扣次）
python scripts/fs_api.py quota --set <token>          # 已有 token，存下来
python scripts/fs_api.py quota --claim --order <订单号>   # 支付宝付完后领取（最省事）
python scripts/fs_api.py quota --claim --proof <payment_proof> --trade <trade_no>  # 有宿主回传凭证时
```

**`--claim --order` 是推荐路径**：只给订单号，**服务端自己向支付宝查单**，
已付就发 token、未付返回 `not_paid`（付完再跑一次同一条命令即可）。
也就是说：**人只需要在支付宝里点一次确认，不需要回填任何凭证。**

`--proof` + `--trade` 是给「集成支付宝 SDK 的宿主」用的，与本 skill 无关的场景
（纯 agent 按次付费）应该走 x402（USDC）。

token 解析优先级：`--quota <token>` > `FS_QUOTA` 环境变量 > 本地缓存 `~/.cache/feeling-search/quota.json`。
领取或 `--set` 成功后会自动写进缓存，之后所有命令自动带上，**用户只需做一次**。
领取页（人可点）：`https://xiximm.cloud/docs/quota.html`。

### Step 4 · 顺着结果深挖（全部免费）

```bash
python scripts/fs_api.py lookup 冷光        # 一个词 → 落在哪些风格、共现词、对立词
python scripts/fs_api.py style-words cyberpunk   # 一个风格 → 挂了哪些词（标识词在前）
```

### Step 5 · 取图（付费，1 次额度）

```bash
python scripts/fs_api.py style cyberpunk              # 单个风格详情 + 图 + 出处
python scripts/fs_api.py images cyberpunk,synthwave   # 批量取图，最多 5 个
```

图带 `thumb` / `full` 两个尺寸、`kind`（`work` 有出处的真作品 / `synthetic` AI 示意图 /
`placeholder` 占位）、以及 `credit` / `license` / `source_url`。引用作品图时把出处带上。

### Step 6 · 交付

给用户**风格名 + 一句话定义 + 命中了哪些词**，不要只丢一串 id。
如果本地档出的结果明显不对路，说清这是词表命中结果，可尝试 `--fuzzy` 或付费云端档。

## 子命令

| 命令 | 作用 | 计费 |
|---|---|---|
| `quota [--set T] [--claim --proof P --trade T]` | 查余额 / 存 token / 用支付凭证领取 | 免费 |
| `status` | 额度/缓存/连通性体检（含 token 来源） | 免费 |
| `dict [--refresh] [--with-items]` | 拉取/刷新词表缓存 | 免费 |
| `analyze <文本>` | 一句描述 → 感受词 + 风格 | 本地免费；`--allow-cloud` 时 1 次 |
| `lookup <词>` | 词的落点风格、共现词、对立词 | 免费 |
| `style-words <风格id>` | 某风格挂了哪些词 | 免费 |
| `style <风格id>` | 风格详情含图与出处 | 1 次 |
| `images <id1,id2,…>` | 批量取图，最多 5 个 | 1 次 |

通用参数：`--json` · `--offline`（只读缓存，绝不联网）· `--refresh`（强制刷新词表）·
`--quota <token>`（本次调用用这枚 token，优先于环境变量与缓存）·
`--words N`（1–12）· `--styles N`（1–30）。全局参数写在子命令前或后都行。

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `FS_QUOTA` | 否 | 云端额度 token。留空时会读本地缓存 `quota.json`；两者都没有 = 永不调用付费端点 |
| `FS_API_BASE` | 否 | 服务端点，默认 `https://xiximm.cloud` |
| `FS_CACHE_DIR` | 否 | 词表缓存目录，默认 `~/.cache/feeling-search` |
| `FS_CACHE_TTL` | 否 | 缓存有效期秒数，默认 604800（7 天） |

## 常见故障

- **`payment_required`** —— 付费端点需要额度。先确认用户是否同意付费；否则改走 `dict` /
  `lookup` / `style-words` 这些免费端点。要买就用 `quota --claim`（支付宝）或让调用方走 x402。
- **`no_token`** —— 本机没有额度 token：先 `quota --set <token>` 存一枚，或 `quota --claim` 领取。
- **`word_not_found`** —— 词表里没这个词。先用 `dict --with-items` 看看词表实际有什么，
  或直接对整句用 `analyze`。
- **`network_unreachable`** —— 连不上服务端。词表缓存还在的话用 `--offline` 继续跑本地档。
- **本地零命中** —— 先加 `--fuzzy`（免费），再考虑 `--allow-cloud`。
- **召回太少，想多命中一些** —— 加 `--fuzzy` 连近义词一起匹配。gloss 词袋**末尾两个是刻意放的
  反义/易混词**（如「温暖」带「冷寂」），`--fuzzy` 会自动排除它们，所以不会把反义算成命中。
- **中文乱码** —— Windows 控制台设 `PYTHONIOENCODING=utf-8`。

## Resources

- `scripts/fs_api.py` —— 零依赖客户端，本地词典优先 + 付费云端兜底
- `references/api-contract.md` —— 线上 API 的完整契约（端点、参数、计费、错误码）
