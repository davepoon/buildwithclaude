# V6.0 评价指标与评分准则

## 1. 通用规则

默认统计单位为完整 run。所有权重和主要终点在运行前固定；`N/A` 从适用分母排除且不算通过，缺失证据单列，成功、规则遵循和过程质量不合并成不可解释的总分。零分母返回 `null` 并报告原因，不返回 0 伪装结果。

## 2. RC：规则遵循率

对 run 内有效规则断言：`RC_run = sum(w_i * pass_i) / sum(w_i)`，`pass_i` 为 0/1，`w_i>0`。按轮预定义 `alpha_t` 后：`RC_turn_weighted = sum_t(alpha_t * RC_t) / sum_t(alpha_t)`。同时报告全局、Skill、轮次、探针族 RC 以及失败数/分母。

## 3. TI：技能行为失活指数

`TI_skill = failed_eligible_probes / total_eligible_probes`。分类包括 `RULE_OMISSION`、`REQUIRED_TOOL_NOT_CALLED`、`TOOL_CALLED_INVALIDLY`、`TOOL_FAILED_EXTERNALLY`、`SAFE_REFUSAL`、`NOT_APPLICABLE`。后两者不自动计入失活；工具型失活还需任务触发、工具可用、安全规则未禁止和 Manifest 明确要求四项前提。

## 4. SS：技能交互效应

`SS_AB = Y_AB - Y_A - Y_B + Y_N`。报告 N/A/B/AB 原始均值、差值、尺度和 CI。正值为正交互，负值为负交互，近零只表示当前精度下未观察到明显交互。二元结果默认风险差尺度并说明地板/天花板；AB 高于两个单项不自动等于超加性。

## 5. CE：上下文效率

`CE = successful_task_score / normalized_context_tokens`，默认归一化单位为 1000 个输入与输出 Token；工具 Token 单列并在纳入时明确。Token 为 0 或未知时返回 `null`。分别报告输入、输出、缓存、工具和总 Token 及成功任务数。CE 不是信息熵或内部 Attention 效率。

## 6. CPS：每次成功任务成本

`CPS = total_observed_cost / successful_run_count`，成功数为 0 时 CPS 为 `null`。成本可包含输入、输出、缓存、工具和可计量外部计算；报告总成本、成功/失败 run 成本、价格来源和日期、估算与账单差异。价格缺失标 `COST_UNKNOWN`，只有 Token 时标 `TOKEN_USAGE_ONLY`，Dry Run 数字标 `ESTIMATE`。

## 7. RS：故障鲁棒性

分类为 `RECOVERED`、`GRACEFUL_DEGRADED`、`SAFE_STOP`、`FAILED`、`LOOPED`、`CRASHED`、`TIMED_OUT`。`RS_strict = RECOVERED / eligible_fault_runs`；`RS_safe = (RECOVERED + GRACEFUL_DEGRADED + SAFE_STOP) / eligible_fault_runs`。安全停止不等于恢复完成。默认各故障类型等权，若另设权重必须预注册，并报告实际注入次数。

## 8. 其他工程指标

- Task Success Rate：成功 run / 合格 run；按任务和模态分层。
- Exact Match / Schema Validity：精确匹配数或 Schema 通过数 / 对应合格数。
- Tool Call Success Rate 与 Tool Argument Validity：分别以真实工具事件和参数校验结果为分母，重试事件另列。
- Recovery Rate、Loop Rate、Timeout Rate：分别报告，避免将存活等同完成。
- Latency：报告中位数与 P95，同时给 n 和计时范围。
- Mutation Score：被检测或正确处理的有效变异 / 有效变异总数；另报存活、无效和各算子分项。
- Multimodal Task Success Rate：按原始模态和预处理策略分层，`UNSUPPORTED` 单独计数。

## 9. 统计报告

每项主要结果给 n、run 单位、均值/中位数、标准差/IQR、效应量、95% CI、检验、适用 p 值、缺失排除、Holm 校正和限制。配对 t 检验检查差值分布，报告 t、自由度、配对均值差和 Cohen's dz；Wilcoxon 审查差值对称性并说明零差值处理。Bootstrap 记录重采样数、种子、配对单位和 CI 方法；置换检验说明交换性与方案。

固定样本 `repeat=2` 仅用于 smoke test。功效分析需要 SESOI 和先导方差；不足标 `UNDERPOWERED`。顺序设计必须预注册停止边界，不能在每批后重复普通检验直到显著。

## 10. Judge 与校准

Judge 输出 `judge_version`、`task_id`、`run_id`、分项分数、总分、扣分、证据引文、不确定性和弃权字段。它不得替代自动检查。连续分数可报告明确类型的 ICC、MAE、RMSE、Pearson r、Spearman rho；有序等级用加权 Cohen's Kappa；类别用 Cohen's Kappa 或适用的多标注者指标，均给 n 与 CI。门槛可配置，包含一致性目标、MAE 上限、关键类别错误上限、CI 要求和人工复核比例。

默认 synthetic、single_annotator、smoke-only Golden Set 状态为 `JUDGE_NOT_CALIBRATED`。只在 development set 调 Prompt，在 locked holdout 一次性复核；测试长度、位置、风格、自我、条件泄露、注入和拒绝误判偏好。
<!-- FILE END: engine/evaluation_rubric.md -->
