#!/bin/bash
# project-boundary guard — paths module
# ======================================
# Path resolution, boundary checks, allowlist matching, and
# write-target classification.
#
# Depends on: hooks/lib/tokenize.sh (glob_to_regex used by the
# precompute block that fills ALLOWLIST_REGEXES / ALLOWLIST_BASE_REGEXES
# — the precompute block itself lives in hooks/guard.sh and runs at
# load time after this module is sourced).
#
# Reads the following globals from hooks/guard.sh at call time:
#   PROJECT_DIR              — canonicalised project root
#   ALLOWLIST_REGEXES        — precomputed regexes
#   ALLOWLIST_BASE_REGEXES   — precomputed trailing-/** regexes
#   HOME                     — used by expand_path

# --- Portable realpath in pure bash ---
# macOS realpath does not support -m (non-existent path resolution).
# This pure-bash implementation handles .., . and works with non-existent paths.
# For non-existent paths, it resolves the nearest existing ancestor via pwd -P
# to handle symlinks (e.g. /var -> /private/var on macOS).
resolve_path() {
  local p="$1"
  # Make absolute
  if [[ "$p" != /* ]]; then
    p="$(pwd)/$p"
  fi
  # Normalize: collapse `.` and `//` segments only. DO NOT lexically resolve
  # `..`, because that would skip over a symlinked intermediate directory
  # (e.g. `memory/linkdir/../x` with `linkdir -> /tmp` is `/tmp/x` at the
  # OS level, not `memory/x`). `..` is left for physical resolution via
  # `cd $check && pwd -P` below, which honors symlink semantics correctly.
  local -a parts=()
  local IFS='/'
  for segment in $p; do
    if [[ "$segment" != "." && -n "$segment" ]]; then
      parts+=("$segment")
    fi
  done
  local IFS='/'
  local normalized
  if [[ ${#parts[@]} -eq 0 ]]; then
    normalized="/"
  else
    normalized="/${parts[*]}"
  fi
  # Walk up to find the nearest existing ancestor directory and resolve symlinks
  local check="$normalized"
  local tail=""
  while [[ ! -e "$check" && "$check" != "/" ]]; do
    tail="/$(basename "$check")$tail"
    check="$(dirname "$check")"
  done
  local combined
  if [[ -d "$check" ]]; then
    # `check` is a directory (possibly via symlink) — canonicalize it.
    # `cd && pwd -P` follows symlinks fully, so `.../linkdir -> /etc`
    # resolves to `/etc`. This is essential: if left unresolved, the
    # subsequent lexical `..` pass would incorrectly pop `linkdir` and
    # leave the caller inside the allowlisted dir.
    # On MSYS2, `cd -P` is also the load-bearing NTFS reparse-point
    # protection (#31): Win32 SetCurrentDirectory traverses junctions
    # and symbolic links, so `pwd -P` returns the physical target —
    # an in-project junction -> C:\Windows resolves to /c/Windows here
    # before is_write_permitted runs. The dedicated readlink-based
    # symlink-chase loop in guard.sh / below is irrelevant for NTFS
    # reparse points (readlink returns nothing for junctions).
    local real_ancestor
    real_ancestor=$(cd -P "$check" && pwd -P)
    combined="${real_ancestor}${tail}"
  elif [[ -e "$check" ]]; then
    # File exists — canonicalize the directory component so that intermediate
    # symlinks are fully dereferenced (macOS /var -> /private/var is one
    # case; more importantly, a user-created symlink inside an allowlisted
    # dir like `memory/linkdir -> /etc` resolves here, otherwise the
    # allowlist matches the unresolved path and permits the write).
    local _f_dir _f_base
    _f_dir=$(dirname "$check")
    _f_base=$(basename "$check")
    if [[ -d "$_f_dir" ]]; then
      local _real_f_dir
      _real_f_dir=$(cd -P "$_f_dir" && pwd -P)
      combined="${_real_f_dir}/${_f_base}${tail}"
    else
      combined="$normalized"
    fi
  else
    combined="$normalized"
  fi
  # Final pass: apply lexical `..` resolution on the combined result.
  # This is SAFE here (unlike at the top of the function) because the
  # ancestor has been physically canonicalized — no symlinks remain in
  # the prefix, so `..` cannot silently cross one. This step collapses
  # path-traversal attempts like `$PROJECT/safe/../../etc/passwd` into
  # `/etc/passwd` for the boundary check.
  local -a _final=()
  local IFS='/'
  for _seg in $combined; do
    if [[ "$_seg" == ".." ]]; then
      [[ ${#_final[@]} -gt 0 ]] && unset '_final[${#_final[@]}-1]'
    elif [[ -n "$_seg" ]]; then
      _final+=("$_seg")
    fi
  done
  if [[ ${#_final[@]} -eq 0 ]]; then
    echo "/"
  else
    echo "/${_final[*]}"
  fi
}

# --- Expand ~ and $HOME in a command argument ---
expand_path() {
  local p="$1"
  # Detect quoted ~ BEFORE stripping quotes. Bash leaves a quoted
  # tilde literal (`"~root"/.bashrc` is the literal path
  # `~root/.bashrc`, not user root's home). Without this check
  # the strip-then-match logic below would substitute the sentinel
  # for a literal-name path and block legitimate in-project
  # filenames containing `~`. Codex review of PR #25 (sec 59).
  local _quoted_tilde=0
  case "$p" in
    \"~*|\'~*) _quoted_tilde=1 ;;
  esac
  # Remove surrounding quotes (single or double)
  p="${p%\"}"
  p="${p#\"}"
  p="${p%\'}"
  p="${p#\'}"
  # Expand ~ at start (skipped entirely for quoted-tilde forms).
  if [ $_quoted_tilde -eq 0 ]; then
    if [[ "$p" == "~/"* ]]; then
      p="$HOME/${p#\~/}"
    elif [[ "$p" == "~" ]]; then
      p="$HOME"
    elif [[ "$p" =~ ^~[a-zA-Z_][a-zA-Z0-9_.-]* ]]; then
      # `~user/path` — bash expands to the named user's home dir at
      # exec time (e.g. `~root` → `/var/root` on macOS, `/root` on
      # Linux). Without exec'ing getent/dscl/eval we can't safely
      # resolve to the actual home, but the result is NEVER inside
      # the project dir. Substitute a sentinel absolute path so
      # is_inside_project / is_write_permitted naturally fail-closed.
      # Pentest-reported bypass: `rm ~root/.bashrc` was treated as a
      # relative path `~root/.bashrc` and prepended with EFFECTIVE_CWD
      # → in-project → ALLOWED.
      p="/__tilde_other_user/${p#\~}"
    fi
  fi
  # Expand $HOME / ${HOME} but NOT when the `$` is backslash-escaped.
  # Bash treats `\$HOME` as literal "$HOME" — no parameter expansion runs —
  # so the guard must mirror that or it produces false permits/blocks on
  # an escaped literal that bash would never expand at exec time.
  local _out="" _i=0 _n=${#p}
  while [ $_i -lt $_n ]; do
    local _c="${p:$_i:1}"
    if [ "$_c" = "\\" ] && [ $((_i+1)) -lt $_n ]; then
      # Backslash escape: emit the backslash + next byte verbatim so a
      # `\$HOME` survives untouched, matching bash's literal handling.
      _out+="${p:$_i:2}"
      _i=$((_i+2))
      continue
    fi
    if [ "$_c" = "\$" ]; then
      if [ "${p:$_i:5}" = "\$HOME" ]; then
        _out+="$HOME"
        _i=$((_i+5))
        continue
      fi
      if [ "${p:$_i:7}" = "\${HOME}" ]; then
        _out+="$HOME"
        _i=$((_i+7))
        continue
      fi
    fi
    _out+="$_c"
    _i=$((_i+1))
  done
  printf '%s\n' "$_out"
}

# --- Check if a resolved path is inside the project directory ---
# STRICT: allowlist does NOT apply here. Use in destructive contexts where
# the allowlist must not grant an exception: rm, chmod/chown, cd-outside,
# find -delete/-exec rm, and executing a script file.
is_inside_project() {
  local resolved="$1"
  # Add trailing slash to both sides so /tmp/project-other doesn't match /tmp/project
  if [[ "$resolved/" == "$PROJECT_DIR/"* ]]; then
    return 0
  fi
  return 1
}

# --- Check whether a resolved path is on the allowlist ---
# Fails closed: empty allowlist means nothing is exempt.
# A pattern ending in `/**` also matches the directory itself (gitignore-like
# semantics: `memory/**` allows both `memory` and its contents).
is_allowlisted() {
  local path="$1"
  local i=0 n=${#ALLOWLIST_REGEXES[@]}
  while [ $i -lt $n ]; do
    local regex="${ALLOWLIST_REGEXES[$i]}"
    if [[ "$path" =~ $regex ]]; then
      return 0
    fi
    local base_regex="${ALLOWLIST_BASE_REGEXES[$i]}"
    if [ -n "$base_regex" ] && [[ "$path" =~ $base_regex ]]; then
      return 0
    fi
    i=$((i+1))
  done
  return 1
}

# --- Check if a resolved path is a permitted WRITE target ---
# Permitted = inside the project OR matches a write-allowlist pattern
# (hooks/allowlist.conf). Use in write contexts: Edit/Write, redirect,
# tee, cp/mv/ln/install/rsync targets, tar -C, unzip -d, cpio -D,
# curl -o, wget -O, dd of=, sed -i, truncate.
#
# NOT for destructive ops (rm, chmod/chown, find -delete, cd+destructive,
# script execution). The allowlist is a WRITE exception, not a general
# boundary exception.
is_write_permitted() {
  local resolved="$1"

  # Dereference leaf symlinks BEFORE the inside-project check. Without
  # this, a symlink that lives inside the project but points outside
  # is treated as in-project and every write-style Bash detector
  # (tee, sed -i, truncate, curl -o, wget -O, dd of=) that funnels
  # through this function lets the write land at the outside target.
  # The Edit/Write tool branch already derefs upstream; this brings
  # the Bash-side paths to parity (Copilot review on PR #12 / 7641a412).
  # Loop limit + post-loop check fail-closed on circular chains.
  local deref="$resolved"
  local depth=20
  while [[ -L "$deref" && $depth -gt 0 ]]; do
    local link_target
    link_target=$(readlink "$deref")
    if [[ "$link_target" == /* ]]; then
      deref=$(resolve_path "$link_target")
    else
      deref=$(resolve_path "$(dirname "$deref")/$link_target")
    fi
    depth=$((depth - 1))
  done
  if [[ -L "$deref" ]]; then
    return 1
  fi

  if is_inside_project "$deref"; then
    return 0
  fi
  if is_allowlisted "$deref"; then
    # Allowlisted paths previously needed their own deref pass to avoid
    # `ln -sf /etc/passwd memory/link && tee memory/link`. Now that the
    # entry deref above already canonicalised the leaf, the allowlist
    # check sees the ultimate OS-level path — same protection, no
    # second loop needed.
    return 0
  fi
  return 1
}

# --- Classify POSIX bit-bucket write targets ---
# Return 0 iff $1 is a POSIX device passthrough whose bytes do NOT
# materialise as a filesystem write under any project boundary:
#
#   /dev/null              kernel bit-bucket (canonical discard)
#   /dev/stdout, /dev/fd/1, /proc/self/fd/1
#                          fd-1 alias — bytes flow to the caller's
#                          stdout, never to a file in /dev or /proc
#   /dev/stderr, /dev/fd/2, /proc/self/fd/2
#                          fd-2 alias — same, for stderr
#
# Linux exposes /dev/stdout etc. as symlinks to /proc/self/fd/N;
# macOS/BSD provide them via devfs. In every case the kernel
# routes the write to an existing file descriptor — there is no
# filesystem mutation under /dev or /proc to enforce a boundary
# on. Callers that KNOW they are writing a target (redirect
# operators, `tee`, `curl -o`, `wget -O`, `dd of=`) can
# short-circuit here before invoking is_write_permitted so
# `curl -o /dev/stdout`, `2>/dev/null`, `wget -O /dev/fd/1`
# don't require allowlist entries (Codex re-review D).
#
# IMPORTANT: this must NOT be used from call sites that do an
# in-place edit via temp-file + rename (`sed -i`, `truncate`) or
# from `cp/mv/ln/install/rsync` targets — those DO write under
# the parent directory of the nominal target (e.g. sed -i creates
# a temp file in /dev/ before renaming over /dev/null), and the
# boundary check must still fire there. See is_write_permitted
# docstring for the full separation of write semantics.
is_discard_target() {
  case "$1" in
    /dev/null|/dev/stdout|/dev/stderr) return 0 ;;
    /dev/fd/1|/dev/fd/2) return 0 ;;
    /proc/self/fd/1|/proc/self/fd/2) return 0 ;;
  esac
  # On Linux, `cd -P` through /dev/fd (symlink to /proc/self/fd) and
  # /proc/self (symlink to /proc/<pid>) canonicalises both to the
  # caller's actual PID — `wget -O /dev/fd/1` reaches is_discard_target
  # as `/proc/12345/fd/1`. Match the per-process form here so the
  # discard semantics survive `resolve_path` canonicalisation.
  if [[ "$1" =~ ^/proc/[0-9]+/fd/[12]$ ]]; then
    return 0
  fi
  return 1
}

# --- DRY helpers for the detector cluster --------------------------
#
# Most walkers share the same path pipeline:
#   raw → expand_path → (prepend EFFECTIVE_CWD if relative) → resolve_path
# followed by an is_write_permitted / is_inside_project gate and a
# canned BLOCKED stderr line + exit 2. These helpers fold the
# boilerplate so a one-liner replaces ~10 lines per walker.

# resolve_command_path RAW
# Echoes the absolute, symlink-resolved path of RAW.
# Reads EFFECTIVE_CWD from the caller's dynamic scope (same contract
# as the detectors themselves).
resolve_command_path() {
  local p="$1"
  p=$(expand_path "$p")
  if [[ "$p" != /* ]]; then
    p="$EFFECTIVE_CWD/$p"
  fi
  resolve_path "$p"
}

# block_unless_path_allowed POLICY LABEL RESOLVED_PATH
#   POLICY = write   → is_write_permitted (allowlist applies)
#   POLICY = strict  → is_inside_project (no allowlist exception)
# On boundary violation: prints BLOCKED line to stderr and exit 2.
# LABEL is the verb name + flag for the message (e.g. "tee",
# "find -fprint", "7z -o<dir>").
block_unless_path_allowed() {
  local policy="$1" label="$2" path="$3"
  case "$policy" in
    write)
      is_write_permitted "$path" && return 0 ;;
    strict)
      is_inside_project "$path" && return 0 ;;
  esac
  echo "BLOCKED: '$label' targets '$path' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
  exit 2
}

# validate_command_path POLICY LABEL RAW_PATH
# Convenience wrapper: resolve + check in one call. Most call-sites
# only need this single helper.
validate_command_path() {
  local resolved
  resolved=$(resolve_command_path "$3")
  block_unless_path_allowed "$1" "$2" "$resolved"
}
