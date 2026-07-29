import type { Stats } from '../types'

interface Props {
  stats: Stats | null
}

const TILES = [
  { key: 'total', label: 'Total orders', mark: '∞', tone: 'ink' },
  { key: 'completed', label: 'Delivered', mark: '✦', tone: 'green' },
  { key: 'auto_repaired', label: 'Auto-repaired', mark: '↻', tone: 'blue' },
  { key: 'awaiting_hitl', label: 'Awaiting counsel', mark: '◴', tone: 'gold' },
  { key: 'hitl_approved', label: 'Approved', mark: '✓', tone: 'green' },
  { key: 'hitl_denied', label: 'Denied', mark: '×', tone: 'red' },
  { key: 'in_progress', label: 'In progress', mark: '≋', tone: 'purple' },
  { key: 'cancelled', label: 'Cancelled', mark: '—', tone: 'muted' },
] as const

export default function StatsBar({ stats }: Props) {
  return (
    <section className="ops-stats" aria-label="Order statistics">
      {TILES.map(tile => (
        <div key={tile.key} className="ops-stat-card" data-tone={tile.tone}>
          <span className="ops-stat-mark" aria-hidden="true">{tile.mark}</span>
          <strong>{stats ? (stats[tile.key] ?? 0) : '—'}</strong>
          <span>{tile.label}</span>
        </div>
      ))}
    </section>
  )
}
