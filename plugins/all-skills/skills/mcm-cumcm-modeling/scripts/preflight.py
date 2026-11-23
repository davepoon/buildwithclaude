#!/usr/bin/env python3
"""Inspect optional modeling and paper capabilities without changing the system."""
import argparse
import importlib.util
import json
import platform
import shutil
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=["analysis", "data", "paper", "all"], default="all")
    parser.add_argument("--json", action="store_true", help="Emit formatted JSON; output is always JSON.")
    parser.add_argument("--strict", action="store_true", help="Return 1 when profile capabilities are missing.")
    args = parser.parse_args()

    profiles = {
        "analysis": {"packages": [], "commands": [], "any_commands": []},
        "data": {"packages": ["numpy", "pandas", "matplotlib"], "commands": [], "any_commands": []},
        "paper": {"packages": [], "commands": [], "any_commands": ["xelatex", "typst", "pandoc"]},
    }
    if args.profile == "all":
        packages = sorted({p for name in profiles for p in profiles[name]["packages"]})
        commands = sorted({c for name in profiles for c in profiles[name]["commands"]})
        any_commands = sorted({c for name in profiles for c in profiles[name]["any_commands"]})
    else:
        selected = profiles[args.profile]
        packages = selected["packages"]
        commands = selected["commands"]
        any_commands = selected["any_commands"]

    package_status = {name: importlib.util.find_spec(name) is not None for name in packages}
    command_status = {name: shutil.which(name) is not None for name in sorted(set(commands + any_commands))}
    blocking = [f"package:{name}" for name, ok in package_status.items() if not ok]
    blocking += [f"command:{name}" for name in commands if not command_status[name]]
    if any_commands and not any(command_status[name] for name in any_commands):
        blocking.append("any_command:" + "|".join(any_commands))

    report = {
        "profile": args.profile,
        "python": {"available": True, "version": platform.python_version(), "executable": sys.executable},
        "packages": package_status,
        "commands": command_status,
        "paper_engines": {name: command_status.get(name, False) for name in any_commands},
        "blocking_for_strict_profile": blocking,
        "status": "pass" if not blocking else "capabilities_missing",
        "note": "Optional capabilities do not block mathematical analysis; never claim unexecuted work was run.",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2 if args.json else None))
    return 1 if args.strict and blocking else 0


if __name__ == "__main__":
    raise SystemExit(main())
