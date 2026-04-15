---
name: session-backup
description: "Automatic daily backups of Claude sessions, skills, and configuration files to Google Drive — versioned, organized, and recoverable."
category: infrastructure-operations
---

# Session Backup to Google Drive

Automated backup of your Claude environment to Google Drive. Protects against data loss from session resets or configuration changes.

## What Gets Backed Up

- Session transcripts and working files
- Skill configurations and custom SKILL.md files
- Plugin settings and MCP configurations
- Memory stores and context files

## Setup

Requires Google Drive API access via Apps Script. Install from `MSApps-Mobile/claude-plugins` marketplace.
