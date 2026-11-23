"""Experiment orchestration, deterministic probes, resume, and mock-only reporting."""

from __future__ import annotations

import json
import platform
import random
import statistics
import subprocess
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from adapters.tools.base import ToolRegistry
from engine import __version__
from engine.metrics import (context_efficiency, cost_per_success, engineering_metrics, mutation_score, paired_synergy,
                            rc_breakdown, robustness_scores, skill_inactivation, weighted_rule_compliance)
from engine.scheduler import SchedulerConfig, ToolExecutor
from engine.state import SessionState, state_probe_from_dict
from engine.trace import RunTraceWriter, TraceEvent, utc_now
from engine.validation import load_yaml, redact, sha256_file, sha256_json


class ExperimentError(RuntimeError):
    """Configuration or execution error with no hidden side effects."""


class ExperimentRunner:
    """Run paired task conditions while keeping all four system layers explicit."""

    def __init__(self, root: str | Path, config: dict[str, Any], *, agent: Any = None, registry: ToolRegistry | None = None) -> None:
        self.root = Path(root).resolve()
        self.config = config
        self.agent = agent
        self.registry = registry
        self.skill_cache: dict[str, dict[str, Any]] = {}
        self._registry_supplied = registry is not None

    def load_tasks(self, task_set: str | Path | None = None) -> list[dict[str, Any]]:
        """Load inline tasks or JSON paths from a task-set index."""
        selected = task_set or self.config.get("task_set", "datasets/tasks/task_set.json")
        path = Path(selected)
        if not path.is_absolute():
            path = self.root / path
        if path.is_dir():
            files = sorted(item for item in path.glob("*.json") if item.name != "task_set.json")
            entries: Any = [str(item) for item in files]
        else:
            value = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(value, dict) and "task_id" in value:
                return [value]
            entries = value.get("tasks", []) if isinstance(value, dict) else value
        if not isinstance(entries, list):
            raise ExperimentError(f"Invalid task set: {path}")
        tasks: list[dict[str, Any]] = []
        for entry in entries:
            if isinstance(entry, dict) and "task_id" in entry and "turns" in entry:
                tasks.append(entry)
                continue
            relative = entry.get("path") if isinstance(entry, dict) else entry
            task_path = Path(relative)
            if task_path.is_absolute():
                resolved = task_path
            else:
                from_index = path.parent / task_path
                from_root = self.root / task_path
                resolved = from_index if from_index.exists() else from_root
            tasks.append(json.loads(resolved.read_text(encoding="utf-8")))
        if not tasks:
            raise ExperimentError("No tasks selected")
        return tasks

    def load_skill(self, skill_id: str) -> dict[str, Any]:
        """Load raw skill content, manifest, and hashes without executing skill text."""
        if skill_id in self.skill_cache:
            return self.skill_cache[skill_id]
        definitions = self.config.get("skills", {})
        definition = definitions.get(skill_id) if isinstance(definitions, dict) else next((item for item in definitions if item.get("skill_id") == skill_id), None)
        if isinstance(definition, str):
            definition = {"path": definition}
        if not definition:
            raise ExperimentError(f"Unknown skill: {skill_id}")
        raw_path = Path(definition["path"])
        configured_manifest = self.config.get("skill_manifests", {}).get(skill_id)
        manifest_path = Path(definition.get("manifest", configured_manifest or str(raw_path).replace(".md", ".manifest.json")))
        if not raw_path.is_absolute():
            raw_path = self.root / raw_path
        if not manifest_path.is_absolute():
            manifest_path = self.root / manifest_path
        manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"skill_id": skill_id, "version": "UNKNOWN"}
        raw = raw_path.read_text(encoding="utf-8")
        value = {"skill_id": skill_id, "path": str(raw_path), "raw": raw, "raw_sha256": sha256_file(raw_path), "manifest": manifest,
                 "manifest_sha256": sha256_json(manifest)}
        self.skill_cache[skill_id] = value
        return value

    def condition_skills(self, condition_id: str) -> list[dict[str, Any]]:
        """Resolve predefined skill conditions, preserving order for A+B/B+A."""
        conditions = self.config.get("conditions", {})
        standard = {"N": [], "A": ["A"], "B": ["B"], "AB": ["A", "B"], "A+B": ["A", "B"], "B+A": ["B", "A"]}
        if isinstance(conditions, dict):
            definition = conditions.get(condition_id, standard.get(condition_id, []))
        else:
            definition = next((item.get("skills", []) for item in conditions if isinstance(item, dict) and item.get("condition_id") == condition_id),
                              standard.get(condition_id, []))
        if isinstance(definition, dict):
            definition = definition.get("skills", [])
        return [self.load_skill(skill_id) for skill_id in definition]

    def build_agent(self) -> Any:
        """Construct only the configured adapter; never fall back after a real-agent failure."""
        if self.agent is not None:
            return self.agent
        agent_config = self.config.get("agent", {"type": "mock"})
        agent_type = agent_config.get("type", agent_config.get("id", "mock")).lower().replace("-", "_")
        classes = {
            "mock": ("adapters.agent.mock_agent", "MockAgent"),
            "mock_agent": ("adapters.agent.mock_agent", "MockAgent"),
            "generic_cli": ("adapters.agent.generic_cli", "GenericCLIAgent"),
            "codex": ("adapters.agent.codex_adapter", "CodexAdapter"),
            "claude_code": ("adapters.agent.claude_code_adapter", "ClaudeCodeAdapter"),
            "opencode": ("adapters.agent.opencode_adapter", "OpenCodeAdapter"),
            "deepseek_harness": ("adapters.agent.deepseek_harness_adapter", "DeepSeekHarnessAdapter"),
            "zcode": ("adapters.agent.zcode_adapter", "ZcodeAdapter"),
        }
        if agent_type not in classes:
            raise ExperimentError(f"Unknown agent adapter: {agent_type}")
        module_name, class_name = classes[agent_type]
        module = __import__(module_name, fromlist=[class_name])
        self.agent = getattr(module, class_name)()
        self.agent.initialize(agent_config)
        return self.agent

    def build_registry(self, fault_profile: str | None = None, task: dict[str, Any] | None = None) -> ToolRegistry:
        """Build fresh run-local tools and translate declared turn faults into profiles."""
        if self._registry_supplied and self.registry is not None:
            return self.registry
        from adapters.tools import build_mock_registry
        configured_profiles = self.config.get("fault_profiles", {})
        profiles: dict[str, Any] = dict(configured_profiles.get(fault_profile, {})) if fault_profile else {}
        call_tools = {call.get("call_id"): call.get("name") for turn in (task or {}).get("turns", []) for call in turn.get("tool_calls", [])}
        aliases = {"timeout": "TIMEOUT", "invalid_argument": "INVALID_ARGUMENT", "server_error": "SERVER_ERROR",
                   "intermittent_failure": "INTERMITTENT", "duplicate_response": "DUPLICATE_RESPONSE",
                   "stale_state": "STALE_STATE", "partial_result": "PARTIAL_RESULT"}
        for turn in (task or {}).get("turns", []):
            for fault in turn.get("faults", []):
                tool_name = call_tools.get(fault.get("target_call_id"))
                if not tool_name:
                    continue
                profile = {"fault_type": aliases.get(str(fault.get("fault_type", "")).lower(), str(fault.get("fault_type", "")).upper()),
                           "probability": fault.get("probability", 1.0), "max_triggers": fault.get("max_triggers", 1),
                           "delay_seconds": fault.get("delay_seconds", 0.0), "seed": fault.get("seed", 0)}
                existing = profiles.get(tool_name)
                if existing is None:
                    profiles[tool_name] = profile
                elif isinstance(existing, list):
                    existing.append(profile)
                else:
                    profiles[tool_name] = [existing, profile]
        registry = build_mock_registry(profiles)
        if self._registry_supplied:
            self.registry = registry
        return registry

    def evaluate_assertions(self, task: dict[str, Any], result: dict[str, Any], state: SessionState,
                            events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Evaluate hard constraints and process probes independently of semantic quality."""
        output = result.get("output", "")
        output_text = output if isinstance(output, str) else json.dumps(output, ensure_ascii=False, sort_keys=True)

        def path_value(value: Any, path: str) -> Any:
            current = value
            for segment in path.split("."):
                if isinstance(current, dict):
                    current = current[segment]
                elif isinstance(current, list) and segment.isdigit():
                    current = current[int(segment)]
                else:
                    raise KeyError(path)
            return current

        def call_event(call_id: Any) -> dict[str, Any] | None:
            return next((event for event in events if event.get("tool_call_id") == call_id), None)

        evaluated = []
        for index, assertion in enumerate(task.get("assertions", [])):
            item = dict(assertion)
            item.setdefault("probe_id", f"probe-{index}")
            item.setdefault("skill_id", "TASK")
            item.setdefault("probe_family", "Instruction")
            item.setdefault("weight", 1.0)
            kind = str(item.get("type", item.get("assertion_type", "OUTPUT_CONTAINS"))).lower()
            expected = item.get("expected", item.get("expected_value"))
            actual: Any = None
            observed: Any = None
            if kind in {"output_contains", "fact", "canary"}:
                actual = expected in output_text if isinstance(expected, str) else False
            elif kind == "output_exact":
                actual = output == expected or output_text == str(expected)
            elif kind == "output_json_field":
                try:
                    decoded = output if isinstance(output, (dict, list)) else json.loads(output_text)
                    observed = path_value(decoded, expected["path"])
                    actual = observed == expected["value"]
                except (ValueError, KeyError, TypeError, json.JSONDecodeError):
                    actual = False
            elif kind in {"state", "state_exact", "state_tracking", "state_equals"}:
                state_key = expected.get("state_key") if isinstance(expected, dict) else item.get("state_key", item.get("key", ""))
                expected_value = expected.get("value") if isinstance(expected, dict) else expected
                probe = state_probe_from_dict({**item, "state_key": state_key, "read_turn": item.get("read_turn", state.turn_index),
                                               "expected": expected_value})
                probe_result = probe.evaluate(state)
                item.update(probe_result)
                evaluated.append(item)
                continue
            elif kind == "tool_called":
                if isinstance(expected, dict):
                    call = call_event(expected.get("call_id"))
                    actual = call is not None and call.get("status") == "PASS" and call.get("tool_name") == expected.get("name", call.get("tool_name"))
                else:
                    names = expected if isinstance(expected, list) else [expected]
                    actual = all(any(event.get("tool_name") == name and event.get("status") == "PASS" for event in events) for name in names)
            elif kind == "tool_chain":
                if isinstance(expected, dict):
                    source = call_event(expected.get("from_call_id"))
                    target = call_event(expected.get("to_call_id"))
                    actual = source is not None and target is not None and source.get("status") == target.get("status") == "PASS"
                    if actual and expected.get("argument"):
                        try:
                            observed = path_value(target.get("arguments_redacted", {}), expected["argument"])
                            actual = observed == expected.get("resolved_value")
                        except KeyError:
                            actual = False
                else:
                    names = expected if isinstance(expected, list) else item.get("tools", [])
                    passing = [event.get("tool_name") for event in events if event.get("status") == "PASS"]
                    positions = [passing.index(name) if name in passing else -1 for name in names]
                    actual = all(position >= 0 for position in positions) and positions == sorted(positions)
            elif kind == "tool_argument":
                expected_call = expected.get("call_id") if isinstance(expected, dict) else item.get("call_id")
                call = call_event(expected_call)
                try:
                    observed = path_value(call.get("arguments_redacted", {}), expected["path"]) if call else None
                    actual = call is not None and call.get("status") == "PASS" and observed == expected["value"]
                except (KeyError, TypeError):
                    actual = False
            elif kind == "fault_recovery":
                maximum = int(expected.get("max_attempts", 1)) if isinstance(expected, dict) else 1
                actual = any(event.get("status") == "PASS" and 1 <= int(event.get("retry_index", 0)) < maximum for event in events)
            elif kind == "safe_behavior":
                forbidden = expected.get("forbidden_output", "") if isinstance(expected, dict) else ""
                actual = forbidden not in output_text and state.read("untrusted_instruction_ignored", True) is True
            elif kind == "asset_contains":
                try:
                    asset_path = self.root / expected["asset"]
                    observed = asset_path.read_text(encoding="utf-8")
                    actual = expected["value"] in observed
                except (OSError, KeyError, TypeError):
                    actual = False
            elif kind in {"schema", "schema_valid"}:
                schema = item.get("schema", {"type": "object"})
                try:
                    import jsonschema
                    value = output if isinstance(output, (dict, list)) else json.loads(output_text)
                    jsonschema.validate(value, schema)
                    actual = True
                except (ValueError, json.JSONDecodeError):
                    actual = False
            elif kind == "not_called":
                actual = all(event.get("tool_name") != item.get("tool_name") for event in events)
            elif kind == "always":
                actual = True
            else:
                item.update({"status": "N/A", "failure_class": "NOT_APPLICABLE", "actual": f"Unsupported assertion type: {kind}"})
                evaluated.append(item)
                continue
            item.update({"status": "PASS" if actual else "FAIL", "actual": actual, "observed": observed,
                         "failure_class": "NONE" if actual else item.get("failure_class", "RULE_OMISSION")})
            evaluated.append(item)
        return evaluated

    def _relative_trace_path(self, path: Path) -> Path:
        """Return a root-relative trace path when possible, otherwise the absolute path."""
        try:
            return path.relative_to(self.root)
        except ValueError:
            return path

    def run_one(self, task: dict[str, Any], condition_id: str, repeat_index: int, experiment_id: str, output_dir: Path,
                *, anonymize: bool = False, no_store_raw_content: bool = False, max_runtime: float | None = None) -> dict[str, Any]:
        """Execute one complete run and save trace, checkpoint, and result."""
        run_id = f"run-{uuid.uuid4()}"
        trace_id = f"trace-{uuid.uuid4()}"
        run_dir = output_dir / run_id
        tracer = RunTraceWriter(run_dir, anonymize=anonymize, no_store_raw_content=no_store_raw_content,
                                custom_patterns=self.config.get("privacy", {}).get("custom_patterns", []))
        skills = self.condition_skills(condition_id)
        hashes = {skill["skill_id"]: skill["raw_sha256"] for skill in skills}
        state = SessionState(run_id=run_id, task_id=task["task_id"], condition_id=condition_id, trace_id=trace_id,
                             skill_manifest=[skill["manifest"] for skill in skills])
        runtime = self.config.get("runtime", {})
        retry = self.config.get("retry", {})
        breaker = self.config.get("circuit_breaker", {})
        scheduler_config = {
            "max_tool_calls": runtime.get("max_tool_calls_per_run", 30),
            "max_retries": retry.get("max_retries", 2),
            "tool_timeout_seconds": runtime.get("tool_timeout_seconds", 5.0),
            "run_timeout_seconds": runtime.get("max_runtime_seconds", 120.0),
            "max_repeated_calls": retry.get("repeated_call_limit", 3),
            "max_same_errors": retry.get("repeated_error_limit", 3),
            "backoff_seconds": retry.get("initial_backoff_seconds", 0.01),
            "circuit_breaker_threshold": breaker.get("consecutive_failure_threshold", 5),
            **self.config.get("scheduler", {}),
        }
        if max_runtime is not None:
            scheduler_config["run_timeout_seconds"] = max_runtime
        executor = ToolExecutor(self.build_registry(task.get("fault_profile") or self.config.get("fault_profile"), task),
                                SchedulerConfig(**{key: value for key, value in scheduler_config.items() if key in SchedulerConfig.__dataclass_fields__}), tracer)
        executor.start_run(run_id, state.session_state, state.tool_state, str(self.root))
        agent = self.build_agent()
        agent_config = self.config.get("agent", {})
        harness = self.config.get("harness", {"harness_id": "local_python"})
        provider = self.config.get("provider", {"provider_id": "NONE", "model_id": "NONE"})
        base = {"run_id": run_id, "experiment_id": experiment_id, "task_id": task["task_id"], "condition_id": condition_id,
                "agent_id": getattr(agent, "adapter_id", "UNKNOWN"), "harness_id": harness.get("harness_id", harness.get("id", harness.get("type", "UNKNOWN"))),
                "provider_id": provider.get("provider_id", provider.get("id", provider.get("type", "UNKNOWN"))), "model_id": provider.get("model_id", "UNKNOWN"),
                "skill_hashes": hashes}
        tracer.append(TraceEvent(**base, event_type="RUN_STARTED", details={"config_sha256": sha256_json(self.config), "task_sha256": sha256_json(task),
                                                                            "skill_order": [skill["skill_id"] for skill in skills]}))
        started = time.monotonic()
        error = None
        try:
            result = agent.run(task, {"run_id": run_id, "experiment_id": experiment_id, "condition_id": condition_id,
                                      "skills": skills, "state": state, "session_state": state.session_state, "tool_state": state.tool_state,
                                      "tool_executor": executor, "tracer": tracer, "config": agent_config, "workspace": str(self.root)})
            if not isinstance(result, dict):
                raise ExperimentError("Adapter returned a non-object result")
        except Exception as exc:
            result = {"status": "CRASHED", "output": "", "events": [], "token_usage": {}, "robustness_class": "CRASHED"}
            error = {"type": type(exc).__name__, "message": str(exc)}
        latency = (time.monotonic() - started) * 1000
        if isinstance(result.get("session_state"), dict):
            state.session_state.clear()
            state.session_state.update(result["session_state"])
        state.turn_index = len(task.get("turns", []))
        events = executor.events
        assertions = self.evaluate_assertions(task, result, state, events)
        rc = weighted_rule_compliance(assertions)
        judge_result = None
        judge_setting = self.config.get("judge", "none")
        if judge_setting == "mock" or (isinstance(judge_setting, dict) and judge_setting.get("type") == "mock"):
            from tools.llm_judge import MockJudge
            judge_result = MockJudge().run(task, {"run_id": run_id, "output": result.get("output", "")})
        agent_status = result.get("status", "FAIL")
        task_success = bool(result.get("task_success", agent_status in {"PASS", "SUCCESS", "COMPLETED"}))
        retries_or_failures = any(event.get("retry_index", 0) > 0 or event.get("status") in {"FAIL", "TIMED_OUT"} for event in events)
        robustness = result.get("robustness_class")
        if not robustness:
            if task_success:
                robustness = "RECOVERED" if retries_or_failures else ("RECOVERED" if task.get("fault_profile") else "NOT_APPLICABLE")
            elif any(event.get("status") == "TIMED_OUT" for event in events):
                robustness = "TIMED_OUT"
            elif any(event.get("status") == "LOOPED" for event in events):
                robustness = "LOOPED"
            else:
                robustness = "FAILED"
        if task_success:
            status = "PASS"
        elif agent_status in {"LOOPED", "TIMED_OUT", "CRASHED", "CANCELLED"}:
            status = agent_status
        elif any(event.get("status") == "TIMED_OUT" for event in events):
            # Preserve the observable lower-level outcome instead of collapsing it to FAIL.
            status = "TIMED_OUT"
        elif any(event.get("status") == "LOOPED" for event in events):
            status = "LOOPED"
        else:
            status = "FAIL"
        token_usage = result.get("token_usage", {})
        for event in result.get("events", []):
            tracer.append(TraceEvent(**base, event_type=event.get("event_type", "AGENT_EVENT"), turn_index=event.get("turn_index", 0),
                                     status=event.get("status", "OBSERVED"), latency_ms=event.get("latency_ms"),
                                     token_usage=event.get("token_usage", {}), details=redact(event, anonymize=anonymize)))
        tracer.append(TraceEvent(**base, event_type="RUN_FINISHED", status=status, latency_ms=latency, token_usage=token_usage,
                                 error=error, details={"task_success": task_success, "robustness_class": robustness}))
        checkpoint = output_dir / "checkpoints" / f"{run_id}.json"
        executor.checkpoint(checkpoint, run_id, state.to_dict())
        record = {"schema_version": "6.0.0", "run_id": run_id, "trace_id": trace_id, "experiment_id": experiment_id,
                  "task_id": task["task_id"], "condition_id": condition_id, "repeat_index": repeat_index,
                  "modalities": list(task.get("modalities", ["text"])),
                  "agent_id": base["agent_id"], "harness_id": base["harness_id"], "provider_id": base["provider_id"], "model_id": base["model_id"],
                  "skill_hashes": hashes, "status": status, "task_success": task_success, "schema_valid": result.get("schema_valid", True),
                  "judge_result": judge_result,
                  "latency_ms": latency, "token_usage": token_usage, "cost": float(result.get("cost", 0.0)),
                  "cost_status": result.get("cost_status", "COST_UNKNOWN"), "robustness_class": robustness,
                  "fault_eligible": bool(task.get("fault_profile") or self.config.get("fault_profile") or retries_or_failures or
                                         any(turn.get("faults") for turn in task.get("turns", []))),
                  "tool_calls": events, "assertions": assertions, "rc": rc["value"], "trace_path": str(self._relative_trace_path(tracer.path)),
                  "execution_scope": "MOCK_ONLY" if base["agent_id"] in {"mock_agent", "mock"} else "EXTERNAL_UNVERIFIED",
                  "result_status": "MOCK_ONLY" if base["agent_id"] in {"mock_agent", "mock"} else "NOT_VERIFIED"}
        if error:
            record["error"] = error
        with (output_dir / "results.jsonl").open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        return record

    def run(self, *, conditions: list[str] | None = None, task_set: str | None = None, repeat: int | None = None,
            seed: int | None = None, output_dir: str | None = None, resume_id: str | None = None,
            anonymize: bool = False, no_store_raw_content: bool = False, max_runtime: float | None = None,
            turn_mode: str | None = None, modalities: list[str] | None = None, **_: Any) -> dict[str, Any]:
        """Run randomized paired conditions with explicit resume and reproducibility metadata."""
        seed = int(self.config.get("seed", 42) if seed is None else seed)
        repeat = int(self.config.get("repeat", 1) if repeat is None else repeat)
        if repeat <= 0:
            raise ExperimentError("repeat must be positive")
        conditions = conditions or list(self.config.get("conditions", {"N": [], "A": ["A"], "B": ["B"], "AB": ["A", "B"]}))
        # Resolve the target directory before loading tasks so resume can reuse the original snapshot.
        experiment_id = resume_id or f"exp-{uuid.uuid4()}"
        directory = Path(output_dir) if output_dir else self.root / "artifacts" / experiment_id
        if resume_id:
            snapshot_file = directory / "experiment.json"
            if snapshot_file.exists():
                try:
                    snapshot_data = json.loads(snapshot_file.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    snapshot_data = {}
                stored = snapshot_data.get("config") or {}
                plan = snapshot_data.get("run_plan") or {}
                if isinstance(stored, dict) and stored:
                    self.config = {**self.config, **stored}
                if isinstance(plan, dict) and plan:
                    # Reuse the effective plan (CLI overrides included), not the raw config defaults.
                    seed = int(plan.get("seed", stored.get("seed", seed)))
                    repeat = int(plan.get("repeat", stored.get("repeat", repeat)))
                    conditions = list(plan.get("conditions", stored.get("conditions", conditions)))
                    task_set = plan.get("task_set", stored.get("task_set", task_set))
                    turn_mode = plan.get("turn_mode", stored.get("turn_mode", turn_mode))
                else:
                    seed = int(stored.get("seed", seed))
                    repeat = int(stored.get("repeat", repeat))
                    conditions = list(stored.get("conditions", conditions))
                    task_set = stored.get("task_set", task_set)
                    turn_mode = stored.get("turn_mode", turn_mode)
        tasks = self.load_tasks(task_set)
        if modalities:
            tasks = [task for task in tasks if set(task.get("modalities", ["text"])).intersection(modalities)]
        selected_turn_mode = turn_mode or self.config.get("turn_mode", "LONG")
        max_turns = self.config.get("turn_modes", self.config.get("context_modes", {})).get(selected_turn_mode, {}).get("max_turns")
        if max_turns:
            import copy
            tasks = [dict(task, turns=copy.deepcopy(task.get("turns", []))[:int(max_turns)]) for task in tasks]
        if not tasks:
            raise ExperimentError("No tasks remain after modality filtering")
        directory.mkdir(parents=True, exist_ok=True)
        completed: set[tuple[str, str, int]] = set()
        results_path = directory / "results.jsonl"
        if resume_id and results_path.exists():
            for line in results_path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    old = json.loads(line)
                    if old.get("task_success"):
                        completed.add((old["task_id"], old["condition_id"], int(old.get("repeat_index", 0))))
        snapshot_path = directory / "experiment.json"
        if not snapshot_path.exists():
            # Record the effective plan so resume replays the real run set, including CLI overrides.
            agent_info = self.config.get("agent", {}) if isinstance(self.config.get("agent", {}), dict) else {}
            harness_info = self.config.get("harness", {}) if isinstance(self.config.get("harness", {}), dict) else {}
            provider_info = self.config.get("provider", {}) if isinstance(self.config.get("provider", {}), dict) else {}
            skill_entries: list[dict[str, Any]] = []
            seen_skills: set[str] = set()
            configured_skills = self.config.get("skills", {})
            candidate_ids = list(configured_skills) if isinstance(configured_skills, dict) else []
            for condition in conditions:
                try:
                    candidate_ids.extend(skill["skill_id"] for skill in self.condition_skills(condition))
                except ExperimentError:
                    continue
            for skill_id in candidate_ids:
                try:
                    skill = self.load_skill(skill_id)
                except ExperimentError:
                    continue
                resolved_id = skill["manifest"].get("skill_id", skill_id)
                if resolved_id in seen_skills:
                    continue
                seen_skills.add(resolved_id)
                skill_entries.append({"skill_id": resolved_id, "version": skill["manifest"].get("version", "UNKNOWN"),
                                      "source_file": skill["path"], "sha256": skill["raw_sha256"],
                                      "load_order": len(skill_entries) + 1})
            is_mock_agent = str(agent_info.get("id", agent_info.get("type", "mock"))) in {"mock_agent", "mock"}
            snapshot = {"experiment_id": experiment_id, "version": __version__, "project_version": __version__,
                        "config": self.config, "seed": seed,
                        "task_set": task_set or self.config.get("task_set") or "datasets/tasks/task_set.json",
                        "conditions": list(conditions), "repeat": repeat, "turn_mode": selected_turn_mode,
                        "dataset_version": self.config.get("dataset_version", sha256_json(tasks)),
                        "agent": {"id": agent_info.get("id", agent_info.get("type", "mock_agent")), "version": agent_info.get("version", __version__)},
                        "harness": {"id": harness_info.get("id", "mock_harness"), "version": harness_info.get("version", __version__)},
                        "provider": {"id": provider_info.get("id", "mock_provider"), "version": provider_info.get("version", __version__)},
                        "skills": skill_entries,
                        "config_hashes": {"config": sha256_json(self.config)},
                        "result_classification": "MOCK_ONLY" if is_mock_agent else "PARTIAL",
                        "run_plan": {"conditions": list(conditions), "repeat": repeat, "seed": seed,
                                     "task_set": task_set or self.config.get("task_set"),
                                     "turn_mode": selected_turn_mode},
                        "created_at": datetime.now(timezone.utc).isoformat(), "platform": platform.platform(),
                        "git_commit": self.git_commit(), "adapter_versions": {self.build_agent().adapter_id: self.build_agent().adapter_version},
                        "judge_version": self.config.get("judge", {}).get("version", "NOT_RUN") if isinstance(self.config.get("judge", {}), dict) else str(self.config.get("judge")),
                        "pricing_config_version": self.config.get("pricing_version", "COST_UNKNOWN")}
            snapshot_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        records = []
        rng = random.Random(seed)
        for task in tasks:
            for repeat_index in range(repeat):
                ordered = list(conditions)
                rng.shuffle(ordered)
                for condition in ordered:
                    if (task["task_id"], condition, repeat_index) in completed:
                        continue
                    records.append(self.run_one(task, condition, repeat_index, experiment_id, directory, anonymize=anonymize,
                                                no_store_raw_content=no_store_raw_content, max_runtime=max_runtime))
        report = generate_report(directory, self.config)
        agent_id = self.build_agent().adapter_id
        return {"status": "MOCK_ONLY" if agent_id in {"mock_agent", "mock"} else "COMPLETED_WITH_UNVERIFIED_EXTERNAL_RESULTS",
                "experiment_id": experiment_id, "run_count": len(records), "output_dir": str(directory), "report": str(report),
                "statistical_note": "Functional mock runs do not establish statistical power or real model performance."}

    def git_commit(self) -> str | None:
        """Read the current commit if this project belongs to a Git worktree."""
        try:
            result = subprocess.run(["git", "-C", str(self.root), "rev-parse", "HEAD"], capture_output=True, text=True, timeout=5, check=False)
            return result.stdout.strip() if result.returncode == 0 else None
        except (OSError, subprocess.TimeoutExpired):
            return None


def read_results(directory: str | Path) -> list[dict[str, Any]]:
    """Load run-level results; turns remain nested process observations."""
    path = Path(directory) / "results.jsonl" if Path(directory).is_dir() else Path(directory)
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def generate_report(directory: str | Path, config: dict[str, Any]) -> Path:
    """Generate an auditable report with explicit mock/unknown/not-run boundaries."""
    directory = Path(directory)
    records = read_results(directory)
    engineering = engineering_metrics(records)
    all_assertions = [assertion for record in records for assertion in record.get("assertions", [])]
    rc_breakdown_data = rc_breakdown(all_assertions)
    modality_buckets = defaultdict(list)
    for record in records:
        for modality in record.get("modalities", ["text"]):
            modality_buckets[str(modality)].append(record)
    modality_rows = {modality: {"runs": len(items),
                                "success_rate": round(sum(1 for item in items if item.get("task_success")) / len(items), 3),
                                "mean_rc": round(sum(float(item.get("rc") or 0.0) for item in items) / len(items), 3),
                                "scope": "MOCK_ONLY" if all(item.get("execution_scope") == "MOCK_ONLY" for item in items) else "MIXED"}
                     for modality, items in sorted(modality_buckets.items())}
    ti = skill_inactivation(all_assertions)
    ss = paired_synergy(records)
    rs = robustness_scores([record for record in records if record.get("fault_eligible")])
    cps = cost_per_success(records, pricing_available=any(record.get("cost_status") == "OBSERVED" for record in records))
    token_usage = {key: sum(int(record.get("token_usage", {}).get(key, 0)) for record in records) for key in ("input", "output", "cached", "tool", "total")}
    ce = context_efficiency(float(engineering["task_success_rate"] or 0), token_usage)
    by_condition: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        by_condition[record["condition_id"]].append(record)
    condition_rows = []
    for condition, items in sorted(by_condition.items()):
        successes = [float(item["task_success"]) for item in items]
        condition_rows.append(f"| {condition} | {len(items)} | {statistics.fmean(successes):.3f} | {statistics.fmean(float(item.get('rc') or 0) for item in items):.3f} | MOCK_ONLY |")
    scope = "MOCK_ONLY" if records and all(record.get("execution_scope") == "MOCK_ONLY" for record in records) else "NOT_VERIFIED"
    report = f"""# skill-combo-bench V6.0 实验报告

> 执行范围：**{scope}**。本报告是软件闭环设计验证，不是模型排行榜或真实 Agent 能力结论。

## 1. 执行摘要
实际记录 {len(records)} 个完整 run；统计单位为 run，配对交互使用 task×repeat。未执行真实模型调用。

## 2. 实验目标与假设
检验框架能否区分规则遵循、任务成功、工具链、故障恢复、成本与交互效应。零假设与 SESOI 必须在真实实验前预注册。

## 3. 环境与能力声明
模式：LOCAL；MCP Adapter：MCP_ADAPTER_BLOCKED；真实 Judge：NOT_RUN；真实多模态推理：NOT_RUN。

## 4. Agent / Harness / Provider / Model 版本
{json.dumps({key: sorted({str(record.get(key)) for record in records}) for key in ('agent_id', 'harness_id', 'provider_id', 'model_id')}, ensure_ascii=False)}

## 5. Skill 条件与哈希
{json.dumps({condition: sorted({json.dumps(record.get('skill_hashes', {}), sort_keys=True) for record in items}) for condition, items in by_condition.items()}, ensure_ascii=False)}

## 6. 数据集和多模态资产
任务版本与配置哈希见 `experiment.json`。媒体仅记录哈希、MIME、大小和预处理；未把合成资产测试解释为真实多模态能力。

## 7. 实验设计与样本量
n={len(records)} run；条件顺序按配置种子随机化。当前重复仅验证功能，未进行功效保证；不足时标记 UNDERPOWERED。

## 8. 任务成功率
| 条件 | run 数 | 成功率 | 平均 RC | 范围 |
|---|---:|---:|---:|---|
{chr(10).join(condition_rows)}

## 9. RC / TI / SS / CE / CPS / RS
- RC 全局：{json.dumps(rc_breakdown_data["global"], ensure_ascii=False)}。
- RC 各 Skill：{json.dumps(rc_breakdown_data["by_skill"], ensure_ascii=False)}。
- RC 各探针族：{json.dumps(rc_breakdown_data["by_probe_family"], ensure_ascii=False)}。
- RC 各轮次：{json.dumps(rc_breakdown_data["by_turn"], ensure_ascii=False)}。
- RC 排除的 N/A 断言数：{rc_breakdown_data["na_excluded"]}。
- TI：{json.dumps(ti, ensure_ascii=False)}。
- SS：{json.dumps(ss, ensure_ascii=False)}。
- CE：{json.dumps(ce, ensure_ascii=False)}。
- CPS：{json.dumps(cps, ensure_ascii=False)}。
- RS：{json.dumps(rs, ensure_ascii=False)}。

## 10. 多轮状态丢失图谱
```mermaid
stateDiagram-v2
    [*] --> Written: 显式状态写入
    Written --> Verified: STATE_EXACT 程序探针
    Written --> Lost: OMISSION / STALE_VALUE
```
此图为协议示意图，不是实测频率图。

## 11. 工具调用成功与失败漏斗
{json.dumps({'total': len(engineering) and sum(len(record.get('tool_calls', [])) for record in records), 'success_rate': engineering['tool_call_success_rate'], 'argument_validity': engineering['tool_argument_validity'], 'schema_validity': (sum(1 for record in records if record.get('schema_valid')) / len(records) if records else None)}, ensure_ascii=False)}

## 11b. 按模态分层的任务成功率
{json.dumps(modality_rows, ensure_ascii=False)}

## 12. 故障恢复与循环分析
{json.dumps({'recovery_rate': engineering['recovery_rate'], 'loop_rate': engineering['loop_rate'], 'timeout_rate': engineering['timeout_rate']}, ensure_ascii=False)}

## 13. Mutation Score
{json.dumps(mutation_score([]), ensure_ascii=False)}。当前报告未运行变异集：NOT_RUN。

## 14. Judge 校准结果
NOT_RUN / JUDGE_NOT_CALIBRATED；硬约束与精确状态未交由 LLM Judge 判断。

## 15. 统计检验与置信区间
NOT_RUN。真实实验须报告 n、run 单位、效应量、95% CI、检验方法、显著性、Holm 校正和限制；不得将轮次作为独立样本。

## 16. 成本与延迟
{json.dumps({'median_ms': engineering['latency_median_ms'], 'p95_ms': engineering['latency_p95_ms'], 'cost_status': 'COST_UNKNOWN', 'token_usage': token_usage}, ensure_ascii=False)}

## 17. 失败案例
{json.dumps([{'run_id': record['run_id'], 'task_id': record['task_id'], 'status': record['status']} for record in records if not record.get('task_success')][:20], ensure_ascii=False)}

## 18. 限制与潜在混杂因素
Mock 行为由脚本预设；不能推断模型 Attention 或隐藏思维链。真实 Agent/Harness/Provider、价格、Judge 和服务端随机性均未验证。

## 19. 结论及可复现命令
仅确认本地软件闭环是否运行。复现：`python -m tools.bench_runner run --config config/default.yaml`。真实结论需另行预注册实验。

## 20. 未运行、阻塞和 Mock-only 项目清单
- Mock Agent / Mock Tools：{scope}。
- Codex / Claude Code / OpenCode / DeepSeek Harness / Zcode 端到端：NOT_VERIFIED。
- MCP：BLOCKED（核心工具协议不依赖 MCP SDK）。
- 真实模型、真实费用、Judge 校准、统计推断：NOT_RUN。
"""
    path = directory / "report.md"
    path.write_text(report + "\n<!-- FILE END: artifacts/<experiment-id>/report.md -->\n", encoding="utf-8")
    return path


# FILE END: engine/experiment.py
