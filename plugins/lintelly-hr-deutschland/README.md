# Lintelly HR Deutschland

German employment law only. A hosted MCP server that answers the HR questions of small companies in Germany under German
employment and social security law: notice periods, employer costs, sick pay, maternity protection, dismissals, references,
contract clauses and HR workflows. Each figure comes with the calculation and the official source with review date.

```
/plugin install lintelly-hr-deutschland@buildwithclaude
```

No sign-in, no account, nothing stored. Or register the server directly:

```
claude mcp add --transport http lintelly-hr-deutschland https://hr.lintelly.com/mcp
```

## What is in the plugin

- MCP server `https://hr.lintelly.com/mcp` (Streamable HTTP), 38 read-only tools
- Skills (German): `hr-sprechstunde`, `ersteinstellung`, `krankmeldung`, `kuendigung-vorbereiten`, `monatsende`
- Command: `/hr-woche`, a weekly look at upcoming HR deadlines

## What you can ask

- "I'm hiring my first employee, 20 hours a week, starting December 1st. What do I need to do?"
- "What does a mini-jobber cost me, and a part-timer with 1,800 euros gross?"
- "An employee has been sick for three weeks. How long do I pay, and do I get anything back?"
- "What changes for employers on January 1st?"

General information, not legal advice for an individual case.

Source: https://github.com/NicksAdvisory/lintelly-hr-deutschland (MIT, content CC BY 4.0). Docs: https://lintelly.com/hr.
Privacy: https://lintelly.com/datenschutz#lintelly-hr. Support: hello@lintelly.com.
