import { useEffect, useRef, useState } from 'react'
import type { OpsChatTurn } from '../types'
import { sendOpsChatMessage, fetchOpsChatTranscript } from '../api'

// Each mounted chat is one OpsChatWorkflow, keyed by a fresh conversation id.
function newConversationId(): string {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const SUGGESTIONS = [
  "What's been failing in the last hour?",
  'Summarise orders currently awaiting a human decision',
  'Which books have an inventory mismatch?',
]

export default function OpsAgentChat() {
  const [conversationId, setConversationId] = useState<string>(newConversationId)
  const [turns, setTurns] = useState<OpsChatTurn[]>([])
  const [processing, setProcessing] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [started, setStarted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Poll the workflow transcript once the conversation has started.
  useEffect(() => {
    if (!started) return
    let cancelled = false
    async function tick() {
      const t = await fetchOpsChatTranscript(conversationId)
      if (cancelled) return
      // Only overwrite once the server has caught up to our optimistic messages,
      // so a poll that races ahead of the signal doesn't blank the user's line.
      setTurns(prev => (t.turns.length >= prev.length ? t.turns : prev))
      setProcessing(t.processing)
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
    setTurns(prev => [...prev, { role: 'human', content: trimmed, timestamp: '' }])
    setInput('')
    try {
      await sendOpsChatMessage(conversationId, trimmed)
    } catch (e: any) {
      setTurns(prev => [...prev, { role: 'agent', content: `⚠️ Failed to send: ${e.message}`, timestamp: '' }])
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
    <div
      className="rounded-lg mb-4 flex flex-col"
      style={{ backgroundColor: 'white', border: '1px solid #d4c9a8', height: 420 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 rounded-t-lg"
        style={{ backgroundColor: 'var(--hp-navy)' }}
      >
        <span className="font-semibold text-sm" style={{ color: 'var(--hp-gold)' }}>
          🪄 Ops Agent — ask about the live OMS
        </span>
        <button
          onClick={reset}
          className="text-xs px-2 py-1 rounded"
          style={{ backgroundColor: 'transparent', color: 'var(--hp-gold)', border: '1px solid var(--hp-gold)' }}
        >
          New chat
        </button>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {turns.length === 0 && (
          <div className="text-sm" style={{ color: '#888' }}>
            <p className="mb-2">
              Ask the durable ops agent about orders, repairs, and inventory. Every message runs a
              read-only Temporal workflow you can open in the Temporal UI.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: 'var(--hp-parchment)', border: '1px solid #d4c9a8', color: 'var(--hp-navy)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => {
          const isAgent = t.role === 'agent'
          return (
            <div key={i} className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
              <div
                className="max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
                style={{
                  backgroundColor: isAgent ? 'var(--hp-parchment)' : 'var(--hp-navy)',
                  color: isAgent ? '#1a1f3a' : 'var(--hp-gold)',
                  border: isAgent ? '1px solid #d4c9a8' : 'none',
                }}
              >
                {t.content}
              </div>
            </div>
          )
        })}

        {processing && (
          <div className="flex justify-start">
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--hp-parchment)', color: '#888', border: '1px solid #d4c9a8' }}
            >
              🔮 thinking…
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={e => { e.preventDefault(); send(input) }}
        className="flex gap-2 p-3 border-t"
        style={{ borderColor: '#e0d8b8' }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask the ops agent…"
          className="flex-1 rounded px-3 py-2 text-sm border"
          style={{ borderColor: '#d4c9a8' }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-4 py-2 rounded font-semibold text-sm transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--hp-dark-red)', color: 'white' }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
