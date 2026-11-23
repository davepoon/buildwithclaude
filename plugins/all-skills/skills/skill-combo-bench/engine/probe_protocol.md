# V6.0 探针协议

## 1. 通用记录

每个探针在展开到具体运行时记录：`probe_id`、`skill_id`、`probe_family`、`task_id`、`condition_id`、`turn_index`、`preconditions`、`stimulus`、`expected_behavior`、`assertions`、`failure_class`、`weight`、`evidence_source`。任务文件保存可复用的探针与断言子集，执行器补充任务和条件上下文。

探针得分与任务成功分开。答案正确但工具链未执行、任务失败但安全规则遵循、工具成功但最终答案错误，都必须分别保留。

## 2. 探针族

### Instruction Probe

验证 Manifest 中明确规则是否体现在相应轮次。前置条件包含规则已加载且用户没有合法修改它；证据优先为输出字段和状态事件。失败类为 `RULE_OMISSION`，不推断内部原因。

### Format / Schema Probe

验证 JSON 可解析、字段和类型符合 Schema、禁止字段未出现。证据为解析结果与验证错误。输出格式错误不能由语义 Judge 抵消。

### Fact / Canary Probe

验证合成专属事实或 canary 被准确复用，并检查没有把不可信文本中的伪事实当真相。精确值使用程序比较。

### State Tracking Probe

每轮状态探针定义 `state_key`、首次写入轮、读取轮、预期值、比较方式、用户修改权限和失败类型。读取事件与状态快照为证据；失败分为 `omission`、`wrong_value`、`stale_value`、`unauthorized_overwrite`。

### Tool-chain Probe

最小链为 Tool A 输出、规范化/校验、Tool B 输入、最终状态验证。断言检查真实 `call_id`、工具名、保存别名、解析后的 `${name.field}`、Tool B 参数和最终数据库状态。工具外部故障不归为 Skill 失活。

### Fault Recovery Probe

前置条件是故障确实触发且属于合格故障 run。结果分为 `RECOVERED`、`GRACEFUL_DEGRADED`、`SAFE_STOP`、`FAILED`、`LOOPED`、`CRASHED`、`TIMED_OUT`。记录重试上限、退避、副作用和实际注入次数。

### Multimodal Probe

至少覆盖以下 7 类，未实现的类型必须显式标记 `UNSUPPORTED` 而不是静默跳过：

1. **图像事实探针**（image_fact）：识别图像中明确可见且可验证的信息；
2. **图像规则探针**（image_rule）：依据图像内容执行 Skill 约束；
3. **音频转写探针**（audio_transcript）：比对 ASR 文本与原始音频内容；
4. **音频指令探针**（audio_instruction）：从音频提取指令并执行受限任务；
5. **视频时序探针**（video_temporal）：检查不同时间点的事件顺序；
6. **跨模态一致性探针**（cross_modal_consistency）：检查文本描述与媒体内容是否冲突；
7. **结构化文件探针**（structured_file）：检查 CSV / JSON 的数据提取与变换。

每个资产记录哈希、MIME、大小、来源和预处理。Adapter 不支持时标 `UNSUPPORTED`，不得从分母中静默删除，也不能把 SVG 源码读取称作视觉理解。

### Mutation Probe

检查受控变异是否被检测或正确处理。记录原任务、算子 ID/版本、种子、diff、目标规则和有效性。正确拒绝、澄清或安全停止均可为通过；无效变异不进入 Mutation Score。

## 3. 合格性与缺失

权重在运行前固定且大于 0。不适用探针标 `N/A` 并从 RC 分母排除，不能算作通过；因故障不满足前置条件的工具型探针标 `NOT_APPLICABLE` 或对应外部故障类。缺失证据标 `MISSING`，不得猜测。各探针同时保留失败计数、合格分母和证据定位。

## 4. 状态引用与副作用

工具调用保存到 `save_as` 后，后续参数可写 `${name.field}`。解析失败是明确的数据流错误，不得原样发送后仍宣称链条成功。恢复时防止非幂等操作重复执行；重复响应、重试和断点恢复都通过调用 ID 关联。
<!-- FILE END: engine/probe_protocol.md -->
