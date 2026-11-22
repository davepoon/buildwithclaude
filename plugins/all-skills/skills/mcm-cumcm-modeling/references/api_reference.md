# 跨平台适配、脚本接口与数据契约

## 1. 可移植边界

技能主体只依赖 Agent Skills 通用的 `SKILL.md + references + assets + scripts` 结构。 Codex、OpenCode、DeepSeek harness、Zcode 等客户端可按各自方式加载该目录；未实际测试的客户端不得声称已通过兼容性认证。

`agent_created` 是 WorkBuddy 管理字段；OpenCode 等客户端会忽略未知 frontmatter 字段。不要删除标准 `name` 和 `description`。

不依赖专属问答、任务、MCP 或 Shell 工具。按语义降级：原生文件工具不可用则使用可用读写接口；Python 不可用则只提供代码和未执行说明。

### 安装与发现

- Codex：项目级放入 `.agents/skills/mcm-cumcm-modeling/`，用户级放入 `~/.agents/skills/mcm-cumcm-modeling/`；可选 `agents/openai.yaml` 已提供。依据：https://developers.openai.com/codex/build-skills
- OpenCode：项目级可放入 `.opencode/skills/` 或 `.agents/skills/`，用户级可放入 `~/.config/opencode/skills/` 或 `~/.agents/skills/`。依据：https://opencode.ai/v1/docs/skills
- DeepSeek harness：优先采用当前版本支持的 `.agents/skills/` 共享目录；若使用专属目录或自定义目录，以该版本文档为准。未在本环境实际启动该客户端。
- Zcode 或其他 Agent：使用其自定义技能目录或显式读取 `SKILL.md`；未核验官方发现路径时不猜测安装位置。
- WorkBuddy：本包已位于用户技能目录。其他客户端可复制整个文件夹，不能只复制主文件，否则会丢失参考、模板和脚本。

安装后检查名称是否唯一、权限是否允许加载、客户端是否发现资源，并用 `evals/cases.json` 中至少一个案例测试触发和执行。格式兼容不等于已经通过该客户端的运行测试。

## 2. 路径与命令

`SKILL_DIR` 指技能根目录，`WORK_DIR` 指用户项目目录。文档命令使用占位符，执行前替换为实际路径并正确引用空格。

Windows、macOS、Linux 均使用 Python 调用脚本；不要假设 `python3` 或 `python` 同时存在。路径在 Markdown 中使用正斜杠，实际系统命令按当前 shell 规则引用。

## 3. 环境预检

```text
python "<SKILL_DIR>/scripts/preflight.py" --profile all --json
python "<SKILL_DIR>/scripts/preflight.py" --profile data
```

`profile` 为 `analysis/data/paper/all`。输出 Python、可选包和命令的可用性。缺少可选包不表示数学工作不能继续。`--strict` 仅在必需能力缺失时返回非零。

## 4. 回归指标

输入 CSV 至少含实际值和预测值两列：

```text
python scripts/regression_metrics.py predictions.csv --actual actual --predicted predicted --json
python scripts/regression_metrics.py predictions.csv --actual actual --predicted predicted --lower lower --upper upper --group region --output metrics.json
```

计算 n、MAE、RMSE、bias、MAPE、sMAPE、R²；给出区间列时计算经验覆盖率和平均宽度；给出 `--group` 时同时计算各组指标。零真实值的 MAPE 排除计数单独报告；不可定义指标输出 `null` 和警告。

该脚本不判断划分是否泄漏，也不把误差指标自动转化为模型有效性。

## 5. 二分类指标

```text
python scripts/classification_metrics.py labels.csv --actual actual --predicted predicted --positive 1 --json
```

输出 TP、FP、TN、FN、accuracy、precision、recall、specificity、F1、balanced_accuracy、MCC。所有不等于 `positive` 的标签均归为负类，使用前必须核对原始标签；零分母指标输出 `null` 并警告。

该脚本不计算 ROC/PR、校准或最优阈值，也不支持直接多分类；需要这些分析时编写对应真实代码。

## 6. 单参数灵敏度汇总

输入 CSV 使用固定列：

```text
question,parameter,baseline_input,perturbed_input,baseline_output,perturbed_output,baseline_decision,perturbed_decision
```

后两列可留空。运行：

```text
python scripts/sensitivity_summary.py sensitivity.csv --output sensitivity.json
```

输出绝对/相对输入变化、输出变化、局部弹性和决策是否反转。基线输入或输出为零时弹性为 `null`，避免伪无穷。该工具只汇总已有实验，不替代采样设计、全局灵敏度或统计检验。

## 7. 证据审计

输入 CSV 使用固定列：

```text
requirement_id,question,status,result_path,verification_path,evidence_gap,severity
```

`status` 建议为 `pending/designed/executed/verified/reproduced/blocked`。运行：

```text
python scripts/evidence_audit.py requirements.csv --root "<WORK_DIR>" --json
python scripts/evidence_audit.py requirements.csv --root "<WORK_DIR>" --strict
```

检查 ID 重复、状态、已执行结果的路径存在性、验证证据和未关闭缺口。路径相对 `--root`。文件存在不证明内容正确；该工具只做结构检查。`--strict` 发现错误返回非零。

## 8. 内部质量评分

JSON 输入结构：

```json
{
  "questions": [
    {
      "id": "Q1",
      "weight": 1,
      "scores": {"coverage": 3, "correctness": 4, "fit": 3, "reproducibility": 3, "validation": 3, "communication": 3},
      "p0": [],
      "p1": [],
      "p2": []
    }
  ]
}
```

运行：

```text
python scripts/score_review.py review.json --output score.json
python scripts/score_review.py review.json --release-gate --strict
```

维度权重为 20/20/15/15/20/10；问权默认为 1。发布门要求无 P0、coverage、correctness 与 validation 至少 3、总分至少 85。阈值是内部规则，不是官方标准。分数必须另附人工证据和扣分理由。

## 9. 哈希清单

```text
python scripts/hash_manifest.py code results paper/main.pdf --root "<WORK_DIR>" --output manifest.json
```

对显式文件或目录生成 SHA-256、大小和相对路径，并记录 Python/平台。目录遍历只用于用户指定项目路径；不要对系统或个人根目录运行。哈希证明字节一致，不证明数学正确。

## 10. 通用退出码与输出

脚本成功返回 0；参数、输入或数值错误返回 2；`--strict` 质量/环境检查失败返回 1。默认 JSON 输出到 stdout；`--output` 写入指定文件。所有脚本仅使用 Python 标准库。

## 11. 模板

`assets/templates/` 提供 Requirement Matrix、Model Card、评分、运行记录、灵敏度计划和审查记录模板。复制到用户项目后填写，不修改技能内原始模板。