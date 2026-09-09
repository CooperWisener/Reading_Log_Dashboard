import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import useStore from '../store/useStore'
import {
  getParticipants,
  getBooksByParticipant,
  getDayOfWeekData,
  getOverTimeData,
  getFinishedBooksOverTime,
} from '../lib/stats'
import HeatmapCalendar from '../components/HeatmapCalendar'

// ─── Shared chart theme ───────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 12,
}
const LABEL_STYLE  = { color: '#f1f5f9', fontWeight: 600 }
const ITEM_STYLE   = { color: '#94a3b8' }
const TICK_PROPS   = { fill: '#64748b', fontSize: 11 }
const GRID_STROKE  = 'rgba(148,163,184,0.08)'

// ─── Star display ────────────────────────────────────────────────────────────

function Star({ fill }) {
  return (
    <span className="relative inline-block leading-none" style={{ fontSize: '0.9rem' }}>
      <span style={{ color: '#334155' }}>★</span>
      {fill > 0 && (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: fill === 1 ? '100%' : '50%', color: '#f59e0b' }}
        >
          ★
        </span>
      )}
    </span>
  )
}

function StarRating({ rating }) {
  const rounded = Math.round(rating * 2) / 2
  return (
    <span className="inline-flex gap-px">
      {[1, 2, 3, 4, 5].map((pos) => {
        const fill = pos <= rounded ? 1 : pos - 0.5 === rounded ? 0.5 : 0
        return <Star key={pos} fill={fill} />
      })}
    </span>
  )
}

// ─── Book list ───────────────────────────────────────────────────────────────

