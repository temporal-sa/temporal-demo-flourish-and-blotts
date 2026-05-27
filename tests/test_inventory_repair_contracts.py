from __future__ import annotations

import inspect

from shared.agent_harness.loop import TurnResult
from shared.agent_harness.tool_ctx import _derive_activity_result_type
from shared.models import (
    FailureType,
    InventoryItem,
    OrderInput,
    OrderRepairInput,
    OrderStepFailure,
)
from worker.agent.repair_state import RepairAgentState
from worker.agent.validator import EXECUTABLE_TOOLS
from worker.agent.tools.list_inventory import _physical_stock, _read_catalog
from worker.workflows import order_repair_workflow
from worker.workflows.order_repair_workflow import _shape_repair_result
from worker.workflows.order_workflow import OrderWorkflow


def _repair_input() -> OrderRepairInput:
    order = OrderInput(
        order_id="ord-test",
        customer_name="Test Customer",
        customer_email="test@example.com",
        book_id="bs-001",
        book_title="Break with a Banshee",
        quantity=1,
        delivery_method="owl_post",
        delivery_address="Hogwarts Great Hall",
    )
    return OrderRepairInput(
        order_id=order.order_id,
        order_input=order,
        failure=OrderStepFailure(
            step="pick_and_pack",
            failure_type=FailureType.INVENTORY_MISMATCH.value,
            description="Physical shelf count found 0.",
            context={"physical_count": 0, "requested": 1},
        ),
    )


def test_inventory_mismatch_requires_substitution(monkeypatch) -> None:
    monkeypatch.setattr(
        order_repair_workflow.workflow,
        "upsert_search_attributes",
        lambda _attrs: None,
    )

    result = _shape_repair_result(
        TurnResult(stop_reason="end_turn", iterations=1, final_text="Repaired."),
        RepairAgentState(),
        _repair_input(),
    )

    assert result.status == "unresolved"
    assert result.outcome == "unresolved"
    assert "no customer-approved substitute_item" in result.notes
    assert result.updated_order is None


def test_inventory_mismatch_with_substitution_updates_order(monkeypatch) -> None:
    monkeypatch.setattr(
        order_repair_workflow.workflow,
        "upsert_search_attributes",
        lambda _attrs: None,
    )
    state = RepairAgentState()
    state.staged_substitution = ("bs-001", "voyages-001", "same author")

    result = _shape_repair_result(
        TurnResult(stop_reason="end_turn", iterations=1, final_text="Repaired."),
        state,
        _repair_input(),
    )

    assert result.status == "resolved"
    assert result.updated_order is not None
    assert result.updated_order.book_id == "voyages-001"
    assert result.updated_order.book_title == "Voyages with Vampires"


def test_substitute_item_cannot_run_from_ops_approved_plan() -> None:
    assert "substitute_item" not in EXECUTABLE_TOOLS


def test_dynamic_subactivities_decode_annotated_result_types() -> None:
    assert _derive_activity_result_type(_read_catalog).__name__ == "ListInventoryResult"


def test_list_inventory_preserves_zero_physical_stock() -> None:
    assert _physical_stock(
        InventoryItem(
            book_id="bs-001",
            title="Break with a Banshee",
            author="Gilderoy Lockhart",
            in_stock=156,
            physical_in_stock=0,
        )
    ) == 0


def test_order_workflow_does_not_swallow_post_repair_failures() -> None:
    source = inspect.getsource(OrderWorkflow.run)
    assert "post-repair): proceeded" not in source
