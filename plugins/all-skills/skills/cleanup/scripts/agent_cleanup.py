#!/usr/bin/env python3
"""agent-cleanup: reclaim the disk space that AI coding agents leave behind.

  scan   Read-only. Finds git worktrees, branches, build artifacts, archives
         and backups, package caches and agent session logs. Classifies each
         one and saves a numbered plan.
  apply  Re-checks the chosen plan items and acts only on those whose state
         has not changed since the scan. Never force-removes a worktree unless
         --force is given, and never touches origin unless --remote is given.

Classes:
  REMOVE          safe to reclaim: merged into the base branch, regenerable, or already gone
  NEEDS-DECISION  holds something unique: uncommitted or ignored files, unmerged commits,
                  build output, archives, logs
  KEEP-ACTIVE     open PR, recent work, or a new branch with no commits yet
  SKIP            main checkout, long-lived branch, locked, rebasing, in use by a process,
                  or on an unmounted drive

Python 3.9+ standard library only. Needs git; uses gh (GitHub CLI) when present
to see PR state, so squash-merged branches are recognised.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import fnmatch
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path

VERSION = "1.0.0"
HOME = Path.home()
STATE_DIR = Path(os.environ.get("XDG_STATE_HOME") or HOME / ".local" / "state") / "agent-cleanup"
PLAN_FILE = STATE_DIR / "plan.json"
LOG_FILE = STATE_DIR / "history.jsonl"
PLAN_MAX_AGE_HOURS = 24
NOW = time.time()
os.environ["GIT_OPTIONAL_LOCKS"] = "0"  # keep `git status` from rewriting the index during a scan
DAY = 86400
CLASSES = ("REMOVE", "NEEDS-DECISION", "KEEP-ACTIVE", "SKIP")
CATEGORIES = ("git", "artifacts", "archives", "caches", "agents", "trash")
LONG_LIVED = re.compile(r"^(main|master|trunk|develop|development|dev|staging|stage|production|prod|"
                        r"gh-pages|releases?(/.*)?)$")

# Where agents keep isolated checkouts outside the repo. Worktrees inside a repo
# (Claude Code's .claude/worktrees, .worktrees) come from `git worktree list`.
# Extra roots: --agent-root or AGENT_CLEANUP_WORKTREE_ROOTS (os.pathsep-separated).
AGENT_WORKTREE_ROOTS = [
    "$CODEX_HOME/worktrees",              # Codex app
    "~/.cursor/worktrees",                # Cursor parallel agents
    "~/conductor/workspaces",             # Conductor
    "/var/tmp/vibe-kanban/worktrees",     # Vibe Kanban (Linux default)
]
IN_REPO_WORKTREE_DIRS = (".claude/worktrees", ".worktrees")

# Agent logs, pruned by age. Each entry: agent, directory, what it holds, the
# agent's own retention setting, and what may be deleted: "files:<glob>" deletes
# matching files older than --keep-days (glob on the path relative to the
# directory; "!" entries are excluded), "dirs" deletes whole subdirectories whose
# newest file is older than --keep-days.
AGENT_DATA = [
    ("Claude Code", "~/.claude/projects", "session transcripts",
     "cleanupPeriodDays in ~/.claude/settings.json (default 30)", ["*.jsonl", "!*/memory/*"]),
    ("Claude Code", "~/.claude/file-history", "file checkpoints", "cleanupPeriodDays", ["*"]),
    ("Claude Code", "~/.claude/debug", "debug logs", "cleanupPeriodDays", ["*"]),
    ("Claude Code", "~/.claude/shell-snapshots", "shell snapshots", "cleanupPeriodDays", ["*"]),
    ("Claude Code", "~/.claude/paste-cache", "pasted content", "cleanupPeriodDays", ["*"]),
    ("Codex", "$CODEX_HOME/sessions", "session rollouts", "none built in", ["*.jsonl"]),
    ("Codex", "$CODEX_HOME/archived_sessions", "archived sessions", "none built in", ["*.jsonl"]),
    ("Codex", "$CODEX_HOME/log", "logs", "none built in", ["*"]),
    ("Gemini CLI", "~/.gemini/tmp", "chat sessions", "general.sessionRetention (default 30d)",
     ["*/chats/*"]),
    ("OpenCode", "~/.local/share/opencode/snapshot", "undo snapshots per project",
     'none built in; "snapshot": false disables them', "dirs"),
    ("OpenCode", "~/.local/share/opencode/log", "logs", "none built in", ["*"]),
]

# Directories an install or build recreates exactly: REMOVE in a stale project.
REGENERABLE = {
    "node_modules", ".next", ".nuxt", ".svelte-kit", ".turbo", ".parcel-cache", ".angular",
    ".expo", ".tox", ".nox", ".pytest_cache", ".mypy_cache", ".ruff_cache", "target", ".gradle",
    ".terraform", "test-results", "playwright-report", ".playwright-mcp", ".dart_tool", "DerivedData",
}
# Output that may hold a release, an export or hand-installed packages: NEEDS-DECISION.
BUILD_OUTPUT = {"build", "dist", "out", "coverage", ".output", ".venv", "venv"}
ARTIFACT_DIRS = REGENERABLE | BUILD_OUTPUT
# Outside git there is no ignore check, so only unambiguous names qualify.
UNAMBIGUOUS = {
    "node_modules", ".next", ".nuxt", ".svelte-kit", ".turbo", ".parcel-cache", ".angular",
    ".tox", ".nox", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".gradle", ".dart_tool",
}
# Ignored files that a merged worktree may lose without anyone missing them.
DISPOSABLE_NAMES = ARTIFACT_DIRS | {"__pycache__", ".DS_Store", "Thumbs.db", ".eslintcache", ".cache",
                                    "next-env.d.ts", ".astro", ".vite"}
DISPOSABLE_SUFFIXES = (".pyc", ".pyo", ".tsbuildinfo", ".log", ".egg-info")
ARCHIVE_RE = re.compile(
    r"\.(zip|tar|tgz|tbz2?|txz|tar\.(gz|bz2|xz|zst)|7z|rar|dump|sql|sql\.gz|bak|orig|old)$", re.I)
BACKUP_DIR_RE = re.compile(r"(^|[-_.])(bak|backup|backups|old|orig)([-_.]|$)", re.I)
# Never walked into while looking for repos, archives and backups.
WALK_SKIP = ARTIFACT_DIRS | {".git", "Library", "Applications", "snap", ".Trash"}
REMOVABLE_MEDIA = ("/media/", "/run/media/", "/mnt/", "/Volumes/")

# (name, command that prints the cache dir, fallback dir, prune command, note)
CACHES = [
    ("npm", ["npm", "config", "get", "cache"], "~/.npm", ["npm", "cache", "clean", "--force"], ""),
    ("pnpm", ["pnpm", "store", "path"], None, ["pnpm", "store", "prune"],
     "prunes only packages no project references"),
    ("yarn", ["yarn", "cache", "dir"], None, ["yarn", "cache", "clean"], ""),
    ("bun", None, "~/.bun/install/cache", ["bun", "pm", "cache", "rm"], ""),
    ("pip", ["pip3", "cache", "dir"], None, ["pip3", "cache", "purge"], ""),
    ("uv", ["uv", "cache", "dir"], None, ["uv", "cache", "prune"], "prunes only unused entries"),
    ("go build", ["go", "env", "GOCACHE"], None, ["go", "clean", "-cache"], ""),
    ("Homebrew", ["brew", "--cache"], None, ["brew", "cleanup", "--prune=all"],
     "also uninstalls outdated formula versions"),
    ("Xcode DerivedData", None, "~/Library/Developer/Xcode/DerivedData", None, ""),
]


# ---------------------------------------------------------------- helpers

def expand(p: str) -> Path:
    codex_home = os.environ.get("CODEX_HOME") or str(HOME / ".codex")
    return Path(os.path.expanduser(p.replace("$CODEX_HOME", codex_home)))


def run(args, cwd=None, timeout=120):
    try:
        return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout,
                              stdin=subprocess.DEVNULL)
    except (OSError, subprocess.TimeoutExpired):
        return None


def git(repo, *args, timeout=120):
    """stdout of a git command, or None when it fails."""
    p = run(["git", "-C", str(repo), *args], timeout=timeout)
    return p.stdout.strip() if p and p.returncode == 0 else None


def git_ok(repo, *args) -> bool:
    p = run(["git", "-C", str(repo), *args])
    return bool(p) and p.returncode == 0


def du(path) -> int:
    """Bytes on disk under path (0 when missing)."""
    path = Path(path)
    if not path.exists() and not path.is_symlink():
        return 0
    if path.is_symlink() or path.is_file():
        return path.lstat().st_size
    p = run(["du", "-sk", str(path)], timeout=900)
    if p and p.stdout.split():
        try:
            return int(p.stdout.split()[0]) * 1024
        except ValueError:
            pass
    total = 0
    for root, _dirs, files in os.walk(path):
        for f in files:
            try:
                total += os.lstat(os.path.join(root, f)).st_size
            except OSError:
                pass
    return total


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(n) < 1024 or unit == "TB":
            return f"{n:.0f} {unit}" if unit in ("B", "KB") else f"{n:.1f} {unit}"
        n /= 1024
    return str(n)


def parse_size(s: str) -> int:
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*([KMGT]?)B?", s.strip(), re.I)
    if not m:
        raise argparse.ArgumentTypeError(f"bad size: {s}")
    return int(float(m.group(1)) * 1024 ** "_KMGT".index(m.group(2).upper() or "_"))


def short(p) -> str:
    s = str(p)
    h = str(HOME)
    return "~" + s[len(h):] if s == h or s.startswith(h + os.sep) else s


def day(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


def tree_stamp(path: Path, skip=frozenset(), limit=200_000):
    """(newest mtime, entry count, complete) over a whole tree, not entering .git or `skip` names."""
    try:
        newest = path.lstat().st_mtime
    except OSError:
        return 0.0, 0, True
    if path.is_symlink() or not path.is_dir():
        return newest, 1, True
    count = 0
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d != ".git" and d not in skip]
        for n in dirs + files:
            try:
                newest = max(newest, os.lstat(os.path.join(root, n)).st_mtime)
            except OSError:
                pass
            count += 1
            if count > limit:
                return newest, count, False
    return newest, count, True


def process_cwds():
    """Working directories of every process we can see, or None if they can't be listed."""
    cwds = set()
    if Path("/proc").is_dir():
        for d in os.listdir("/proc"):
            if d.isdigit():
                try:
                    cwds.add(os.readlink(f"/proc/{d}/cwd"))
                except OSError:
                    pass
        return sorted(cwds)
    p = run(["lsof", "-d", "cwd", "-Fn"], timeout=180)  # macOS and other BSDs
    if not p or not p.stdout:
        return None
    return sorted(line[1:] for line in p.stdout.splitlines() if line.startswith("n/"))