function BookList({ books }) {
  const qualified = useMemo(
    () =>
      books
        .filter((b) => b.sessionCount >= 1)
        .sort((a, b) => b.avgRating - a.avgRating)
        .slice(0, 10),
    [books]
  )

  if (qualified.length === 0) {
    return (
      <p className="text-slate-500 text-sm italic py-2">
        No books logged yet.
      </p>
    )
  }

  return (
    <div>
      {qualified.map((book) => (
        <div key={book.bookTitle} className="py-3 border-b border-slate-700/50 last:border-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-snug">
                {book.bookTitle}
                {book.completed && (
                  <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-900/60 text-emerald-300 align-middle">
                    ✓ Completed
                  </span>
                )}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">{book.author}</p>
            </div>
            <div className="shrink-0 pt-0.5">
              {book.avgRating > 0 ? <StarRating rating={book.avgRating} /> : <span className="text-slate-600 text-xs">—</span>}
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {book.bookSeries && (
              <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-900/60 text-indigo-300">
                {book.bookSeries}
              </span>
            )}
            <span className="text-slate-500 text-xs">{book.sessionCount} sessions</span>
            {book.totalPages > 0 && (
              <span className="text-slate-500 text-xs">{book.totalPages.toLocaleString()} pages</span>
            )}
            {book.avgRating > 0 && (
              <span className="text-slate-500 text-xs">{book.avgRating.toFixed(1)} / 5</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Chart: Days of Week ─────────────────────────────────────────────────────

const DOW_METRICS = ['sessions', 'minutes', 'pages']
const DOW_COLORS  = { sessions: '#10b981', minutes: '#6366f1', pages: '#f59e0b' }
const DOW_LABELS  = { sessions: 'Sessions', minutes: 'Minutes', pages: 'Pages' }

function DayOfWeekChart({ sessions, name }) {
  const [metric, setMetric] = useState('sessions')

  const data = useMemo(() => {
    const raw = getDayOfWeekData(sessions, name)
    // Reorder Sun-first → Mon-Sun for display
    return [raw[1], raw[2], raw[3], raw[4], raw[5], raw[6], raw[0]]
  }, [sessions, name])

  const isEmpty = data.every((d) => d.sessions === 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white text-sm font-semibold">When {name} Reads</h4>
        <div className="flex gap-1">
          {DOW_METRICS.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                metric === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {DOW_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <p className="text-slate-500 text-sm italic py-2">No data.</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={TICK_PROPS} axisLine={false} tickLine={false} />
            <YAxis tick={TICK_PROPS} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={LABEL_STYLE}
              itemStyle={ITEM_STYLE}
              cursor={{ fill: 'rgba(148,163,184,0.05)' }}
            />
            <Bar dataKey={metric} name={DOW_LABELS[metric]} fill={DOW_COLORS[metric]} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Chart: Progress Over Time ───────────────────────────────────────────────

const OT_SERIES = [
  { key: 'minutes',  label: 'Minutes',  color: '#6366f1' },
  { key: 'pages',    label: 'Pages',    color: '#f59e0b' },
  { key: 'sessions', label: 'Sessions', color: '#10b981' },
]

function OverTimeChart({ sessions, name }) {
  const [show, setShow] = useState({ minutes: true, pages: false, sessions: false })

  const data = useMemo(() => getOverTimeData(sessions, name), [sessions, name])

  const xFmt   = (d) => format(parseISO(d), 'MMM d')
  const lblFmt = (d) => format(parseISO(d), 'MMM d, yyyy')

  if (data.length === 0) {
    return (
      <div>
        <h4 className="text-white text-sm font-semibold mb-3">Progress Over Time</h4>
        <p className="text-slate-500 text-sm italic py-2">No data.</p>
      </div>
    )
  }

  const visibleSeries = OT_SERIES.filter(({ key }) => show[key])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white text-sm font-semibold">Progress Over Time</h4>
        <div className="flex gap-3">
          {OT_SERIES.map(({ key, label, color }) => (
            <label key={key} className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={show[key]}
                onChange={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
                className="w-3 h-3 accent-indigo-500"
              />
              <span className="text-xs" style={{ color }}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={xFmt}
            interval="preserveStartEnd"
          />
          <YAxis tick={TICK_PROPS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            itemStyle={ITEM_STYLE}
            labelFormatter={lblFmt}
          />
          {visibleSeries.map(({ key, label, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Chart: Cumulative Totals ─────────────────────────────────────────────────

// Running totals of minutes / pages / sessions across the date series.
function computeCumulative(overTimeData) {
  let cumMinutes = 0, cumPages = 0, cumSessions = 0
  return overTimeData.map((point) => {
    cumMinutes  += point.minutes
    cumPages    += point.pages
    cumSessions += point.sessions
    return {
      date: point.date,
      minutes: cumMinutes,
      pages: cumPages,
      sessions: cumSessions,
    }
  })
}

function CumulativeChart({ sessions, name }) {
  const [show, setShow] = useState({ minutes: true, pages: true, sessions: false })

  const overTimeData   = useMemo(() => getOverTimeData(sessions, name), [sessions, name])
  const cumulativeData = useMemo(() => computeCumulative(overTimeData), [overTimeData])

  const xFmt   = (d) => format(parseISO(d), 'MMM d')
  const lblFmt = (d) => format(parseISO(d), 'MMM d, yyyy')

  if (cumulativeData.length === 0) {
    return (
      <div>
        <h4 className="text-white text-sm font-semibold mb-3">Cumulative Totals</h4>
        <p className="text-slate-500 text-sm italic py-2">No data.</p>
      </div>
    )
  }

  const visibleSeries = OT_SERIES.filter(({ key }) => show[key])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white text-sm font-semibold">Cumulative Totals</h4>
        <div className="flex gap-3">
          {OT_SERIES.map(({ key, label, color }) => (
            <label key={key} className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={show[key]}
                onChange={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
                className="w-3 h-3 accent-indigo-500"
              />
              <span className="text-xs" style={{ color }}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={cumulativeData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={xFmt}
            interval="preserveStartEnd"
          />
          <YAxis tick={TICK_PROPS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            itemStyle={ITEM_STYLE}
            labelFormatter={lblFmt}
          />
          {visibleSeries.map(({ key, label, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Chart: Books Finished Over Time ──────────────────────────────────────────

const FINISHED_COLOR = '#10b981'

function FinishedBooksChart({ sessions, name }) {
  const data = useMemo(() => getFinishedBooksOverTime(sessions, name), [sessions, name])

  const xFmt   = (d) => format(parseISO(d), 'MMM d')
  const lblFmt = (d) => format(parseISO(d), 'MMM d, yyyy')

  if (data.length === 0) {
    return (
      <div>
        <h4 className="text-white text-sm font-semibold mb-3">Books Finished</h4>
        <p className="text-slate-500 text-sm italic py-2">No completed books yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white text-sm font-semibold">Books Finished</h4>
        <span className="text-xs" style={{ color: FINISHED_COLOR }}>Cumulative</span>
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={xFmt}
            interval="preserveStartEnd"
          />
          <YAxis tick={TICK_PROPS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            itemStyle={ITEM_STYLE}
            labelFormatter={lblFmt}
          />
          <Line
            type="stepAfter"
            dataKey="cumulative"
            name="Books finished"
            stroke={FINISHED_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: FINISHED_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Per-participant column ──────────────────────────────────────────────────

function ParticipantColumn({ name, sessions }) {
  const books = useMemo(() => getBooksByParticipant(sessions, name), [sessions, name])

  const card = 'rounded-xl p-5 mb-5'
  const cardBg = { backgroundColor: '#1e293b' }
  const sectionLabel = 'text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3'

  return (
    <div>
      {/* Column header */}
      <div className="mb-5">
        <h2 className="text-white text-xl font-bold">{name}</h2>
        <div className="mt-2 h-px" style={{ backgroundColor: '#4f46e5', opacity: 0.4 }} />
      </div>

      {/* Top-Rated Books */}
      <div className={card} style={cardBg}>
        <h3 className={sectionLabel}>Top-Rated Books</h3>
        <BookList books={books} />
      </div>

      {/* Reading Heatmap Calendar */}
      <div className={card} style={cardBg}>
        <h3 className={sectionLabel}>Reading Heatmap — past 12 months</h3>
        <HeatmapCalendar sessions={sessions} name={name} />
      </div>

      {/* Days of Week Bar Chart */}
      <div className={card} style={cardBg}>
        <DayOfWeekChart sessions={sessions} name={name} />
      </div>

      {/* Progress Over Time Line Chart */}
      <div className={card} style={cardBg}>
        <OverTimeChart sessions={sessions} name={name} />
      </div>

      {/* Cumulative Totals Line Chart */}
      <div className={card} style={cardBg}>
        <CumulativeChart sessions={sessions} name={name} />
      </div>

      {/* Books Finished Line Chart */}
      <div className={card} style={cardBg}>
        <FinishedBooksChart sessions={sessions} name={name} />
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const sessions = useStore((s) => s.sessions)
  const selectedParticipants = useStore((s) => s.selectedParticipants)
  const setSelectedParticipants = useStore((s) => s.setSelectedParticipants)

  const participants = useMemo(() => getParticipants(sessions), [sessions])

  // Keep the selection in sync with the available participants: default to the
  // first reader when nothing valid is selected, and drop any names that no
  // longer exist after a data refresh (otherwise a removed/renamed reader stays
  // selected with no toggle button to clear it).
  const hasParticipants = participants.length > 0
  useEffect(() => {
    if (!hasParticipants) return
    const valid = selectedParticipants.filter((n) => participants.includes(n))
    if (valid.length === 0) {
      setSelectedParticipants([participants[0]])
    } else if (valid.length !== selectedParticipants.length) {
      setSelectedParticipants(valid)
    }
  }, [participants, selectedParticipants, setSelectedParticipants, hasParticipants])

  function toggleParticipant(name) {
    if (selectedParticipants.includes(name)) {
      if (selectedParticipants.length > 1) {
        setSelectedParticipants(selectedParticipants.filter((n) => n !== name))
      }
    } else {
      setSelectedParticipants([...selectedParticipants, name])
    }
  }

  const isMulti = selectedParticipants.length > 1

  return (
    <div>
      <h1 className="text-white text-3xl font-bold mb-6">Analytics</h1>

      {/* Participant toggles */}
      <div className="flex flex-wrap gap-2 mb-8">
        {participants.map((name) => {
          const active = selectedParticipants.includes(name)
          return (
            <button
              key={name}
              onClick={() => toggleParticipant(name)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
              }`}
            >
              {name}
            </button>
          )
        })}
      </div>

      {/* Participant columns */}
      <div className={isMulti ? 'flex gap-6 overflow-x-auto pb-4' : ''}>
        {selectedParticipants.map((name) => (
          <div
            key={name}
            className={isMulti ? 'flex-1 min-w-[300px]' : 'max-w-2xl'}
          >
            <ParticipantColumn name={name} sessions={sessions} />
          </div>
        ))}
      </div>
    </div>
  )
}
