#!/bin/bash
# project-boundary guard — heredoc module
# ========================================
# Heredoc body sanitisation for the substitution / variable-expansion
# scanners. bash semantics for `<<'EOF'` / `<<"EOF"` / `<<\EOF` /
# `<<-'EOF'` treat the body as a literal byte stream — no parameter,
# command, or arithmetic expansion runs. The detectors downstream
# must not fire on body bytes that would otherwise look like live
# expansions, which is what blank_quoted_heredoc_bodies arranges.
#
# No runtime dependencies. Called from hooks/guard.sh at three sites:
#   CMD_EXPAND_SCAN (variable-expansion fail-closed)
#   CMD_BLANKED + CMD_TOKENS_SCAN (sed -i / truncate / redirect walkers)
#   split_and_check scan_cmd (command-separator splitting with the
#                              blank_newlines flag)

# --- Blank out bodies of quoted/escaped heredocs for substitution scan ---
# When bash reads a heredoc whose delimiter is quoted or backslash-escaped
# (`<<'EOF'`, `<<"EOF"`, `<<\EOF`, `<<-'EOF'`), it does NOT perform
# parameter/command/arithmetic expansion in the body. Backticks and
# $(...) in such a body are therefore literal bytes written to stdin,
# not command substitutions. The substitution detector further down
# must not fire on those bytes, otherwise a legitimate
#   cat > <allowlisted>/file <<'EOF'
#   `echo hi`
#   EOF
# is wrongly blocked as "command substitution with backticks".
#
# This helper returns a copy of the input in which every quoted-heredoc
# body is overwritten with spaces (newlines preserved so byte offsets
# and line counts remain aligned). Unquoted heredoc bodies are left
# untouched — bash DOES expand them, so substitution detection must
# still fire there. Ambiguous / malformed input falls through to
# returning the original (= fail closed on the main scan).
#
# Note: shell-stdin-heredoc blocking for `bash <<...` / `sh <<...` is
# done elsewhere (shell_reads_from_stdin) on the original CMD and is
# unaffected by this sanitization.
blank_quoted_heredoc_bodies() {
  local s="$1"
  local n=${#s}
  case "$s" in *"<<"*) ;; *) printf '%s' "$s"; return 0 ;; esac

  # Build line index: LS[k]=start, LE[k]=offset of terminating '\n' (or n).
  local -a LS=() LE=()
  local i=0 ls=0
  while [ $i -lt $n ]; do
    if [ "${s:$i:1}" = $'\n' ]; then
      LS+=("$ls"); LE+=("$i"); ls=$((i+1))
    fi
    i=$((i+1))
  done
  LS+=("$ls"); LE+=("$n")
  local num_lines=${#LS[@]}

  # Queue of pending heredocs: parallel arrays.
  local -a HD=() HQ=() HI=() HB=()   # delim, quoted, indented(<<-), body_start
  local -a BS=() BE=()               # ranges to blank: [BS[k], BE[k])

  local li=0
  while [ $li -lt $num_lines ]; do
    local lstart=${LS[$li]} lend=${LE[$li]}
    local line="${s:$lstart:$((lend-lstart))}"

    if [ ${#HD[@]} -eq 0 ]; then
      # Command context — scan for `<<` openers outside quotes.
      local ci=0 clen=${#line} sq=0 dq=0 esc=0
      while [ $ci -lt $clen ]; do
        local c="${line:$ci:1}"
        if [ $esc -eq 1 ]; then esc=0; ci=$((ci+1)); continue; fi
        if [ "$c" = "\\" ] && [ $sq -eq 0 ]; then esc=1; ci=$((ci+1)); continue; fi
        if [ "$c" = "'" ] && [ $dq -eq 0 ]; then sq=$((1-sq)); ci=$((ci+1)); continue; fi
        if [ "$c" = '"' ] && [ $sq -eq 0 ]; then dq=$((1-dq)); ci=$((ci+1)); continue; fi
        if [ $sq -eq 0 ] && [ $dq -eq 0 ] && [ "$c" = "<" ] && [ $((ci+1)) -lt $clen ] && [ "${line:$((ci+1)):1}" = "<" ]; then
          # Skip `<<<` here-string — not a heredoc.
          if [ $((ci+2)) -lt $clen ] && [ "${line:$((ci+2)):1}" = "<" ]; then
            ci=$((ci+3)); continue
          fi
          local p=$((ci+2)) ind=0
          if [ $p -lt $clen ] && [ "${line:$p:1}" = "-" ]; then ind=1; p=$((p+1)); fi
          while [ $p -lt $clen ]; do
            local ws="${line:$p:1}"
            [ "$ws" = " " ] || [ "$ws" = $'\t' ] || break
            p=$((p+1))
          done
          if [ $p -ge $clen ]; then
            # Delimiter on next line — give up and return original (fail closed).
            printf '%s' "$s"; return 0
          fi
          local f="${line:$p:1}" delim="" q=0 j=0
          case "$f" in
            "'")
              j=$((p+1))
              while [ $j -lt $clen ] && [ "${line:$j:1}" != "'" ]; do j=$((j+1)); done
              if [ $j -ge $clen ]; then printf '%s' "$s"; return 0; fi
              delim="${line:$((p+1)):$((j-p-1))}"; q=1; p=$((j+1)) ;;
            '"')
              j=$((p+1))
              while [ $j -lt $clen ] && [ "${line:$j:1}" != '"' ]; do j=$((j+1)); done
              if [ $j -ge $clen ]; then printf '%s' "$s"; return 0; fi
              delim="${line:$((p+1)):$((j-p-1))}"; q=1; p=$((j+1)) ;;
            "\\")
              p=$((p+1)); j=$p
              while [ $j -lt $clen ] && [[ "${line:$j:1}" =~ [A-Za-z0-9_.+:=,/@%^-] ]]; do j=$((j+1)); done
              delim="${line:$p:$((j-p))}"; q=1; p=$j ;;
            *)
              j=$p
              while [ $j -lt $clen ] && [[ "${line:$j:1}" =~ [A-Za-z0-9_.+:=,/@%^-] ]]; do j=$((j+1)); done
              delim="${line:$p:$((j-p))}"; q=0; p=$j ;;
          esac
          if [ -z "$delim" ]; then printf '%s' "$s"; return 0; fi
          HD+=("$delim"); HQ+=("$q"); HI+=("$ind"); HB+=("-1")
          ci=$p; continue
        fi
        ci=$((ci+1))
      done
      # Only the queue HEAD's body starts on the line after this opener.
      # Subsequent heredocs' bodies begin on the line AFTER their
      # predecessor's terminator — we defer their body_start until the
      # predecessor is popped (see the matching block in body context
      # below). Previously we set body_start = lend+1 for every heredoc
      # on this line, so a later quoted heredoc's blank range covered
      # bytes belonging to an earlier unquoted body, hiding $(...) /
      # backtick / $VAR in the unquoted body from fail-closed scans.
      # Reported by Copilot review on commit aa6409b.
      if [ ${#HB[@]} -gt 0 ] && [ "${HB[0]}" = "-1" ]; then
        HB[0]=$((lend+1))
        [ $li -eq $((num_lines-1)) ] && HB[0]=$n
      fi
    else
      # Body context — check for terminator of queue head.
      local hd="${HD[0]}" hq="${HQ[0]}" hi_flag="${HI[0]}" hbs="${HB[0]}"
      local cmp="$line"
      if [ "$hi_flag" = "1" ]; then
        while [ ${#cmp} -gt 0 ] && [ "${cmp:0:1}" = $'\t' ]; do cmp="${cmp:1}"; done
      fi
      if [ "$cmp" = "$hd" ]; then
        if [ "$hq" = "1" ] && [ "$hbs" != "-1" ] && [ $lstart -gt $hbs ]; then
          BS+=("$hbs"); BE+=("$lstart")
        fi
        HD=("${HD[@]:1}"); HQ=("${HQ[@]:1}"); HI=("${HI[@]:1}"); HB=("${HB[@]:1}")
        # The predecessor just popped; the next queue head's body starts
        # on the line AFTER this terminator line. Matches the deferred
        # body_start in the opener-context block above.
        if [ ${#HD[@]} -gt 0 ] && [ "${HB[0]}" = "-1" ]; then
          HB[0]=$((lend+1))
          [ $li -eq $((num_lines-1)) ] && HB[0]=$n
        fi
      fi
    fi
    li=$((li+1))
  done

  # Any heredoc still open at EOF: blank remainder if quoted (tolerant of
  # trailing newlines / missing terminator).
  local qi=0
  while [ $qi -lt ${#HD[@]} ]; do
    if [ "${HQ[$qi]}" = "1" ] && [ "${HB[$qi]}" != "-1" ]; then
      local hbs="${HB[$qi]}"
      [ $n -gt $hbs ] && { BS+=("$hbs"); BE+=("$n"); }
    fi
    qi=$((qi+1))
  done

  if [ ${#BS[@]} -eq 0 ]; then printf '%s' "$s"; return 0; fi

  # Emit output: copy bytes, replace blanked ranges with space.
  # Newlines inside body ranges are preserved by default so byte
  # offsets and line counts remain aligned for line-based scanners.
  # Pass "blank_newlines" as the second arg to also replace body
  # newlines with spaces — needed by split_and_check, which would
  # otherwise treat a newline INSIDE a quoted heredoc body as a
  # command separator and slice the heredoc into pseudo-subcommands.
  # Build the output as bulk chunks instead of byte-by-byte concat.
  # The previous inner loop did `out+=" "` once per body byte; on bash
  # 3.2 (macOS default) that path is O(n²) due to repeated string
  # reallocation, which slows PreToolUse on large heredocs. Per-range
  # chunked emit via printf + tr keeps total work O(n). Reported by
  # Copilot review on PR #137.
  local blank_nl="${2:-preserve}"
  local out="" pos=0 bi=0 nb=${#BS[@]}
  while [ $bi -lt $nb ]; do
    local bs=${BS[$bi]} be=${BE[$bi]}
    # In blank_newlines mode, also subsume the newline that immediately
    # PRECEDES the body — that newline ends the heredoc opener line
    # syntactically (it's not a command separator and not a body byte
    # either). Without subsuming it, split_and_check would treat it as
    # a real newline-separator and slice the heredoc opener away from
    # its body, exposing the raw body to downstream walkers.
    if [ "$blank_nl" = "blank_newlines" ] && [ $bs -gt 0 ] && [ "${s:$((bs-1)):1}" = $'\n' ]; then
      bs=$((bs-1))
    fi
    if [ $pos -lt $bs ]; then out+="${s:$pos:$((bs-pos))}"; fi
    local blen=$((be-bs))
    if [ $blen -gt 0 ]; then
      local _chunk
      if [ "$blank_nl" = "blank_newlines" ]; then
        # Every byte (incl. newlines) collapses to a single space.
        printf -v _chunk '%*s' "$blen" ''
      else
        # Non-newline bytes → space; newlines preserved at same offsets.
        # `Z` sentinel guards the trailing-newline strip from $(...) so
        # a body that ends in `\n` keeps its newline in the result.
        _chunk=$(printf '%sZ' "${s:$bs:$blen}" | tr -c '\n' ' ')
        _chunk="${_chunk% }"
      fi
      out+="$_chunk"
    fi
    pos=$be; bi=$((bi+1))
  done
  if [ $pos -lt $n ]; then out+="${s:$pos:$((n-pos))}"; fi
  printf '%s' "$out"
}
