---
name: immich-photo-manager
category: storage-docs
description: "Manage your self-hosted Immich photo library through conversation — natural language search, geographic album curation, duplicate detection, library health audits, and interactive HTML galleries. Install: claude plugin install immich-photo-manager"
---

# Immich Photo Manager

> Claude Code plugin for intelligent photo management with self-hosted [Immich](https://immich.app).

## Overview

When your Immich library has grown past the point of manual management, this plugin gives Claude direct access to your instance through 21 MCP tools and 11 specialized skills. Search with natural language, create geographic albums from GPS data, find duplicates across import sources, and browse results in interactive HTML galleries.

## Key Features

- **Natural language search** — Find photos using CLIP visual search ("sunset at the beach", "birthday cake")
- **Geographic albums** — Create albums organized by place using GPS clustering + temporal matching
- **Duplicate detection** — Cross-source analysis with perceptual hashing (catches re-encoded copies from Apple Photos, Google Takeout)
- **Library health** — Full audit of metadata completeness, storage breakdown, and recommendations
- **Interactive galleries** — Self-contained HTML files with embedded thumbnails, 3 themes, slideshow mode
- **Safety first** — Never deletes without explicit user confirmation

## Installation

```bash
git clone https://github.com/drolosoft/immich-photo-manager.git
cd immich-photo-manager
claude plugin marketplace add .
claude plugin install immich-photo-manager
```

## Usage

```
"How healthy is my photo library?"
"Show me my photos from Italy"
"Create albums for everywhere I've traveled"
"Find duplicates in my library"
/cleanup — scan for screenshots and junk
/my-travels — discover all travel destinations
```

## Links

- **Repository**: https://github.com/drolosoft/immich-photo-manager
- **Author**: [Drolosoft](https://drolosoft.com)
- **License**: MIT
