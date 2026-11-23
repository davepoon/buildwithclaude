# V6.0 Mermaid 图模板

以下均为**结构示意图模板**，不是实验结果。数据图只有在绑定真实 trace 后才可移除“示意图”标记；没有数据时保留 `NOT_RUN`。

## 1. Agent / Harness / Provider / Tool 架构（示意图）

```mermaid
flowchart LR
  A[Agent\n{{agent_id}}] --> H[Harness\n{{harness_id}}]
  H --> P[Model Provider\n{{provider_id}} / {{model_id}}]
  H --> S[Skill Packages\n{{skill_hashes}}]
  H --> T[Tool Interface]
  T --> M[Mock Tools]
  T --> X[External Tools\nNOT_VERIFIED]
```

## 2. 多轮状态流转（示意图）

```mermaid
flowchart LR
  T1[Turn 1\ninput + writes] --> P1{state probes}
  P1 --> T2[Turn 2\nreference saved tool result]
  T2 --> P2{state probes}
  P2 --> T3[Turn 3\nverify final state]
  T3 --> R[run-level result]
```

## 3. Tool Calling Sequence（示意图）

```mermaid
sequenceDiagram
  participant A as Agent
  participant H as Harness
  participant D as mock_database
  participant C as mock_calculator
  A->>H: create(order-042)
  H->>D: create
  D-->>H: result saved as order_create
  A->>H: expression=${order_create.record.expression}
  H->>C: resolved expression=19.5 * 4
  C-->>H: 78.0
  A->>H: assert original state
  H->>D: assert
  D-->>H: verification event
```

## 4. Fault Injection 状态（示意图）

```mermaid
stateDiagram-v2
  [*] --> ToolRequested
  ToolRequested --> Faulted: actual injection recorded
  Faulted --> Retrying: retryable and below limit
  Retrying --> Recovered: later attempt succeeds
  Faulted --> SafeStop: unsafe or unrecoverable
  Retrying --> Looped: repeated calls without progress
  Retrying --> TimedOut: run deadline exceeded
  Recovered --> [*]
  SafeStop --> [*]
  Looped --> [*]
  TimedOut --> [*]
```

## 5. 多 Skill 条件矩阵（设计示意）

```mermaid
flowchart TB
  N[N: no skill] --> Pair[Same task + repeat_index]
  A[A: skill A] --> Pair
  B[B: skill B] --> Pair
  AB[AB: A and B] --> Pair
  Pair --> SS[SS_AB = Y_AB - Y_A - Y_B + Y_N]
```

## 6. 工具调用失败漏斗（数据绑定后生成）

```mermaid
flowchart LR
  R[Requested\n{{requested_or_NOT_RUN}}] --> V[Valid arguments\n{{valid_or_NOT_RUN}}]
  V --> C[Completed\n{{completed_or_NOT_RUN}}]
  V --> I[Invalid\n{{invalid_or_NOT_RUN}}]
  C --> F[External failure\n{{failed_or_NOT_RUN}}]
```

## 7. 多轮状态丢失图谱（数据绑定后生成）

```mermaid
flowchart LR
  W[First write turn\n{{write_turn_or_NOT_RUN}}] --> O[Omission\n{{omission_or_NOT_RUN}}]
  W --> V[Wrong value\n{{wrong_value_or_NOT_RUN}}]
  W --> S[Stale value\n{{stale_value_or_NOT_RUN}}]
  W --> U[Unauthorized overwrite\n{{overwrite_or_NOT_RUN}}]
```
<!-- FILE END: templates/mermaid_matrix.md -->
