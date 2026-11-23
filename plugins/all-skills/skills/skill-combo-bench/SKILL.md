---
name: skill-combo-bench
description: Auditable, offline-first benchmark for evaluating how skill combinations affect an agent across rule compliance, task success, tool chaining, fault recovery, cost, and interaction effects. This skill should be used when a user wants to benchmark or compare skill combinations (single skills vs. skill combos) across agents such as Codex, Claude Code, OpenCode, DeepSeek Harness, or Zcode; to run a controlled offline mock experiment; to validate a skill-combination benchmark dataset; or to produce a reproducible experiment report with RC/TI/SS/CE/CPS/RS metrics.
category: testing-qa
license: MIT
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Skill Combo Bench

一个**离线优先、可审计**的 skill 组合评测框架。它量化「单个 skill vs. skill 组合」在智能体行为上的差异，覆盖规则遵循、任务成功、工具链、故障恢复、成本与交互效应，并为 Codex / Claude Code / OpenCode / DeepSeek Harness / Zcode 等外部 Agent 提供**无厂商假设**的适配层。

> 本项目默认运行在 `LOCAL` 模式下，使用确定性 Mock Agent / Mock Tools 做软件闭环验证。任何真实模型结论都必须先完成真实凭据接入与预注册实验，绝不把离线 Mock 结果包装成真实模型能力。

## 何时使用

- 用户想「评测 / 对比 / 基准测试」不同的 skill 组合（如 skill A、skill B 与 A+B）。
- 用户想运行一次受控的离线实验，验证评测流水线本身是否可复现。
- 用户想校验一份 skill 组合评测数据集或任务清单是否符合 schema。
- 用户想生成一份可复现的实验报告，输出 RC / TI / SS / CE / CPS / RS 等指标。

## 快速开始

```bash
# 1. 安装依赖（仅需 PyYAML 与 jsonschema）
python -m pip install PyYAML jsonschema

# 2. 校验配置、schema、任务与 manifest
python -m tools.bench_runner validate

# 3. 估算工作量与成本（不执行）
python -m tools.bench_runner dry-run

# 4. 运行离线 Mock 实验（默认 config/default.yaml）
python -m tools.bench_runner run

# 5. 重新生成报告 / 复现某次实验
python -m tools.bench_runner report --run-id <EXPERIMENT_ID>
python -m tools.bench_runner replay --run-id <EXPERIMENT_ID>
```

也可通过 `pip install -e .` 安装后直接使用 `skill-combo-bench` 命令。

## 核心概念

### 统计单位

统计单位固定为**完整 run**（一次完整的多轮任务执行），配对交互使用 `task × repeat`。**不得把单个轮次（turn）当作独立样本**。报告必须给出 n、效应量、95% CI、检验方法与 Holm 校正。

### 六项指标

| 指标 | 含义 |
|---|---|
| **RC** | Rule Compliance，加权规则遵循（N/A 排除分母） |
| **TI** | Tool Integrity，工具调用完整性（外部/安全失败排除） |
| **SS** | Skill Synergy，交互效应（AB>A、B 不构成超可加性） |
| **CE** | Cost Efficiency，成本效率 |
| **CPS** | Cost Per Success，单次成功成本 |
| **RS** | Robustness Score，故障恢复（RECOVERED / GRACEFUL_DEGRADED / SAFE_STOP 分列） |

### 结果分类（诚实标注）

- `MOCK_ONLY`：仅离线 Mock 验证，不代表真实模型能力。
- `NOT_VERIFIED`：外部 Agent / Provider 适配器已实现但未端到端验证。
- `NOT_RUN`：真实模型、真实费用、Judge 校准、统计推断等未执行。

## 项目结构

