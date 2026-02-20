# MeMesh - Persistent Memory for Claude Code

Enhance Claude Code with cross-session memory using semantic search and knowledge graphs. MeMesh automatically remembers your architecture decisions, coding patterns, debugging insights, and project-specific context.

## 🎯 Key Features

- **Automatic Memory**: Claude Code automatically saves important decisions and patterns
- **Semantic Search**: Find past knowledge with natural language queries
- **Project Isolation**: Memories scoped to project paths prevent cross-contamination
- **100% Local**: All data stored locally on your machine (`~/.claude/memory/`)
- **Zero Configuration**: Install and restart Claude Code - it just works

## 📦 Installation

MeMesh is an MCP (Model Context Protocol) server plugin. Install it globally via npm:

```bash
npm install -g @pcircle/memesh
```

After installation, restart Claude Code. MeMesh will be automatically available.

## 🚀 Usage

MeMesh provides three main MCP tools that Claude Code can use automatically:

### `buddy-remember` - Semantic Search
Query your knowledge base with natural language:

```
Example: "How did we handle authentication in the API?"
```

Claude Code will automatically search past memories and retrieve relevant context.

### `buddy-do` - Execute with Memory
Execute tasks while leveraging past knowledge:

```
Example: "Implement the new feature using our established patterns"
```

Claude Code will reference past architectural decisions and coding patterns.

### `buddy-help` - Quick Reference
Get help with MeMesh commands and usage.

## 📊 Statistics

- ⭐ 63 GitHub Stars
- 📥 13,500+ Repository Clones
- 📦 1,700+ npm Downloads
- 💯 Open Source (AGPL-3.0)

## 🔐 Privacy & Security

- **100% Local Storage**: All memories stored in `~/.claude/memory/`
- **No Telemetry**: Zero data collection or tracking
- **Optional Encryption**: AES-256 encryption support
- **GDPR Compliant**: Automatic cleanup and data portability
- **Fully Auditable**: Open source - inspect the code yourself

## 📚 Documentation

- **Getting Started**: [GETTING_STARTED.md](https://github.com/PCIRCLE-AI/claude-code-buddy/blob/main/docs/GETTING_STARTED.md)
- **User Guide**: [USER_GUIDE.md](https://github.com/PCIRCLE-AI/claude-code-buddy/blob/main/docs/USER_GUIDE.md)
- **Architecture**: [ARCHITECTURE.md](https://github.com/PCIRCLE-AI/claude-code-buddy/blob/main/docs/ARCHITECTURE.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](https://github.com/PCIRCLE-AI/claude-code-buddy/blob/main/docs/TROUBLESHOOTING.md)

## 🛠️ Requirements

- Claude Code CLI (latest version)
- Node.js >= 20.0.0
- ~100MB disk space

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/PCIRCLE-AI/claude-code-buddy/issues)
- **Email**: support@memesh.ai
- **Repository**: [PCIRCLE-AI/claude-code-buddy](https://github.com/PCIRCLE-AI/claude-code-buddy)

## 📄 License

AGPL-3.0 - See [LICENSE](https://github.com/PCIRCLE-AI/claude-code-buddy/blob/main/LICENSE)

---

**Note**: MeMesh uses the Model Context Protocol (MCP) for integration with Claude Code. It provides tools rather than traditional slash commands, enabling Claude Code to automatically leverage memory capabilities during conversations.
