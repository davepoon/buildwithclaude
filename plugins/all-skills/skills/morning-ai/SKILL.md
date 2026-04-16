---
name: morning-ai
category: data-ai
description: AI news tracking skill that monitors 80+ entities across 6 free sources (Reddit, HN, GitHub, HuggingFace, arXiv, X/Twitter). Generates scored daily reports with infographics and message digests. Invoke via /morning-ai.
---

# MorningAI

Daily AI news tracker that collects updates from 80+ entities across 6 sources, scores and deduplicates them, and generates a structured Markdown report.

## When to Use This Skill

- When the user wants a daily AI news briefing
- When tracking AI model releases, product launches, funding rounds, or benchmark results
- When generating AI news reports or infographics for sharing

## What This Skill Does

1. Collects data from 6 sources: Reddit, Hacker News, GitHub, HuggingFace, arXiv, X/Twitter
2. Scores items using two-stage scoring (automated metadata + qualitative evaluation)
3. Deduplicates and cross-verifies high-scoring items
4. Generates a Markdown report with scored entries and source links

## Installation

MorningAI requires its full repository for data collection scripts:

```bash
# Install as a Claude Code plugin
git clone https://github.com/octo-patch/MorningAI.git ~/.claude/plugins/MorningAI

# Or install as a skill
git clone https://github.com/octo-patch/MorningAI.git
cd MorningAI
```

## How to Use

### Basic Usage

```
/morning-ai
```

### With Options

```
/morning-ai --lang zh
/morning-ai --depth deep
/morning-ai --exclude Funding
```

## Requirements

- Python 3.9+
- No API keys required (all 6 sources are free)

## Links

- Repository: https://github.com/octo-patch/MorningAI
- License: MIT
