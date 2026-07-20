"""OpsChatWorkflow — Slack-free, in-dashboard conversational ops agent.

One workflow per dashboard chat session. The operator's messages arrive as
`send_message` signals; the agent's replies and the running transcript are exposed
via the `transcript` query, which the dashboard polls. This is the web replacement
for the Slack `OpsAgentConversationWorkflow`: same declarative tool harness and
`run_agent_turn` loop, but I/O is a signal in + a query out instead of Slack.

Read-only: the agent is given only the READ-category ops tools, so it introspects
Temporal Visibility and workflow history but cannot mutate order or inventory state
from the chat. That keeps the surface small and safe with no confirmation plumbing.
"""
from __future__ import annotations

from datetime import timedelta

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from shared.agent_harness import AgentCtx, run_agent_turn
    from shared.models import (
        ConversationTurn,
        OpsChatInput,
        OpsChatMessageSignal,
        OpsChatTranscript,
    )
    from worker.agent.tools import OPS_READ_TOOLS, build_web_ops_system_prompt


IDLE_TIMEOUT = timedelta(hours=6)
MAX_TOOL_TURNS_PER_MESSAGE = 8


@workflow.defn
class OpsChatWorkflow:
    def __init__(self) -> None:
        self._inbox: list[OpsChatMessageSignal] = []
        self._turns: list[ConversationTurn] = []
        self._messages: list[dict] = []  # Claude message list, mutated by run_agent_turn
        self._processing = False
        self._closed = False
        self._agent_ctx = AgentCtx(channel="web")

    @workflow.signal
    async def send_message(self, message: OpsChatMessageSignal) -> None:
        if self._closed:
            return
        if message.text and message.text.strip():
            self._inbox.append(message)

    @workflow.signal
    async def close(self) -> None:
        self._closed = True

    @workflow.query
    def transcript(self) -> OpsChatTranscript:
        return OpsChatTranscript(
            turns=list(self._turns),
            processing=self._processing,
            closed=self._closed,
        )

    @workflow.run
    async def run(self, input: OpsChatInput) -> str:
        self._agent_ctx = AgentCtx(channel="web", domain_input=input)
        system = build_web_ops_system_prompt(input.user_name)

        while not self._closed:
            try:
                await workflow.wait_condition(
                    lambda: bool(self._inbox) or self._closed,
                    timeout=IDLE_TIMEOUT,
                )
            except TimeoutError:
                # No activity for the idle window — close the session cleanly.
                self._closed = True
                return "idle_timeout"

            if self._closed and not self._inbox:
                break

            while self._inbox:
                message = self._inbox.pop(0)
                self._turns.append(ConversationTurn(
                    role="human",
                    content=message.text,
                    timestamp=message.timestamp or str(workflow.now().timestamp()),
                ))
                self._messages.append({"role": "user", "content": message.text})

            self._processing = True
            try:
                turn = await run_agent_turn(
                    messages=self._messages,
                    system=system,
                    tools=OPS_READ_TOOLS,
                    agent_ctx=self._agent_ctx,
                    max_iterations=MAX_TOOL_TURNS_PER_MESSAGE,
                )
                reply = turn.final_text or (
                    "I wasn't able to finish that within my tool budget — try narrowing "
                    "the question or pointing me at a specific order."
                )
            except Exception as error:
                # Keep the chat entity alive across a failed turn (e.g. a transient
                # Claude outage) rather than failing the whole workflow. asyncio
                # cancellation is a BaseException and still propagates.
                reply = f"Sorry — I hit an error handling that: {error}"
            finally:
                self._processing = False

            self._turns.append(ConversationTurn(
                role="agent",
                content=reply,
                timestamp=str(workflow.now().timestamp()),
            ))

        return "closed"
