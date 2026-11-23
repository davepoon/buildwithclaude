# V6.0 实验报告：{{experiment_id}}

> 结果分类：`{{PASS|FAIL|NOT_RUN|BLOCKED|MOCK_ONLY|PARTIAL}}`。本模板中的花括号字段必须由实际记录填充；没有数据时写 `NOT_RUN`，不得填猜测值。

## 1. 执行摘要

- 主要结论：{{evidence_bound_summary}}
- 计划/完成/排除 run：{{planned_runs}} / {{completed_runs}} / {{excluded_runs}}
- 统计单位：run；重复数：{{repeat}}
- 结论边界：{{real_or_mock_limitation}}

## 2. 实验目标与假设

{{objectives_and_preregistered_hypotheses}}

## 3. 环境与能力声明

{{phase0_capabilities_and_unsupported_modalities}}

## 4. Agent / Harness / Provider / Model

| 层 | ID | 版本 | Model ID | 验证状态 |
|---|---|---|---|---|
| Agent | {{agent_id}} | {{agent_version}} | N/A | {{agent_status}} |
| Harness | {{harness_id}} | {{harness_version}} | N/A | {{harness_status}} |
| Provider | {{provider_id}} | {{provider_version}} | {{model_id}} | {{provider_status}} |

## 5. Skill 条件与哈希

{{conditions_load_order_skill_versions_sha256}}

## 6. 数据集与多模态资产

{{dataset_version_task_ids_asset_hashes_preprocessing_unsupported}}

## 7. 实验设计与样本量

{{conditions_pairing_randomization_repeat_power_limits}}

## 8. 任务成功率

{{task_success_counts_denominators_by_task_and_condition}}

## 9. RC / TI / SS / CE / CPS / RS

{{metrics_with_raw_means_effect_sizes_ci_denominators_missing_values}}

## 10. 多轮状态丢失图谱

{{state_loss_plot_from_trace_or_NOT_RUN}}

## 11. 工具调用成功与失败漏斗

{{tool_funnel_from_events_or_NOT_RUN}}

## 12. 故障恢复与循环分析

{{fault_eligibility_actual_injections_recovery_loop_timeout}}

## 13. Mutation Score

{{valid_detected_surviving_invalid_mutations_by_operator_or_NOT_RUN}}

## 14. Judge 校准结果

{{judge_version_split_annotators_calibration_metrics_ci_bias_or_NOT_CALIBRATED}}

## 15. 统计检验与置信区间

{{test_assumptions_effect_size_ci_p_adjustment_sequential_design}}

## 16. 成本与延迟

{{observed_or_estimate_cost_price_source_token_latency_median_p95}}

## 17. 失败案例

{{trace_linked_failure_cases_without_sensitive_raw_content}}

## 18. 限制与潜在混杂因素

{{limitations_confounders_external_validity}}

## 19. 结论与复现命令

{{conclusions_within_evidence_and_exact_reproduction_commands}}

## 20. 未运行、阻塞与 Mock-only 清单

| 项目 | 状态 | 原因/边界 |
|---|---|---|
| {{item}} | {{NOT_RUN|BLOCKED|MOCK_ONLY|PARTIAL}} | {{reason}} |
<!-- FILE END: templates/report_template.md -->
