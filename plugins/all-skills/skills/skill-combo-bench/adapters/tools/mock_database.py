"""Run-isolated, serializable records with simple and namespaced APIs."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .base import ToolContext, ToolError, ToolInterface


class MockDatabase(ToolInterface):
    """Create, read, update, and assert records inside ``context.tool_state``."""

    name = "mock_database"
    description = "Operate on deterministic records isolated by run_id."
    input_schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            "operation": {"type": "string", "enum": ["create", "get", "update", "assert"]},
            "id": {"type": "string", "minLength": 1},
            "value": {},
            "expected_value": {},
            "collection": {"type": "string", "minLength": 1},
            "record_id": {"type": "string", "minLength": 1},
            "record": {"type": "object"},
            "expected": {"type": "object"},
        },
        "required": ["operation"],
        "additionalProperties": False,
    }
    timeout_seconds = 2.0
    side_effect_level = "LOCAL"
    idempotent = False
    version = "1.1.0"
    error_contract = {"errors": ["INVALID_TOOL_ARGUMENT", "RECORD_NOT_FOUND", "DUPLICATE_RECORD", "STATE_ASSERTION_FAILED"]}

    @staticmethod
    def _normalise(arguments: dict[str, Any]) -> dict[str, Any]:
        """Support both id/value and collection/record_id/record spellings."""
        value = deepcopy(arguments)
        collection = value.get("collection")
        record_id = value.get("record_id")
        if collection is not None or record_id is not None:
            if not isinstance(collection, str) or not collection or not isinstance(record_id, str) or not record_id:
                raise ToolError("INVALID_TOOL_ARGUMENT", "collection and record_id must be supplied together")
            value["id"] = f"{collection}/{record_id}"
        if "record" in value:
            value["value"] = value["record"]
        if "expected" in value:
            value["expected_value"] = value["expected"]
        return value

    def execute(self, arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
        """Apply one operation and return a detached record or assertion result."""
        value = self._normalise(arguments)
        operation = value["operation"]
        if operation != "create" and not value.get("id"):
            raise ToolError("INVALID_TOOL_ARGUMENT", "id or collection/record_id is required")
        if operation in {"create", "update"} and "value" not in value:
            raise ToolError("INVALID_TOOL_ARGUMENT", "value or record is required")
        if operation == "assert" and "expected_value" not in value:
            raise ToolError("INVALID_TOOL_ARGUMENT", "expected_value or expected is required")
        state = self._run_state(context)
        if operation == "create":
            return self._create(state, value, arguments)
        record_id = value["id"]
        records = state["records"]
        if record_id not in records:
            raise ToolError("RECORD_NOT_FOUND", f"Record not found: {record_id}", details={"id": record_id})
        if operation == "get":
            return deepcopy(records[record_id])
        if operation == "update":
            records[record_id].update({"value": deepcopy(value["value"]), "record": deepcopy(value["value"])})
            return deepcopy(records[record_id])
        actual = records[record_id]["value"]
        expected = value["expected_value"]
        if actual != expected:
            raise ToolError("STATE_ASSERTION_FAILED", "Database value does not match expected_value.",
                            details={"id": record_id, "expected": deepcopy(expected), "actual": deepcopy(actual)})
        return {"id": record_id, "value": deepcopy(actual), "record": deepcopy(actual), "matches": True}

    @staticmethod
    def _run_state(context: ToolContext) -> dict[str, Any]:
        """Keep independent state even when contexts share a tool_state mapping."""
        runs = context.tool_state.setdefault("mock_database", {})
        if not isinstance(runs, dict):
            raise ToolError("TOOL_STATE_ERROR", "mock_database tool_state must be an object.")
        return runs.setdefault(context.run_id, {"records": {}, "next_id": 1})

    @staticmethod
    def _create(state: dict[str, Any], value: dict[str, Any], original: dict[str, Any]) -> dict[str, Any]:
        """Create a caller-supplied or monotonically allocated record ID."""
        records = state["records"]
        record_id = value.get("id")
        if record_id is None:
            while f"rec-{state['next_id']}" in records:
                state["next_id"] += 1
            record_id = f"rec-{state['next_id']}"
            state["next_id"] += 1
        if record_id in records:
            raise ToolError("DUPLICATE_RECORD", f"Record already exists: {record_id}", details={"id": record_id})
        record = {"id": record_id, "record_id": original.get("record_id", record_id), "collection": original.get("collection"),
                  "value": deepcopy(value["value"]), "record": deepcopy(value["value"])}
        records[record_id] = record
        return deepcopy(record)


# FILE END: adapters/tools/mock_database.py
