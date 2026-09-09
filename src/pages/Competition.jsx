import { useState, useEffect, useMemo } from 'react'
import useStore from '../store/useStore'
import { getStatsByParticipant } from '../lib/stats'

const METRICS = [
  { label: 'Total Minutes Read', key: 'totalMinutes' },
  { label: 'Total Pages Read', key: 'totalPages' },
  { label: 'Total Sessions', key: 'totalSessions' },
  { label: '% of Days Read', key: 'percentDaysRead' },
  { label: 'Books Completed', key: 'completedBooks' },
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const selectClass =
  'bg-slate-800 text-white border border-slate-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer'

function formatValue(value, metric) {
  switch (metric) {
    case 'totalMinutes': {
      const h = Math.floor(value / 60)
      const m = value % 60
      return h > 0 ? `${h}h ${m}m` : `${m}m`
    }
    case 'totalPages':
      return `${value.toLocaleString()} pages`
    case 'totalSessions':
      return `${value} sessions`
    case 'percentDaysRead':
      return `${value}%`
    case 'completedBooks':
      return `${value} book${value === 1 ? '' : 's'}`
    default:
      return String(value)
  }
}

export default function Competition() {
  const sessions = useStore((s) => s.sessions)
  const competitionMetric = useStore((s) => s.competitionMetric)
  const setCompetitionMetric = useStore((s) => s.setCompetitionMetric)
  const competitionYear = useStore((s) => s.competitionYear)
  const setCompetitionYear = useStore((s) => s.setCompetitionYear)
  const competitionMonth = useStore((s) => s.competitionMonth)
  const setCompetitionMonth = useStore((s) => s.setCompetitionMonth)

  const [started, setStarted] = useState(false)
  const [complete, setComplete] = useState(false)

  // Stable "today" for the lifetime of the mount so the year/month derivations
  // below don't silently drift if the app is left open across midnight/new-year.
  const now = useMemo(() => new Date(), [])

  // Years that have data, plus the current year, newest first.
  const availableYears = useMemo(() => {
    const set = new Set(
      sessions.map((s) => s.date && s.date.getFullYear()).filter(Boolean)
    )
    set.add(now.getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [sessions])

  // Effective year: the stored pick if still valid, else the current year when
  // present, else the newest year with data.
  const year = useMemo(() => {
    if (competitionYear != null && availableYears.includes(competitionYear)) {
      return competitionYear
    }
    if (availableYears.includes(now.getFullYear())) return now.getFullYear()
    return availableYears[0]
  }, [competitionYear, availableYears])

  // Months (0-indexed) that have data in the effective year, ascending.
  const availableMonths = useMemo(() => {
    const set = new Set(
      sessions
        .filter((s) => s.date && s.date.getFullYear() === year)
        .map((s) => s.date.getMonth())
    )
    return [...set].sort((a, b) => a - b)
  }, [sessions, year])

  // Effective month: 'all' or a 0-indexed month. Defaults to the current month
  // (when the current year has data for it), else the newest month with data.
  const month = useMemo(() => {
    if (competitionMonth === 'all') return 'all'
    if (
      typeof competitionMonth === 'number' &&
      availableMonths.includes(competitionMonth)
    ) {
      return competitionMonth
    }
    if (year === now.getFullYear() && availableMonths.includes(now.getMonth())) {
      return now.getMonth()
    }
    return availableMonths.length > 0 ? availableMonths[availableMonths.length - 1] : 'all'
  }, [competitionMonth, availableMonths, year])

  const periodSessions = useMemo(
    () =>
      sessions.filter((s) => {
        if (!s.date || s.date.getFullYear() !== year) return false
        return month === 'all' || s.date.getMonth() === month
      }),
    [sessions, year, month]
  )

  const statsMap = useMemo(
    () => getStatsByParticipant(periodSessions),
    [periodSessions]
  )

  const ranked = useMemo(() => {
    return Object.entries(statsMap)
      .map(([name, s]) => ({ name, value: s[competitionMetric] ?? 0 }))
      .sort((a, b) => b.value - a.value)
  }, [statsMap, competitionMetric])

  const maxValue = ranked.length > 0 ? ranked[0].value : 1

  useEffect(() => {
    setStarted(false)
    setComplete(false)

    let raf1, raf2, timer

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setStarted(true)
        timer = setTimeout(() => setComplete(true), 2600)
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(timer)
    }
  }, [competitionMetric, year, month])

  const currentMetric = METRICS.find((m) => m.key === competitionMetric)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <h1 className="text-white text-3xl font-bold">Competition</h1>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-slate-400 text-sm font-medium whitespace-nowrap">
              Year:
            </label>
            <select
              value={year}
              onChange={(e) => {
                setCompetitionYear(Number(e.target.value))
                setCompetitionMonth(null) // re-default the month for the new year
              }}
              aria-label="Competition year"
              className={selectClass}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-slate-400 text-sm font-medium whitespace-nowrap">
              Month:
            </label>
            <select
              value={month}
              onChange={(e) =>
                setCompetitionMonth(
                  e.target.value === 'all' ? 'all' : Number(e.target.value)
                )
              }
              aria-label="Competition month"
              className={selectClass}
            >
              <option value="all">All Year</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {MONTH_NAMES[m]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-slate-400 text-sm font-medium whitespace-nowrap">
              Metric:
            </label>
            <select
              value={competitionMetric}
              onChange={(e) => setCompetitionMetric(e.target.value)}
              aria-label="Competition metric"
              className={selectClass}
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Zero participants — unreachable in normal use, but fail gracefully */}
      {ranked.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#1e293b' }}>
          <p className="text-slate-400 text-sm">No participants to display yet.</p>
        </div>
      )}

      {/* Single participant — hide the race, just show the lone result */}
      {ranked.length === 1 && (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#1e293b' }}>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">
            {currentMetric?.label}
          </p>
          <p className="text-amber-300 text-2xl font-bold">{ranked[0].name}</p>
          <p className="text-amber-400 text-4xl font-extrabold tabular-nums mt-1">
            {formatValue(ranked[0].value, competitionMetric)}
          </p>
          <p className="text-slate-500 text-sm mt-3">
            Only one reader logged so far — no race to run yet.
          </p>
        </div>
      )}

      {/* Race track card */}
      {ranked.length > 1 && (
      <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: '#1e293b' }}>
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-5">
          Race Track &mdash;{' '}
          <span className="text-slate-400 normal-case font-medium">{currentMetric?.label}</span>
        </p>

        {ranked.length === 0 ? (
          <p className="text-slate-500 text-sm">No participants to race.</p>
        ) : (
          <div className="space-y-4">
            {ranked.map(({ name, value }, idx) => {
              const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
              const isWinner = idx === 0
              // runner center = leading edge of fill bar; minimum 3% to keep visible at start
              const runnerLeft = started
                ? `calc(${Math.max(pct, 3)}% - 14px)`
                : '2px'

              return (
                <div key={name} className="flex items-center gap-3">
                  {/* Participant name */}
                  <div className="w-28 shrink-0 text-right">
                    <span
                      className={`text-sm font-medium truncate block ${
                        isWinner ? 'text-amber-300' : 'text-slate-300'
                      }`}
                    >
                      {name}
                    </span>
                  </div>

                  {/* Track lane */}
                  <div
                    className="relative flex-1 h-8 rounded-full"
                    style={{ backgroundColor: '#0f172a' }}
                  >
                    {/* Finish line marker */}
                    <div
                      className="absolute right-0 top-0 h-full w-px rounded-r-full"
                      style={{ borderRight: '2px dashed rgba(148,163,184,0.2)' }}
                    />

                    {/* Fill bar */}
                    <div
                      className="absolute top-0 left-0 h-full rounded-full"
                      style={{
                        width: started ? `${pct}%` : '0%',
                        transition: started ? 'width 2.5s ease-out' : 'none',
                        backgroundColor: isWinner ? '#f59e0b' : '#4f46e5',
                      }}
                    />

                    {/* Runner emoji — tracks the leading edge */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 text-lg leading-none select-none"
                      style={{
                        left: runnerLeft,
                        transition: started ? 'left 2.5s ease-out' : 'none',
                        zIndex: 2,
                      }}
                    >
                      🏃
                    </div>
                  </div>

                  {/* Trophy column — always reserves space */}
                  <div className="w-7 shrink-0 flex items-center justify-center">
                    {complete && isWinner && (
                      <span className="text-xl leading-none" title="Winner!">
                        🏆
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}

      {/* Standings — revealed after animation */}
      {complete && ranked.length > 1 && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-white font-semibold text-lg">Standings</h2>
          </div>

          <table className="w-full">
            <thead>
              <tr
                className="border-b border-slate-700"
                style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}
              >
                <th className="text-left py-3 px-6 text-slate-400 text-xs font-semibold uppercase tracking-wider w-20">
                  Rank
                </th>
                <th className="text-left py-3 px-6 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Name
                </th>
                <th className="text-right py-3 px-6 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  {currentMetric?.label}
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ name, value }, idx) => {
                const isFirst = idx === 0
                return (
                  <tr
                    key={name}
                    className="border-b border-slate-700/50 last:border-0"
                    style={isFirst ? { backgroundColor: 'rgba(245,158,11,0.07)' } : {}}
                  >
                    <td className="py-4 px-6">
                      <span
                        className={`text-sm font-bold ${
                          isFirst ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      >
                        {isFirst ? '🥇' : `#${idx + 1}`}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`text-sm font-semibold ${
                          isFirst ? 'text-amber-300' : 'text-white'
                        }`}
                      >
                        {name}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          isFirst ? 'text-amber-400' : 'text-slate-300'
                        }`}
                      >
                        {formatValue(value, competitionMetric)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
