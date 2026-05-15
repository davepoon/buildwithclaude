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
| `install` (source, destination, `--target-directory=`) | Allowed | **Blocked** |
| `rsync` (source, destination, `--log-file=`, `--partial-dir=`, `--backup-dir=`, `--temp-dir=`, `--write-batch=`, `--only-write-batch=`) | Allowed | **Blocked** |
| `tar -C` / `--directory=` | Allowed | **Blocked** |
| `unzip -d` / `cpio -D` | Allowed | **Blocked** |
| `7z -o<dir>` / `7z -w<dir>` (extract verbs only) | Allowed | **Blocked** |
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
| `python -c` / `ruby -e` / `perl -e` / `node --eval` / `php -r/-R/--run` / `Rscript -e` / `osascript -e` | Inline interpreter code is opaque to the Bash parser |
| `awk '... system("...") ...'` (and similar `\| "sh"`) | Awk programs can shell out without the guard seeing the inner command |
| `env -S` / `env --split-string` / `env -C` / `env --chdir` | These either smuggle a real command inside a string or change the working directory before the inner tool runs |
| `$(...)` / backticks (outside single quotes) | Command substitution target is uninspectable. Single-quoted forms like `'$(cmd)'` and arithmetic expansion `$((2+2))` are allowed. |
| `$VAR` / `${VAR}` and positional / special parameters (`$1` … `$9`, `$@`, `$*`, `$#`, `$?`, `$$`, `$!`, `$-`) outside single quotes | Variable expansion target is uninspectable for the same reason as `$(...)`. Only `$HOME` / `${HOME}` is allowed (canonical home path). Use literal values inline, or reach for the `Read` / `Grep` tools instead of piping shell vars. ANSI-C `$'…'`, i18n `$"…"`, backslash-escaped `\$VAR`, single-quoted `'$VAR'`, and quoted-heredoc bodies are unaffected. |

### Additional protections

- **Chained commands** — splits on `;`, `&&`, `||`, `|`, and unquoted newlines, then checks each sub-command independently
- **`cwd` awareness** — uses `cwd` from the hook event, so commands run outside the project (without an explicit `cd`) are also guarded
- **`cd` tracking** — `cd /tmp && rm -rf something` is blocked because `cd` left the project; `cd ~/your-repo && rm file` is allowed even if the event `cwd` was outside (`$PROJECT` and other non-`$HOME` variables are uninspectable, so use `~`/`$HOME` or a literal path)
- **Destructive subcommands outside project** — when running outside the project (via event `cwd` or `cd`), these are blocked: `git clean -f`, `git checkout .`, `git restore .`, `git reset --hard`, `git push --force`, `git stash drop/clear`, `git branch -D`, `git reflog expire`, `rails db:drop/reset`, `rake db:drop/reset`. Safe commands like `git status`, `git log`, `rails routes` remain allowed.
- **`sudo` prefix** — stripped before checking, so `sudo rm /etc/passwd` is still blocked
- **`find` options** — handles `-L`, `-H`, `-P` before the search path
- **Path traversal** — `..` segments are resolved before boundary check
- **`~` and `$HOME` expansion** — `rm ~/file` and `rm $HOME/file` are correctly detected as outside-project
- **Symlink resolution** — handles macOS `/var` → `/private/var`, dereferences symlink chains in Edit/Write/MultiEdit (fail-closed after 20 hops)
- **`/dev/null` bit-bucket** — `curl -o /dev/null`, `2>/dev/null`, `tee /dev/null`, `dd of=/dev/null`, and all redirect target forms are allowed so routine probe and silencing workflows don't hit the boundary. Narrow exemption: the discard-only walkers short-circuit *before* `is_write_permitted`; `sed -i /dev/null`, `truncate /dev/null`, and `cp|mv|ln ... /dev/null` remain blocked because each performs a real filesystem write under `/dev/`.
- **POSIX `--` end-of-options** — `install`, `rsync`, `sed -i`, and `truncate` continue parsing operands after a literal `--`, so `rsync … -- -outside/file` and similar dash-prefixed targets are validated rather than silently skipped as flags.
- **Windows-native path tokens in COMMAND** — `tee C:\Windows\System32\…`, `rm C:/Users/x/.ssh/id_rsa`, redirects to drive-letter paths and UNC `\\server\share\…` are rewritten per-token via `cygpath -u` (MSYS2) before walkers run, then the boundary check rejects them. On non-MSYS2 shells Windows-shape tokens fail closed because they don't match the POSIX absolute-path pattern.
- **`jq` behaviour canary** — the hook entry challenges `jq` with a randomised key/value JSON object on every invocation. A hostile shim that returns canned output (`jq() { echo ""; }`) cannot reproduce a per-call random value and the hook blocks, so the parser used to extract `tool_input` is provably real `jq`.
- **NTFS reparse-point traversal** — junctions (`mklink /J`) and symbolic links (`mklink /D`) inside the project are followed to their physical target by `cd -P` (MSYS2 implements it via Win32 `SetCurrentDirectory`), so `project/escape -> C:\Windows` resolves to `/c/Windows` and writes through it are blocked. Regression-anchored on the Windows-smoke job.

