"""Single dynamic Temporal activity for agent tool dispatch.

Routing: the workflow calls `workflow.execute_activity(tool_name, args, ...)`
with activity_type = tool_name. Because no activity is registered with that
exact name, Temporal routes the task to the dynamic activity defined here.
We read activity_type at runtime, look the handler up in TOOL_HANDLERS, and
decode the wire payload into the handler's annotated arg type.

Why dynamic? It collapses N per-tool activity registrations into one,
gives per-tool activity events in workflow history (so the Temporal UI
shows `dispatch_house_elf` etc. rather than a coarse umbrella name), and
makes adding a tool a zero-touch operation for `worker/main.py`.

NOTE: `from __future__ import annotations` is intentionally omitted here.
The Temporal SDK validates the dynamic-activity parameter's runtime type
annotation against `Sequence[RawValue]` exactly. PEP-563 deferred evaluation
(annotations-as-strings) breaks that check, so we keep annotations eager.
"""
from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel
from temporalio import activity
from temporalio.common import RawValue
from temporalio.exceptions import ApplicationError

from shared.agent_harness.registry import TOOL_HANDLERS


@activity.defn(dynamic=True)
async def dispatch_tool_activity(raw_args: Sequence[RawValue]) -> Any:
    tool_name = activity.info().activity_type
    entry = TOOL_HANDLERS.get(tool_name)
    if entry is None:
        raise ApplicationError(
            f"No tool handler registered for {tool_name!r}",
            non_retryable=True,
        )
    handler, takes_arg, ann = entry
    if not takes_arg:
        return await handler()
    if not raw_args:
        # Handler expects an arg but none was sent. Surface clearly rather than
        # passing an undefined value through.
        raise ApplicationError(
            f"Tool {tool_name!r}: handler expects an argument but the workflow "
            "sent no positional payload.",
            non_retryable=True,
        )
    if ann is None:
        # Annotation couldn't be resolved at registration time. Fall back to
        # the converter's default decoding (typically dict for JSON payloads).
        decoded = activity.payload_converter().from_payloads([raw_args[0].payload])[0]
    else:
        decoded = activity.payload_converter().from_payload(raw_args[0].payload, ann)
    # isinstance(ann, type) guards against generic aliases (list[X], Optional[X])
    # which are not `type` instances and would raise TypeError in issubclass.
    if isinstance(decoded, dict) and isinstance(ann, type) and issubclass(ann, BaseModel):
        decoded = ann(**decoded)
    return await handler(decoded)
