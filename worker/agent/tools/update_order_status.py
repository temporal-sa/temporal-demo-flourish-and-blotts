"""Update the status and add a note to an order in the OMS."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow

from shared.agent_harness import (
    ToolCategory,
    ToolCtx,
    ops_tool,
    repair_tool,
)
from worker.agent.tools._repair_context import is_inventory_mismatch

with workflow.unsafe.imports_passed_through():
    from worker.agent.guards import ops_confirmation
    from worker.agent.tool_args import UpdateOrderStatusArgs


_DEFAULT_TIMEOUT = timedelta(seconds=30)


@dataclass
class _UpdateStatusInput:
    order_id: str
    status: str
    message: str
    delay: float


async def _update_oms_status(input: _UpdateStatusInput) -> str:
    """Stub — write the status update to the OMS."""
    await asyncio.sleep(input.delay)
    return f"Order {input.order_id} status updated to '{input.status}': {input.message}"


@repair_tool(category=ToolCategory.AUTONOMOUS, timeout=_DEFAULT_TIMEOUT)
@ops_tool(
    category=ToolCategory.MUTATING,
    guards=(ops_confirmation,),
    timeout=_DEFAULT_TIMEOUT,
)
async def update_order_status(args: UpdateOrderStatusArgs, ctx: ToolCtx) -> str:
    """Update the status and add a note to an order in the OMS. This only records
    status; it does not perform fulfilment or make inventory available."""
    if (
        args.status == "repaired"
        and is_inventory_mismatch(ctx)
        and getattr(ctx.state, "staged_substitution", None) is None
    ):
        raise ValueError(
            "ERROR: cannot mark inventory_mismatch as repaired without a "
            "customer-approved substitute_item. A status update does not make "
            "physical stock available."
        )

    rng = workflow.random()
    return await ctx.activity(
        _update_oms_status,
        _UpdateStatusInput(
            order_id=args.order_id,
            status=args.status,
            message=args.message,
            delay=rng.uniform(0.2, 0.5),
        ),
        summary=f"Update order {args.order_id} status to '{args.status}'.",
        start_to_close_timeout=_DEFAULT_TIMEOUT,
    )