def in_use(path: str, cwds) -> bool:
    """A process runs inside path. Unknown process list counts as in use."""
    if cwds is None:
        return True
    real = os.path.realpath(path)
    return any(c in (path, real) or c.startswith(path + os.sep) or c.startswith(real + os.sep)
               for c in cwds)


def drive_unmounted(path: str) -> bool:
    """A missing path on removable media whose drive is not mounted.

    Mounted means some existing ancestor below the media root is a mount point.
    """
    prefix = next((m for m in REMOVABLE_MEDIA if path.startswith(m)), None)
    if not prefix:
        return False
    p = Path(path).parent
    while str(p) + "/" != prefix and len(p.parts) > 1:
        if p.exists() and os.path.ismount(p):
            return False
        p = p.parent
    return True


def safe_rmtree(path: Path):
    """Delete a file or tree, refusing anything that looks like a root or a home folder."""
    path = Path(os.path.abspath(path))
    if len(path.parts) < 3 or path in (HOME, HOME.parent, Path("/")) or path.parent == HOME:
        raise RuntimeError(f"refusing to delete {path}")
    if path.is_symlink() or path.is_file():
        path.unlink()
        return

    def onerror(func, p, _exc):  # read-only files and folders (node_modules, Go modules)
        for target in (os.path.dirname(p), p):
            try:
                os.chmod(target, stat.S_IRWXU)
            except OSError:
                pass
        func(p)

    if sys.version_info >= (3, 12):
        shutil.rmtree(path, onexc=onerror)
    else:
        shutil.rmtree(path, onerror=onerror)


def item(kind, cls, path, note, size=0, **extra):
    d = {"kind": kind, "class": cls, "path": str(path) if path else "", "note": note, "size": size}
    d.update(extra)
    d["key"] = "|".join([kind, d["path"], d.get("repo", ""), d.get("branch", "")])
    return d


# ---------------------------------------------------------------- git

def default_base(repo) -> str:
    head = git(repo, "symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD")
    if head:
        return head.split("/", 1)[1]
    for b in ("main", "master", "trunk", "develop"):
        if git_ok(repo, "rev-parse", "-q", "--verify", f"refs/heads/{b}"):
            return b
    return git(repo, "branch", "--show-current") or "main"


