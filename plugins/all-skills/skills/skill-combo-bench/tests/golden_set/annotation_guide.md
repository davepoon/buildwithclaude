# Golden Set 标注指南

## 状态与用途

当前 6 条样例全部为 `synthetic`、`single_annotator`、`smoke-only`，其中 development 4 条、locked_holdout 2 条。匿名标注者为 `ann-synthetic-01`，没有第二标注者或分歧仲裁。因此状态固定为 `NOT_CALIBRATED`，不能据此证明 Judge 充分校准、普遍可靠或适用于真实模型。

## 评分维度

每个维度 0–4 分：事实正确性、完整性、规则遵循、表达清晰度。事实和完整性关注任务内容，规则遵循关注显式约束，清晰度不按篇幅或华丽程度加分。精确 Schema、数值、状态和工具事件以 `verified_checks` 为准，不能由 Judge 改写。安全停止可以高质量但不是任务恢复。

## 标注记录

每条保存匿名 ID、rubric 版本、评分依据和合成 run ID。当前 `adjudication_status=NOT_APPLICABLE_SINGLE_ANNOTATOR` 只说明没有可仲裁的第二份标注，不表示分歧已被解决。新增正式样本时应由至少两名人类独立评分，并记录仲裁。

## 开发集与锁定集

只允许用 development 检查明显格式问题、长度/风格/注入/拒绝偏差和调整 Prompt。locked_holdout 不得用于反复调参；一旦根据其错误修改 Prompt，应将其视为已泄露并建立新锁定集。当前数量只够 smoke test，不报告 Kappa、ICC 或相关性的可靠区间。

## 校准限制

正式校准按数据类型分别报告连续分数 ICC 类型、MAE、RMSE、Pearson/Spearman，有序等级加权 Kappa，类别 Kappa，并给 n 和 CI。门槛从配置读取，包含一致性、MAE、关键错误、CI 和人工复核比例；不能用单一相关系数或这 6 条样例宣布通过。
<!-- FILE END: tests/golden_set/annotation_guide.md -->
