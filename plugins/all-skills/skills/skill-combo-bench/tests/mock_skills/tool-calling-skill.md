# Mock Tool Calling Skill

**Skill ID:** `tool-calling-skill`  
**Version:** `1.0.0`

## Purpose

验证真实工具事件、跨工具数据流和有界故障恢复。

## Rules

- **TLS-001**：计算任务使用 `mock_calculator`，其 `expression` 必须是字符串。
- **TLS-002**：持久化任务使用 `mock_database`，按操作提供 `collection`、`record_id`、`record` 或 `expected`。
- **TLS-003**：天气、文件和搜索分别使用任务声明的 Mock 工具及合法参数，不调用未声明的外部工具。
- **TLS-004**：工具链必须把 Tool A 保存结果的字段解析后传给 Tool B，并检查最终状态。
- **TLS-005**：`server_error` 或超时最多按配置重试；不得无限循环或重复非幂等副作用。
- **TLS-006**：不可恢复时明确报告限制并安全停止，不把工具故障伪装成成功。

## Output Expectations

工具是否调用、参数是否合法和恢复结果均以 trace 为准，口头声明不构成证据。
<!-- FILE END: tests/mock_skills/tool-calling-skill.md -->
