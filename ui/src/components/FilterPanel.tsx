interface Filters {
  status: string
  repair_outcome: string
  requires_hitl: string
  failure_type: string
}

interface Props {
  filters: Filters
  onChange: (filters: Filters) => void
}

const STATUS_OPTIONS = [
  '', 'processing', 'payment_processing', 'verifying_credentials',
  'pick_and_pack', 'dispatching', 'repair_in_progress', 'awaiting_hitl',
  'completed', 'cancelled',
]

const OUTCOME_OPTIONS = ['', 'auto_repaired', 'hitl_approved', 'hitl_denied', 'unresolved']

const FAILURE_OPTIONS = [
  '', 'none', 'monster_book_escape', 'ministry_approval_required',
  'floo_misdirected', 'gringotts_failure', 'owl_intercepted',
  'restricted_section', 'inventory_mismatch', 'warehouse_failure', 'payment_timeout',
]

function optionLabel(value: string): string {
  if (!value) return 'All'
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

export default function FilterPanel({ filters, onChange }: Props) {
  function update(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="ops-filters">
      <div className="ops-filter-heading">
        <span aria-hidden="true">⌁</span>
        <div>
          <strong>Ledger filters</strong>
          <p>Narrow the order records</p>
        </div>
      </div>

      <label className="ops-filter-field">
        <span>Status</span>
        <select value={filters.status} onChange={event => update('status', event.target.value)}>
          {STATUS_OPTIONS.map(option => <option key={option} value={option}>{optionLabel(option)}</option>)}
        </select>
      </label>

      <label className="ops-filter-field">
        <span>Repair outcome</span>
        <select value={filters.repair_outcome} onChange={event => update('repair_outcome', event.target.value)}>
          {OUTCOME_OPTIONS.map(option => <option key={option} value={option}>{optionLabel(option)}</option>)}
        </select>
      </label>

      <label className="ops-filter-field">
        <span>Human review</span>
        <select value={filters.requires_hitl} onChange={event => update('requires_hitl', event.target.value)}>
          <option value="">All</option>
          <option value="true">Required</option>
          <option value="false">Not required</option>
        </select>
      </label>

      <label className="ops-filter-field">
        <span>Failure</span>
        <select value={filters.failure_type} onChange={event => update('failure_type', event.target.value)}>
          {FAILURE_OPTIONS.map(option => <option key={option} value={option}>{optionLabel(option)}</option>)}
        </select>
      </label>

      <button
        onClick={() => onChange({ status: '', repair_outcome: '', requires_hitl: '', failure_type: '' })}
        className="ops-filter-clear"
      >
        Clear filters
      </button>
    </div>
  )
}
