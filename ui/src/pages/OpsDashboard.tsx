import { useState, useEffect } from 'react'
import type { Order, Stats } from '../types'
import { fetchStats, fireBulkOrders, approveOrder, denyOrder, subscribeToOrders, fetchConfig } from '../api'
import StatsBar from '../components/StatsBar'
import FilterPanel from '../components/FilterPanel'
import OrderTable from '../components/OrderTable'
import OpsAgentChat from '../components/OpsAgentChat'

const DEFAULT_TEMPORAL_UI = import.meta.env.VITE_TEMPORAL_UI_URL || 'http://localhost:8233/namespaces/default'

interface Filters {
  status: string
  repair_outcome: string
  requires_hitl: string
  failure_type: string
}

export default function OpsDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filters, setFilters] = useState<Filters>({ status: '', repair_outcome: '', requires_hitl: '', failure_type: '' })
  const [bulkCount, setBulkCount] = useState(100)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)
  const [liveConnected, setLiveConnected] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(true)
  const [temporalUi, setTemporalUi] = useState(DEFAULT_TEMPORAL_UI)

  // Runtime config — correct Temporal UI URL on Cloud; falls back to the default.
  useEffect(() => {
    fetchConfig().then(c => { if (c?.temporal_ui_url) setTemporalUi(c.temporal_ui_url) }).catch(() => {})
  }, [])

  // Stats refresh
  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      try {
        const s = await fetchStats()
        if (!cancelled) setStats(s)
      } catch {}
    }
    loadStats()
    const id = setInterval(loadStats, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Live SSE subscription
  useEffect(() => {
    const unsub = subscribeToOrders((incoming) => {
      setLiveConnected(true)
      setOrders(incoming)
    })
    return unsub
  }, [])

  // Filtered view
  const filtered = orders.filter(o => {
    if (filters.status && o.order_status !== filters.status) return false
    if (filters.repair_outcome && o.repair_outcome !== filters.repair_outcome) return false
    if (filters.requires_hitl === 'true' && !o.requires_hitl) return false
    if (filters.requires_hitl === 'false' && o.requires_hitl) return false
    if (filters.failure_type && o.failure_type !== filters.failure_type) return false
    return true
  })

  async function handleBulkOrders() {
    setBulkLoading(true)
    setBulkResult(null)
    try {
      const result = await fireBulkOrders(bulkCount)
      setBulkResult(`✅ Fired ${result.started} orders`)
    } catch (e: any) {
      setBulkResult(`❌ ${e.message}`)
    } finally {
      setBulkLoading(false)
    }
  }

  async function handleApprove(orderId: string) {
    try {
      await approveOrder(orderId)
      setActionFeedback(`✅ Approved order ${orderId}`)
      setTimeout(() => setActionFeedback(null), 3000)
    } catch (e: any) {
      setActionFeedback(`❌ ${e.message}`)
      setTimeout(() => setActionFeedback(null), 5000)
    }
  }

  async function handleDeny(orderId: string) {
    try {
      await denyOrder(orderId)
      setActionFeedback(`🚫 Denied order ${orderId}`)
      setTimeout(() => setActionFeedback(null), 3000)
    } catch (e: any) {
      setActionFeedback(`❌ ${e.message}`)
      setTimeout(() => setActionFeedback(null), 5000)
    }
  }

  return (
    <div className="ops-page">
      <section className="ops-dashboard-hero">
        <img
          src="/images/ops/tardigrade-time-seal.jpg"
          alt=""
          aria-hidden="true"
          title="A tiny guardian of durable time"
          className="ops-time-seal"
          width="500"
          height="500"
        />
        <div className="ops-dashboard-hero-copy">
          <p className="ops-eyebrow">Flourish &amp; Blotts · Back office</p>
          <h2>Order Operations Chamber</h2>
          <p>
            Watch every order, repair, and human decision unfold across the durable timeline.
          </p>
        </div>
        <div className="ops-dashboard-actions">
          <div className={`ops-live-status${liveConnected ? ' ops-live-status--connected' : ''}`}>
            <span aria-hidden="true" />
            {liveConnected ? 'Live timeline' : 'Opening channel'}
          </div>
          <button
            onClick={() => setShowChat(v => !v)}
            className={`ops-counsel-toggle${showChat ? ' ops-counsel-toggle--active' : ''}`}
            aria-expanded={showChat}
          >
            <span aria-hidden="true">✦</span>
            {showChat ? 'Close counsel' : 'Consult the hat'}
          </button>
          <a
            href={temporalUi}
            target="_blank"
            rel="noreferrer"
            className="ops-temporal-link"
          >
            Temporal Web UI <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <StatsBar stats={stats} />

      {showChat && <OpsAgentChat />}

      <section className="ops-bulk-panel">
        <div className="ops-bulk-mark" aria-hidden="true">⚡</div>
        <div className="ops-bulk-copy">
          <p className="ops-eyebrow">Demo controls</p>
          <h3>Conjure a rush of orders</h3>
          <p>Creates randomized wizarding customers and a representative failure distribution.</p>
        </div>
        <div className="ops-bulk-controls">
          <label htmlFor="bulk-order-count">Order count</label>
          <input
            id="bulk-order-count"
            type="number"
            min={1}
            max={500}
            value={bulkCount}
            onChange={e => setBulkCount(Number(e.target.value))}
          />
          <button
            onClick={handleBulkOrders}
            disabled={bulkLoading}
          >
            {bulkLoading ? 'Casting…' : `Conjure ${bulkCount}`}
          </button>
        </div>
        {bulkResult && (
          <span className={`ops-bulk-result${bulkResult.startsWith('✅') ? ' ops-bulk-result--good' : ''}`}>
            {bulkResult}
          </span>
        )}
      </section>

      {actionFeedback && (
        <div className={`ops-action-feedback${actionFeedback.startsWith('❌') ? ' ops-action-feedback--bad' : ''}`} role="status">
          {actionFeedback}
        </div>
      )}

      <section className="ops-ledger" aria-labelledby="order-ledger-title">
        <img
          src="/images/ops/tardigrade-marginalia.jpg"
          alt=""
          aria-hidden="true"
          title="Something patient is watching the timeline"
          className="ops-ledger-marginalia"
          width="700"
          height="700"
        />
        <header className="ops-ledger-header">
          <div>
            <p className="ops-eyebrow">Live records</p>
            <h3 id="order-ledger-title">The Order Ledger</h3>
          </div>
          <div className="ops-ledger-count">
            <strong>{filtered.length}</strong>
            <span>
              order{filtered.length !== 1 ? 's' : ''} shown
              {filtered.length !== orders.length && ` of ${orders.length}`}
            </span>
          </div>
        </header>

        <FilterPanel filters={filters} onChange={setFilters} />

        <div className="ops-ledger-refresh">
          <span aria-hidden="true" />
          Ledger ink refreshes every three seconds via SSE
        </div>

        <OrderTable orders={filtered} onApprove={handleApprove} onDeny={handleDeny} />
      </section>
    </div>
  )
}
