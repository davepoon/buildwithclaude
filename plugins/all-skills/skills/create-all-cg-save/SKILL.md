---
name: create-all-cg-save
category: gaming
description: "Create an all-CG save for local single-player games (galgame / AVG / RPG Maker / Ren'Py / Kirikiri / Unity). Use it when the user asks for an all-CG save, wants to unlock every CG / recollection room / gallery / differential sprite, or wants a 100% collection in a local offline save. It locates the save file, identifies the engine, finds the bytes that gate CG unlocks, and patches them with byte-level precision plus automatic backup and one-command rollback. 关键词：全CG、全CG存档、回想全解锁、解锁画廊、解锁回想、unlock all CG、gallery unlock、100% collection."
license: MIT
metadata:
  author: xixi048
  version: "1.2.0"
  language: zh-CN
---

# 创建一个全 CG 存档

## Overview

为**本地单机游戏**的已有存档产出「全 CG 版本」：定位本机存档文件 → 识别引擎与存档格式 → 找到承载 CG 解锁状态的字段 → 生成最小字节级补丁 → 带备份写入 → 可一键回滚。

核心判断：**能不能改，取决于能不能看懂存档**。本技能提供两条通道：

- **引擎快速通道** —— 存档格式已知且可被程序解析时（Ruby Marshal、明文 JSON 等），直接算出每个解锁位的精确字节偏移，一步到位。
- **通用差分通道** —— 格式未知或加密时，用「解锁前 / 解锁后两份存档做字节差分」反推解锁位，再推断阵列结构外扩到全部 CG。

## 路径约定

正文里所有相对路径都相对 **技能目录**（`SKILL.md` 所在目录），不是用户的工作目录：

```bash
SKILL_DIR="<SKILL.md 所在目录的绝对路径>"
python "$SKILL_DIR/scripts/save_scout.py" --game <游戏名>
```

- cwd 不确定时先 `cd "$SKILL_DIR"` 再执行；Windows PowerShell 同理，把相对路径拼成绝对路径。
- 脚本之间靠 `sys.path` 互相 import，**不要**把单个脚本拷到别处单独运行。
- Windows 控制台若出现中文乱码，先设 `PYTHONIOENCODING=utf-8` 或 `chcp 65001`。

## 适用边界

动手前必须先判断，不满足就明确告知用户做不到：

| 判断项 | 要求 |
|---|---|
| 联网 / 多人 | **仅限离线单机**。涉及联机对战、排行榜、在线校验、反作弊的游戏一律不做 |
| 存档位置 | 必须能在本地文件系统拿到明文或可解密的存档；云存档无法直读时先想办法同步到本地 |
| 用户权利 | 只处理用户自己合法拥有的副本 |
| 文件完整性 | 任何写入前先备份；情况不明时不猜、先问用户 |

不要做的事：不要下载或分发游戏本体 / CG 图片 / 脚本源码；不要把游戏资源提交到 Git；不要为了省事直接把存档替换成他人提供的文件 —— 应基于用户自己的存档做增量修改。

## 决策树

```
目标存档已明确？
├─ 否 → Step 2 定位存档
└─ 是 ↓
能用 scripts/engines/ 里的适配器解析出解锁字段？
├─ 是 → Step 4 引擎快速通道 ────────┐
└─ 否 → 存档是明文 / 已知结构？      │
         ├─ 是 → 直接定位字段 ──────┤
         └─ 否 → Step 5 通用差分 ───┤
                                     ↓
                           Step 6 生成计划 → Step 7 写入验证
```

## 工作流

### Step 1 · 搞清楚「CG 解锁」在这款游戏里叫什么

不同游戏差别很大，必须先问清用户要解锁的是：

- CG / 回想 / 回想模式 / Gallery / 画册 / 收藏
- 差分立绘、表情、服装
- 场景 / 事件 / 结局 / 成就

同时问清：存档路径（若已知）、游戏安装目录、是否已有可用存档槽。
**不要跳过这一步** —— 「全 CG」定义不同，改错字段会直接把进度弄乱。

### Step 2 · 定位存档

```bash
python scripts/save_scout.py --game <游戏名关键词>
python scripts/save_scout.py --dir "<安装目录>"
python scripts/save_scout.py --game <名称> --changed-within 2 --json found.json
```

`--changed-within` 很有用：让用户刚玩完游戏退出，只列出近几小时变动过的文件，通常一发即中。
找不到时查 `references/engines.md` 里各引擎的默认存档位置表。

### Step 3 · 识别引擎与存档格式

`save_scout.py` 会给出初步判断。需要人工确认时：

1. 看安装目录的标志性文件（`references/engines.md` 有完整特征表）
2. 检查候选存档的头部字节（magic / 是否 zlib / 是否可打印文本）

### Step 4 · 引擎快速通道

**RPG Maker XP / VX / VX Ace（RGSS1/2/3）—— 已完整支持**

```bash
# 结构与当前状态
python scripts/engines/rgss_save.py inspect "D:/games/x/Save01.rvdata2"
# 生成「开关置 ON」计划
python scripts/engines/rgss_save.py plan-switches "Save01.rvdata2" \
    --ids 1,3,5-40 --out plan.json
# 变量赋值（CG 看图参数常挂在变量上）
python scripts/engines/rgss_save.py plan-variables "Save01.rvdata2" \
    --set 41=1,42=3 --out plan-vars.json
```

要点：

