"""Configuration-driven CLI agent adapter with no proprietary command assumptions."""

from __future__ import annotations

import copy
import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Mapping

from adapters.base import AgentAdapter


_OUTPUT_NOT_SET = object()


class GenericCLIAgent(AgentAdapter):
    """Run an explicitly configured argument vector and collect JSONL observations."""

    adapter_id = "generic_cli"
    executable: str | None = None
    verification_status = "NOT_VERIFIED"

    def __init__(self) -> None:
        self.config: dict[str, Any] = {}
        self._events: list[dict[str, Any]] = []
        self._processes: dict[str, subprocess.Popen[str]] = {}
        self._cancel_requested: set[str] = set()
        self._lock = threading.RLock()

    def capabilities(self) -> dict[str, Any]:
        """Describe only generic process behavior, never a vendor-specific CLI."""
        return {
            "adapter_id": self.adapter_id,
            "adapter_type": "AGENT",
            "execution_mode": "EXTERNAL_CLI",
            "verification_status": self.verification_status,
            "input_modalities": ["text", "structured_data"],
            "output_modalities": ["text", "structured_data"],
            "supported_file_types": ["application/json", "application/x-ndjson"],
            "max_input_bytes": self.config.get("max_input_bytes"),
            "supports_tool_calls": False,
            "supports_state": False,
            "supports_cancellation": True,
            "supports_streaming": False,
            "invokes_real_model": None,
            "loads_skills": False,
            "limitations": [
                "The configured executable defines all model and skill behavior.",
                "Only {task_file}, {workspace}, and {run_id} placeholders are supplied.",
                "No proprietary flags, prompts, or authentication arguments are inferred.",
                "Media modalities require an explicitly configured external protocol and are not decoded here.",
                "JSONL events are collected after process exit, not streamed live.",
            ],
        }

    def initialize(self, config: dict[str, Any]) -> dict[str, Any]:
        """Store a defensive configuration copy without testing connectivity."""
        result = super().initialize(config)
        command = self.config.get("command")
        if command is not None and (
            not isinstance(command, list)
            or not command
            or any(not isinstance(part, str) or not part for part in command)
        ):
            return {
                "status": "FAIL",
                "adapter_id": self.adapter_id,
                "failure_class": "INVALID_COMMAND",
                "error": {"type": "INVALID_COMMAND", "message": "command must be a non-empty string array"},
            }
        return result

    def run(self, task: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        """Write task JSON, execute with shell=False, and bound process output and time."""
        run_id = str(context.get("run_id") or task.get("run_id") or "cli-run")
        command = self.config.get("command")
        if command is None:
            return self._simple_result(
                status="UNSUPPORTED",
                run_id=run_id,
                failure_class="COMMAND_NOT_CONFIGURED",
                error={
                    "type": "COMMAND_NOT_CONFIGURED",
                    "message": "Set config['command'] to a non-empty argument array; no CLI syntax is inferred",
                },
            )
        if not isinstance(command, list) or not command or any(
            not isinstance(part, str) or not part for part in command
        ):
            return self._simple_result(
                status="FAIL",
                run_id=run_id,
                failure_class="INVALID_COMMAND",
                error={"type": "INVALID_COMMAND", "message": "command must be a non-empty string array"},
            )

        workspace = str(Path(context.get("workspace") or self.config.get("workspace") or os.getcwd()).resolve())
        if not Path(workspace).is_dir():
            return self._simple_result(
                status="FAIL",
                run_id=run_id,
                failure_class="INVALID_WORKSPACE",
                error={"type": "INVALID_WORKSPACE", "message": f"Workspace is not a directory: {workspace}"},
            )
        try:
            timeout_seconds = float(self.config.get("timeout_seconds", 60.0))
            if timeout_seconds <= 0:
                raise ValueError("timeout_seconds must be positive")
            max_output_chars = int(self.config.get("max_output_chars", 4000))
            if max_output_chars < 0:
                raise ValueError("max_output_chars cannot be negative")
        except (TypeError, ValueError) as exc:
            return self._simple_result(
                status="FAIL",
                run_id=run_id,
                failure_class="INVALID_CONFIGURATION",
                error={"type": "INVALID_CONFIGURATION", "message": str(exc)},
            )

        task_file: str | None = None
        process: subprocess.Popen[str] | None = None
        events: list[dict[str, Any]] = []
        started = time.monotonic()
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                suffix=".json",
                prefix="skill-combo-task-",
                dir=self.config.get("temp_dir"),
                delete=False,
            ) as handle:
                task_file = handle.name
                json.dump(task, handle, ensure_ascii=False, allow_nan=False)
            argv = [self._expand_argument(part, task_file, workspace, run_id) for part in command]
            launch_event = self._event(
                "process_started",
                run_id,
                executable=argv[0],
                argument_count=len(argv) - 1,
                workspace=workspace,
            )
            events.append(launch_event)
            self._events.append(launch_event)
            process = subprocess.Popen(
                argv,
                shell=False,
                cwd=workspace,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            with self._lock:
                if run_id in self._processes:
                    raise RuntimeError(f"A process is already registered for run_id: {run_id}")
                self._processes[run_id] = process
            timed_out = False
            try:
                stdout, stderr = process.communicate(timeout=timeout_seconds)
            except subprocess.TimeoutExpired:
                timed_out = True
                process.kill()
                stdout, stderr = process.communicate()
            with self._lock:
                cancelled = run_id in self._cancel_requested
            duration_ms = round((time.monotonic() - started) * 1000, 3)
            stdout_text, stdout_truncated = self._summarise(stdout, max_output_chars)
            stderr_text, stderr_truncated = self._summarise(stderr, max_output_chars)
            parsed_events = self._parse_jsonl_events(stdout, run_id)
            events.extend(parsed_events)
            self._events.extend(parsed_events)
            cli_output: Any = _OUTPUT_NOT_SET
            for event in reversed(parsed_events):
                if "output" in event:
                    cli_output = copy.deepcopy(event["output"])
                    break
            if timed_out:
                status = "TIMED_OUT"
                failure_class: str | None = "TIMEOUT"
                robustness_class: str | None = "TIMED_OUT"
                error: dict[str, Any] | None = {
                    "type": "TIMEOUT",
                    "message": f"CLI exceeded timeout_seconds={timeout_seconds}",
                }
            elif cancelled:
                status = "CANCELLED"
                failure_class = "CANCELLED"
                robustness_class = None
                error = {"type": "CANCELLED", "message": "Cancellation was requested for this run"}
            elif process.returncode == 0:
                status = "SUCCESS"
                failure_class = None
                robustness_class = None
                error = None
            else:
                status = "FAIL"
                failure_class = "CLI_NONZERO_EXIT"
                robustness_class = None
                error = {
                    "type": "CLI_NONZERO_EXIT",
                    "message": f"CLI exited with return code {process.returncode}",
                    "return_code": process.returncode,
                }
            completed_event = self._event(
                "process_completed",
                run_id,
                status=status,
                return_code=process.returncode,
                latency_ms=duration_ms,
                stdout_bytes=len(stdout.encode("utf-8")),
                stderr_bytes=len(stderr.encode("utf-8")),
            )
            events.append(completed_event)
            self._events.append(completed_event)
            return {
                "status": status,
                "output": stdout_text if cli_output is _OUTPUT_NOT_SET else cli_output,
                "events": events,
                "token_usage": self._token_usage(),
                "failure_class": failure_class,
                "robustness_class": robustness_class,
                "error": error,
                "run_id": run_id,
                "adapter_id": self.adapter_id,
                "verification_status": self.verification_status,
                "return_code": process.returncode,
                "latency_ms": duration_ms,
                "stdout": stdout_text,
                "stderr": stderr_text,
                "stdout_truncated": stdout_truncated,
                "stderr_truncated": stderr_truncated,
                "stdout_length": len(stdout),
                "stderr_length": len(stderr),
            }
        except (OSError, TypeError, ValueError, RuntimeError) as exc:
            failure_class = "EXECUTABLE_NOT_FOUND" if isinstance(exc, FileNotFoundError) else "CLI_EXECUTION_ERROR"
            error = {"type": type(exc).__name__, "message": str(exc)}
            failure_event = self._event("process_failed", run_id, status="FAIL", error=error)
            events.append(failure_event)
            self._events.append(failure_event)
            result = self._simple_result(
                status="FAIL",
                run_id=run_id,
                failure_class=failure_class,
                error=error,
            )
            result["events"] = events
            return result
        finally:
            with self._lock:
                if process is not None:
                    self._processes.pop(run_id, None)
                self._cancel_requested.discard(run_id)
            if task_file is not None:
                try:
                    Path(task_file).unlink(missing_ok=True)
                except OSError:
                    # Temporary-file cleanup failure does not alter the observed CLI result.
                    pass

    def stream_events(self) -> Iterator[dict[str, Any]]:
        """Drain process and JSONL events without claiming live provider streaming."""
        with self._lock:
            pending, self._events = self._events, []
        yield from copy.deepcopy(pending)

    def cancel(self, run_id: str) -> dict[str, Any]:
        """Request termination only for an active process owned by this adapter."""
        with self._lock:
            process = self._processes.get(run_id)
            if process is None:
                return {
                    "status": "NOT_FOUND",
                    "operation": "cancel",
                    "run_id": run_id,
                    "reason": "No active process is registered for this run_id",
                }
            if process.poll() is not None:
                return {
                    "status": "NOT_RUNNING",
                    "operation": "cancel",
                    "run_id": run_id,
                    "return_code": process.returncode,
                }
            self._cancel_requested.add(run_id)
            try:
                process.terminate()
            except OSError as exc:
                self._cancel_requested.discard(run_id)
                return {
                    "status": "FAIL",
                    "operation": "cancel",
                    "run_id": run_id,
                    "error": {"type": type(exc).__name__, "message": str(exc)},
                }
        return {"status": "CANCEL_REQUESTED", "operation": "cancel", "run_id": run_id}

    def close(self) -> dict[str, Any]:
        """Terminate any still-active child processes owned by this adapter."""
        with self._lock:
            active = list(self._processes.items())
        terminated: list[str] = []
        errors: dict[str, str] = {}
        for run_id, process in active:
            if process.poll() is None:
                try:
                    process.terminate()
                    terminated.append(run_id)
                except OSError as exc:
                    errors[run_id] = str(exc)
        return {
            "status": "CLOSED" if not errors else "PARTIAL",
            "adapter_id": self.adapter_id,
            "termination_requested": terminated,
            "errors": errors,
        }

    def health_check(self) -> dict[str, Any]:
        """Check executable discovery only; do not invoke the CLI or access a network."""
        command = self.config.get("command")
        candidate = command[0] if isinstance(command, list) and command else self.executable
        if not candidate:
            return {
                "status": "UNSUPPORTED",
                "scope": "EXECUTABLE_DISCOVERY",
                "adapter_id": self.adapter_id,
                "verification_status": self.verification_status,
                "reason": "No command or class executable is configured",
            }
        discovered = shutil.which(candidate)
        return {
            "status": "PASS" if discovered else "FAIL",
            "scope": "EXECUTABLE_DISCOVERY",
            "adapter_id": self.adapter_id,
            "executable": candidate,
            "executable_path": discovered,
            "verification_status": self.verification_status,
            "integration_tested": False,
        }

    @staticmethod
    def _expand_argument(argument: str, task_file: str, workspace: str, run_id: str) -> str:
        return (
            argument.replace("{task_file}", task_file)
            .replace("{workspace}", workspace)
            .replace("{run_id}", run_id)
        )

    @staticmethod
    def _summarise(text: str, limit: int) -> tuple[str, bool]:
        return text[:limit], len(text) > limit

    @staticmethod
    def _parse_jsonl_events(stdout: str, run_id: str) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        for line_number, line in enumerate(stdout.splitlines(), start=1):
            if not line.strip():
                continue
            try:
                decoded = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(decoded, dict):
                continue
            event = copy.deepcopy(decoded)
            event.setdefault("event_type", str(event.get("type") or "cli_event"))
            event.setdefault("run_id", run_id)
            event["source"] = "CLI_JSONL"
            event["source_line"] = line_number
            events.append(event)
        return events

    @staticmethod
    def _event(event_type: str, run_id: str, **fields: Any) -> dict[str, Any]:
        return {
            "event_type": event_type,
            "run_id": run_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **fields,
        }

    @staticmethod
    def _token_usage() -> dict[str, Any]:
        return {
            "input_tokens": 0,
            "output_tokens": 0,
            "cached_tokens": 0,
            "total_tokens": 0,
            "measurement_status": "NOT_MEASURED",
            "source": "CLI_NOT_REPORTED",
        }

    def _simple_result(
        self,
        *,
        status: str,
        run_id: str,
        failure_class: str | None,
        error: dict[str, Any] | None,
    ) -> dict[str, Any]:
        return {
            "status": status,
            "output": None,
            "events": [],
            "token_usage": self._token_usage(),
            "failure_class": failure_class,
            "robustness_class": None,
            "error": error,
            "run_id": run_id,
            "adapter_id": self.adapter_id,
            "verification_status": self.verification_status,
        }


# FILE END: adapters/agent/generic_cli.py
