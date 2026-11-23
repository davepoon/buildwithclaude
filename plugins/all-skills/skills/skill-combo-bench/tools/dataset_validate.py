"""Validate task, skill-manifest, experiment, trace, and judge data contracts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from engine.validation import DataValidationError, load_schema, validate_json_file, validate_instance


def validate_project(root: str | Path) -> dict[str, Any]:
    """Validate all shipped schemas, task files, and skill manifests."""
    base = Path(root)
    schemas = {path.stem.replace(".schema", ""): load_schema(path) for path in (base / "schemas").glob("*.schema.json")}
    validated: list[str] = []
    errors: list[dict[str, str]] = []
    for path in sorted((base / "datasets" / "tasks").glob("*.json")):
        if path.name == "task_set.json":
            continue
        try:
            validate_json_file(path, schemas["task"])
            validated.append(str(path.relative_to(base)))
        except (DataValidationError, json.JSONDecodeError, KeyError) as exc:
            errors.append({"file": str(path.relative_to(base)), "error": str(exc)})
    for path in sorted((base / "tests" / "mock_skills").glob("*.manifest.json")):
        try:
            validate_json_file(path, schemas["skill_manifest"])
            validated.append(str(path.relative_to(base)))
        except (DataValidationError, json.JSONDecodeError, KeyError) as exc:
            errors.append({"file": str(path.relative_to(base)), "error": str(exc)})
    return {"status": "PASS" if not errors else "FAIL", "schema_count": len(schemas), "validated_files": validated, "errors": errors}


def main(argv: list[str] | None = None) -> int:
    """CLI for project or single-file validation."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".")
    parser.add_argument("--input")
    parser.add_argument("--schema")
    args = parser.parse_args(argv)
    if args.input and args.schema:
        try:
            validate_json_file(args.input, load_schema(args.schema))
            result: dict[str, Any] = {"status": "PASS", "file": args.input}
        except (DataValidationError, json.JSONDecodeError) as exc:
            result = {"status": "FAIL", "file": args.input, "error": str(exc)}
    else:
        result = validate_project(args.root)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

# FILE END: tools/dataset_validate.py
