#!/bin/bash
# project-boundary guard — filesystem-entry creation detectors
# ============================================================
# mktemp -p<dir> / --tmpdir, mkfifo, mknod create a temp file or
# special FS entry whose location can land outside the project.
# Split out of write_targets_b.sh by domain (Codex r5 finding #4).
#
# Same dynamic-scope contract as the rest of detectors/:
# reads CMD, CMD_BLANKED, CMD_TOKENS, CMD_TOKENS_SCAN,
# EFFECTIVE_CWD, PROJECT_DIR; helpers from
# hooks/lib/tokenize.sh + paths.sh + command_name.sh +
# options.sh. Calls `exit 2` on violation.

run_filesystem_create_detectors() {
  # --- mktemp -p<dir> / --tmpdir=<dir>: temp file/dir creation ---
  # `mktemp -p DIR TEMPLATE` and `mktemp --tmpdir=DIR TEMPLATE`
  # create a temp file or directory inside DIR. Outside-project DIR
  # is a write outside the boundary. Bare `mktemp` (no -p / --tmpdir)
  # uses the default temp dir (/tmp or $TMPDIR) and is left ALLOWED —
  # test harnesses (incl. helpers.sh) rely on the default form.
  if command_name_is "mktemp"; then
    local mtdir
    # -p / --tmpdir / --tmpdir=DIR — explicit destination flag.
    while IFS= read -r mtdir; do
      [ -n "$mtdir" ] && validate_command_path write "mktemp dir" "$mtdir"
    done < <(extract_attached_or_split_from CMD_TOKENS_SCAN -p --tmpdir)
    # Positional template with embedded path component:
    # mktemp /etc/tmp.XXX writes into /etc. Validate the template's
    # dirname (Codex r5 P1). The flag walker above ignores positionals;
    # we re-walk here for the path-bearing template form.
    local mti=1 mtn=${#CMD_TOKENS_SCAN[@]}
    while [ $mti -lt $mtn ]; do
      local mttok
      mttok=$(strip_quotes "${CMD_TOKENS_SCAN[$mti]}")
      case "$mttok" in
        -p|--tmpdir) mti=$((mti + 2)); continue ;;
        -p?*|--tmpdir=*) mti=$((mti + 1)); continue ;;
        -*) mti=$((mti + 1)); continue ;;
        */*) validate_command_path write "mktemp dir" "$(dirname -- "$mttok")" ;;
      esac
      mti=$((mti + 1))
    done
  fi

  # --- mkfifo / mknod: create special filesystem entry (round-5) ---
  # `mkfifo PATH...` creates a named pipe at each PATH; `mknod PATH
  # TYPE MAJOR MINOR` creates a device node at PATH (only the first
  # positional is a path — the rest are spec). Outside-project PATH
  # is a real boundary violation, but no walker covered it.
  # Value-bearing flags: -m / --mode (and `--mode=...`), -Z /
  # --context (SELinux on GNU). is_write_permitted (allowlist OK).
  local SPECIAL_CMD
  for SPECIAL_CMD in mkfifo mknod; do
    if command_name_is "$SPECIAL_CMD"; then
      # mknod adds `-F FORMAT` (BSD `mknod -F bsd|freebsd|linux|solaris`);
      # mkfifo has no -F so we must NOT pair-skip it there.
      local _sf="-m --mode -Z --context"
      [ "$SPECIAL_CMD" = "mknod" ] && _sf="$_sf -F"
      local _path
      while IFS= read -r _path; do
        [ -z "$_path" ] && continue
        validate_command_path write "$SPECIAL_CMD" "$_path"
        # mknod has only one PATH positional; mkfifo accepts many.
        [ "$SPECIAL_CMD" = "mknod" ] && break
      done < <(walk_path_operands_from CMD_TOKENS_SCAN "$_sf" "--mode --context")
    fi
  done
}