def pr_states(repo, base) -> dict:
    """branch -> (state, number, headOid). A PR merged into another branch doesn't count as merged."""
    if not shutil.which("gh") or os.environ.get("AGENT_CLEANUP_NO_GH"):
        return {}
    p = run(["gh", "pr", "list", "--state", "all", "--limit", "1000",
             "--json", "headRefName,state,number,headRefOid,baseRefName"], cwd=repo, timeout=60)
    if not p or p.returncode != 0:
        return {}
    prs = {}
    for pr in reversed(json.loads(p.stdout or "[]")):  # oldest first, so newer ones overwrite
        state = pr["state"]
        if state == "MERGED" and pr.get("baseRefName") != base:
            state = "CLOSED"  # merged into a stacked parent, not into base
        cur = prs.get(pr["headRefName"])
        if cur is None or state != "CLOSED":
            prs[pr["headRefName"]] = (state, pr["number"], pr["headRefOid"])
    return prs


def worktrees(repo):
    """Parsed `git worktree list --porcelain`."""
    out = git(repo, "worktree", "list", "--porcelain") or ""
    wts, cur = [], None
    for line in out.splitlines() + [""]:
        if line.startswith("worktree "):
            cur = {"path": line[9:], "head": "", "branch": "", "locked": False, "bare": False}
        elif cur is None:
            continue
        elif line.startswith("HEAD "):
            cur["head"] = line[5:]
        elif line.startswith("branch "):
            cur["branch"] = re.sub(r"^refs/heads/", "", line[7:])
        elif line.startswith("locked"):
            cur["locked"] = True
        elif line == "bare":
            cur["bare"] = True
        elif line == "":
            wts.append(cur)
            cur = None
    return wts


def rebasing_branch(path):
    """Branch being rebased in this checkout, or None."""
    gitdir = git(path, "rev-parse", "--absolute-git-dir")
    for d in ("rebase-merge", "rebase-apply"):
        f = Path(gitdir or "/nonexistent") / d / "head-name"
        if f.is_file():
            return re.sub(r"^refs/heads/", "", f.read_text().strip())
    return None


def disposable(rel: str) -> bool:
    parts = rel.rstrip("/").split("/")
    return any(p in DISPOSABLE_NAMES for p in parts) or rel.rstrip("/").endswith(DISPOSABLE_SUFFIXES)


