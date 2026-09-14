#!/usr/bin/env bash
# Desktop integration for the ctrl-clip skill. Registers *.claudeclip files as
# application/x-claude-clip, handled by clip-url-handler.sh, so Ctrl+clicking a
# "⧉ ctrl + click" file:// link in Claude Code copies the draft. Idempotent: it only
# rewrites files and refreshes the MIME/desktop databases when something changed.
#
#   clip-setup.sh              register the handler if needed and print CLIP_DIR=…
#   clip-setup.sh --hook       same, then print the "Drafts to paste" rule (SessionStart hook)
#   clip-setup.sh --rule       print the "Drafts to paste" rule with absolute paths
#   clip-setup.sh --claude-md  add or refresh the rule in CLAUDE.md (autoload without the plugin)
#   clip-setup.sh --check      end-to-end self-test (restores your text clipboard afterwards)
#   clip-setup.sh --uninstall  remove the handler, MIME type, CLAUDE.md rule and saved drafts
set -euo pipefail

skill_dir=$(cd -- "$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")" && pwd)
clip_dir="$HOME/.cache/claude-clip"
data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
mime_type="application/x-claude-clip"
mime_file="$data_home/mime/packages/claude-clip.xml"
desktop_id="claude-clip-url-handler.desktop"
desktop_file="$data_home/applications/$desktop_id"
claude_md="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/CLAUDE.md"
begin_marker="<!-- claude-clip:begin -->"
end_marker="<!-- claude-clip:end -->"

warn() { printf 'clip-setup: %s\n' "$*" >&2; }

mime_xml() {
  cat <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-claude-clip">
    <comment>Claude draft to copy to the clipboard</comment>
    <glob pattern="*.claudeclip" weight="100"/>
  </mime-type>
</mime-info>
EOF
}

desktop_entry() {
  local exec_path="$skill_dir/clip-url-handler.sh"
  [[ "$exec_path" =~ [[:space:]] ]] && exec_path="\"$exec_path\""
  cat <<EOF
[Desktop Entry]
Name=Claude Clip
Comment=Copy a Claude draft (.claudeclip) to the clipboard
Exec=$exec_path %f
Type=Application
NoDisplay=true
MimeType=$mime_type;
EOF
}

