# Runbook: Flourish & Blotts agentic order repair demo

This runbook is for presenting the demo. The [README](README.md) explains what it is and how it's built.

## What it shows

A bookshop's order system runs every order as a Temporal Workflow: take payment, verify credentials, pick and pack, dispatch. When a step fails for a business reason, a Claude repair agent takes over inside a child Workflow, fixes what it can on its own, asks the customer when the customer has to decide, and the order either continues or rolls back the steps it already completed.

The demo makes three problems visible:

- **A failed order leaves half-done work behind.** Payment went through, but the book can't ship. Beat 3 shows the Workflow refunding the payment when the customer says no, and beat 4 shows it when the repairs run out.
- **An LLM agent is one more thing that can fail mid-repair.** Model calls time out and get rate limited, and a crash halfway through a repair shouldn't repeat the tool calls that already ran. Beat 4 opens the repair Workflow, where every model call and every tool call is its own Activity in the Event History.
- **Some fixes need a person, and people take hours.** Beat 2 has the agent propose a substitute book; the customer approves it from an email or the order page, and the Workflow waits durably until they do.

## Before you start

- **On tmprl-demo.cloud:** open https://flourish-and-blotts.tmprl-demo.cloud. The storefront is public. The **Watch in Temporal →** and **Temporal Web UI ↗** links open the `tmprl-dem-cld-flourish-and-blotts` Namespace on Temporal Cloud, so sign in to Temporal Cloud with an account that can see it before you present. The MailHog inbox is at `/mailhog` on the same host. There is no Slack in this deployment.
- **Locally:**
  1. Install Docker Desktop (or Docker Engine with Compose v2) and the [Temporal CLI](https://docs.temporal.io/cli).
  2. Get an [Anthropic API key](https://console.anthropic.com). Every repair and every ops-chat message calls Claude, so this demo costs money each time you run it.
  3. Run `cp .env.example .env`. Set `ANTHROPIC_API_KEY` and `HITL_TOKEN_SECRET` (any non-empty string locally). If you aren't using Slack, clear the values of `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` and `SLACK_CHANNEL_ID`; the Slack bot exits when its tokens are empty.
- **Slack is optional.** Without it, the three forced failures that route to an operator (**🏦 Gringotts Failure**, **🏭 Warehouse Failure**, and `payment_timeout`, which only the API accepts) can't finish. See [With Slack configured](#with-slack-configured) and [When something goes wrong](#when-something-goes-wrong).

## Start it

Locally, from the repository root:

1. `make dev` starts the Temporal dev server on `localhost:7233`, with the Temporal UI on http://localhost:8233.
2. In a second terminal, `make setup-attrs` registers the eight custom Search Attributes (`OrderId`, `OrderStatus`, `FailureType`, `RepairOutcome` and others). Run it once per dev server.
3. `make docker-up` builds and starts the Worker, API, UI, MailHog and Slack bot containers.

Open http://localhost:3000. A healthy start shows the **Bookshop** page with ten books and an empty **Owl Post Satchel**. Click **Order operations**: the header shows **Live timeline** once the order stream connects, and the **Order Ledger** says "The ledger is quiet." MailHog is at http://localhost:8025. `make logs` tails the containers; the Worker logs `Worker started on task queue 'flourish-blotts-oms'`.

On tmprl-demo.cloud everything is already running; the same two pages are a healthy start.

## The walkthrough

Every order starts from the **Bookshop** page:

1. Click **Add to satchel** on a book, then **Continue to checkout**.
2. Fill in **Customer Name**, **Owl Post Email** and **Delivery Address**. Any values work; the email only goes to MailHog.
3. Pick a **Delivery Method** and a **🧪 Demo: Force Failure Scenario**, as each beat says.
4. Click **Place Order via Gringotts**. The banner reads "Your order is on the move." with **Track order** (the customer's order page) and **View in Temporal** (the order's Workflow).

Use **Portkey Express — Same Day** in every beat. Owl Post and Floo Network fail at random during dispatch (18% and 22% of the time), which would add an unplanned repair to the beat.

### 1. A clean order runs the saga

1. Order **A History of Magic** with **Natural (book-specific behaviour)**.
2. Click **View in Temporal**. The `order-ord-…` Workflow runs four Activities in order: `process_payment`, `verify_credentials`, `pick_and_pack`, `dispatch_delivery`. **Track order** moves through "Taking payment at Gringotts" to "Delivered".
3. Say: "Each order is one Workflow, and each step is an Activity. If a Worker dies halfway, another one picks the order up at the step it was on."
4. Payments without a forced failure sometimes hit a simulated Gringotts error: a premium-charge flag on 12% of Portkey Express payments, and otherwise a connection timeout on 8%. When it happens, Temporal retries `process_payment` after a second and the order carries on without the agent. Failed attempts don't add events to the history; the `ActivityTaskStarted` event shows `attempt` 2, and while the retry is pending, **Pending Activities** shows the `OrderTransientError` as the last failure. If you see one, point it out: no code in the Workflow asked for that retry.

### 2. The agent finds a substitute, and the customer approves it

1. Order **Break with a Banshee** with **Natural**. The storefront shows plenty in stock, but the warehouse shelf is empty.
2. Click **Track order**. After payment and credentials, the status changes to "Our agent is resolving an issue", and **Detected issue** reads "inventory mismatch".
3. Open **Watch in Temporal →**. A child Workflow `repair-ord-…` has started. Open it: `call_claude` Activities alternate with tool calls such as `list_inventory:_read_catalog`, labelled "Read the full book catalog from the OMS." Then the agent calls `substitute_item`, and before the substitution runs, a second child Workflow `customer-confirm-ord-…` starts.
4. Back on the order page, a card reads "An owl has arrived — we need your decision" with the agent's proposed substitute and **✅ Yes, substitute** / **❌ No, cancel my order**. Click **Inbox (MailHog) →** to show the same question as an email, "Action needed for your Flourish & Blotts order ord-…".
5. Say: "The agent decided a substitute is the fix, but it can't apply it on its own. The harness asked the customer first, by email and on this page, and the Workflow will wait a day for an answer if it has to."
6. Click **✅ Yes, substitute** (or **Approve** in the email). The status returns to "Picking & packing your books" and ends at "Delivered". The order's history shows a `receive_customer_decision` Signal in `customer-confirm-ord-…`, then `pick_and_pack` running again for the substituted book.

The agent picks the substitute. The prompt and the catalog steer it toward **Voyages with Vampires**, by the same author, but the choice is the model's.

### 3. The customer says no, and the payment is refunded

1. Order **A History of Magic** with **🏛️ Ministry Approval Required**.
2. `verify_credentials` fails. The agent calls `request_customer_confirmation`, which starts `customer-confirm-ord-…`, and the order page shows the agent's question with an approve and a deny button. The agent writes the button labels, so they change from run to run.
3. Click the deny button.
4. The order page ends at "Cancelled at your request" (it may show "Reversing your order" for a moment first). In the `order-ord-…` history, `refund_payment` runs after the repair Workflow completes. There's no inventory release or delivery recall, because only payment had succeeded.
5. Say: "The order recorded one undo step for each step that finished. The customer said no, so it ran the one it had: the refund. Nobody wrote cleanup code for this particular failure."

Use the deny path here. On approval, the Workflow re-runs `verify_credentials`, and a forced failure fires on every attempt, so the order goes round again. Use a well-stocked book: **Moste Potente Potions** and **Secrets of the Darkest Art** also trigger this path, but they have 3 and 1 copies, and a cancelled order doesn't give its copy back.

### 4. The agent repairs on its own, and the Workflow limits how often

1. Order **The Monster Book of Monsters** with **📚 Monster Book Escape**.
2. Open the order in Temporal, then the `repair-ord-…` child. The agent calls tools without asking anyone. `apply_containment_charm:_apply_charm` is labelled "Apply containment charm to 'The Monster Book of Monsters' for order ord-…" and heartbeats its progress ("applying charm — step 2/5", for example); it only runs for a few seconds, so you'll see the heartbeat under **Pending Activities** only if you catch it. Expand a `call_claude` event to show the exact prompt and the model's reply, including its tool calls.
3. Say: "Every model call and every tool call is an Activity. If the model API times out or rate limits, Temporal retries that one call. If the Worker restarts, the agent resumes from its last completed step and doesn't call the model again for the steps it already did."
4. The repair ends with **Repair outcome: auto repaired**, and the order retries `pick_and_pack`. A forced failure fires on every attempt, so the step fails again and a new repair starts. After three repairs the order stops trying: the ledger shows **3 repairs**, the status badge ends at **cancelled unresolved**, and `refund_payment` runs.
5. Say: "The agent can't loop forever. The Workflow caps it at three repair attempts per order and ten model calls per attempt, then refunds and cancels."

You don't need to wait for all three repairs: go on to beat 5 and come back to the ledger. The order page labels the final status "Cancelled — no response received", which is the UI's wording for any unresolved order. Without the forced failure, the Monster Book fails `pick_and_pack` 75% of the time on each attempt, so a natural order usually gets repaired and continues, but not always.

### 5. Ask the ops agent what happened

1. Click **Order operations**. The **Counsel Hat** chat is open (toggle it with **Consult the hat** / **Close counsel**).
2. Click the suggestion **Read the last hour's failures**, or type a question such as "Why was order ord-… cancelled?" and press Enter. The status reads "Divining the event history" while it works.
3. The reply cites the orders from beats 2 to 4. It answers from Temporal Visibility and the Workflows' Event Histories.
4. Say: "The ops agent is also a Workflow. Each message is a Signal, and it reads the same histories you just looked at. It can't change anything from here; this chat only gets read-only tools."
5. For proof, open **Temporal Web UI ↗** and find the `ops-chat-web-…` Workflow: one `send_message` Signal per question, then `call_claude` and tool Activities such as `list_orders:_fetch_orders`.

To fill the ledger first, use **Conjure a rush of orders**. Set **Order count** to 10 or so before you click **Conjure 10**: each failing order runs the repair agent up to three times, and the default of 100 means hundreds of Claude calls. About 2% of conjured orders get **Gringotts Failure**, which needs Slack to finish.

### With Slack configured

Locally, with a Slack app installed from `slack-app-manifest.yml` and the three Slack values set in `.env`:

1. Order **A History of Magic** with **🏦 Gringotts Failure**.
2. The agent calls `escalate_to_human`, which starts `slack-conv-ord-…` and posts "🧙 Flourish & Blotts — Order Repair Required" to your channel, with the agent's plan and **✅ Approve Plan** / **❌ Deny & Cancel Order**. Replies in the thread go back to Claude, which can change the plan.
3. **❌ Deny & Cancel Order** ends the order as `cancelled_by_ops`. On **✅ Approve Plan**, the plan's steps run and the order retries `process_payment`, where the forced failure fires again, as in beat 4.
4. Mention `@ops-agent` in the channel for the Slack version of the ops agent. It can also cancel orders and adjust stock, each behind a confirmation card.

## Show it in code

All links point at commit [`546464d`](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/commit/546464d1297566984ff7289c4eb09fcb653f31ee). Open a file locally with `code -g <path>:<line>`.

### Undo the completed steps when an order can't be saved

**When to use it:** after beat 3, or when someone asks where the refund came from.

**Where it is:** [`worker/workflows/order_workflow.py` lines 91–118](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/order_workflow.py#L91-L118) (`code -g worker/workflows/order_workflow.py:91`), with the step-to-undo map in [lines 47–53](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/order_workflow.py#L47-L53) and the recording in [lines 159–163](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/order_workflow.py#L159-L163)

```python
# forward step → compensation activity name. Steps without a compensation (read-only)
# are intentionally absent.
COMPENSATIONS: dict[str, str] = {
    "process_payment": "refund_payment",
    "pick_and_pack": "release_inventory_reservation",
    "dispatch_delivery": "recall_delivery",
}
```

```python
async def _run_compensations(self, order: OrderInput) -> None:
    """Run compensations in reverse order of execution."""
    # ...
    # Reverse so newer steps compensate first.
    for forward_step, compensation_name in reversed(self._pending_compensations):
        try:
            result = await workflow.execute_activity(
                compensation_name,
                CompensationInput(
                    order_id=order.order_id,
                    order_input=order,
                    forward_step=forward_step,
                ),
                start_to_close_timeout=COMPENSATION_TIMEOUT,
            )
            self._compensations_executed.append(f"{compensation_name}: {result}")
        except ActivityError as error:
            # Deliberately let permanent compensation failure surface as workflow
            # failure — operators need to see "refund stuck" loudly, not silently.
            self._compensations_executed.append(f"{compensation_name}: FAILED — {error}")
            raise
    # ...
```

**What you need to understand:**

- Each forward step that succeeds appends its undo step to a list in the Workflow. On cancellation the Workflow runs that list backwards. The list is Workflow state, so it survives a Worker crash with the rest of the Workflow.
- `verify_credentials` has no entry because it changes nothing. A failure at credentials refunds the payment and nothing else, which is what beat 3 shows.
- Compensations use the default retry policy: retry with backoff, with no attempt limit and no overall timeout. A refund that keeps failing keeps retrying; one that raises a non-retryable error fails the Workflow so an operator sees it.
- The undo step is recorded after the forward step succeeds. If a payment goes through but its Activity never reports back, no refund is recorded for it. The [Saga pattern](https://docs.temporal.io/design-patterns/saga-pattern#best-practices) docs recommend registering the compensation before the step runs, with an idempotent compensation that is a no-op when the step never happened.
- The same compensation runs if the Workflow is cancelled from outside. The `except BaseException` block in [lines 274–282](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/order_workflow.py#L274-L282) runs it before re-raising.
- A customer would replace the simulated refund and release bodies with real API calls, each idempotent on the order ID, because an Activity can run more than once.

**Docs:** [Saga pattern](https://docs.temporal.io/design-patterns/saga-pattern), [Python: Saga](https://docs.temporal.io/develop/python/best-practices/error-handling#implement-saga-pattern), [Retry Policies](https://docs.temporal.io/encyclopedia/retry-policies)

### Retry glitches automatically; hand business failures to the agent

**When to use it:** after beat 1 if a payment retried, or when someone asks how the Workflow tells a glitch from a real problem.

**Where it is:** [`worker/activities/order_activities.py` lines 18–43](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/activities/order_activities.py#L18-L43) (`code -g worker/activities/order_activities.py:18`), caught in [`worker/workflows/order_workflow.py` lines 150–172](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/order_workflow.py#L150-L172) (`code -g worker/workflows/order_workflow.py:150`)

```python
def _raise_failure(step: str, failure_type: str, description: str, context: dict = {}):
    raise ApplicationError(
        description,
        {"step": step, "failure_type": failure_type, "description": description, "context": context},
        type="OrderFailure",
        non_retryable=True,
    )


def _raise_transient(description: str, context: dict = {}):
    # ...
    raise ApplicationError(
        description,
        {"transient": True, "context": context},
        type="OrderTransientError",
        # Default non_retryable=False — Temporal will retry per the
        # activity's retry policy (default: exponential backoff, bounded by
        # the activity's schedule_to_close_timeout).
    )
```

```python
try:
    result = await workflow.execute_activity(
        activity_fns[activity_name],
        order,
        start_to_close_timeout=STEP_TIMEOUT,
        schedule_to_close_timeout=timedelta(minutes=5),
    )
    # ...
except ActivityError as error:
    cause = error.cause
    if not (
        isinstance(cause, ApplicationError)
        and cause.type == "OrderFailure"
    ):
        raise
```

**What you need to understand:**

- The Activity decides which kind of failure it is. `non_retryable=True` tells Temporal not to retry, so the failure reaches the Workflow on the first attempt. A retryable error never reaches the Workflow unless the retries run out.
- The default retry policy starts at 1 second, doubles each time, caps at 100 seconds between attempts, and has no attempt limit. `schedule_to_close_timeout=timedelta(minutes=5)` is what stops a step from retrying forever: after five minutes in total the Activity fails.
- `start_to_close_timeout` (30 seconds) limits one attempt. A hung Gringotts call is abandoned after 30 seconds and retried.
- The structured details (`failure_type`, `context`) travel with the error into the Workflow, which passes them to the repair agent's prompt.
- There's no retry loop in `process_payment`; the retries come from the Activity's retry policy. On Temporal Cloud each retry is a billable Action.

**Docs:** [Retry Policies](https://docs.temporal.io/encyclopedia/retry-policies), [Python: failure handling](https://docs.temporal.io/develop/python/best-practices/error-handling)

### Run each repair as a child Workflow, with a limit

**When to use it:** during beat 4, when the order goes round a second and third time, or when someone asks what stops a runaway agent.

**Where it is:** [`worker/workflows/order_workflow.py` lines 194–229](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/order_workflow.py#L194-L229) (`code -g worker/workflows/order_workflow.py:194`)

```python
if self._repair_attempts >= MAX_REPAIR_ATTEMPTS:
    self._repair_outcome = RepairOutcome.UNRESOLVED.value
    # ...
    cancel_status = OrderStatus.CANCELLED_UNRESOLVED
    # ...
    break

repair_input = OrderRepairInput(
    order_id=order.order_id,
    order_input=order,
    failure=OrderStepFailure(
        step=activity_name,
        failure_type=failure_type,
        description=description,
        context=context,
    ),
)

self._repair_attempts += 1
# ...

repair_result: OrderRepairResult = await workflow.execute_child_workflow(
    OrderRepairWorkflow,
    repair_input,
    id=f"repair-{order.order_id}",
    task_queue="flourish-blotts-oms",
    execution_timeout=timedelta(hours=25),
)
```

**What you need to understand:**

- `MAX_REPAIR_ATTEMPTS` is 3 per order. Inside each repair, `MAX_AGENT_ITERATIONS` is 10 model calls ([`order_repair_workflow.py` line 21](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/order_repair_workflow.py#L21)). Both are plain code in the Workflow, so they hold however the model behaves.
- When a repair succeeds, the Workflow retries the step that failed ([lines 259–261](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/order_workflow.py#L259-L261)). That's why beat 4 goes round three times: the forced failure fires again on every retry.
- The repair runs as a child Workflow with its own ID and Event History. The order's history stays short, and the agent's whole transcript is one click away.
- The 25-hour execution timeout covers the longest human wait inside a repair: a 24-hour customer decision.
- Every repair of an order reuses the ID `repair-ord-…`. The default ID reuse policy for child Workflows allows a new run once the previous one has closed.

**Docs:** [Child Workflows](https://docs.temporal.io/child-workflows), [Python: Child Workflows](https://docs.temporal.io/develop/python/workflows/child-workflows)

### Run the agent loop as durable Activities

**When to use it:** during beat 4, when you expand a `call_claude` event, or when someone asks what happens if the model API goes down mid-repair.

**Where it is:** [`shared/agent_harness/loop.py` lines 157–182](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/shared/agent_harness/loop.py#L157-L182) (`code -g shared/agent_harness/loop.py:157`), with the retry policy in [lines 32–35](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/shared/agent_harness/loop.py#L32-L35) and the client settings in [`worker/activities/claude_activities.py` lines 27–29](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/activities/claude_activities.py#L27-L29)

```python
DEFAULT_CLAUDE_RETRY = RetryPolicy(
    maximum_attempts=4,
    initial_interval=timedelta(seconds=1),
)
```

```python
for iteration_index in range(max_iterations):
    response: ClaudeResponse = await workflow.execute_activity(
        call_claude,
        CallClaudeInput(messages=messages, system=system, tools=anthropic_tools),
        start_to_close_timeout=claude_timeout,
        retry_policy=claude_retry,
    )
    messages.append({"role": "assistant", "content": response.content})

    if response.stop_reason == "end_turn":
        return TurnResult(
            # ...
        )

    # ...
    results = await execute_tool_uses(
        response.tool_uses,
        pending_actions=agent_ctx.pending_actions,
        activity_dispatch=dispatch,
    )
    messages.append(to_tool_results_message(results))
```

```python
def _build_client() -> anthropic.AsyncAnthropic:
    # max_retries=0: Temporal owns all retry/backoff, not the client library.
    return anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, max_retries=0)
```

**What you need to understand:**

- The loop runs in Workflow code. The model call is an Activity, so its result is recorded in the Event History. After a Worker restart the Workflow replays those results instead of calling Claude again.
- Each model call gets 60 seconds and up to four attempts. The Anthropic client's own retries are off, so there's one retry policy to reason about.
- The Activity maps Anthropic errors to retryable or not ([lines 61–104](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/activities/claude_activities.py#L61-L104)): bad requests and auth errors fail at once; 5xx and connection errors retry. A rate limit passes the server's `retry-after` as `next_retry_delay`, so the next attempt waits as long as Anthropic asked.
- Tool calls from one model response run concurrently with `asyncio.gather`, each as its own Activity or child Workflow. A failed tool becomes an error result the model sees on its next turn.
- There is no agent framework here: `temporalio`, `anthropic` and Pydantic. The README's [Out of scope](README.md#out-of-scope) notes there is no Continue-As-New; repairs are bounded instead.

**Docs:** [Retry Policies: per-error next retry delay](https://docs.temporal.io/encyclopedia/retry-policies#per-error-next-retry-delay), [Cost optimization: Retry Policies](https://docs.temporal.io/best-practices/cost-optimization#actions-optimization)

### Label every tool call in the Event History

**When to use it:** during beat 4, when the audience reads the Activity names and labels, or when someone asks how they'd add a tool.

**Where it is:** [`worker/agent/tools/apply_containment_charm.py` lines 49–75](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/agent/tools/apply_containment_charm.py#L49-L75) (`code -g worker/agent/tools/apply_containment_charm.py:49`), dispatched through [`shared/agent_harness/tool_ctx.py` lines 115–119](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/shared/agent_harness/tool_ctx.py#L115-L119)

```python
@repair_tool(category=ToolCategory.AUTONOMOUS, timeout=_DEFAULT_TIMEOUT)
@ops_tool(
    category=ToolCategory.MUTATING,
    guards=(ops_confirmation,),
    timeout=_DEFAULT_TIMEOUT,
)
async def apply_containment_charm(args: ApplyContainmentCharmArgs, ctx: ToolCtx) -> str:
    # ...
    book = get_book_by_id(args.item_id)
    title = book.title if book else args.item_id
    rng = workflow.random()
    total_steps = rng.randint(3, 6)
    outcome = await ctx.activity(
        _apply_charm,
        _ApplyCharmInput(
            # ...
            delays=[rng.uniform(0.3, 0.7) for _ in range(total_steps)],
            outcome_variant=rng.randrange(2),
        ),
        summary=f"Apply containment charm to {title!r} for order {args.order_id}.",
        start_to_close_timeout=_DEFAULT_TIMEOUT,
        heartbeat_timeout=timedelta(seconds=10),
    )
    return f"Order {args.order_id}: {outcome}"
```

```python
name = derive_activity_name(callable_obj)
kwargs: dict[str, Any] = {
    "start_to_close_timeout": start_to_close_timeout,
    "summary": summary,
}
```

**What you need to understand:**

- A tool is one function. Its name, docstring and Pydantic argument model become the schema Claude sees, and the decorators register it.
- The same function is registered twice with different rules: the repair agent may run it on its own (`AUTONOMOUS`); the Slack ops agent must get an operator's confirmation first (`MUTATING` with `ops_confirmation`).
- `summary=` is Activity user metadata. The Temporal UI shows it next to the event, which is where "Apply containment charm to …" comes from.
- The tool body runs in the Workflow, so it uses `workflow.random()`, which replays the same values, and puts the slow work in the `_apply_charm` Activity. The heartbeat timeout of 10 seconds means a stuck charm is detected long before the 30-second limit.
- Every sub-Activity goes through one dynamic Activity ([`shared/agent_harness/dispatch_activity.py` lines 30–33](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/shared/agent_harness/dispatch_activity.py#L30-L33)), registered with `dynamic=True`. The Activity Type is the tool's name, such as `apply_containment_charm:_apply_charm`, so adding a tool doesn't change `worker/main.py`.

**Docs:** [Python: enriching the UI](https://docs.temporal.io/develop/python/platform/enriching-ui), [Activity Heartbeats](https://docs.temporal.io/encyclopedia/detecting-activity-failures#activity-heartbeat)

### A tool that changes things can't ship without a human approval

**When to use it:** after beat 2, when someone asks what stops the model from skipping the customer, or how a team enforces a rule across every agent.

**Where it is:** [`shared/agent_harness/policy.py` lines 16–31](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/shared/agent_harness/policy.py#L16-L31) and [lines 68–77](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/shared/agent_harness/policy.py#L68-L77) (`code -g shared/agent_harness/policy.py:16`), called by the decorators in [`shared/agent_harness/decorators.py` line 89](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/shared/agent_harness/decorators.py#L89)

```python
HUMAN_CONFIRMATION_KINDS = frozenset({
    GuardKind.CUSTOMER_CONFIRMATION,
    GuardKind.OPS_CONFIRMATION,
})


# Org-level policy. To add a new rule (e.g. "all SLACK_OUTPUT tools must
# carry an audit guard"), add a kind here and the registry validator will
# enforce it from the next worker startup.
CATEGORY_POLICIES: dict[ToolCategory, frozenset[GuardKind]] = {
    ToolCategory.READ:             frozenset(),
    ToolCategory.MUTATING:         HUMAN_CONFIRMATION_KINDS,  # at least one
    ToolCategory.AUTONOMOUS:       frozenset(),
    ToolCategory.HITL_INTERACTION: frozenset(),
    ToolCategory.SLACK_OUTPUT:     frozenset(),
}
```

```python
required = CATEGORY_POLICIES.get(tool.category, frozenset())
if not required:
    return
present = {getattr(g, "kind", None) for g in tool.guards}
if not (present & required):
    raise ToolPolicyError(
        f"Tool {tool.name!r} (category={tool.category.value}) needs "
        f"at least one guard of kind {sorted(k.value for k in required)}; "
        # ...
    )
```

**What you need to understand:**

- This is demo code, not a Temporal feature. Temporal makes it work: a guard is ordinary Workflow code, so it can start a child Workflow or wait on a Signal for as long as a person takes.
- The check runs when the tool module is imported. A `MUTATING` tool without a confirmation guard raises `ToolPolicyError`, and the Worker doesn't start.
- The model never sees the guard. It calls `substitute_item`; the harness runs the guard first, and only on approval runs the tool. A prompt can ask the model to check with the customer; this makes the check part of the tool.
- A guard that rejects returns its reason to the model as a tool result, so the model can propose something else.

### Ask the customer before a substitution, and wait as long as it takes

**When to use it:** during beat 2, when the approval card appears.

**Where it is:** [`worker/agent/guards.py` lines 110–159](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/agent/guards.py#L110-L159) (`code -g worker/agent/guards.py:110`), attached to the tool in [`worker/agent/tools/substitute_item.py` lines 31–37](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/agent/tools/substitute_item.py#L31-L37)

```python
@repair_tool(
    name="substitute_item",
    category=ToolCategory.MUTATING,
    guards=(substitute_item_customer_confirmation,),
    timeout=_DEFAULT_TIMEOUT,
)
async def substitute_item_repair(args: SubstituteItemArgs, ctx: ToolCtx) -> str:
```

```python
@guard(kind=GuardKind.CUSTOMER_CONFIRMATION)
async def substitute_item_customer_confirmation(
    tool_use: ClaudeToolUse, agent_ctx: AgentCtx,
) -> GuardOutcome:
    # ...
    customer_result = await workflow.execute_child_workflow(
        CustomerConfirmationWorkflow.run,
        CustomerConfirmationInput(
            order_id=repair_input.order_id,
            order_input=repair_input.order_input,
            question=f"Substitute with '{substitute_title}'?",
            # ...
            options=[
                CustomerConfirmationOption(value="approve", label="Yes, substitute"),
                CustomerConfirmationOption(value="deny",    label="No, cancel my order"),
            ],
        ),
        # ...
        id=f"customer-confirm-{repair_input.order_id}",
        task_queue="flourish-blotts-oms",
        execution_timeout=timedelta(hours=25),
    )
    if customer_result.status == "approved":
        return Pass()
    return Reject(
        reason=(
            f"Customer {customer_result.status}: "
            f"{customer_result.note or '(no note)'}. "
            "Do not retry the same substitute; propose a different one or escalate."
        ),
    )
```

**What you need to understand:**

- The question goes to a child Workflow with a known ID, `customer-confirm-ord-…`. The API finds it by that ID when the customer clicks, from either the email or the order page.
- The repair Workflow is blocked on that child the whole time. Nothing polls, and a Worker restart in the meantime changes nothing.
- On denial, the guard rejects with a reason, and the agent may propose a different substitute. That's why the deny path for a substitution varies; beat 3 uses `request_customer_confirmation`, where a denial cancels the order.
- The button labels in beat 2 come from this code. In beat 3 the agent writes them.

**Docs:** [Child Workflows](https://docs.temporal.io/child-workflows), [Approval pattern](https://docs.temporal.io/design-patterns/approval)

### Wait for one answer from two channels, with a reminder and a deadline

**When to use it:** after beat 2 or 3, or when someone asks what happens if the customer never answers.

**Where it is:** [`worker/workflows/customer_confirmation_workflow.py` lines 36–52](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/customer_confirmation_workflow.py#L36-L52) and [lines 88–129](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/customer_confirmation_workflow.py#L88-L129) (`code -g worker/workflows/customer_confirmation_workflow.py:36`)

```python
@workflow.signal
def receive_customer_decision(self, signal: CustomerDecisionSignal) -> None:
    # Signal handlers only mutate state; the main run loop reacts.
    if self._decision is None:
        self._decision = signal

@workflow.query
def get_pending_decision(self) -> PendingCustomerDecision | None:
    if self._decision is not None or self._input is None:
        return None
    # ...
```

```python
try:
    await workflow.wait_condition(
        lambda: self._decision is not None, timeout=REMINDER_AFTER,
    )
except asyncio.TimeoutError:
    pass

if self._decision is None:
    # 4h passed with no response — send a reminder, then wait the rest.
    # ...
    try:
        await workflow.wait_condition(
            lambda: self._decision is not None,
            timeout=DECISION_TIMEOUT - REMINDER_AFTER,
        )
    except asyncio.TimeoutError:
        pass

if self._decision is None:
    workflow.upsert_search_attributes({"OrderStatus": ["cancelled_unresolved"]})
    return CustomerConfirmationResult(
        status="timeout",
        note="Customer did not respond within 24 hours.",
    )
```

**What you need to understand:**

- The email link and the order-page button both send the same Signal. The first one wins; the handler ignores the second, and the API shows "this order's already been decided" if the Workflow has already closed.
- The order page polls the `get_pending_decision` Query every 3 seconds to draw the card. A Query reads state and adds nothing to the history.
- `wait_condition` with a timeout is a durable timer: 4 hours to the reminder, 24 hours to the deadline. The Workflow does no work while it waits, and the timer survives restarts.
- The email links carry an HMAC-signed token the API checks before it signals ([`shared/hitl_tokens.py`](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/shared/hitl_tokens.py)).
- For a decision that must return a result to the caller, a customer might use an Update instead of a Signal. This demo doesn't need one: the page only needs to know the click was delivered.

**Docs:** [Python: Workflow message passing](https://docs.temporal.io/develop/python/workflows/message-passing), [Approval pattern](https://docs.temporal.io/design-patterns/approval)

### Start the chat Workflow on the first message, signal it after

**When to use it:** during beat 5, when someone asks how a chat maps to a Workflow.

**Where it is:** [`api/main.py` lines 796–811](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/api/main.py#L796-L811) (`code -g api/main.py:796`), received by [`worker/workflows/ops_chat_workflow.py` lines 93–99](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/workflows/ops_chat_workflow.py#L93-L99)

```python
# SignalWithStart: starts the workflow on the first message and signals the
# already-running workflow on subsequent messages (atomic + idempotent).
await client.start_workflow(
    OpsChatWorkflow.run,
    OpsChatInput(conversation_id=conversation_id, user_name=request.user_name),
    id=f"ops-chat-{conversation_id}",
    task_queue=TASK_QUEUE,
    start_signal="send_message",
    start_signal_args=[
        OpsChatMessageSignal(
            # ...
        ),
    ],
)
```

```python
turn = await run_agent_turn(
    messages=self._messages,
    system=system,
    tools=OPS_READ_TOOLS,
    agent_ctx=self._agent_ctx,
    max_iterations=MAX_TOOL_TURNS_PER_MESSAGE,
)
```

**What you need to understand:**

- `start_signal` makes this a Signal-With-Start: one call that starts the Workflow if it isn't running and signals it either way. The API doesn't need to know whether the chat exists.
- The conversation lives in the Workflow. **New consultation** in the UI starts a fresh ID; the old Workflow closes itself after 6 idle hours.
- The chat uses the same `run_agent_turn` loop as the repair agent, with only the `READ` tools, so it has nothing to confirm.
- A failed turn is caught and becomes an apology in the transcript, so a Claude outage doesn't end the conversation.

**Docs:** [Signal-With-Start pattern](https://docs.temporal.io/design-patterns/signal-with-start)

### What's demo-only

When someone asks what they'd change for their own system, these are the parts to leave out:

- **Failure injection.** The forced failures and the random failure rates live in the Activities, for example [`worker/activities/order_activities.py` lines 70–83](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/activities/order_activities.py#L70-L83) and [lines 135–145](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/activities/order_activities.py#L135-L145). The Workflows never check `forced_failure`.
- **The OMS steps and their undo steps are simulated.** Each sleeps and returns text. The tools are the same, such as `_apply_charm`.
- **Inventory lives in the API's memory.** [`api/main.py` lines 256–274](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/api/main.py#L256-L274): restarting the API resets stock. The Worker has its own copy of the catalog.
- **Idempotency caches are in process memory.** [`worker/activities/ops_activities.py` lines 65–66](https://github.com/temporal-sa/temporal-demo-flourish-and-blotts/blob/546464d1297566984ff7289c4eb09fcb653f31ee/worker/activities/ops_activities.py#L65-L66): a Worker restart forgets them. Production would key them in a database.
- **MailHog stands in for email.**
- **The agent harness is the demo's own code** in `shared/agent_harness/`, not a Temporal library. The pattern carries over; the code is a starting point.

## Reset and tear down

- **Between runs:** nothing to reset. Each order is a new Workflow, and the ledger keeps the old ones.
- **Stock:** a cancelled order keeps its reserved copy unless `pick_and_pack` had succeeded, so stock only goes down. Locally, `docker compose restart api` restores the catalog. On tmprl-demo.cloud you can't restart it, which is why the beats use well-stocked books.
- **An order stuck waiting on Slack:** terminate it from the Temporal UI (**Terminate** on `order-ord-…`) or with `temporal workflow terminate --workflow-id order-ord-…`. Its child Workflows are terminated with it. Terminating skips compensation.
- **To stop locally:** `make docker-down`, then `Ctrl-C` the dev server. `make dev` keeps no data on disk, so the next start is empty. `make clean` also removes the images and `node_modules`.
- **What keeps running on Temporal Cloud:** open customer decisions wait up to 24 hours, idle chats up to 6 hours, Slack escalations up to 24 hours. Waiting costs nothing, but an escalation without Slack retries its Slack Activity, and each retry is an Action. Terminate any order stuck in `repair_in_progress` before you leave.

## When something goes wrong

| What you see | Likely cause | Fix |
|---|---|---|
| An order sits at "Our agent is resolving an issue", and the repair's history shows `post_initial_slack_message` retrying | The agent escalated to ops and Slack isn't configured. Forced Gringotts and Warehouse failures do this, and so can a natural warehouse failure, which hits about 12% of `pick_and_pack` attempts | Terminate the order (see above). Avoid the ops-escalation forced failures without Slack |
| The dashboard's **Approve** / **Deny** buttons never appear | The ledger shows them only for orders in `awaiting_hitl`, a status that is set on the Slack child Workflow, not on the order | Approve or deny in Slack |
| **Awaiting counsel**, **Approved** and **Denied** stay at 0, and **In progress** counts cancelled orders | The stats tiles query statuses and outcomes the Workflows don't set | Ignore those tiles; use the ledger |
| Every repair fails, and `call_claude` shows `AuthenticationError` | `ANTHROPIC_API_KEY` is missing or wrong | Fix it in `.env`, then `make docker-down` and `make docker-up` |
| Checkout says "Cannot place order: insufficient stock" | The book's copies are reserved by earlier orders | Pick a well-stocked book, or restart the API locally |
| The ledger is empty and the header stays on **Opening channel** | The API can't reach Temporal, or the Search Attributes are missing | Run `make dev` before `make docker-up`, and `make setup-attrs` once per dev server |
| The approval email never arrives | The email Activity failed | `docker compose logs worker` shows the `send_customer_confirmation_email` error. The order page card works without email |
| Clicking an email link shows "Link invalid or expired" | `HITL_TOKEN_SECRET` changed after the email was sent | Use the card on the order page |
| A beat picks up an extra repair at dispatch | Owl Post or Floo Network failed at random | Use Portkey Express |

## Keeping this runbook current

The code links point at a fixed commit. When a linked file changes, update its link, line numbers, and snippet together. Before an event, list the linked files that have changed:

```sh
grep -oE 'blob/[0-9a-f]{40}/[^#)]+' RUNBOOK.md | sort -u | while IFS=/ read -r _ sha file; do
  git diff --quiet "$sha" HEAD -- "$file" || echo "changed since ${sha:0:7}: $file"
done
```
