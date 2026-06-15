---
description: Show GCF proxy token savings statistics for the current session or overall usage.
---

# GCF Stats

Show the user their gcf-proxy token savings.

Run `npx -y @blackwell-systems/gcf-proxy@latest --stats` to retrieve session statistics.

If that command is not available or returns no data, explain that gcf-proxy tracks savings in real time when running with `--verbose` and suggest:

```bash
npx -y @blackwell-systems/gcf-proxy@latest --verbose -- <their-server-command>
```

Present any stats in a clear format showing:
- Tokens saved (GCF vs JSON)
- Percentage reduction
- Session deduplication savings (if multi-call session)
- Estimated cost savings based on their model's pricing
