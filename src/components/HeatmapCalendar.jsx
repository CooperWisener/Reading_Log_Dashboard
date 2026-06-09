import { useMemo, useState } from 'react'
import { startOfDay, startOfWeek, addDays, subWeeks, format, getDate } from 'date-fns'
import { getOverTimeData } from '../lib/stats'

const CELL = 10
const GAP = 2
const STEP = CELL + GAP

// Fixed-threshold intensity scale (minutes → indigo shade)
function getCellColor(minutes) {
  if (minutes === 0)   return '#1e293b'
  if (minutes <= 15)   return '#1e1b4b'
  if (minutes <= 45)   return '#312e81'
  if (minutes <= 90)   return '#4338ca'
  if (minutes <= 150)  return '#6366f1'
  return '#818cf8'
}

// Show only Mon / Wed / Fri row labels (rows 1, 3, 5 in Sun-first grid)
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

export default function HeatmapCalendar({ sessions, name }) {
  const [hovered, setHovered] = useState(null)

  const overTimeData = useMemo(() => getOverTimeData(sessions, name), [sessions, name])

  const { weeks, monthLabels, dataMap } = useMemo(() => {
    const dataMap = {}
    for (const d of overTimeData) dataMap[d.date] = d

    const today = startOfDay(new Date())
    // Start of the Sunday ~52 weeks back so we have ~12 months of columns
    const calStart = startOfWeek(subWeeks(today, 51), { weekStartsOn: 0 })

    const weeks = []
    const monthLabels = []
    const monthSeen = new Set()
    let cursor = calStart

    while (cursor <= today) {
      const week = []
      for (let d = 0; d < 7; d++) {
        const day = addDays(cursor, d)
        week.push(day <= today ? day : null)
      }
      weeks.push(week)

      // Add a month label at the first week where the 1st–7th of that month appears
      for (const day of week) {
        if (!day) continue
        const mk = format(day, 'yyyy-MM')
        if (!monthSeen.has(mk) && getDate(day) <= 7) {
          monthSeen.add(mk)
          monthLabels.push({ wi: weeks.length - 1, label: format(day, 'MMM') })
        }
      }

      cursor = addDays(cursor, 7)
    }

    return { weeks, monthLabels, dataMap }
  }, [overTimeData])

  // True only if at least one day *within the rendered 12-month window* has
  // reading — so a reader whose sessions are all older than a year still gets a
  // friendly message instead of a blank grid.
  const hasVisibleData = useMemo(() => {
    for (const week of weeks) {
      for (const day of week) {
        if (day && dataMap[format(day, 'yyyy-MM-dd')]?.minutes > 0) return true
      }
    }
    return false
  }, [weeks, dataMap])

  if (!hasVisibleData) {
    return (
      <p className="text-slate-500 text-sm italic py-2">
        No reading in the past 12 months.
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-flex', alignItems: 'flex-start' }}>

        {/* Day-of-week labels */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: GAP,
            paddingTop: 20, marginRight: 4, flexShrink: 0,
          }}
        >
          {DAY_LABELS.map((lbl, i) => (
            <div
              key={i}
              style={{
                height: CELL, width: 24, fontSize: 9, color: '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              }}
            >
              {lbl}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ position: 'relative', flexShrink: 0 }}>

          {/* Month labels */}
          <div style={{ position: 'relative', height: 18, marginBottom: 2 }}>
            {monthLabels.map(({ wi, label }) => (
              <span
                key={wi}
                style={{
                  position: 'absolute', left: wi * STEP, top: 4,
                  fontSize: 9, color: '#64748b', whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Week columns */}
          <div style={{ display: 'flex', gap: GAP }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {week.map((day, di) => {
                  if (!day) return <div key={di} style={{ width: CELL, height: CELL }} />

                  const dateStr = format(day, 'yyyy-MM-dd')
                  const entry = dataMap[dateStr]
                  const mins = entry?.minutes ?? 0

                  return (
                    <div
                      key={di}
                      style={{
                        width: CELL, height: CELL, borderRadius: 2,
                        backgroundColor: getCellColor(mins),
                      }}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect()
                        setHovered({
                          label: format(day, 'MMM d, yyyy'),
                          minutes: mins,
                          pages: entry?.pages ?? 0,
                          sessions: entry?.sessions ?? 0,
                          x: r.left + CELL / 2,
                          y: r.top,
                        })
                      }}
                      onMouseLeave={() => setHovered(null)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed-position tooltip (avoids overflow-x clipping) */}
      {hovered && (
        <div
          style={{
            position: 'fixed',
            left: hovered.x, top: hovered.y - 10,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '8px 12px',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <p style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap' }}>
            {hovered.label}
          </p>
          {hovered.minutes > 0 ? (
            <>
              <p style={{ color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>{hovered.minutes} min</p>
              {hovered.pages > 0 && (
                <p style={{ color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>{hovered.pages} pages</p>
              )}
              <p style={{ color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>
                {hovered.sessions} session{hovered.sessions !== 1 ? 's' : ''}
              </p>
            </>
          ) : (
            <p style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>No reading</p>
          )}
        </div>
      )}
    </div>
  )
}
