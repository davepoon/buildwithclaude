"""Deterministic arithmetic using a bounded AST whitelist instead of eval."""

from __future__ import annotations

import ast
import math
import operator
from collections.abc import Callable
from typing import Any

from .base import ToolContext, ToolError, ToolInterface

Number = int | float
_BINARY_OPERATORS: dict[type[ast.operator], Callable[[Number, Number], Number]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY_OPERATORS: dict[type[ast.unaryop], Callable[[Number], Number]] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


class MockCalculator(ToolInterface):
    """Evaluate numeric expressions containing only whitelisted arithmetic nodes."""

    name = "mock_calculator"
    description = "Safely evaluate a deterministic arithmetic expression."
    input_schema: dict[str, Any] = {
        "type": "object",
        "properties": {"expression": {"type": "string", "minLength": 1, "maxLength": 512}},
        "required": ["expression"],
        "additionalProperties": False,
    }
    timeout_seconds = 2.0
    side_effect_level = "NONE"
    idempotent = True
    version = "1.0.0"
    error_contract = {"errors": ["INVALID_TOOL_ARGUMENT", "CALCULATION_ERROR"]}

    def execute(self, arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
        """Return the numeric result under ``value`` for expression references."""
        del context
        self.validate_arguments(arguments)
        expression = arguments["expression"]
        try:
            tree = ast.parse(expression, mode="eval")
        except (SyntaxError, ValueError, RecursionError) as exc:
            raise ToolError("CALCULATION_ERROR", "Invalid arithmetic expression.") from exc
        if sum(1 for _ in ast.walk(tree)) > 64:
            raise ToolError("CALCULATION_ERROR", "Expression exceeds the 64-node limit.")
        return {"value": self._evaluate(tree.body)}

    def _evaluate(self, node: ast.AST) -> Number:
        """Recursively evaluate one approved node and enforce numeric bounds."""
        if isinstance(node, ast.Constant) and not isinstance(node.value, bool):
            if isinstance(node.value, (int, float)):
                return self._checked(node.value)
        if isinstance(node, ast.BinOp) and type(node.op) in _BINARY_OPERATORS:
            left = self._evaluate(node.left)
            right = self._evaluate(node.right)
            if isinstance(node.op, ast.Pow) and abs(right) > 100:
                raise ToolError("CALCULATION_ERROR", "Exponent magnitude cannot exceed 100.")
            try:
                value = _BINARY_OPERATORS[type(node.op)](left, right)
            except (ArithmeticError, OverflowError, ValueError) as exc:
                raise ToolError("CALCULATION_ERROR", "Arithmetic operation failed.", details={"operation": type(node.op).__name__}) from exc
            return self._checked(value)
        if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPERATORS:
            return self._checked(_UNARY_OPERATORS[type(node.op)](self._evaluate(node.operand)))
        raise ToolError("CALCULATION_ERROR", "Expression contains a disallowed syntax node.", details={"node": type(node).__name__})

    @staticmethod
    def _checked(value: Any) -> Number:
        """Reject complex, non-finite, boolean, and excessively large values."""
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ToolError("CALCULATION_ERROR", "Expression must produce a real number.")
        if isinstance(value, int) and value.bit_length() > 4096:
            raise ToolError("CALCULATION_ERROR", "Integer result exceeds the 4096-bit limit.")
        if isinstance(value, float) and not math.isfinite(value):
            raise ToolError("CALCULATION_ERROR", "Floating-point result must be finite.")
        return value


# FILE END: adapters/tools/mock_calculator.py
