# Project Boundary — Claude Code Plugin

Allows destructive operations **within your project** but blocks them **outside** the project directory. Built for `--dangerously-skip-permissions` mode where Claude doesn't ask — this plugin is your safety net.

## How it differs from existing plugins

- **[claude-code-safety-net](https://github.com/kenryu42/claude-code-safety-net)** — blocks `rm` everywhere; Project Boundary allows it inside the project so refactoring works normally.
- **[destructive-command-guard](https://github.com/Dicklesworthstone/destructive_command_guard)** — only distinguishes `/tmp` vs everything else; Project Boundary uses `$CLAUDE_PROJECT_DIR` as the actual boundary.
- **[claude-code-damage-control](https://github.com/disler/claude-code-damage-control)** — requires manually listing protected paths; Project Boundary automatically protects everything outside the project.

## What it does

### Boundary-checked (allowed inside project, blocked outside)

| Operation | Inside project | Outside project |
|-----------|---------------|-----------------|
| `rm`, `rm -rf` | Allowed | **Blocked** |
| `mv` (source and destination) | Allowed | **Blocked** |
| `cp` (source and destination) | Allowed | **Blocked** |
| `ln` (source and target) | Allowed | **Blocked** |
| `chmod` / `chown` | Allowed | **Blocked** |
| `>` / `>>` redirect | Allowed | **Blocked** |
| `tee` / `tee -a` | Allowed | **Blocked** |
| `curl -o` / `curl --output` | Allowed | **Blocked** |
| `wget -O` / `wget --output-document` | Allowed | **Blocked** |
| `find -delete` / `find -exec rm` | Allowed | **Blocked** |
| `dd of=` | Allowed | **Blocked** |
| `install` (source and destination) | Allowed | **Blocked** |
| `rsync` (source and destination) | Allowed | **Blocked** |
| `tar -C` / `--directory=` | Allowed | **Blocked** |
| `unzip -d` / `cpio -D` | Allowed | **Blocked** |
| **Edit** tool (file edits) | Allowed | **Blocked** |
| **MultiEdit** tool (multi-file edits) | Allowed | **Blocked** |
| **Write** tool (file creation) | Allowed | **Blocked** |

### Always blocked (unsafe to inspect)

| Command | Reason |
|---------|--------|
| `bash -c "..."` / `sh -c "..."` | Nested shell — cannot inspect inner command |
| `eval '...'` | Cannot safely parse evaluated code |
| Piping to `sh` / `bash` | Inner commands invisible to guard |
| `xargs rm/mv/cp/...` | Arguments cannot be validated |
| `$(...)` / backticks (outside single quotes) | Command substitution target is uninspectable. Single-quoted forms like `'$(cmd)'` and arithmetic expansion `$((2+2))` are allowed. |

### Additional protections

- **Chained commands** — splits on `;`, `&&`, `||`, `|` and checks each sub-command independently
- **`cwd` awareness** — uses `cwd` from the hook event, so commands run outside the project (without an explicit `cd`) are also guarded
- **`cd` tracking** — `cd /tmp && rm -rf something` is blocked because `cd` left the project; `cd $PROJECT && rm file` is allowed even if the event `cwd` was outside
- **Destructive subcommands outside project** — when running outside the project (via event `cwd` or `cd`), these are blocked: `git clean -f`, `git checkout .`, `git restore .`, `git reset --hard`, `git push --force`, `git stash drop/clear`, `git branch -D`, `git reflog expire`, `rails db:drop/reset`, `rake db:drop/reset`. Safe commands like `git status`, `git log`, `rails routes` remain allowed.
- **`sudo` prefix** — stripped before checking, so `sudo rm /etc/passwd` is still blocked
- **`find` options** — handles `-L`, `-H`, `-P` before the search path
- **Path traversal** — `..` segments are resolved before boundary check
- **`~` and `$HOME` expansion** — `rm ~/file` and `rm $HOME/file` are correctly detected as outside-project
- **Symlink resolution** — handles macOS `/var` → `/private/var`, dereferences symlink chains in Edit/Write/MultiEdit (fail-closed after 20 hops)

### Known limitations

- Paths with spaces work when properly quoted (single or double quotes). Unquoted paths with spaces are not supported.
- Heredoc body contents are not inspected (only the first line of the command, where redirects are handled normally)
- Brace expansion (`{a,b,c}`) is not enumerated — literal match only
- `~user/` (home of another user) is not expanded; only `~/` (current user) is handled

## Install

Direct:
```
claude --plugin-dir /path/to/claude-code-project-boundary
```

From marketplace:
```
/plugin marketplace add davepoon/buildwithclaude
/plugin install project-boundary@buildwithclaude
```

## How it works

Pure-bash PreToolUse hooks for Bash, Edit, MultiEdit, and Write tools. The Bash hook splits chained commands and resolves target paths (handling symlinks, `..`, `~`, `$HOME`); the Edit, MultiEdit, and Write hooks perform file path boundary checks against `$CLAUDE_PROJECT_DIR`. Dependencies: bash + jq.

## Testing

```
bash tests/test_guard.sh
```

Full test suite covering all guard scenarios. CI runs on Ubuntu and macOS.

## License

MIT
