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
  # Remove surrounding quotes (single or double)
  p="${p%\"}"
  p="${p#\"}"
  p="${p%\'}"
  p="${p#\'}"
  # Expand ~ at start
  if [[ "$p" == "~/"* ]]; then
    p="$HOME/${p#\~/}"
  elif [[ "$p" == "~" ]]; then
    p="$HOME"
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
# Return 0 iff $1 is a POSIX bit-bucket write target whose bytes are
# guaranteed to be discarded with no real filesystem write.
#
# /dev/null is the canonical bit-bucket on every POSIX system
# (Linux, macOS, BSD) at the same path. Writes to it are accepted
# by the kernel and dropped — there is no filesystem target, no
# parent directory mutation, no symlink side-effect. Callers that
# KNOW they are writing a target (redirect operators, `tee`,
# `curl -o`, `wget -O`, `dd of=`) can short-circuit here before
# invoking is_write_permitted, so probe and silencing workflows
# like `curl -o /dev/null` and `2>/dev/null` don't require a
# per-project allowlist entry.
#
# IMPORTANT: this must NOT be used from call sites that do an
# in-place edit via temp-file + rename (`sed -i`, `truncate`) or
# from `cp/mv/ln/install/rsync` targets — those DO write under
# the parent directory of the nominal target (e.g. sed -i creates
# a temp file in /dev/ before renaming over /dev/null), and the
# boundary check must still fire there. See is_write_permitted
# docstring for the full separation of write semantics.
is_discard_target() {
  [ "$1" = "/dev/null" ]
}