```
skill-combo-bench/
├── SKILL.md                 # 本文件（跨 Agent 入口）
├── config/                  # YAML 配置（default / modalities / sampling / providers / pricing）
├── schemas/                 # JSON Schema（task / run_trace / judge_result / experiment / skill_manifest）
├── engine/                  # 核心引擎（state / validation / trace / scheduler / metrics / mutation / multimodal / experiment）
├── adapters/
│   ├── agent/               # Mock + 外部 CLI 适配器（Codex / Claude Code / OpenCode / DeepSeek Harness / Zcode）
│   ├── providers/           # mock_provider / openai_compatible
│   └── tools/               # 确定性 Mock 工具 + 故障注入器
├── tools/                   # CLI、统计、Judge 校准、成本估算、trace 导出、数据集校验
├── datasets/                # 离线任务 + 多模态合成资产 + 变异集
├── prompts/                 # Judge / 任务生成 / 对抗生成提示词
├── templates/               # 报告与实验卡片模板
└── tests/                   # 单元测试 + mock_skills + golden_set
```

## 多 Agent 适配

外部 Agent 通过**无 Shell 推断**的可配置 CLI 适配器接入。核心原则：

1. **不发明厂商专有参数**：Codex / Claude Code / OpenCode / DeepSeek Harness / Zcode 子类只声明 `adapter_id`、`executable` 与 `verification_status="NOT_VERIFIED"`，通过通用 `GenericCLIAgent` 运行。
2. **配置驱动**：在 config 中把 `agent.type` 设为 `codex` / `claude_code` / `opencode` / `deepseek_harness` / `zcode`，并提供 `command` 参数数组（支持 `{task_file}` / `{workspace}` / `{run_id}` 占位符）。
3. **健康检查仅探测可执行文件**：`health_check()` 只检查 `shutil.which()`，不调用 CLI、不访问网络。
4. **未配置即 UNSUPPORTED**：未提供 `command` 时返回 `UNSUPPORTED`，绝不推断命令。

接入真实 Agent 的步骤：

```yaml
# config 中覆盖 agent 配置
agent:
  type: codex            # 或 claude_code / opencode / deepseek_harness / zcode / generic_cli
  command: ["codex", "exec", "--json", "{task_file}"]  # 由用户显式提供，框架不推断
  timeout_seconds: 120
```

## 数据集与任务契约

任务 JSON 建议字段：`task_id`、`version`、`description`、`modalities`、`turns`、`assertions`。每个 turn 含 `turn_index`、`input`、`mock_output`、`tool_calls`、`state_writes`、`state_probes`；tool_call 含 `call_id`、`name`、`arguments`、`save_as`；assertion 含 `probe_id`、`skill_id`、`probe_family`、`turn_index`、`type`、`expected`、`weight`、`evidence_source`。

工具参数约定：`mock_calculator` 用 `expression` 字符串（AST 白名单，非 eval）；`mock_database` 支持 `operation: create|get|update|assert`；`mock_weather` 用 `location`（兼容 `city`）；`mock_file_store` 用 `operation/path/content`；`mock_search` 用 `query`。工具调用保存 `save_as` 后可用 `${name.field}` 引用。

## 故障注入

`adapters/tools/fault_injector.py` 支持 `TIMEOUT / INVALID_ARGUMENT / SERVER_ERROR / INTERMITTENT / DUPLICATE_RESPONSE / STALE_STATE / PARTIAL_RESULT`，含 `probability / max_triggers / delay_seconds / seed`。任务可在 turn 内通过 `faults` 数组声明故障，框架会转换为工具级 profile 并注入。

## 报告与诚实性约束

- 报告必须区分 `MOCK_ONLY` / `NOT_VERIFIED` / `NOT_RUN`，逐项列出未运行、阻塞与 Mock-only 项目。
- Judge 校准需分别报告一致性、误差与置信区间，**不用单一相关系数宣称「已校准」**。
- 配对设计需声明顺序停止边界；样本不足时标记 `UNDERPOWERED`。
- 真实实验需先预注册零假设与 SESOI。

详细协议见 `engine/experimental_design.md`、`engine/theoretical_basis.md`、`engine/evaluation_rubric.md`、`engine/probe_protocol.md`。

## 测试

```bash
python -m unittest discover -s tests/unit -p "test_*.py" -v
```

默认 26 个单元测试覆盖指标、变异、状态校验、统计与 Judge 校准。

<!-- FILE END: SKILL.md -->
