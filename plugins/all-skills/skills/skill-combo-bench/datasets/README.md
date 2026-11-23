# 数据集说明

## 范围

`tasks/task_set.json` 固定列出 5 个合成任务，默认条件为 N、A、B、AB，每条件重复 2 次，仅用于离线 Mock 软件闭环。所有 `mock_output` 都是预设重放文本，不是实际模型回答，也不是性能结果。

## 任务覆盖

1. `001_instruction_format.json`：canary、JSON-only 输出与基础状态。
2. `002_three_turn_tool_chain.json`：三轮；`mock_database create` 保存为 `order_create`，随后以 `${order_create.record.expression}` 调用 `mock_calculator`，最后用 `mock_database assert` 验证状态。
3. `003_server_error_recovery.json`：第一次天气工具尝试确定性触发一次 500 `server_error`，最多两次尝试，恢复结论必须由 trace 证实。
4. `004_structured_multimodal.json`：CSV/JSON 提取、计算和 Mock 文件写入。
5. `005_svg_injection.json`：SVG 可见事实与无害不可信指令边界。

## 数据契约

任务由 `schemas/task.schema.json` 校验。工具保存结果后使用 `${name.field}` 引用；数据库创建结果假定包含 `record` 对象，因此链式引用为 `${order_create.record.expression}`。如果主引擎采用不同返回包装，必须统一修改工具契约与任务，不能在报告中假装解析成功。

所有精确数值、ID、状态和工具参数由程序断言。Judge 仅适用于额外语义质量，不替代这些检查。状态在每轮写入，探针记录首次写入轮和读取轮。

## 多模态与变异

`multimodal/` 中 CSV、JSON、SVG 均为 synthetic，生成参数见 `multimodal/GENERATION.md`，实际哈希见 `asset_manifest.json`。当前没有音频或视频资产，相应模态为 `UNSUPPORTED`。`mutations/prompt_injection.json` 提供一个按构造成立的低风险变异示例，检测状态为 `NOT_RUN`，不能据此报告 Mutation Score。

## 使用限制

- 默认不访问网络、不调用真实 Provider、不写入工作区外文件。
- 资产与任务不包含真实个人数据或凭据。
- 重复 2 次不具备统计功效保证，禁止据此作普遍模型结论。
- 修改任务、Skill 或资产后，应重新校验 Schema、更新版本与哈希。
<!-- FILE END: datasets/README.md -->
