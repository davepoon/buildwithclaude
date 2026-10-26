---
name: feeling-search
description: "Turn a vague feeling into concrete visual style. Use when the user describes a mood, atmosphere or sensation in plain language and needs art-direction vocabulary — for image generation prompts, concept art, game art direction, illustration style, brand visuals, or when they ask what style/风格/氛围 matches a sentence. Maps one colloquial sentence to 762 feeling words and 598 visual styles (with definitions, related words and reference images). Runs on a local cached lexicon for free; only falls back to a paid cloud call when nothing matches locally and the user allows it. 关键词：感觉检索、氛围、情绪、美术风格、风格参考、画面调性、prompt 风格词、找一个匹配的画风、feeling search、visual style lookup、mood to art style."
category: design
license: MIT
metadata:
  author: xixi048
  version: "1.0.0"
  language: zh-CN
---

# 感觉检索 · 用你的感觉检索美术风格

## Overview

输入一句口语化的感觉描述（中/英皆可），输出**感受词 + 视觉风格**：

```
"下雨天一个人走在便利店门口，冷白灯光"
   → 感受词：光 / 白 / 冷光 / 古寂 …
   → 视觉风格：灰烬寒冬、哥特彩色玻璃、冰晶冷白、枯山水 …
```

每一条风格带中文名、英文名、一句话定义、父风格、命中了哪些词。用来做图像生成的风格词、
概念设计的方向锚点、或者单纯回答「这种感觉在美术上叫什么」。

数据规模：**762 个感受词 / 598 个视觉风格**（含 181 个细分变种），词表自带每个词的落点风格。

## 两条路径 · 先免费后付费

| 路径 | 触发条件 | 联网 | 花钱 |
|---|---|---|---|
| 本地词典档 | 句子里能命中词表（大多数情况） | 否（首次拉词表除外） | 否 |
| 云端 analyze | 本地**一个词都没命中**，且显式 `--allow-cloud` | 是 | 是，1 次额度 |

顺序是硬的：**先用本地，本地不够再 `--fuzzy`，还是不行才考虑付费**。
绝大多数句子在本地档就能出结果，别一上来就烧额度。

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
# ① 免费档：连近义词一起匹配（gloss 词袋里混有易混词，可能带进反义，看结果取舍）
python scripts/fs_api.py analyze "<文本>" --fuzzy

# ② 付费档：确认用户同意后再加，会消耗 1 次额度
python scripts/fs_api.py analyze "<文本>" --allow-cloud
```

没配 `FS_QUOTA` 时付费端点会被 402 拦下，脚本会明确报 `payment_required` 并提示改走免费端点，
**不会静默失败、也不会把本地结果伪装成云端结果**（`source` 只有 `local` / `cloud` 两个值）。

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
| `status` | 额度/缓存/连通性体检 | 免费 |
| `dict [--refresh] [--with-items]` | 拉取/刷新词表缓存 | 免费 |
| `analyze <文本>` | 一句描述 → 感受词 + 风格 | 本地免费；`--allow-cloud` 时 1 次 |
| `lookup <词>` | 词的落点风格、共现词、对立词 | 免费 |
| `style-words <风格id>` | 某风格挂了哪些词 | 免费 |
| `style <风格id>` | 风格详情含图与出处 | 1 次 |
| `images <id1,id2,…>` | 批量取图，最多 5 个 | 1 次 |

通用参数：`--json` · `--offline`（只读缓存，绝不联网）· `--refresh`（强制刷新词表）·
`--words N`（1–12）· `--styles N`（1–30）。全局参数写在子命令前或后都行。

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `FS_QUOTA` | 否 | 云端额度 token。**留空 = 永不调用任何付费端点** |
| `FS_API_BASE` | 否 | 服务端点，默认 `https://xiximm.cloud` |
| `FS_CACHE_DIR` | 否 | 词表缓存目录，默认 `~/.cache/feeling-search` |
| `FS_CACHE_TTL` | 否 | 缓存有效期秒数，默认 604800（7 天） |

## 常见故障

- **`payment_required`** —— 付费端点需要额度。先确认用户是否同意付费；否则改走 `dict` /
  `lookup` / `style-words` 这些免费端点。
- **`word_not_found`** —— 词表里没这个词。先用 `dict --with-items` 看看词表实际有什么，
  或直接对整句用 `analyze`。
- **`network_unreachable`** —— 连不上服务端。词表缓存还在的话用 `--offline` 继续跑本地档。
- **本地零命中** —— 先加 `--fuzzy`（免费），再考虑 `--allow-cloud`。
- **结果里出现反义词** —— `--fuzzy` 开了近义词匹配，而 gloss 词袋里刻意混着易混词
  （如「温暖」带「冷寂」）。去掉 `--fuzzy` 即只认本词。
- **中文乱码** —— Windows 控制台设 `PYTHONIOENCODING=utf-8`。

## Resources

- `scripts/fs_api.py` —— 零依赖客户端，本地词典优先 + 付费云端兜底
- `references/api-contract.md` —— 线上 API 的完整契约（端点、参数、计费、错误码）
