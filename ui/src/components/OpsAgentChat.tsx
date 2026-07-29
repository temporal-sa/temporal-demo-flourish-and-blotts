import { useEffect, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { OpsChatTurn } from '../types'
import { sendOpsChatMessage, fetchOpsChatTranscript } from '../api'

// Each mounted chat is one OpsChatWorkflow, keyed by a fresh conversation id.
function newConversationId(): string {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const SUGGESTIONS = [
  "Read the last hour's failures",
  'Show orders awaiting a human decision',
  'Find every inventory mismatch',
]

const MARKDOWN_COMPONENTS: Components = {
  a({ href, children }) {
    const isExternal = href?.startsWith('http://') || href?.startsWith('https://')
    return (
      <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>
        {children}
      </a>
    )
  },
}

function AgentMarkdown({ children }: { children: string }) {
  return (
    <div className="ops-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

export default function OpsAgentChat() {
  const [conversationId, setConversationId] = useState<string>(newConversationId)
  const [turns, setTurns] = useState<OpsChatTurn[]>([])
  const [processing, setProcessing] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [started, setStarted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!started) return
    let cancelled = false
    async function tick() {
      const transcript = await fetchOpsChatTranscript(conversationId)
      if (cancelled) return
      // Do not let a poll that races the signal remove the optimistic human turn.
      setTurns(previous => (transcript.turns.length >= previous.length ? transcript.turns : previous))
      setProcessing(transcript.processing)
    }
    tick()
    const id = setInterval(tick, 1500)
    return () => { cancelled = true; clearInterval(id) }
  }, [conversationId, started])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, processing])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setStarted(true)
    setTurns(previous => [...previous, { role: 'human', content: trimmed, timestamp: '' }])
    setInput('')
    try {
      await sendOpsChatMessage(conversationId, trimmed)
    } catch (error: any) {
      setTurns(previous => [
        ...previous,
        { role: 'agent', content: `> **The consultation could not be delivered.**\n\n${error.message}`, timestamp: '' },
      ])
    } finally {
      setSending(false)
    }
  }

  function reset() {
    setConversationId(newConversationId())
    setTurns([])
    setProcessing(false)
    setStarted(false)
    setInput('')
  }

  return (
    <section className="ops-counsel-shell" aria-labelledby="counsel-title">
      <aside className="counsel-presence">
        <div className="counsel-portrait-frame">
          <div className="counsel-portrait-glow" />
          <img
            src="/images/ops/counsel-hat.jpg"
            alt="An ancient, expressive counsel hat"
            className="counsel-portrait"
            width="900"
            height="900"
          />
        </div>
        <p className="counsel-kicker">Durable consultation</p>
        <h3 id="counsel-title">The Counsel Hat</h3>
        <p className="counsel-description">
          Listening across workflow histories, repair attempts, and the occasional suspicious bookshelf.
        </p>
        <div className="counsel-status">
          <span aria-hidden="true" />
          {processing ? 'Divining the event history' : 'Ready to consult'}
        </div>
      </aside>

      <div className="counsel-conversation">
        <header className="counsel-chat-header">
          <div>
            <p>Operations divination</p>
            <strong>Ask about the live order realm</strong>
          </div>
          <button onClick={reset} className="counsel-reset">
            New consultation
          </button>
        </header>

        <div ref={scrollRef} className="counsel-transcript" aria-live="polite">
          {turns.length === 0 && (
            <div className="counsel-welcome">
              <p className="counsel-welcome-quote">
                “Place a question before me. I shall read the threads already woven.”
              </p>
              <p>
                Every message runs through a durable Temporal workflow. Agent replies support
                headings, lists, tables, links, blockquotes, and fenced code.
              </p>
              <div className="counsel-suggestions">
                {SUGGESTIONS.map(suggestion => (
                  <button key={suggestion} onClick={() => send(suggestion)}>
                    <span aria-hidden="true">✦</span>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, index) => {
            const isAgent = turn.role === 'agent'
            return (
              <div key={index} className={`counsel-message counsel-message--${isAgent ? 'agent' : 'operator'}`}>
                <div className="counsel-message-avatar" aria-hidden="true">
                  {isAgent ? (
                    <img src="/images/ops/counsel-hat.jpg" alt="" width="42" height="42" />
                  ) : (
                    <span>OP</span>
                  )}
                </div>
                <div className="counsel-message-column">
                  <p className="counsel-message-role">{isAgent ? 'The Counsel Hat' : 'Operator'}</p>
                  <div className="counsel-message-bubble">
                    {isAgent ? <AgentMarkdown>{turn.content}</AgentMarkdown> : turn.content}
                  </div>
                </div>
              </div>
            )
          })}

          {processing && (
            <div className="counsel-message counsel-message--agent">
              <div className="counsel-message-avatar" aria-hidden="true">
                <img src="/images/ops/counsel-hat.jpg" alt="" width="42" height="42" />
              </div>
              <div className="counsel-message-column">
                <p className="counsel-message-role">The Counsel Hat</p>
                <div className="counsel-thinking">
                  Reading the threads of history
                  <span aria-hidden="true"><i /><i /><i /></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={event => { event.preventDefault(); send(input) }}
          className="counsel-composer"
        >
          <label htmlFor="counsel-input">Your question</label>
          <div className="counsel-composer-row">
            <textarea
              id="counsel-input"
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  send(input)
                }
              }}
              placeholder="Ask what has failed, what needs attention, or how a repair unfolded…"
              rows={2}
            />
            <button type="submit" disabled={sending || !input.trim()}>
              {sending ? 'Sending…' : 'Consult'}
            </button>
          </div>
          <p>Enter to send · Shift + Enter for a new line</p>
        </form>
      </div>
    </section>
  )
}
