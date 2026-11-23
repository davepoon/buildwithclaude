# 实验卡：{{experiment_id}}

## 身份与状态

- 项目版本：{{project_version}}
- 实验状态：{{PASS|FAIL|NOT_RUN|BLOCKED|MOCK_ONLY|PARTIAL}}
- 创建时间与时区：{{created_at_timezone}}
- Git commit：{{git_commit_or_UNAVAILABLE}}
- 配置/数据/Adapter/Judge/价格版本：{{version_manifest}}

## 研究设计

- 主要终点：{{primary_endpoint}}
- 假设与 SESOI：{{hypotheses_and_sesoi}}
- 任务集及版本：{{task_set_version}}
- 条件与加载顺序：{{conditions_load_order}}
- repeat 与配对单位：{{repeat_pairing}}
- 随机种子与顺序：{{seed_order_randomization}}
- SHORT/MEDIUM/LONG：{{context_mode_token_ranges}}
- 计划样本量、排除规则、停止规则：{{sampling_and_stopping}}

## 四层组件

- Agent：{{agent_id_version_status}}
- Harness：{{harness_id_version_status}}
- Provider / Model：{{provider_model_version_status}}
- Skills 与 SHA-256：{{skill_manifest_hashes}}

## 数据与模态

- 资产 SHA-256 / MIME / 大小：{{asset_metadata}}
- 来源与权限：{{synthetic_public_user_permission}}
- 预处理：{{preprocessing_parameters}}
- 不支持模态：{{unsupported_modalities}}

## 工具与安全

- 工具接口版本和初值：{{tool_versions_initial_state}}
- 故障配置与实际触发：{{fault_config_actual_counts}}
- 超时、重试、熔断、并发：{{runtime_governance}}
- 文件/网络 allowlist：{{allowlists}}
- 副作用与人工确认：{{side_effect_controls}}

## 隐私与成本

- 脱敏规则版本：{{anonymization_version}}
- 原始内容存储与保留天数：{{raw_storage_retention}}
- 价格来源/日期：{{price_source_date_or_COST_UNKNOWN}}
- 预算和 Dry Run：{{budget_and_ESTIMATE}}

## 评测与统计

- 确定性断言版本：{{assertion_version}}
- Judge 版本与盲评：{{judge_version_blinding}}
- Golden Set 标注状态：{{annotation_status_use_limit}}
- 效应量、CI、检验、多重比较：{{analysis_plan}}

## 结果与审计

- Trace / Artifact 路径与哈希：{{trace_artifact_hashes}}
- 结果摘要及分母：{{results_and_denominators}}
- 未运行/阻塞/Mock-only：{{not_run_blocked_mock_only}}
- 限制与混杂：{{limitations_confounders}}
- 复现命令：{{exact_reproduction_command}}
<!-- FILE END: templates/experiment_card.md -->
