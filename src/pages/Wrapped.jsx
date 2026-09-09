import { useMemo } from 'react'
import useStore from '../store/useStore'
import { getParticipants, getWrappedStats } from '../lib/stats'

// ─── Period options (display label → Zustand value) ──────────────────────────

const PERIODS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'alltime' },
]

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatHM(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, full = false }) {
  return (
    <div
      className={`rounded-xl p-6 flex flex-col justify-between ${full ? 'col-span-1 sm:col-span-2' : ''}`}
      style={{ backgroundColor: '#1e293b' }}
    >
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
        {label}
      </p>
      <div>
        <p className="text-amber-400 text-3xl font-bold leading-tight tabular-nums break-words">
          {value}
        </p>
        {sub && <p className="text-slate-400 text-sm mt-1.5 leading-snug">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Wrapped() {
  const sessions = useStore((s) => s.sessions)
  const wrappedPeriod = useStore((s) => s.wrappedPeriod)
  const setWrappedPeriod = useStore((s) => s.setWrappedPeriod)
  const wrappedParticipant = useStore((s) => s.wrappedParticipant)
  const setWrappedParticipant = useStore((s) => s.setWrappedParticipant)

  const participants = useMemo(() => getParticipants(sessions), [sessions])

  const stats = useMemo(
    () => getWrappedStats(sessions, wrappedParticipant, wrappedPeriod),
    [sessions, wrappedParticipant, wrappedPeriod]
  )

  // Per-participant stats for the current period — used to rank the selection
  // within each category. Only participants who actually read are ranked.
  const rankedParticipants = useMemo(
    () =>
      participants
        .map((name) => ({ name, s: getWrappedStats(sessions, name, wrappedPeriod) }))
        .filter((x) => x.s.totalSessions > 0),
    [participants, sessions, wrappedPeriod]
  )

  // Subtext describing where the selection ranks in a given metric.
  // For "Combined" there is no rank, so we surface the category leader instead.
  function rankSub(metricKey) {
    if (rankedParticipants.length === 0) return null

    if (wrappedParticipant === 'Combined') {
      const leader = [...rankedParticipants].sort(
        (a, b) => b.s[metricKey] - a.s[metricKey]
      )[0]
      return leader ? `${leader.name} leads` : null
    }

    const n = rankedParticipants.length
    if (n <= 1) return 'Only reader this period'

    const myValue = stats[metricKey]
    const rank = rankedParticipants.filter((x) => x.s[metricKey] > myValue).length + 1
    return rank === 1 ? `🥇 1st of ${n} readers` : `#${rank} of ${n} readers`
  }

  const periodLabel =
    PERIODS.find((p) => p.value === wrappedPeriod)?.label ?? 'All Time'

  const hasData = stats.totalSessions > 0

  const selectClass =
    'bg-slate-800 text-white border border-slate-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer'

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <h1 className="text-white text-3xl font-bold mb-6">Wrapped</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <select
          value={wrappedPeriod}
          onChange={(e) => setWrappedPeriod(e.target.value)}
          aria-label="Time period"
          className={selectClass}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={wrappedParticipant}
          onChange={(e) => setWrappedParticipant(e.target.value)}
          aria-label="Participant"
          className={selectClass}
        >
          <option value="Combined">Combined</option>
          {participants.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {!hasData ? (
        // ─── Empty state ──────────────────────────────────────────────────────
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: '#1e293b' }}
        >
          <p className="text-5xl mb-4">📚</p>
          <p className="text-white text-lg font-semibold mb-1">
            No reading data for {periodLabel.toLowerCase()}.
          </p>
          <p className="text-slate-400 text-sm">
            {wrappedParticipant === 'Combined'
              ? 'No one logged any sessions in this period — try a wider time range.'
              : `${wrappedParticipant} hasn't logged any sessions in this period — try a wider time range.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Highlight callout — full width, gradient, accent */}
          <div
            className="col-span-1 sm:col-span-2 rounded-2xl p-8 text-center"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #f59e0b 140%)',
              boxShadow: '0 10px 40px -12px rgba(124,58,237,0.5)',
            }}
          >
            <p className="text-indigo-100 text-xs font-semibold uppercase tracking-[0.2em] mb-3">
              {wrappedParticipant} &middot; {periodLabel}
            </p>
            <p className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
              {stats.highlightStat}
            </p>
          </div>

          {/* Stat cards — subtext shows where the selection ranks per category */}
          <StatCard
            label="Total Minutes Read"
            value={formatHM(stats.totalMinutes)}
            sub={rankSub('totalMinutes')}
          />
          <StatCard
            label="Total Pages Read"
            value={stats.totalPages.toLocaleString()}
            sub={rankSub('totalPages')}
          />
          <StatCard
            label="Total Sessions"
            value={stats.totalSessions}
            sub={rankSub('totalSessions')}
          />
          <StatCard
            label="Completed Books"
            value={stats.completedBooks}
            sub={rankSub('completedBooks')}
          />
          <StatCard
            label="Longest Single Session"
            value={`${stats.longestSession} min`}
            sub={rankSub('longestSession')}
          />
          <StatCard
            label="Best Single Day"
            value={formatHM(stats.bestDayMinutes)}
            sub={rankSub('bestDayMinutes')}
          />
          <StatCard
            label="Longest Reading Streak"
            value={`${stats.longestStreak} ${stats.longestStreak === 1 ? 'day' : 'days'}`}
            sub={rankSub('longestStreak')}
          />
          <StatCard
            label="Favorite Book"
            value={stats.favoriteBook || '—'}
            sub={stats.favoriteBook ? 'Highest avg rating' : 'No rated books yet'}
          />
          <StatCard
            label="Top Author"
            value={stats.topAuthor || '—'}
            sub="Most minutes read"
          />
          <StatCard
            label="Reading Consistency"
            value={`${stats.consistencyPct}%`}
            sub={rankSub('consistencyPct')}
          />
        </div>
      )}
    </div>
  )
}
