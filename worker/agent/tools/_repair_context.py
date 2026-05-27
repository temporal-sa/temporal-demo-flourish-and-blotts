"""Helpers for enforcing repair-domain invariants inside workflow tool bodies."""
from __future__ import annotations

from shared.models import FailureType
from shared.agent_harness import ToolCtx


def current_failure_type(ctx: ToolCtx) -> str:
    failure = getattr(ctx.input, "failure", None)
    return str(getattr(failure, "failure_type", "") or "")


def is_inventory_mismatch(ctx: ToolCtx) -> bool:
    return current_failure_type(ctx) == FailureType.INVENTORY_MISMATCH.value
