# shellcheck shell=bash
# Per-wrapper list of options that consume the NEXT token.
#
# Some wrappers take option-with-value flags before the real verb
# (`sudo -u root cmd`, `env -u VAR cmd`, `timeout -k 5 10 cmd`).
# Without skipping the value too, the verb-finder mis-identifies the
# value as the verb (e.g. `root` instead of `cmd`), so downstream
# walkers (sink table / install detector / remote-dispatch
# neutraliser) never match. Reported by Copilot review on PR #23
# (guard.sh:897); propagated to command_name.sh / remote_dispatch.sh
# in PR #24 sec 41 / 42.
#
# Returns a space-separated list on stdout; empty for unknown
# wrappers. Callers wrap the result in ` ` so a `case` glob like
# `*" $t "*` matches whole tokens only.
#
# IMPORTANT: only flags that actually take a value go here. Value-
# less flags (sudo `-A`, `-k`, `-K`, `-E`, `-H`, `-i`, `-l`, `-n`,
# `-P`, `-S`, `-s`, `-V`, `-v`, `-b`, `-e`; long forms `--askpass`,
# `--background`, `--preserve-env`, `--login`, `--shell`, ...) MUST
# fall through to the caller's generic `-*` / `-[A-Za-z]*` branch
# (consume one token). Mis-listing a value-less flag skips the real
# verb and reopens the section-40 bypass — Codex round-1 P1 on PR
# #24.
_wrapper_opts_with_val() {
  case "$1" in
    sudo) printf -- '-a -c -C -D -g -h -p -R -r -t -T -U -u --auth-type --chdir --chroot --close-from --command-timeout --group --host --login-class --other-user --prompt --role --type --user' ;;
    env)  printf -- '-u -C -P --unset --chdir' ;;
    timeout) printf -- '-k -s --kill-after --signal' ;;
    nice) printf -- '-n --adjustment' ;;
    ionice) printf -- '-c -n -p --class --classdata --pid' ;;
    chrt) printf -- '-p --pid' ;;
    *) ;;
  esac
}