rule() {
  cat <<EOF
## Drafts to paste
Whenever you draft a message the user will paste elsewhere (Slack, Teams, PR comment, email), follow the \`ctrl-clip\` skill's "Inline ⧉ copy link" section: write the formatted text to \`$clip_dir/<id>.claudeclip\`, show the draft as a \`>\` blockquote with nothing else inside it, and put \`[⧉ ctrl + click](file://$clip_dir/<id>.claudeclip)\` on its own line right under it. Keep commentary outside the blockquote. Plain click does nothing; only Ctrl+click copies.
EOF
}

# write_if_changed FILE CONTENT — succeeds only when the file was (re)written.
write_if_changed() {
  if [[ -f "$1" && "$(cat -- "$1")" == "$2" ]]; then
    return 1
  fi
  mkdir -p -- "$(dirname -- "$1")"
  printf '%s\n' "$2" > "$1"
}

ensure() {
  # shellcheck disable=SC2174  # mode only matters when the dir is new
  mkdir -p -m 700 -- "$clip_dir"
  chmod +x -- "$skill_dir/clip.sh" "$skill_dir/clip-url-handler.sh" "$skill_dir/clip-setup.sh" 2>/dev/null || true

  if [[ "$(uname -s)" != Linux ]]; then
    warn "Ctrl+click copy links need a Linux desktop (freedesktop MIME + xdg-open); /ctrl-clip still works."
    return 0
  fi
  local cmd missing=()
  for cmd in xdg-mime update-mime-database update-desktop-database; do
    command -v "$cmd" >/dev/null || missing+=("$cmd")
  done
  if (( ${#missing[@]} )); then
    warn "missing ${missing[*]} (packages: xdg-utils shared-mime-info desktop-file-utils); Ctrl+click links disabled."
    return 0
  fi

  if write_if_changed "$mime_file" "$(mime_xml)"; then
    update-mime-database "$data_home/mime" >/dev/null 2>&1 || warn "update-mime-database failed"
  fi
  if write_if_changed "$desktop_file" "$(desktop_entry)"; then
    update-desktop-database "$data_home/applications" >/dev/null 2>&1 || true
  fi
  if [[ "$(xdg-mime query default "$mime_type" 2>/dev/null)" != "$desktop_id" ]]; then
    xdg-mime default "$desktop_id" "$mime_type"
  fi
}

strip_rule_block() {
  awk -v b="$begin_marker" -v e="$end_marker" '$0 == b { skip = 1; next } $0 == e { skip = 0; next } !skip'
}

install_claude_md() {
  local rest
  mkdir -p -- "$(dirname -- "$claude_md")"
  touch -- "$claude_md"
  [[ -e "$claude_md.claude-clip.bak" ]] || cp -- "$claude_md" "$claude_md.claude-clip.bak"
  rest=$(strip_rule_block < "$claude_md")
  if grep -qx '## Drafts to paste' <<< "$rest"; then
    warn "$claude_md already has an unmanaged '## Drafts to paste' section; remove it to avoid duplicates."
  fi
  {
    [[ -z "$rest" ]] || printf '%s\n\n' "$rest"
    printf '%s\n%s\n%s\n' "$begin_marker" "$(rule)" "$end_marker"
  } > "$claude_md.tmp.$$"
  cat -- "$claude_md.tmp.$$" > "$claude_md"   # cat keeps a symlinked CLAUDE.md intact
  rm -f -- "$claude_md.tmp.$$"
  echo "⧉ Autoload rule written to $claude_md"
}

uninstall() {
  rm -f -- "$mime_file" "$desktop_file"
  if command -v update-mime-database >/dev/null && [[ -d "$data_home/mime" ]]; then
    update-mime-database "$data_home/mime" >/dev/null 2>&1 || true
  fi
  if command -v update-desktop-database >/dev/null && [[ -d "$data_home/applications" ]]; then
    update-desktop-database "$data_home/applications" >/dev/null 2>&1 || true
  fi
  if [[ -f "$claude_md" ]] && grep -qxF "$begin_marker" "$claude_md"; then
    local rest
    rest=$(strip_rule_block < "$claude_md")
    printf '%s\n' "$rest" > "$claude_md"
  fi
  rm -rf -- "$clip_dir"
  echo "⧉ Removed the Ctrl+click handler, MIME type, autoload rule and $clip_dir"
}

# Clipboard helpers for --check, picking the same backend order as clip.sh.
clipboard_get() {
  if [[ -n "${WAYLAND_DISPLAY:-}" ]] && command -v wl-paste >/dev/null; then
    wl-paste --no-newline 2>/dev/null
  elif [[ -n "${DISPLAY:-}" ]] && command -v xclip >/dev/null; then
    xclip -selection clipboard -o 2>/dev/null
  elif [[ -n "${DISPLAY:-}" ]] && command -v xsel >/dev/null; then
    xsel --clipboard --output 2>/dev/null
  fi
}

clipboard_set() {
  if [[ -n "${WAYLAND_DISPLAY:-}" ]] && command -v wl-copy >/dev/null; then
    wl-copy >/dev/null 2>&1
  elif [[ -n "${DISPLAY:-}" ]] && command -v xclip >/dev/null; then
    xclip -selection clipboard -i >/dev/null 2>&1
  elif [[ -n "${DISPLAY:-}" ]] && command -v xsel >/dev/null; then
    xsel --clipboard --input >/dev/null 2>&1
  fi
}

check() {
  local draft="$clip_dir/install-test.claudeclip"
  local outside="$HOME/.cache/outside-claude-clip-test.claudeclip"
  local expected=$'Hello team, *clip* test\n\n- line with a bar'
  local failures=0 previous got rc

  expect() {
    if [[ "$2" == "$3" ]]; then
      printf '  ✓ %s\n' "$1"
    else
      printf '  ✗ %s\n      expected: %q\n      got:      %q\n' "$1" "$3" "$2"
      failures=$((failures + 1))
    fi
  }

  ensure
  echo "⧉ ctrl-clip self-test"
  previous=$(clipboard_get || true)

  printf '%s\n' '> Hello team, *clip* test' '>' '│ - line with a bar' > "$draft"
  expect "*.claudeclip is $mime_type" "$(xdg-mime query filetype "$draft" 2>/dev/null)" "$mime_type"
  expect "default app is $desktop_id" "$(xdg-mime query default "$mime_type" 2>/dev/null)" "$desktop_id"

  printf SENTINEL | clipboard_set
  xdg-open "$draft" >/dev/null 2>&1 &
  for _ in $(seq 50); do
    got=$(clipboard_get || true)
    [[ "$got" == SENTINEL ]] || break
    sleep 0.1
  done
  expect "xdg-open copies the draft without > or │" "$got" "$expected"

  printf SENTINEL | clipboard_set
  cp -- "$draft" "$outside"
  if "$skill_dir/clip-url-handler.sh" "$outside" 2>/dev/null; then rc=0; else rc=$?; fi
  expect "handler rejects files outside $clip_dir" "$rc" 1
  expect "clipboard untouched after a rejected file" "$(clipboard_get || true)" SENTINEL
  expect "handler.log records both invocations" \
    "$(tail -n 2 "$clip_dir/handler.log" | grep -c -e "$draft" -e "$outside")" 2
  rm -f -- "$outside" "$draft"

  if [[ -n "$previous" ]]; then printf '%s' "$previous" | clipboard_set; fi
  if (( failures )); then
    echo "⧉ $failures check(s) failed — see $clip_dir/handler.log"
    return 1
  fi
  echo "⧉ All checks passed"
}

case "${1:-}" in
  "" | --ensure) ensure; echo "CLIP_DIR=$clip_dir" ;;
  --hook) ensure 2>/dev/null || true; rule ;;
  --rule) rule ;;
  --claude-md) ensure; install_claude_md ;;
  --check) check ;;
  --uninstall) uninstall ;;
  -h | --help) sed -n '2,13s/^# \{0,1\}//p' "${BASH_SOURCE[0]}" ;;
  *) warn "unknown option: $1 (see --help)"; exit 2 ;;
esac
