#!/usr/bin/env python3
"""Run a minimal, read-only portability smoke test for this skill package."""
import json
import platform
from pathlib import Path


def main():
    skill_dir = Path(__file__).resolve().parent.parent
    report = {
        "skill": "mcm-cumcm-modeling",
        "skill_dir": str(skill_dir),
        "python": platform.python_version(),
        "skill_md_exists": (skill_dir / "SKILL.md").is_file(),
        "standard_library_only": True,
        "note": "This smoke test does not certify any external agent harness."
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["skill_md_exists"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