class RepoScan:
    """Classifies one repository's worktrees and local branches."""

    def __init__(self, repo: Path, opts, cwds):
        self.repo, self.opts, self.cwds = repo, opts, cwds
        self.base = opts.base or default_base(repo)
        self.base_ref = f"origin/{self.base}"
        if not git_ok(repo, "rev-parse", "-q", "--verify", f"refs/remotes/{self.base_ref}"):
            self.base_ref = self.base
        self.base_tree = git(repo, "rev-parse", f"{self.base_ref}^{{tree}}")
        self.prs = pr_states(repo, self.base) if self.base_tree else {}

    def content_merged(self, head) -> bool:
        """True when merging head into base changes nothing (catches squash and rebase merges)."""
        p = run(["git", "-C", str(self.repo), "merge-tree", "--write-tree", self.base_ref, head])
        if p and p.returncode == 0:
            return p.stdout.split("\n", 1)[0].strip() == self.base_tree
        if p and p.returncode == 1:  # conflicts
            return False
        return git_ok(self.repo, "merge-base", "--is-ancestor", head, self.base_ref)  # git < 2.38

    def creation(self, br):
        """(reflog entries, creation time) for a local branch; (0, None) without a reflog."""
        log = git(self.repo, "reflog", "show", "--date=unix", "--format=%gd", f"refs/heads/{br}", "--")
        stamps = re.findall(r"@\{(\d+)\}", log or "")
        return (len(stamps), float(stamps[-1])) if stamps else (0, None)

    def upstream_alive(self, br) -> bool:
        up = git(self.repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", f"{br}@{{upstream}}")
        return bool(up) and git_ok(self.repo, "rev-parse", "-q", "--verify", f"refs/remotes/{up}")

    def no_own_commits(self, br, head, age):
        """Class for a branch whose head is already an ancestor of base."""
        stale = self.opts.stale_days
        entries, created = self.creation(br) if br else (0, None)
        if entries == 1:  # only the creation entry: nothing was ever committed to it
            if NOW - created <= stale * DAY:
                return "KEEP-ACTIVE", "new branch, no commits yet"
            return "REMOVE", f"created {day(created)}, never committed to"
        if entries == 0:
            if age <= stale:
                return "KEEP-ACTIVE", "no commits of its own; recent"
            return "NEEDS-DECISION", "no commits of its own; no reflog to tell new from merged"
        if br and self.upstream_alive(br):
            return "KEEP-ACTIVE", "tracks a live remote branch; no commits beyond base"
        return "REMOVE", f"merged into {self.base_ref}"

    def classify(self, kind, br, path, head, dirty, kept, locked, main_wt):
        """kept: ignored files git would delete that don't look regenerable."""
        state, num, oid = self.prs.get(br, ("", "", "")) if br else ("", "", "")
        last = float(git(self.repo, "log", "-1", "--format=%ct", head) or 0)
        touched = last
        if path:
            idx = git(path, "rev-parse", "--path-format=absolute", "--git-path", "index")
            if idx and os.path.exists(idx):
                touched = max(touched, os.stat(idx).st_mtime)
        age = int((NOW - touched) // DAY)
        unpushed = git(self.repo, "rev-list", "--count", head, "--not", "--remotes") or "?"
        pr = f"PR #{num} {state.lower()}" if num else "no PR"
        stale = self.opts.stale_days

        if path == main_wt or br == self.base:
            cls, note = "SKIP", "main checkout / base branch"
        elif br and LONG_LIVED.match(br):
            cls, note = "SKIP", "long-lived branch"
        elif locked:
            cls, note = "SKIP", "locked"
        elif path and in_use(path, self.cwds):
            cls, note = "SKIP", "in use (a process is running inside it)"
        elif dirty is None:
            cls, note = "NEEDS-DECISION", "git status failed; check it by hand"
        elif dirty:
            cls, note = "NEEDS-DECISION", f"{dirty} uncommitted path(s), {pr}"
        elif kept:
            shown = ", ".join(kept[:3]) + (", ..." if len(kept) > 3 else "")
            cls, note = "NEEDS-DECISION", f"{len(kept)} ignored file(s) removal would delete: {shown}"
        elif state == "OPEN":
            cls, note = "KEEP-ACTIVE", f"PR #{num} open"
        else:
            merged = self.content_merged(head)
            if state == "MERGED" and (oid == head or merged):
                cls, note = "REMOVE", f"PR #{num} merged"
            elif merged and git_ok(self.repo, "merge-base", "--is-ancestor", head, self.base_ref):
                cls, note = self.no_own_commits(br, head, age)
            elif merged:
                cls, note = "REMOVE", f"content already on {self.base_ref}"
            elif state == "MERGED":
                cls, note = "NEEDS-DECISION", f"commits after PR #{num} merged, {unpushed} unpushed"
            elif age <= stale:
                cls, note = "KEEP-ACTIVE", f"touched {age}d ago, {pr}"
            elif state == "CLOSED":
                cls, note = "NEEDS-DECISION", f"PR #{num} closed unmerged, {unpushed} unpushed"
            else:
                cls, note = "NEEDS-DECISION", f"stale {age}d, no PR, {unpushed} unpushed commit(s)"
        return item(kind, cls, path, note, repo=str(self.repo), branch=br or "", head=head,
                    fingerprint=f"{head}:{dirty}:{len(kept)}", last_commit=day(last) if last else "")

    def scan(self):
        if not self.base_tree:
            return [item("repo", "SKIP", self.repo, f"no base branch '{self.base}' found",
                         repo=str(self.repo))]
        out, taken = [], set()  # taken: branches handled with their worktree
        wts = worktrees(self.repo)
        main_wt = wts[0]["path"] if wts else str(self.repo)
        for wt in wts:
            path, br = wt["path"], wt["branch"]
            if wt["bare"]:
                taken.add(br)
                continue
            if not os.path.isdir(path):
                if drive_unmounted(path):
                    taken.add(br)
                    out.append(item("worktree", "SKIP", path, "drive not mounted",
                                    repo=str(self.repo), branch=br))
                else:  # the branch is classified on its own below
                    out.append(item("worktree", "REMOVE", path, "directory is gone; unregister it",
                                    repo=str(self.repo), registered_branch=br, head=wt["head"],
                                    fingerprint=f"missing:{wt['head']}"))
                continue
            taken.add(br)
            rebasing = rebasing_branch(path)
            if rebasing:
                taken.add(rebasing)
                out.append(item("worktree", "SKIP", path, f"rebase of {rebasing} in progress",
                                repo=str(self.repo), branch=br))
                continue
            p = run(["git", "-C", path, "status", "--porcelain", "--ignored"])
            dirty, kept = None, []
            if p and p.returncode == 0:
                lines = p.stdout.splitlines()
                dirty = sum(1 for line in lines if not line.startswith("!! "))
                kept = [line[3:] for line in lines if line.startswith("!! ") and not disposable(line[3:])]
            out.append(self.classify("worktree", br, path, wt["head"], dirty, kept, wt["locked"], main_wt))
        refs = git(self.repo, "for-each-ref", "--format=%(refname:short)%09%(objectname)",
                   "refs/heads") or ""
        for line in refs.splitlines():
            br, head = line.split("\t")
            if br not in taken:
                out.append(self.classify("branch", br, "", head, 0, [], False, main_wt))
        if self.opts.remote:
            out += self.remote_items(out)
        return out

    def remote_items(self, local):
        """origin branches whose local copy is REMOVE and whose remote tip is merged too."""
        out = []
        for it in local:
            br = it.get("branch")
            if it["class"] != "REMOVE" or not br:
                continue
            sha = git(self.repo, "rev-parse", "-q", "--verify", f"refs/remotes/origin/{br}")
            if not sha:
                continue
            state, num, oid = self.prs.get(br, ("", "", ""))
            if (state == "MERGED" and oid == sha) or self.content_merged(sha):
                out.append(item("remote-branch", "REMOVE", "", f"origin/{br} is merged",
                                repo=str(self.repo), branch=br, fingerprint=sha))
        return out


def main_repo_of(path: Path):
    """Main repository for a checkout (linked worktree or clone); None for submodules."""
    if git(path, "rev-parse", "--show-superproject-working-tree"):
        return None
    common = git(path, "rev-parse", "--path-format=absolute", "--git-common-dir")
    if not common:
        return None
    common = Path(common)
    return common.parent if common.name == ".git" else common  # else: bare repository


def gitdir_target(dotgit: Path):
    """For a linked worktree's .git file: the admin dir it points to."""
    try:
        text = dotgit.read_text(errors="replace").strip()
    except OSError:
        return None
    if not text.startswith("gitdir:"):
        return None
    target = Path(text[7:].strip())
    return target if target.is_absolute() else (dotgit.parent / target)


def is_orphan(d: Path) -> bool:
    """A linked worktree whose admin dir (and usually whole repo) no longer exists."""
    dotgit = d / ".git"
    if not dotgit.is_file():
        return False
    target = gitdir_target(dotgit)
    if target is None:
        return False
    if target.exists():
        return False
    return not drive_unmounted(str(target))


# ---------------------------------------------------------------- discovery

def walk(root: Path, depth: int):
    """Yield (dirpath, dirnames, filenames) to `depth`, skipping WALK_SKIP and dot dirs."""
    root_depth = len(root.parts)
    for dirpath, dirnames, filenames in os.walk(root):
        d = Path(dirpath)
        keep = []
        for n in dirnames:
            if n in WALK_SKIP or (n.startswith(".") and n not in (".claude", ".worktrees")):
                continue
            if (d / n).is_symlink():
                continue
            keep.append(n)
        dirnames[:] = keep if len(d.parts) - root_depth < depth else []
        yield d, dirnames, filenames


def discover(roots, agent_roots, depth):
    """Repos, orphaned worktrees and backup/archive candidates under the given roots."""
    repos, orphans, candidates = set(), [], []

    def checkout(d: Path):
        dotgit = d / ".git"
        if dotgit.is_dir():
            repos.add(d)
        elif is_orphan(d):
            orphans.append(d)
        elif dotgit.is_file():
            main = main_repo_of(d)
            if main:
                repos.add(main)

    for root in agent_roots:
        for d, dirnames, _ in walk(root, 3):
            if (d / ".git").exists():
                checkout(d)
                dirnames[:] = []
    for root in roots:
        for d, dirnames, filenames in walk(root, depth):
            if (d / ".git").exists():
                checkout(d)
            for n in list(dirnames):
                if BACKUP_DIR_RE.search(n):
                    candidates.append(d / n)
                    dirnames.remove(n)
            candidates += [d / f for f in filenames if ARCHIVE_RE.search(f)]
    for repo in list(repos):
        for sub in IN_REPO_WORKTREE_DIRS:
            base = repo / sub
            if base.is_dir():
                orphans += [d for d in base.iterdir() if is_orphan(d)]
    return sorted(repos), sorted(set(orphans)), candidates


def deep_fingerprint(p: Path):
    newest, count, _ = tree_stamp(p)
    return newest, f"{int(newest)}:{count}"


def orphan_items(orphans, cwds):
    out = []
    for d in orphans:
        if in_use(str(d), cwds):
            continue
        _, fp = deep_fingerprint(d)
        out.append(item("orphan-worktree", "NEEDS-DECISION", d,
                        "worktree whose repository is gone; any changes in it exist nowhere else",
                        fingerprint=fp))
    return out


def candidate_items(candidates, opts, cwds):
    out = []
    for p in candidates:
        if not (p.exists() or p.is_symlink()) or (p.is_dir() and in_use(str(p), cwds)):
            continue
        newest, fp = deep_fingerprint(p)
        if NOW - newest < opts.stale_days * DAY:
            continue
        if main_repo_of(p.parent) and git(p.parent, "ls-files", "--", p.name):
            continue  # tracked in git: part of the project, not a leftover
        kind = "backup" if p.is_dir() else "archive"
        note = f"untouched since {day(newest)}"
        if (p / ".git").exists():
            note += "; contains a git checkout (check for unpushed work)"
        out.append(item(kind, "NEEDS-DECISION", p, note, fingerprint=fp))
    return out


def artifact_dirs(project: Path, is_git: bool):
    """Regenerable and build-output dirs inside a project."""
    found = []
    root_depth = len(project.parts)
    for dirpath, dirnames, _ in os.walk(project):
        d = Path(dirpath)
        keep = []
        for n in dirnames:
            p = d / n
            if n == ".git" or p.is_symlink():
                continue
            if d != project and (p / ".git").exists():
                continue  # nested checkout: scanned on its own
            if n in ARTIFACT_DIRS:
                if is_artifact(project, p, n, is_git):
                    found.append(p)
                continue
            keep.append(n)
        dirnames[:] = keep if len(d.parts) - root_depth < 4 else []
    return found


def is_artifact(project, p: Path, name, is_git) -> bool:
    if name in ("venv", ".venv") and not (p / "pyvenv.cfg").exists():
        return False
    if name == "target" and not any((p.parent / m).exists() for m in ("Cargo.toml", "pom.xml")):
        return False
    if is_git:
        rel = os.path.relpath(p, project)
        return git_ok(project, "check-ignore", "-q", rel) and not git(project, "ls-files", "--", rel)
    return name in UNAMBIGUOUS or name in ("venv", ".venv", "target")


def project_touched(project: Path, is_git: bool):
    """Newest activity in a project outside its artifact dirs, or None if too big to tell."""
    newest, _, complete = tree_stamp(project, skip=ARTIFACT_DIRS)
    if not complete:
        return None
    if is_git:
        newest = max(newest, float(git(project, "log", "-1", "--format=%ct") or 0))
        idx = git(project, "rev-parse", "--path-format=absolute", "--git-path", "index")
        if idx and os.path.exists(idx):
            newest = max(newest, os.stat(idx).st_mtime)
    return newest


def artifact_items(project: Path, is_git: bool, opts, cwds):
    touched = project_touched(project, is_git)
    if touched is None or NOW - touched < opts.stale_days * DAY or in_use(str(project), cwds):
        return []
    out = []
    dirs = artifact_dirs(project, is_git)
    for kind, cls, names, why in (
            ("artifacts", "REMOVE", REGENERABLE, "the next install or build recreates them"),
            ("build-output", "NEEDS-DECISION", BUILD_OUTPUT, "may hold a release, export or hand-installed packages")):
        mine = [p for p in dirs if p.name in names]
        if mine:
            listed = ", ".join(sorted({p.name for p in mine}))
            out.append(item(kind, cls, project, f"{listed} in a project untouched since {day(touched)}; {why}",
                            paths=[str(p) for p in mine], is_git=is_git, fingerprint=str(int(touched))))
    return out


# ---------------------------------------------------------------- storage

def cache_items():
    out = []
    for name, locate, fallback, cmd, note in CACHES:
        path = None
        if locate and shutil.which(locate[0]):
            p = run(locate, cwd=str(HOME), timeout=30)
            if p and p.returncode == 0 and p.stdout.strip():
                path = Path(p.stdout.strip().splitlines()[-1])
        if path is None and fallback:
            path = expand(fallback)
        if path is None or not path.exists():
            continue
        if name == "npm":
            path = path / "_cacache"
        if cmd and not shutil.which(cmd[0]):
            continue
        how = " ".join(cmd) if cmd else "delete contents"
        out.append(item("cache", "REMOVE", path,
                        f"{name} cache; `{how}`" + (f" ({note})" if note else ""),
                        name=name, command=cmd or []))
    if shutil.which("docker"):
        p = run(["docker", "system", "df", "--format", "{{.Type}}\t{{.Reclaimable}}"], timeout=20)
        if p and p.returncode == 0:
            for line in p.stdout.splitlines():
                kind, _, rec = line.partition("\t")
                if kind == "Build Cache":
                    m = re.match(r"([\d.]+)\s*([kKMGT]?B)", rec)
                    size = parse_size(m.group(1) + m.group(2).upper()[0]) if m and m.group(2) != "B" else 0
                    out.append(item("cache", "REMOVE", "", "docker build cache; `docker builder prune -f`",
                                    size=size, name="docker", command=["docker", "builder", "prune", "-f"]))
    return out


def prunable(path: Path, rule, keep_days: int):
    """(path, size) of what an agent-data rule allows deleting: old matching files, or old subdirs."""
    cutoff = NOW - keep_days * DAY
    if rule == "dirs":
        for d in sorted(path.iterdir()):
            if d.is_dir() and not d.is_symlink():
                newest, _, complete = tree_stamp(d)
                if complete and newest < cutoff:
                    yield str(d), du(d)
        return
    include = [g for g in rule if not g.startswith("!")]
    exclude = [g[1:] for g in rule if g.startswith("!")]
    for root, _dirs, files in os.walk(path):
        for f in files:
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, path)
            if not any(fnmatch.fnmatch(rel, g) for g in include) or any(fnmatch.fnmatch(rel, g) for g in exclude):
                continue
            try:
                st = os.lstat(fp)
            except OSError:
                continue
            if st.st_mtime < cutoff:
                yield fp, st.st_size


def agent_data_items(opts):
    out = []
    for agent, d, what, retention, rule in AGENT_DATA:
        path = expand(d)
        if not path.is_dir():
            continue
        old = sum(size for _, size in prunable(path, rule, opts.keep_days))
        if old < opts.min_size:
            continue
        out.append(item("agent-data", "NEEDS-DECISION", path,
                        f"{agent} {what} older than {opts.keep_days}d; retention: {retention}",
                        size=old, agent=agent, rule=rule, keep_days=opts.keep_days))
    return out


def trash_entries(t: Path):
    """Top-level items in the trash (Linux keeps them under files/ and info/)."""
    entries = []
    for sub in ((t / "files", t / "info") if (t / "files").is_dir() else (t,)):
        if sub.is_dir():
            entries += sorted(sub.iterdir())
    return entries


def trash_fingerprint(t: Path) -> str:
    h = hashlib.sha1()
    for e in trash_entries(t):
        try:
            h.update(f"{e}:{int(e.lstat().st_mtime)}\n".encode())
        except OSError:
            pass
    return h.hexdigest()


def trash_items(opts):
    for t in (HOME / ".local/share/Trash", HOME / ".Trash"):
        if t.is_dir():
            size = du(t)
            if size >= opts.min_size:
                return [item("trash", "NEEDS-DECISION", t, "files already deleted to the trash",
                             size=size, fingerprint=trash_fingerprint(t))]
    return []


# ---------------------------------------------------------------- scan

def scan(opts):
    cwds = process_cwds()
    if cwds is None:
        print("warning: could not list running processes; every worktree is treated as in use",
              file=sys.stderr)
    agent_roots = [expand(p) for p in AGENT_WORKTREE_ROOTS + opts.agent_root
                   + [p for p in os.environ.get("AGENT_CLEANUP_WORKTREE_ROOTS", "").split(os.pathsep) if p]]
    agent_roots = [p for p in agent_roots if p.is_dir()]
    roots = [Path(os.path.abspath(os.path.expanduser(r))) for r in opts.root]
    repos, orphans, candidates = discover(roots, agent_roots, opts.depth)
    for r in opts.repo:
        main = main_repo_of(Path(r).expanduser())
        if main:
            repos.append(main)
    repos = sorted(set(repos))
    cats = set(opts.only or CATEGORIES)
    items = []

    if opts.fetch and "git" in cats:
        with cf.ThreadPoolExecutor(8) as ex:
            list(ex.map(lambda r: run(["git", "-C", str(r), "fetch", "--prune", "--quiet"], timeout=120),
                        repos))
    if "git" in cats:
        with cf.ThreadPoolExecutor(8) as ex:
            for res in ex.map(lambda r: RepoScan(r, opts, cwds).scan(), repos):
                items += res
        items += orphan_items(orphans, cwds)
    if "artifacts" in cats:
        removable = {i["path"] for i in items if i["class"] == "REMOVE"}
        projects = {}
        for r in repos:
            for wt in worktrees(r):
                if not wt["bare"] and os.path.isdir(wt["path"]) and wt["path"] not in removable:
                    projects.setdefault(Path(wt["path"]), True)
        for root in roots:  # non-git projects directly under a root
            for d in sorted(root.iterdir()) if root.is_dir() else []:
                if d.is_dir() and not (d / ".git").exists() and not d.name.startswith("."):
                    projects.setdefault(d, False)
        with cf.ThreadPoolExecutor(8) as ex:
            for res in ex.map(lambda kv: artifact_items(kv[0], kv[1], opts, cwds), projects.items()):
                items += res
    if "archives" in cats:
        items += candidate_items(candidates, opts, cwds)
    if "caches" in cats:
        items += cache_items()
    if "agents" in cats:
        items += agent_data_items(opts)
    if "trash" in cats:
        items += trash_items(opts)

    def size_of(i):  # only what could be reclaimed is measured
        if i["size"] or not i["path"] or i["kind"] == "branch" or i["class"] in ("KEEP-ACTIVE", "SKIP"):
            return i["size"]
        if "paths" in i:
            return sum(du(p) for p in i["paths"])
        return du(i["path"])

    with cf.ThreadPoolExecutor(8) as ex:
        for i, size in zip(items, ex.map(size_of, items)):
            i["size"] = size
    # Storage-only items below the threshold are noise; git items always show.
    items = [i for i in items if i["kind"] in ("worktree", "branch", "remote-branch", "orphan-worktree",
                                               "repo") or i["size"] >= opts.min_size]
    order = {c: n for n, c in enumerate(CLASSES)}
    items.sort(key=lambda i: (order[i["class"]], -i["size"], i["kind"], i["path"], i.get("branch", "")))
    for n, i in enumerate(items, 1):
        i["id"] = n
    return items


def render(items, show_all: bool):
    header = {
        "REMOVE": "REMOVE: safe to reclaim (merged, regenerable, or already gone)",
        "NEEDS-DECISION": "NEEDS-DECISION: holds something unique; delete only on an explicit pick",
        "KEEP-ACTIVE": "KEEP-ACTIVE: in use or recent; left alone",
        "SKIP": "SKIP: never touched",
    }
    lines = []
    for cls in CLASSES:
        group = [i for i in items if i["class"] == cls]
        if not group:
            continue
        total = sum(i["size"] for i in group)
        lines.append(f"\n{header[cls]}  [{len(group)} item(s), {human(total)}]")
        if cls in ("KEEP-ACTIVE", "SKIP") and not show_all:
            lines.append("  (listed with --all)")
            continue
        for i in group:
            where = short(i["path"] or i.get("repo") or i.get("name", ""))
            size = human(i["size"]) if i["size"] else "-"
            why = (f"{i['branch']} · " if i.get("branch") else "") + i["note"]
            lines.append(f"  {i['id']:>3}  {size:>9}  {i['kind']:<15} {where}")
            lines.append(f"  {'':>3}  {'':>9}  {'':<15} {why}")
    rec = sum(i["size"] for i in items if i["class"] == "REMOVE")
    nd = sum(i["size"] for i in items if i["class"] == "NEEDS-DECISION")
    lines.append(f"\nReclaimable: {human(rec)} recommended (REMOVE), up to {human(rec + nd)} with NEEDS-DECISION.")
    return "\n".join(lines)


def cmd_scan(opts):
    items = scan(opts)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    plan = {"version": VERSION, "created": dt.datetime.now().isoformat(timespec="seconds"),
            "created_ts": NOW, "options": {k: v for k, v in vars(opts).items() if k != "func"},
            "items": items}
    PLAN_FILE.write_text(json.dumps(plan, indent=1))
    if opts.json:
        print(json.dumps(plan, indent=1))
        return 0
    print(f"agent-cleanup {VERSION} scan, {plan['created']}. Plan saved to {short(PLAN_FILE)}")
    print(render(items, opts.all))
    print("Next: apply --recommended   or   apply <ids>   (add --dry-run to preview)")
    return 0


# ---------------------------------------------------------------- apply

def parse_ids(tokens):
    ids = set()
    for tok in tokens:
        for part in tok.split(","):
            if not part:
                continue
            m = re.fullmatch(r"(\d+)(?:-(\d+))?", part)
            if not m or (m.group(2) and int(m.group(2)) < int(m.group(1))):
                raise ValueError(f"bad id or range: {part}")
            ids.update(range(int(m.group(1)), int(m.group(2) or m.group(1)) + 1))
    return ids


def recheck(planned, opts):
    """Current state of each planned item, re-derived the same way scan did."""
    cwds = process_cwds()
    fresh = {}
    repos = {i["repo"] for i in planned if i["kind"] in ("worktree", "branch", "remote-branch")}
    for r in repos:
        if os.path.isdir(r):
            for i in RepoScan(Path(r), opts, cwds).scan():
                fresh[i["key"]] = i
    for i in planned:
        k, p = i["kind"], Path(i["path"]) if i["path"] else None
        if k == "orphan-worktree" and p and p.is_dir() and is_orphan(p) and not in_use(str(p), cwds):
            fresh[i["key"]] = dict(i, fingerprint=deep_fingerprint(p)[1])
        elif k in ("archive", "backup") and p and (p.exists() or p.is_symlink()):
            if not (p.is_dir() and in_use(str(p), cwds)):
                fresh[i["key"]] = dict(i, fingerprint=deep_fingerprint(p)[1])
        elif k in ("artifacts", "build-output") and p and p.is_dir():
            for cur in artifact_items(p, i["is_git"], opts, cwds):
                fresh[cur["key"]] = cur
        elif k == "trash" and p and p.is_dir():
            fresh[i["key"]] = dict(i, fingerprint=trash_fingerprint(p))
        elif k in ("cache", "agent-data") and (p is None or p.exists()):
            fresh[i["key"]] = i  # rules are re-applied at delete time (age only grows)
    return fresh


def execute(i, opts):
    """Perform one item's action. Returns a short result string."""
    k, path, repo, br = i["kind"], i["path"], i.get("repo", ""), i.get("branch", "")
    if opts.dry_run:
        return "would " + describe(i)
    if k == "worktree":
        rescue = ""
        head = i.get("head")
        if not br and not i.get("registered_branch") and head and not git(
                repo, "for-each-ref", "--count=1", "--contains", head):  # detached, reachable from no ref
            ref = f"refs/agent-cleanup/{Path(path).name}-{head[:10]}"
            if not git_ok(repo, "update-ref", ref, head):
                raise RuntimeError(f"could not save detached HEAD as {ref}; nothing removed")
            rescue = f"; detached HEAD saved as {ref}"
        args = ["git", "-C", repo, "worktree", "remove"]
        if opts.force and i["class"] == "NEEDS-DECISION":
            args.append("--force")
        p = run(args + [path])
        if not p or p.returncode != 0:
            raise RuntimeError("git refused: " + (p.stderr.strip() if p else "git not found"))
        if i.get("fingerprint", "").startswith("missing:"):
            kept = f"; branch {i['registered_branch']} kept" if i.get("registered_branch") else ""
            return "unregistered" + kept + rescue
        if br and i["class"] == "REMOVE":
            p = run(["git", "-C", repo, "branch", "-D", br])
            if not p or p.returncode != 0:
                return f"worktree removed; branch {br} kept ({p.stderr.strip() if p else 'git error'})"
            return f"worktree removed, branch {br} deleted"
        return "worktree removed" + (f"; branch {br} kept (has unmerged work)" if br else "") + rescue
    if k == "branch":
        p = run(["git", "-C", repo, "branch", "-D", br])
        if not p or p.returncode != 0:
            raise RuntimeError("git refused: " + (p.stderr.strip() if p else "git not found"))
        return f"branch {br} deleted (was {i['head'][:10]})"
    if k == "remote-branch":  # the lease refuses if origin moved since the scan
        p = run(["git", "-C", repo, "push", f"--force-with-lease=refs/heads/{br}:{i['fingerprint']}",
                 "origin", f":refs/heads/{br}"], timeout=120)
        if not p or p.returncode != 0:
            raise RuntimeError("push refused: " + (p.stderr.strip() if p else "git not found"))
        return f"origin/{br} deleted"
    if k in ("artifacts", "build-output"):
        for d in i["paths"]:
            if os.path.exists(d):
                safe_rmtree(Path(d))
        return f"deleted {len(i['paths'])} dir(s)"
    if k in ("orphan-worktree", "archive", "backup"):
        safe_rmtree(Path(path))
        return "deleted"
    if k == "cache":
        if i["command"]:
            p = run(i["command"], cwd=str(HOME), timeout=1800)
            if not p or p.returncode != 0:
                raise RuntimeError(f"`{' '.join(i['command'])}` failed: " + (p.stderr.strip()[-300:] if p else ""))
            return f"ran `{' '.join(i['command'])}`"
        for child in Path(path).iterdir():
            safe_rmtree(child)
        return "emptied"
    if k == "agent-data":
        n = 0
        for target, _ in list(prunable(Path(path), i["rule"], i["keep_days"])):
            safe_rmtree(Path(target))
            n += 1
        for root, dirs, files in os.walk(path, topdown=False):
            if root != path and not dirs and not files:
                try:
                    os.rmdir(root)
                except OSError:
                    pass
        return f"deleted {n} item(s) older than {i['keep_days']}d"
    if k == "trash":
        for e in trash_entries(Path(path)):
            safe_rmtree(e)
        return "trash emptied"
    raise RuntimeError(f"no action for kind {k}")


def describe(i):
    k = i["kind"]
    return {
        "worktree": f"git worktree remove {short(i['path'])}" + (" + delete branch " + i["branch"]
                                                                 if i.get("branch") and i["class"] == "REMOVE" else ""),
        "branch": f"git branch -D {i.get('branch')}",
        "remote-branch": f"git push origin --delete {i.get('branch')} (with lease)",
        "artifacts": "delete " + ", ".join(short(p) for p in i.get("paths", [])),
        "build-output": "delete " + ", ".join(short(p) for p in i.get("paths", [])),
        "cache": "run " + (" ".join(i.get("command") or []) or f"empty {short(i['path'])}"),
        "agent-data": f"delete {short(i['path'])} entries older than {i.get('keep_days')}d",
        "trash": f"empty {short(i['path'])}",
    }.get(k, f"delete {short(i['path'])}")


def cmd_apply(opts):
    if not PLAN_FILE.exists():
        print("No plan found. Run `scan` first.", file=sys.stderr)
        return 2
    plan = json.loads(PLAN_FILE.read_text())
    age_h = (time.time() - plan.get("created_ts", 0)) / 3600
    if age_h > PLAN_MAX_AGE_HOURS:
        print(f"The plan is {age_h:.0f}h old. Run `scan` again first.", file=sys.stderr)
        return 2
    items = plan["items"]
    o = plan["options"]
    print(f"Plan from {plan['created']}: repos {', '.join(short(r) for r in o.get('repo') or []) or '-'}, "
          f"roots {', '.join(short(r) for r in o.get('root') or []) or '-'}")
    if opts.recommended:
        chosen = [i for i in items if i["class"] == "REMOVE"
                  and (i["kind"] != "remote-branch" or opts.remote)]
    else:
        try:
            ids = parse_ids(opts.ids)
        except ValueError as e:
            print(e, file=sys.stderr)
            return 2
        unknown = ids - {i["id"] for i in items}
        if unknown:
            print(f"Unknown id(s): {sorted(unknown)}", file=sys.stderr)
            return 2
        chosen = [i for i in items if i["id"] in ids]
    if not chosen:
        print("Nothing selected.")
        return 0
    scan_opts = argparse.Namespace(**o)
    fresh = recheck(chosen, scan_opts)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    freed, failures = 0, 0
    # Worktrees before their branches; branches before remote branches.
    rank = {"worktree": 0, "branch": 1, "remote-branch": 2}
    for i in sorted(chosen, key=lambda x: rank.get(x["kind"], 3)):
        label = f"#{i['id']} {i['kind']} {short(i['path']) or i.get('branch', '')}".rstrip()
        cur = fresh.get(i["key"])
        if i["class"] in ("KEEP-ACTIVE", "SKIP"):
            result, ok = f"refused: class {i['class']} is never acted on", False
        elif i["kind"] == "remote-branch" and not opts.remote:
            result, ok = "refused: deleting branches on origin needs --remote", False
        elif cur is None:
            result, ok = "skipped: no longer present or now in use", False
        elif cur["class"] != i["class"] or cur.get("fingerprint") != i.get("fingerprint"):
            result, ok = f"skipped: changed since scan (now {cur['class']}: {cur['note']})", False
        else:
            if "paths" in i:  # only dirs that still qualify now
                i = dict(i, paths=[p for p in i["paths"] if p in cur["paths"]])
            try:
                result, ok = execute(i, opts), True
            except Exception as e:  # report and continue with the rest
                result, ok = f"failed: {e}", False
        if ok and not opts.dry_run:
            if i["kind"] in ("cache", "agent-data", "trash"):
                freed += max(i["size"] - (du(i["path"]) if i["path"] else 0), 0)
            else:
                freed += i["size"]
        failures += not ok
        print(f"{label}: {result}")
        if not opts.dry_run:
            with LOG_FILE.open("a") as f:
                f.write(json.dumps({"at": dt.datetime.now().isoformat(timespec="seconds"), "ok": ok,
                                    "result": result, "item": i}) + "\n")
    if not opts.dry_run:
        print(f"\nFreed about {human(freed)}. {failures} item(s) not applied. Log: {short(LOG_FILE)}")
    return 1 if failures else 0


# ---------------------------------------------------------------- cli

def main(argv=None):
    ap = argparse.ArgumentParser(prog="agent_cleanup.py", description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog=__doc__.split("\n\n", 1)[1])
    ap.add_argument("--version", action="version", version=VERSION)
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("scan", help="read-only inventory; saves a numbered plan")
    s.add_argument("--repo", action="append", default=[],
                   help="repository to inventory (default: the one containing the current directory)")
    s.add_argument("--root", action="append", default=[],
                   help="folder of projects to sweep for repos, artifacts, archives and backups (repeatable)")
    s.add_argument("--agent-root", action="append", default=[], help="extra agent worktree folder")
    s.add_argument("--only", type=lambda v: v.split(","), help=f"comma list from {','.join(CATEGORIES)}")
    s.add_argument("--base", help="base branch for every repo (default: origin/HEAD per repo)")
    s.add_argument("--stale-days", type=int, default=14, help="untouched this long counts as stale (14)")
    s.add_argument("--keep-days", type=int, default=30, help="agent logs newer than this are kept (30)")
    s.add_argument("--min-size", type=parse_size, default=parse_size("20M"),
                   help="hide storage items smaller than this (20M)")
    s.add_argument("--depth", type=int, default=3, help="how deep to look under each --root (3)")
    s.add_argument("--fetch", action="store_true", help="git fetch --prune each repo first")
    s.add_argument("--remote", action="store_true", help="also offer deleting merged branches on origin")
    s.add_argument("--all", action="store_true", help="also list KEEP-ACTIVE and SKIP items")
    s.add_argument("--json", action="store_true", help="print the plan as JSON")
    s.set_defaults(func=cmd_scan)

    a = sub.add_parser("apply", help="act on plan items after re-checking them")
    a.add_argument("ids", nargs="*", help="item ids from the last scan: 3 5 7-9 or 3,5,7-9")
    a.add_argument("--recommended", action="store_true", help="every REMOVE item (remote branches need --remote)")
    a.add_argument("--remote", action="store_true", help="allow deleting the chosen branches on origin")
    a.add_argument("--dry-run", action="store_true", help="show what would happen")
    a.add_argument("--force", action="store_true",
                   help="allow `git worktree remove --force` on NEEDS-DECISION worktrees (discards their changes)")
    a.set_defaults(func=cmd_apply)

    opts = ap.parse_args(argv)
    if opts.cmd == "scan" and opts.only:
        bad = set(opts.only) - set(CATEGORIES)
        if bad:
            ap.error(f"unknown --only categories: {', '.join(sorted(bad))}")
    if opts.cmd == "scan" and not opts.repo and not opts.root:
        here = git(os.getcwd(), "rev-parse", "--show-toplevel")
        if here:
            opts.repo = [here]
    if opts.cmd == "apply" and not opts.ids and not opts.recommended:
        ap.error("give item ids or --recommended")
    if not shutil.which("git"):
        ap.error("git is required")
    return opts.func(opts)


if __name__ == "__main__":
    sys.exit(main())
