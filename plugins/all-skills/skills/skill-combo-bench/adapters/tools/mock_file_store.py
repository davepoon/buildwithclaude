"""UTF-8 mock file storage with run-local memory or a confined workspace."""

from __future__ import annotations

import hashlib
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any

from .base import ToolContext, ToolError, ToolInterface


class MockFileStore(ToolInterface):
    """Read and write text while rejecting absolute paths and traversal."""

    name = "mock_file_store"
    description = "Store UTF-8 text in per-run memory or an optional confined workspace."
    input_schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            "operation": {"type": "string", "enum": ["read", "write"]},
            "path": {"type": "string", "minLength": 1, "maxLength": 512},
            "content": {"type": "string"},
        },
        "required": ["operation", "path"],
        "additionalProperties": False,
        "allOf": [
            {
                "if": {"properties": {"operation": {"const": "write"}}},
                "then": {"required": ["content"]},
            }
        ],
    }
    timeout_seconds = 2.0
    side_effect_level = "LOCAL"
    idempotent = False
    version = "1.0.0"
    error_contract = {"errors": ["INVALID_TOOL_ARGUMENT", "PATH_ESCAPE", "FILE_NOT_FOUND", "FILE_STORE_ERROR"]}

    def __init__(self, workspace: str | Path | None = None) -> None:
        """Use memory by default, or confine disk operations to ``workspace``."""
        self._workspace = Path(workspace).expanduser().resolve() if workspace is not None else None

    def execute(self, arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
        """Read or write one normalized relative path and return its SHA-256."""
        self.validate_arguments(arguments)
        path = self._normalize(arguments["path"])
        if self._workspace is None:
            return self._execute_memory(arguments, context, path)
        return self._execute_disk(arguments, path)

    @staticmethod
    def _normalize(raw_path: str) -> str:
        """Normalize separators without allowing traversal or platform drives."""
        if "\x00" in raw_path:
            raise ToolError("PATH_ESCAPE", "NUL bytes are not allowed in paths.")
        windows_path = PureWindowsPath(raw_path)
        if windows_path.is_absolute() or windows_path.drive:
            raise ToolError("PATH_ESCAPE", "Absolute paths and drive-qualified paths are forbidden.")
        portable = PurePosixPath(raw_path.replace("\\", "/"))
        if portable.is_absolute() or ".." in portable.parts:
            raise ToolError("PATH_ESCAPE", "Path traversal is forbidden.")
        parts = [part for part in portable.parts if part not in ("", ".")]
        if not parts:
            raise ToolError("INVALID_TOOL_ARGUMENT", "path must identify a file.")
        return PurePosixPath(*parts).as_posix()

    def _execute_memory(self, arguments: dict[str, Any], context: ToolContext, path: str) -> dict[str, Any]:
        """Store independent text mappings for each run."""
        runs = context.tool_state.setdefault("mock_file_store", {})
        if not isinstance(runs, dict):
            raise ToolError("TOOL_STATE_ERROR", "mock_file_store tool_state must be an object.")
        files = runs.setdefault(context.run_id, {})
        if arguments["operation"] == "write":
            content = arguments["content"]
            files[path] = content
        else:
            try:
                content = files[path]
            except KeyError as exc:
                raise ToolError("FILE_NOT_FOUND", f"File not found: {path}", details={"path": path}) from exc
        return self._result(path, content, include_content=arguments["operation"] == "read")

    def _execute_disk(self, arguments: dict[str, Any], path: str) -> dict[str, Any]:
        """Resolve the complete target before every operation to block escapes."""
        assert self._workspace is not None
        target = self._workspace.joinpath(*PurePosixPath(path).parts).resolve(strict=False)
        if not target.is_relative_to(self._workspace):
            raise ToolError("PATH_ESCAPE", "Resolved path escapes the configured workspace.")
        try:
            if arguments["operation"] == "write":
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(arguments["content"], encoding="utf-8")
                content = arguments["content"]
            else:
                content = target.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise ToolError("FILE_NOT_FOUND", f"File not found: {path}", details={"path": path}) from exc
        except (OSError, UnicodeError) as exc:
            raise ToolError("FILE_STORE_ERROR", "File operation failed.", details={"path": path}) from exc
        return self._result(path, content, include_content=arguments["operation"] == "read")

    @staticmethod
    def _result(path: str, content: str, *, include_content: bool) -> dict[str, Any]:
        """Return stable hash and byte size without changing text content."""
        encoded = content.encode("utf-8")
        result: dict[str, Any] = {
            "path": path,
            "sha256": hashlib.sha256(encoded).hexdigest(),
            "byte_size": len(encoded),
        }
        if include_content:
            result["content"] = content
        return result


# FILE END: adapters/tools/mock_file_store.py
