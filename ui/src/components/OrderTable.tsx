import type { CSSProperties } from 'react'
import type { Order } from '../types'

interface Props {
  orders: Order[]
  onApprove: (orderId: string) => void
  onDeny: (orderId: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#3f7755',
  cancelled: '#8a3437',
  awaiting_hitl: '#a97821',
  repair_in_progress: '#476b88',
  processing: '#655179',
  payment_processing: '#655179',
  verifying_credentials: '#655179',
  pick_and_pack: '#655179',
  dispatching: '#655179',
}

const OUTCOME_COLORS: Record<string, string> = {
  auto_repaired: '#476b88',
  hitl_approved: '#3f7755',
  hitl_denied: '#8a3437',
  unresolved: '#71695e',
}

const FAILURE_MARKS: Record<string, string> = {
  monster_book_escape: '▤',
  ministry_approval_required: '♜',
  floo_misdirected: '✧',
  gringotts_failure: '◆',
  owl_intercepted: '⌁',
  restricted_section: '⌑',
  inventory_mismatch: '□',
  warehouse_failure: '△',
  payment_timeout: '◴',
  none: '',
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ')
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="order-ledger-badge"
      style={{ '--badge-color': color } as CSSProperties}
    >
      {formatLabel(label)}
    </span>
  )
}

export default function OrderTable({ orders, onApprove, onDeny }: Props) {
  if (orders.length === 0) {
    return (
      <div className="order-ledger-empty">
        <img src="/images/ops/tardigrade-marginalia.jpg" alt="" width="96" height="96" />
        <div>
          <h4>The ledger is quiet.</h4>
          <p>Conjure demo orders or loosen the filters to reveal more records.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="order-ledger-table-wrap">
      <table className="order-ledger-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Book</th>
            <th>Status</th>
            <th>Failure</th>
            <th>Repair</th>
            <th><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => {
            const isHITL = order.order_status === 'awaiting_hitl'
            return (
              <tr key={order.workflow_id} className={isHITL ? 'order-ledger-row--attention' : undefined}>
                <td>
                  <a href={order.temporal_url} target="_blank" rel="noreferrer" className="order-id-link">
                    {order.order_id}
                  </a>
                  {order.repair_attempts > 0 && (
                    <span className="order-repair-count">
                      {order.repair_attempts} repair{order.repair_attempts !== 1 ? 's' : ''}
                    </span>
                  )}
                </td>
                <td className="order-ledger-customer">{order.customer_name}</td>
                <td className="order-ledger-book">{order.book_title}</td>
                <td>
                  <Badge
                    label={order.order_status}
                    color={STATUS_COLORS[order.order_status] || '#71695e'}
                  />
                </td>
                <td>
                  {order.failure_type && order.failure_type !== 'none' ? (
                    <span className="order-failure">
                      <i aria-hidden="true">{FAILURE_MARKS[order.failure_type] || '!'}</i>
                      {formatLabel(order.failure_type)}
                    </span>
                  ) : (
                    <span className="order-ledger-none">—</span>
                  )}
                </td>
                <td>
                  {order.repair_outcome ? (
                    <Badge
                      label={order.repair_outcome}
                      color={OUTCOME_COLORS[order.repair_outcome] || '#71695e'}
                    />
                  ) : (
                    <span className="order-ledger-none">—</span>
                  )}
                </td>
                <td>
                  {isHITL ? (
                    <div className="order-review-actions">
                      <button onClick={() => onApprove(order.order_id)} className="order-review-approve">
                        Approve
                      </button>
                      <button onClick={() => onDeny(order.order_id)} className="order-review-deny">
                        Deny
                      </button>
                    </div>
                  ) : (
                    <a href={order.temporal_url} target="_blank" rel="noreferrer" className="order-view-link">
                      Inspect <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
