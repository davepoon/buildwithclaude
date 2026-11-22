#!/usr/bin/env python3
"""Create a SHA-256 manifest for explicitly supplied project files or directories."""
import argparse
import datetime
import hashlib
import json
import platform
from pathlib import Path


def digest(path):
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(block)
    return hasher.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+")
    parser.add_argument("--root", default=".")
    parser.add_argument("--output")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        root = Path(args.root).resolve()
        output_path = Path(args.output).resolve() if args.output else None
        selected = set()
        for raw in args.paths:
            path = (root / raw).resolve()
            if not path.exists():
                raise ValueError("Path not found: " + raw)
            if path.is_dir():
                for child in path.rglob("*"):
                    if child.is_file() and (output_path is None or child.resolve() != output_path):
                        selected.add(child)
            else:
                selected.add(path)
        files = []
        for path in sorted(selected, key=lambda p: str(p)):
            try:
                relative = str(path.relative_to(root)).replace("\\", "/")
            except ValueError:
                relative = str(path)
            files.append({"path": relative, "size_bytes": path.stat().st_size, "sha256": digest(path)})
        report = {
            "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "root": str(root), "python": platform.python_version(), "platform": platform.platform(),
            "file_count": len(files), "files": files,
            "note": "Hashes establish byte identity, not mathematical correctness or independent reproduction."
        }
        text = json.dumps(report, ensure_ascii=False, indent=2 if args.json or args.output else None)
        if args.output:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(text + "\n", encoding="utf-8")
        print(text)
        return 0
    except (OSError, ValueError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
