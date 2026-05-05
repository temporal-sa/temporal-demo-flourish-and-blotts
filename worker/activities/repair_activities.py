"""Tool implementation handlers — the actual repair actions the agent can take.

Each repair-toolkit handler is a plain async function (no @activity.defn).
They are invoked through dispatch_tool_activity (the harness's dynamic activity)
which decodes the wire payload into the handler's typed arg model. The
substitute_item handler is a shim — REPAIR's substitute_item runs as a workflow
interaction (not an activity); the OPS variant exists so the ops agent can
describe and confirm the action, and surfaces a loud error if it ever runs.

execute_approved_plan_step remains a registered activity because it's invoked
directly via workflow.execute_activity from interactions.py; internally it
dispatches the per-step tool through the harness registry.
"""
import asyncio
import random

from temporalio import activity

from shared.agent_harness import call_tool_handler
from shared.catalog import get_book_by_id
from shared.models import RepairPlanStep
from worker.agent.tool_args import (
    ApplyContainmentCharmArgs,
    CheckInventoryArgs,
    ContactCustomerArgs,
    DispatchHouseElfArgs,
    RerouteViaFlooArgs,
    SubstituteItemArgs,
    UpdateOrderStatusArgs,
    VerifyCustomerCredentialsArgs,
)


async def check_inventory(args: CheckInventoryArgs) -> str:
    book = get_book_by_id(args.item_id)
    if not book:
        return f"Item '{args.item_id}' not found in catalog."
    physical = book.physical_count
    if physical == book.in_stock:
        return (
            f"Inventory check: '{book.title}' — {physical} copies on the shelf "
            "at Diagon Alley warehouse."
        )
    return (
        f"Inventory check: '{book.title}' — only {physical} copies physically on "
        f"the shelf at Diagon Alley warehouse (OMS records {book.in_stock}; the "
        "OMS count is stale and cannot be filled against)."
    )


async def apply_containment_charm(args: ApplyContainmentCharmArgs) -> str:
    await asyncio.sleep(random.uniform(0.3, 0.8))
    book = get_book_by_id(args.item_id)
    title = book.title if book else args.item_id
    outcome = random.choice([
        f"Containment charm applied successfully to '{title}'. Item subdued and "
        "ready for repackaging with dragon-hide reinforced box.",
        f"Enhanced containment charm applied to '{title}'. Three attempts required — "
        "book resisted. Now secured with Unbreakable Charm reinforcement.",
    ])
    return f"Order {args.order_id}: {outcome}"


async def dispatch_house_elf(args: DispatchHouseElfArgs) -> str:
    await asyncio.sleep(random.uniform(0.3, 0.8))
    elf = random.choice(["Dobby", "Kreacher", "Winky", "Hokey", "Mipsy"])
    outcome = random.choice([
        f"{elf} has been dispatched and completed the task successfully: {args.task}",
        f"{elf} reports task complete. Note: {elf} is very happy to help and requests no payment.",
    ])
    return f"Order {args.order_id}: House elf {outcome}"


async def reroute_via_floo(args: RerouteViaFlooArgs) -> str:
    await asyncio.sleep(random.uniform(0.3, 0.8))
    return (
        f"Order {args.order_id}: Floo Network rerouting initiated. "
        f"Package redirected to '{args.destination}'. "
        "Floo Regulation Panel notified. Estimated re-delivery: 2 hours."
    )


async def update_order_status(args: UpdateOrderStatusArgs) -> str:
    await asyncio.sleep(random.uniform(0.3, 0.8))
    return f"Order {args.order_id} status updated to '{args.status}': {args.message}"


async def contact_customer(args: ContactCustomerArgs) -> str:
    await asyncio.sleep(random.uniform(0.3, 0.8))
    return f"Notification owl dispatched to customer for Order {args.order_id}: '{args.message}'"


async def verify_customer_credentials(args: VerifyCustomerCredentialsArgs) -> str:
    await asyncio.sleep(random.uniform(0.3, 0.8))
    found = random.random() > 0.3
    if found:
        return (
            f"Customer '{args.customer_id}' credential check PASSED for requirement "
            f"'{args.requirement_type}'. Records found in Ministry database."
        )
    return (
        f"Customer '{args.customer_id}' credential check INCONCLUSIVE for "
        f"'{args.requirement_type}'. Records not found. Manual verification required."
    )


async def substitute_item(args: SubstituteItemArgs) -> str:
    """OPS substitute_item is intentionally non-functional at the activity layer.
    REPAIR's substitute_item runs as a workflow interaction (not an activity)
    because it must signal a child workflow. The OPS variant exists so the ops
    agent can describe and confirm the action; if it's ever actually invoked
    here, surface that loudly rather than silently lying that the swap happened."""
    return (
        f"ERROR: substitute_item must be handled in the workflow, not as an "
        f"activity. The substitution did NOT take effect for order {args.order_id}. "
        "Use a repair-flow path instead."
    )


@activity.defn
async def execute_approved_plan_step(step: RepairPlanStep, order_id: str) -> str:
    """Execute a single step from a human-approved repair plan. The plan stores
    tool args as plain dicts; call_tool_handler coerces them into the handler's
    Pydantic model when needed. order_id is injected into the args before
    dispatch because it isn't always present in the persisted tool_args."""
    await asyncio.sleep(random.uniform(0.2, 0.6))

    if step.tool:
        args = dict(step.tool_args or {})
        args.setdefault("order_id", order_id)
        try:
            return await call_tool_handler(step.tool, args)
        except KeyError:
            return f"Unknown tool '{step.tool}' — no action taken."

    return f"Executed plan step '{step.action}': {step.description}"
