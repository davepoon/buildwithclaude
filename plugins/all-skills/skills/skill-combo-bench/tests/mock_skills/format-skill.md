# Mock Format Skill

**Skill ID:** `format-skill`  
**Version:** `1.0.0`

## Purpose

验证结构化输出和字段约束，供离线 Schema/格式探针使用。

## Rules

- **FMT-001**：要求 JSON-only 时，只输出一个合法 JSON 对象，不添加代码围栏或解释。
- **FMT-002**：仅输出任务指定字段，字段名、类型和值约束必须一致。
- **FMT-003**：写文件工具时使用任务指定的受限路径，并把结构化内容编码为合法 JSON 字符串。
- **FMT-004**：Schema 校验失败时修正格式，不用自然语言解释替代合法输出。

## Output Expectations

格式正确性由程序验证；语义完整性与格式通过分开报告。
<!-- FILE END: tests/mock_skills/format-skill.md -->
