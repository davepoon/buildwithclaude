---
name: datacircle
category: research
description: Compare and price GTM APIs. Downloads every plan of every GTM API on Datacircle as one file, with the price per 1,000 results, our score for the plan, the rate limits and the fields each plan returns. Use when the user asks which GTM API to buy, what an API costs per 1,000 results, or how two providers compare.
license: MIT
---

# Datacircle

Find the best GTM APIs. We benchmark all the GTM APIs and we put the results on our website, https://datacircle.dev.

## When to use

Use it to compare or price a GTM API.

## How to use

Download the file:

```bash
curl -fsSL --compressed -o datacircle.json https://datacircle.dev/datacircle.json
```

The same rows as CSV: https://datacircle.dev/datacircle.csv. One row is one plan of one call. Each row has the provider, the API, the price per 1,000 results, our score, the rate limits and a link to the plan's docs.

The full skill, with every key explained: https://datacircle.dev/SKILL.md

Open API, no key: https://api.datacircle.dev/v1 (spec: https://api.datacircle.dev/v1/openapi.json)

## Example

**User**: "Which email finder API is cheapest per 1,000 emails?"

**Output**: the plans of the Find email API, sorted by price per 1,000, each with its score.
