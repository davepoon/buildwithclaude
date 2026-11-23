"""Unified CLI for validation, dry-run, execution, resume, replay, and reports."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path
from typing import Any

from engine import __version__
from engine.experiment import ExperimentError, ExperimentRunner, generate_report, read_results
from engine.validation import DataValidationError, load_yaml
from tools.cost_estimator import estimate_cost
from tools.dataset_validate import validate_project
from tools.trace_export import compare_traces, load_trace


def comma_list(value: str | None) -> list[str] | None:
    """Parse comma-separated CLI values while preserving explicit empty input."""
    return [item.strip() for item in value.split(",") if item.strip()] if value is not None else None


def add_run_options(parser: argparse.ArgumentParser) -> None:
    """Add only options wired to configuration or execution behavior."""
    parser.add_argument("--config", default="config/default.yaml")
    parser.add_argument("--root", help="Project root; defaults to the config directory's parent")
    parser.add_argument("--condition", action="append", help="Condition ID; repeat or use comma-separated values")
    parser.add_argument("--skills", help="Select configured skill IDs and derive N/single/combo conditions")
    parser.add_argument("--task-set")
    parser.add_argument("--repeat", type=int)
    parser.add_argument("--turn-mode", choices=["SHORT", "MEDIUM", "LONG"])
    parser.add_argument("--mock-tools", action="store_true", help="Force the safe local mock-tool registry")
    parser.add_argument("--fault-profile")
    parser.add_argument("--modalities", help="Comma-separated task modality filter")
    parser.add_argument("--judge", choices=["none", "mock"])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--resume", action="store_true", help="Resume --run-id without repeating successful runs")
    parser.add_argument("--run-id", help="Experiment ID used with --resume")
    parser.add_argument("--anonymize", action="store_true")
    parser.add_argument("--no-store-raw-content", action="store_true")
    parser.add_argument("--max-cost", type=float)
    parser.add_argument("--max-runtime", type=float)
    parser.add_argument("--retention-days", type=int, help="Prune experiment directories under artifacts older than N days")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--output-dir")


def project_root(config_path: Path, explicit: str | None) -> Path:
    """Resolve a portable root without depending on the caller's current directory."""
    if explicit:
        return Path(explicit).resolve()
    return (config_path.resolve().parent.parent if config_path.parent.name == "config" else Path.cwd().resolve())


def prepare(args: argparse.ArgumentParser) -> tuple[Path, dict[str, Any], argparse.ArgumentParser]:
    """Load configuration and apply effective CLI overrides."""
    config_path = Path(args.config).resolve()
    root = project_root(config_path, getattr(args, "root", None))
    config = load_yaml(config_path)
    for argument, key in (("task_set", "task_set"), ("repeat", "repeat"), ("turn_mode", "turn_mode"),
                          ("fault_profile", "fault_profile"), ("seed", "seed"), ("judge", "judge")):
        value = getattr(args, argument, None)
        if value is not None:
            config[key] = value
    if getattr(args, "modalities", None) is not None:
        config["modalities"] = comma_list(args.modalities)
    if getattr(args, "mock_tools", False):
        config["tool_backend"] = "mock"
    selected_skills = comma_list(getattr(args, "skills", None))
    if selected_skills:
        combo = {"N": []}
        for skill in selected_skills:
            combo[skill] = [skill]
        combo["+".join(selected_skills)] = selected_skills
        config["conditions"] = combo
    return root, config, args


def selected_conditions(args: argparse.Namespace, config: dict[str, Any]) -> list[str]:
    """Expand repeated and comma-separated condition options."""
    values: list[str] = []
    for raw in getattr(args, "condition", None) or []:
        values.extend(comma_list(raw) or [])
    return values or list(config.get("conditions", {}))