### Path allowlist (`hooks/allowlist.conf`)

Some paths legitimately live outside every project — e.g. Claude Code's auto-memory under `~/.claude/projects/<slug>/memory/`, which needs to persist across projects by design. The allowlist file lets you permit writes to those paths without loosening the project boundary for everything else.

**Scope:** the allowlist is a **WRITE exception only**. It applies to the gentle write paths — `Edit` / `Write` / `MultiEdit`, redirects (`>` / `>>`), `tee`, `curl -o`, `wget -O`, `dd of=`, and similar — and to `cd` into an allowlisted directory. It deliberately does **not** apply to destructive or move/copy operations (`rm`, `mv`, `cp`, `ln`, `chmod`, `chown`, `find -delete`, `find -exec rm`, `install`, `rsync`, `tar -C`, `unzip -d`, `cpio -D`) or to script execution and shell redirection from outside paths. An allowlist entry that grants WRITE to `~/.claude/projects/*/memory/**` will **not** let `rm` or `rsync` run against that path.

**Format:** one glob pattern per line; `#` starts a comment; `~` expands to `$HOME`; `**` matches across path segments (bash globstar), `*` within a single segment.

**Defaults shipped with the plugin:**
- `~/.claude/projects/*/memory/**` — Claude Code auto-memory

> [!WARNING]
> **Do not mass-add entries to the allowlist.** Every entry is an escape hatch from the boundary, and Claude is creative enough to find non-obvious workarounds through allowed paths — for example: symlink-chasing from an allowlisted dir into sensitive files, writing executable content that some other tool later `source`s, or staging payloads in an allowed dir before moving them elsewhere. Widening the allowlist to something like `~/.claude/**` would let Claude overwrite `settings.json` or your shell rc files. Keep entries narrow, purpose-specific, and comment each one with the reason it exists. Prefer asking Claude for explicit per-write permission over adding entries.

### Known limitations

- Paths with spaces work when properly quoted (single or double quotes). Unquoted paths with spaces are not supported.
- Brace expansion (`{a,b,c}`) is not enumerated — literal match only
- `~user/` (home of another user) is not expanded; only `~/` (current user) is handled

### Multiline git commits (`$(cat <<EOF)` is blocked)

The common idiom `git commit -m "$(cat <<'EOF' … EOF)"` is **blocked on purpose** — command substitution `$(…)` is fail-closed because the inner command is not inspectable in the general case (`$(cat && rm /etc/passwd)` looks identical to the parser). Making an exception for one shape of `cat` would just open a new bypass category.

The supported pattern is heredoc on stdin:

```bash
git commit -F - <<'EOF'
Subject line

Body paragraph.
EOF
```

Repeated `-m` works for shorter messages where every paragraph fits on one line:

```bash
git commit -m "Subject line" -m "Body paragraph."
```

Avoid: writing the message to `.git/COMMIT_*` files (triggers a Write-tool prompt) or to `/tmp/*_msg.txt` (outside-project, blocked). The `SessionStart` hook ships a one-line hint that points Claude at the heredoc form on the first try, so no manual nudging is needed.

## Requirements

`bash` and `jq` must be on the PATH of the hook shell. macOS and most Linux distros ship bash; `jq` is usually present but install it explicitly if missing — without `jq` the hook fails closed with a clear `BLOCKED: 'jq' is required ...` message.

| Platform | Install |
|---|---|
| macOS | `brew install jq` |
| Debian/Ubuntu | `apt install jq` |
| Fedora/RHEL | `dnf install jq` |
| Arch | `pacman -S jq` |
| Windows (MSYS2) | `pacman -S jq` |
| Windows (Scoop/Winget) | `scoop install jq` or `winget install jqlang.jq` |

On Windows the plugin runs under MSYS2 bash; `cygpath` (shipped with MSYS2) is required for Windows-native paths (`C:\…`, `\\server\…`) to be normalized — without it those paths fail closed.

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

Full test suite covering all guard scenarios. CI runs on Ubuntu, macOS, and Windows (MSYS2 smoke job — minimal end-to-end coverage of Windows-native path handling and the NTFS reparse-point regression anchor).

## License

MIT