- 存档是 Ruby Marshal，**两个流首尾相接**：第 1 段 `make_save_header`（存档界面显示用），第 2 段 `make_save_contents`（真正的游戏状态）。必须按 `read_streams()` 分段解析，按单流解析会错位。
- `:switches` 的 `@data` 是布尔数组，`'T'`/`'F'`/`'0'`(nil) 各占 1 字节，**等长替换即可改写，文件长度完全不变** —— 风险最低的写入方式。
- Marshal 是顺序自描述格式、无全局偏移表与校验和，因此改变量值带来的长度变化通常也安全；但仍要留意被 `TYPE_USRDEF`（带显式长度前缀）包裹的数据。
- **把全部开关无脑置 ON 有风险**：部分游戏的开关同时承担剧情进度、分支判定甚至 Game Over 条件。优先只置已确认 CG 相关的 ID；确需全开时务必让用户在游戏里验证。

其他引擎的存档格式与可自动化程度见 `references/engines.md`。

### Step 5 · 通用差分通道

格式不可解析时（多数闭源引擎的私有二进制），按 `references/diff-method.md` 执行：

1. 在游戏里存一份「未解锁」存档 A
2. 进游戏解锁 **1~2 张** CG，立刻再存一份「已解锁」存档 B
3. 建议解锁**两张**各存一次（A→B、B→C），两次差分才能拟合出阵列步长
4. 差分：

```bash
python scripts/save_diff.py A.save B.save --gap 8 --json ab.diff.json
python scripts/save_diff.py B.save C.save --gap 8 --json bc.diff.json
```

排除噪声：`--ignore 0x00-0x20`（时间戳、随机种子等）会让结果干净很多。

### Step 6 · 生成解锁计划

```bash
python scripts/infer_plan.py ab.diff.json bc.diff.json \
    --target A.save --count 128 --out unlock-plan.json
# 不知道总数时自动外扩
python scripts/infer_plan.py ab.diff.json --target A.save \
    --auto-extend --out unlock-plan.json
# 步长 / 阵列起点已知时直接钉死（最可靠）
python scripts/infer_plan.py ab.diff.json --target A.save \
    --stride 4 --start 0x100 --count 128 --out unlock-plan.json
```

`infer_plan.py` 做三件事：拟合等步长阵列（`start + stride`）、识别 off→on 字节值、外扩到全部 CG 槽位。

- **只有 1~2 个观测位点时步长必然歧义**：拟合出的是「观测间距」，真实步长可能只是它的约数（例：步长 4 的阵列只解锁了第 0、5 项，GCD 会给出 20），外扩就会跳过大量槽位。此时脚本会告警，必须用 `--stride` / `--start` 钉死，或再补几份快照。
- 显式给出 `--count` 永远比自动推断可靠；推算槽位超出文件边界时脚本会报丢弃数量，占比过大说明结构猜错了。

### Step 7 · 写入与验证

```bash
python scripts/apply_plan.py unlock-plan.json --dry-run   # 必须先看预演
python scripts/apply_plan.py unlock-plan.json             # 备份后写入
python scripts/apply_plan.py unlock-plan.json verify      # 校验
python scripts/apply_plan.py unlock-plan.json rollback    # 出问题回滚
```

- 写入前校验 `sha256_before`，与目标不符直接拒绝 —— 避免把针对另一份存档的计划打到新存档上。
- 会改变文件长度的补丁默认拒绝执行，需显式 `--allow-resize`。
- 写入后必须让用户实际进游戏确认。

### Step 8 · 交付

告知用户备份文件位置与回滚命令，提示进游戏验证。备份命名规则 `<存档名>.allcg-bak-<时间戳>`。

## 内置资源

| 路径 | 用途 |
|---|---|
| `scripts/save_scout.py` | 扫描常见位置找候选存档，顺带识别引擎 |
| `scripts/save_diff.py` | 两份存档字节差分，输出 diff JSON |
| `scripts/infer_plan.py` | 从差分推断 CG 阵列结构，生成解锁计划 |
| `scripts/apply_plan.py` | 应用 / 校验 / 回滚补丁（默认自动备份） |
| `scripts/engines/ruby_marshal.py` | 零依赖 Ruby Marshal 解析器 + 整数/布尔编码器 |
| `scripts/engines/rgss_save.py` | RPG Maker RGSS 存档的检查与计划生成 |
| `scripts/common.py` | 备份、原子写、哈希等公共工具 |

## 常见故障

- **Marshal 解析报"未知类型字节"** —— 多半是把多段 Marshal 流拼接的文件当单流解析了，改用 `read_streams()` 或 CLI 的 `--streams`。
- **差分结果为 0** —— 两份存档状态其实一样；确认它们是「解锁前 / 解锁后」，且存档确实被重新写过。
- **差分结果上百个区间** —— 存档含时间戳 / 压缩 / 重排，先用 `--ignore` 排除头部再试；若几乎每个字节都变了，说明存档被整体压缩或加密，普通差分失效。
- **拟合不出步长** —— 变化位点不足，或多个不同阵列混在一起；多采集几个解锁前后快照。
- **拟合出的步长明显偏大（外扩后槽位稀疏）** —— 典型是只有 1~2 个观测位点导致步长歧义，用 `--stride` / `--start` 显式指定。
- **提示「N 个推算槽位超出文件边界已丢弃」** —— `--count` 或步长偏大，先缩小范围验证，再全量写入。
- **apply 提示原始字节不匹配** —— 计划是针对另一份存档生成的，对新存档重新生成计划。
- **改完进游戏进度错乱** —— 立刻回滚；说明这批开关并非只控制 CG，改为分步、只置已验证过的 ID。

## Resources

- `references/engines.md` —— 各引擎的存档位置、文件格式、可自动化程度与坑点
- `references/diff-method.md` —— 差分法的完整操作手册
- `references/unlock-plan-schema.md` —— diff / plan 两个 JSON 的字段定义
- `references/safety.md` —— 备份、校验与合规红线
