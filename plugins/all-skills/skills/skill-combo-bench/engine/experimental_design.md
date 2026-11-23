# V6.0 实验设计

## 1. 目标与边界

本设计比较 Skill 对可观察任务行为的影响，分别记录 Agent、Harness、Model Provider 和 Skill Package。默认实验是 `MOCK_ONLY` 软件闭环：5 个合成任务，条件 `N/A/B/AB`，每条件 `repeat=2`，总计 40 个计划 run。该样本只验证执行路径，不支持真实模型排行榜或统计功效声明。

## 2. 可证伪假设

- H1：A+B 条件在指定主要终点的均值不同于 N 基线。
- H2：AB 的风险差尺度交互项不为 0；不预设方向。
- H3：随轮次增加，早期规则的遵循率发生变化。
- H4：可控工具故障降低完成率，而有界重试改善安全处理率。
- H5：模态和预处理策略改变结构化提取或图像事实任务结果。

所有假设以完整 run 为统计单位。轮次和工具调用是 run 内过程数据，不当作独立样本。

## 3. 条件与加载顺序

- `N`：无 Skill；`A`：仅 A；`B`：仅 B；`AB`：同时加载 A 与 B。
- 仅在 Harness 支持且加载语义可区分时增加 `A+B`、`B+A`；并行隔离条件记为 `A||B`，不得并入 AB。
- 多 Skill 扩展采用预注册因子或成对设计，不无控制穷举排列。

## 4. 控制与随机化

同一配对块固定任务版本、媒体 SHA-256、工具初值、Agent/Harness/Provider/Model 版本、System Prompt、温度、Token 上限、超时、重试、Judge 和 Skill 哈希。每个 run 有独立 `run_id`，同一任务跨条件使用相同 `repeat_index` 和可比种子。条件顺序按种子随机化或平衡；不可控变量写入实验元数据。

## 5. 上下文与状态分层

`SHORT` 默认最多 3 轮、输入 0–4000 Token；`MEDIUM` 最多 8 轮、4001–16000 Token；`LONG` 最多 20 轮、16001–64000 Token。实际 Token 单独记录，不假设不同模型的 Token 等价。状态初值在每个配对 run 前重置，防止跨任务污染。

## 6. 工具链与故障

最小链为 `mock_database create -> 保存结果并规范化引用 -> mock_calculator -> mock_database assert`。故障数据支持 timeout、invalid argument、server error、intermittent failure、duplicate response、stale state 和 partial result；默认只启用确定性的单次 `server_error`。每次注入记录配置次数、实际触发次数、种子和恢复结果。重试、总超时、重复调用和熔断均由配置限定。

## 7. 多模态与变异

CSV/JSON/SVG 资产均为 synthetic，并记录生成方式、MIME、大小和 SHA-256。SVG 文本可审计不等于 Adapter 已通过视觉理解验证。变异保留原始任务、算子版本、种子、diff、目标规则和有效性审核；只有有效变异进入 Mutation Score 分母。

## 8. 分析计划

主要终点预先指定为 run 级 Task Success。报告 n、条件原始均值、效应量、95% CI、排除数、检验和限制。配对近似连续指标可用配对 t 检验并检查差值；Wilcoxon 需要审查对称性；可补充以任务配对为重采样单位的 Bootstrap 或置换检验。多重比较采用 Holm。默认 `repeat=2` 不执行确认性显著性结论。

顺序采样默认关闭。启用时必须预注册主要终点、最小/最大样本、批量、alpha-spending 或其他错误率控制边界和停止原因；禁止反复普通 t 检验直到显著。预算内功效不足标记 `UNDERPOWERED`。

## 9. 评测顺序

依次执行硬约束、确定性任务检查、语义 Judge、过程质量和成本效率。Judge 仅评语义，Golden Set 未充分校准前标记 `JUDGE_NOT_CALIBRATED`，Judge 分数不能成为主要结论。所有报告分列未运行、阻塞、估算和 Mock-only 项。
<!-- FILE END: engine/experimental_design.md -->