def dry_run(root: Path, config: dict[str, Any], conditions: list[str]) -> dict[str, Any]:
    """Compute workload and cost ranges without constructing an agent."""
    runner = ExperimentRunner(root, config)
    tasks = runner.load_tasks()
    modalities = config.get("modalities")
    if modalities:
        tasks = [task for task in tasks if set(task.get("modalities", ["text"])).intersection(modalities)]
    turn_mode = config.get("turn_mode", "SHORT")
    configured_max = config.get("turn_modes", {}).get(turn_mode, {}).get("max_turns")
    max_turns = max((len(task.get("turns", [])) for task in tasks), default=0)
    if configured_max:
        max_turns = min(max_turns, int(configured_max))
    max_tools = max((sum(len(turn.get("tool_calls", [])) for turn in task.get("turns", [])) for task in tasks), default=0)
    pricing = config.get("pricing") if config.get("pricing_available") else None
    result = estimate_cost(len(tasks), len(conditions), int(config.get("repeat", 1)), max_turns, max_tools,
                           tuple(config.get("token_estimate", {}).get("range_per_call", [0, 0])), pricing)
    result["conditions"] = conditions
    result["turn_mode"] = turn_mode
    result["modalities"] = modalities or "ALL"
    return result


def locate_experiment(root: Path, run_id: str) -> Path:
    """Resolve an experiment by explicit directory, artifact path, or stored experiment id."""
    candidate = Path(run_id)
    if candidate.is_dir() and (candidate / "results.jsonl").exists() or candidate.is_dir() and (candidate / "experiment.json").exists():
        return candidate
    direct = root / "artifacts" / run_id
    if direct.exists():
        return direct
    # Fall back to scanning artifacts so custom --output-dir experiments remain resumable.
    if (root / "artifacts").is_dir():
        for snapshot in sorted((root / "artifacts").glob("*/experiment.json")):
            try:
                data = json.loads(snapshot.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if data.get("experiment_id") == run_id:
                return snapshot.parent
    raise ExperimentError(f"Experiment not found: {run_id}")


def prune_expired_experiments(root: Path, retention_days: int | None, keep: Path) -> list[str]:
    """Delete only experiment directories under artifacts that exceed the retention window."""
    if retention_days is None or retention_days < 0:
        return []
    artifacts = root / "artifacts"
    if not artifacts.is_dir():
        return []
    cutoff = time.time() - retention_days * 86400
    removed: list[str] = []
    keep_resolved = keep.resolve()
    for candidate in artifacts.iterdir():
        if not candidate.is_dir() or candidate.resolve() == keep_resolved:
            continue
        # Only prune recorded experiments, never ad-hoc directories.
        if not (candidate / "experiment.json").exists():
            continue
        try:
            if candidate.stat().st_mtime < cutoff:
                shutil.rmtree(candidate)
                removed.append(candidate.name)
        except OSError:
            continue
    return removed


def main(argv: list[str] | None = None) -> int:
    """Run the benchmark CLI; return nonzero for validation/budget failures."""
    parser = argparse.ArgumentParser(prog="skill-combo-bench", description=__doc__)
    parser.add_argument("--version", action="version", version=__version__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate_parser = subparsers.add_parser("validate", help="Validate config, schemas, tasks, and manifests")
    validate_parser.add_argument("--config", default="config/default.yaml")
    validate_parser.add_argument("--root")
    dry_parser = subparsers.add_parser("dry-run", help="Estimate workload and cost without executing")
    add_run_options(dry_parser)
    run_parser = subparsers.add_parser("run", help="Execute an experiment")
    add_run_options(run_parser)
    resume_parser = subparsers.add_parser("resume", help="Resume incomplete runs in an experiment")
    add_run_options(resume_parser)
    resume_parser.set_defaults(resume=True)
    resume_parser.set_defaults(run_id=None)
    report_parser = subparsers.add_parser("report", help="Regenerate a report from stored results")
    report_parser.add_argument("--run-id", required=True)
    report_parser.add_argument("--config", default="config/default.yaml")
    report_parser.add_argument("--root")
    replay_parser = subparsers.add_parser("replay", help="Replay a mock experiment and compare observable traces")
    add_run_options(replay_parser)
    replay_parser.set_defaults(run_id=None)
    args = parser.parse_args(argv)
    try:
        if args.command == "validate":
            root, config, _ = prepare(args)
            result = validate_project(root)
            required = ("agent", "conditions", "task_set")
            missing = [key for key in required if key not in config]
            if missing:
                result["status"] = "FAIL"
                result["errors"].append({"file": args.config, "error": f"Missing config fields: {missing}"})
            result["config_status"] = "PASS" if not missing else "FAIL"
            result["real_agent_tests"] = "NOT_RUN"
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["status"] == "PASS" else 1
        if args.command == "report":
            root, config, _ = prepare(args)
            directory = locate_experiment(root, args.run_id)
            path = generate_report(directory, config)
            print(json.dumps({"status": "PASS", "report": str(path), "run_count": len(read_results(directory))}, ensure_ascii=False, indent=2))
            return 0
        root, config, args = prepare(args)
        if args.command == "resume" and not args.run_id:
            parser.error("resume requires --run-id <EXPERIMENT_ID>")
        if args.command == "replay" and not args.run_id:
            parser.error("replay requires --run-id <EXPERIMENT_ID>")
        conditions = selected_conditions(args, config)
        estimate = dry_run(root, config, conditions)
        if args.command == "dry-run" or args.dry_run:
            print(json.dumps(estimate, ensure_ascii=False, indent=2))
            return 0
        if args.max_cost is not None:
            high = estimate.get("estimated_cost_range", [None, None])[1] if estimate.get("estimated_cost_range") else None
            if high is None:
                print(json.dumps({"status": "BLOCKED", "reason": "COST_UNKNOWN; --max-cost cannot be enforced for real spending"}, indent=2))
                return 2
            if high > args.max_cost:
                print(json.dumps({"status": "BLOCKED", "reason": "ESTIMATE exceeds --max-cost", "estimate": high, "max_cost": args.max_cost}, indent=2))
                return 2
        if args.command == "replay":
            original_dir = locate_experiment(root, args.run_id)
            snapshot = json.loads((original_dir / "experiment.json").read_text(encoding="utf-8"))
            replay_config = snapshot["config"]
            replay_root = root
            replay_output = root / "artifacts" / f"{args.run_id}-replay"
            replay = ExperimentRunner(replay_root, replay_config).run(seed=snapshot["seed"], output_dir=str(replay_output))
            original = read_results(original_dir)
            repeated = read_results(replay_output)
            comparisons = []
            for old in original:
                match = next((item for item in repeated if (item["task_id"], item["condition_id"], item["repeat_index"]) ==
                              (old["task_id"], old["condition_id"], old["repeat_index"])), None)
                if match:
                    comparisons.append(compare_traces(load_trace(root / old["trace_path"]), load_trace(root / match["trace_path"])))
            result = {"status": "PASS" if all(item["status"] == "MATCH" for item in comparisons) else "DIFFERENT",
                      "scope": "MOCK_ONLY", "comparison_count": len(comparisons), "comparisons": comparisons, "replay": replay}
            (replay_output / "replay_diff.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["status"] == "PASS" else 1
        resume_id = args.run_id if args.resume or args.command == "resume" else None
        if resume_id and not args.output_dir:
            # Bind resume to the stored experiment directory so completed runs are actually skipped.
            args.output_dir = str(locate_experiment(root, resume_id))
        runner = ExperimentRunner(root, config)
        result = runner.run(conditions=conditions, task_set=config.get("task_set"), repeat=config.get("repeat"), seed=config.get("seed"),
                            output_dir=args.output_dir, resume_id=resume_id, anonymize=args.anonymize,
                            no_store_raw_content=args.no_store_raw_content, max_runtime=args.max_runtime,
                            turn_mode=config.get("turn_mode"), modalities=config.get("modalities"))
        retention = args.retention_days if getattr(args, "retention_days", None) is not None else config.get("privacy", {}).get("retention_days")
        pruned = prune_expired_experiments(root, retention, Path(result.get("output_dir", root / "artifacts")))
        if pruned:
            result["pruned_experiments"] = pruned
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ExperimentError, DataValidationError, FileNotFoundError, KeyError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

# FILE END: tools/bench_runner.py
