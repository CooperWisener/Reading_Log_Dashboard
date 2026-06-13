import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import useStore from '../store/useStore'
import { getParticipants } from '../lib/stats'

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatTime(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m}m`
  }
  return `${minutes} min`
}

// ─── Sortable columns (header label → session key) ───────────────────────────

const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'name', label: 'Reader' },
  { key: 'minutesRead', label: 'Time Read' },
  { key: 'pagesRead', label: 'Pages Read' },
  { key: 'bookTitle', label: 'Book' },
  { key: 'rating', label: 'Rating' },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function History() {
  const sessions = useStore((s) => s.sessions)

  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [filterName, setFilterName] = useState('All')

  const participants = useMemo(() => getParticipants(sessions), [sessions])

  const rows = useMemo(() => {
    const filtered =
      filterName === 'All' ? sessions : sessions.filter((s) => s.name === filterName)

    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string') return av.localeCompare(bv) * dir
      return (av - bv) * dir
    })
  }, [sessions, filterName, sortKey, sortDir])

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      // Date defaults to newest-first; everything else ascending.
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  const selectClass =
    'bg-slate-800 text-white border border-slate-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer'

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <h1 className="text-white text-3xl font-bold mb-6">Session History</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <select
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          aria-label="Participant"
          className={selectClass}
        >
          <option value="All">All Readers</option>
          {participants.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <p className="text-slate-500 text-sm">
          {rows.length} {rows.length === 1 ? 'session' : 'sessions'}
        </p>
      </div>

      {rows.length === 0 ? (
        // ─── Empty state ──────────────────────────────────────────────────────
        <div className="rounded-xl p-12 text-center" style={{ backgroundColor: '#1e293b' }}>
          <p className="text-5xl mb-4">📖</p>
          <p className="text-white text-lg font-semibold">No sessions recorded yet.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700">
                {COLUMNS.map(({ key, label }) => (
                  <th key={key} className="px-4 py-3">
                    <button
                      onClick={() => handleSort(key)}
                      className="flex items-center gap-1 text-slate-400 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors"
                    >
                      {label}
                      {sortKey === key &&
                        (sortDir === 'asc' ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        ))}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr
                  key={`${s.name}-${s.date.getTime()}-${i}`}
                  className="border-b border-slate-800 last:border-b-0 hover:bg-slate-700/50 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-300 text-sm whitespace-nowrap tabular-nums">
                    {format(s.date, 'MMM dd, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-white text-sm font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-slate-300 text-sm tabular-nums">
                    {formatTime(s.minutesRead)}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-sm tabular-nums">
                    {s.pagesRead > 0 ? s.pagesRead : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-sm max-w-[240px] truncate">
                    {s.bookTitle || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {s.rating > 0 ? (
                      <span className="text-amber-400" aria-label={`${s.rating} of 5 stars`}>
                        {'★'.repeat(s.rating)}
                        <span className="text-slate-600">{'★'.repeat(5 - s.rating)}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
