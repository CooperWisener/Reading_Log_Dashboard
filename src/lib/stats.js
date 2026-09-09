import {
  startOfDay,
  differenceInCalendarDays,
  format,
  isWithinInterval,
  subDays,
  subWeeks,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from 'date-fns'

// ─── helpers ────────────────────────────────────────────────────────────────

function toDay(date) {
  return format(startOfDay(date), 'yyyy-MM-dd')
}

function filterByPeriod(sessions, period) {
  if (period === 'alltime') return sessions
  const now = new Date()
  const start =
    period === 'week'
      ? subWeeks(now, 1)
      : subMonths(now, 1)
  return sessions.filter((s) => s.date && s.date >= start)
}

// ─── exported functions ──────────────────────────────────────────────────────

export function getParticipants(sessions) {
  const names = [...new Set(sessions.map((s) => s.name).filter(Boolean))]
  return names.sort()
}

export function getStatsByParticipant(sessions) {
  const today = startOfDay(new Date())

  // Earliest date across ALL participants for percentDaysRead denominator
  const allDates = sessions
    .map((s) => s.date)
    .filter(Boolean)
    .map((d) => startOfDay(d))
  const firstDate = allDates.length
    ? new Date(Math.min(...allDates.map((d) => d.getTime())))
    : today
  const totalSpan = differenceInCalendarDays(today, firstDate) + 1

  const participants = getParticipants(sessions)
  const result = {}

  for (const name of participants) {
    const mine = sessions.filter((s) => s.name === name && s.date)

    const totalMinutes = mine.reduce((a, s) => a + s.minutesRead, 0)
    const totalPages = mine.reduce((a, s) => a + s.pagesRead, 0)
    const totalSessions = mine.length

    // Unique days read (sorted ascending)
    const daySet = [...new Set(mine.map((s) => toDay(s.date)))].sort()
    const uniqueDays = daySet.length

    // Current streak: consecutive days ending on or before today
    let streak = 0
    let cursor = today
    while (true) {
      const key = format(cursor, 'yyyy-MM-dd')
      if (daySet.includes(key)) {
        streak++
        cursor = subDays(cursor, 1)
      } else {
        break
      }
    }

    const percentDaysRead =
      totalSpan > 0
        ? Math.round((uniqueDays / totalSpan) * 1000) / 10
        : 0

    result[name] = {
      totalMinutes,
      totalPages,
      totalSessions,
      currentStreak: streak,
      percentDaysRead,
      completedBooks: countCompletedBooks(mine),
    }
  }

  return result
}

export function getBooksByParticipant(sessions, name) {
  const mine = sessions.filter((s) => s.name === name)
  const bookMap = {}

  for (const s of mine) {
    const key = s.bookTitle.toLowerCase()
    if (!bookMap[key]) {
      bookMap[key] = {
        bookTitle: s.bookTitle,
        bookSeries: s.bookSeries,
        author: s.author,
        ratings: [],
        sessionCount: 0,
        totalMinutes: 0,
        totalPages: 0,
        completed: false,
        lastRead: null,
      }
    }
    const b = bookMap[key]
    if (s.rating > 0) b.ratings.push(s.rating)
    b.sessionCount++
    b.totalMinutes += s.minutesRead
    b.totalPages += s.pagesRead
    // A book is completed if ANY of its sessions is checked off.
    if (s.completed) b.completed = true
    if (s.date && (!b.lastRead || s.date > b.lastRead)) b.lastRead = s.date
  }

  return Object.values(bookMap).map((b) => ({
    bookTitle: b.bookTitle,
    bookSeries: b.bookSeries,
    author: b.author,
    avgRating:
      b.ratings.length > 0
        ? Math.round((b.ratings.reduce((a, r) => a + r, 0) / b.ratings.length) * 10) / 10
        : 0,
    sessionCount: b.sessionCount,
    totalMinutes: b.totalMinutes,
    totalPages: b.totalPages,
    completed: b.completed,
    lastRead: b.lastRead,
  }))
}

// Count of distinct completed books (any session checked off) for a participant's
// session list. Groups by lowercased title, matching the rest of the app.
function countCompletedBooks(sessions) {
  const completed = {}
  for (const s of sessions) {
    const key = s.bookTitle.toLowerCase()
    if (!(key in completed)) completed[key] = false
    if (s.completed) completed[key] = true
  }
  return Object.values(completed).filter(Boolean).length
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function getDayOfWeekData(sessions, name) {
  const mine = sessions.filter((s) => s.name === name && s.date)
  const buckets = DAY_LABELS.map((day) => ({ day, sessions: 0, minutes: 0, pages: 0 }))

  for (const s of mine) {
    const idx = s.date.getDay()
    buckets[idx].sessions++
    buckets[idx].minutes += s.minutesRead
    buckets[idx].pages += s.pagesRead
  }

  return buckets
}

export function getOverTimeData(sessions, name) {
  const mine = sessions.filter((s) => s.name === name && s.date)
  const dayMap = {}

  for (const s of mine) {
    const key = toDay(s.date)
    if (!dayMap[key]) dayMap[key] = { date: key, minutes: 0, pages: 0, sessions: 0 }
    dayMap[key].minutes += s.minutesRead
    dayMap[key].pages += s.pagesRead
    dayMap[key].sessions++
  }

  return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))
}

export function getWrappedStats(sessions, participant, period) {
  const filtered =
    participant === 'Combined'
      ? filterByPeriod(sessions, period)
      : filterByPeriod(
          sessions.filter((s) => s.name === participant),
          period
        )

  const totalMinutes = filtered.reduce((a, s) => a + s.minutesRead, 0)
  const totalPages = filtered.reduce((a, s) => a + s.pagesRead, 0)
  const totalSessions = filtered.length
  const longestSession = filtered.reduce((a, s) => Math.max(a, s.minutesRead), 0)
  const completedBooks = countCompletedBooks(filtered)

  // Best day
  const dayMap = {}
  for (const s of filtered) {
    if (!s.date) continue
    const key = toDay(s.date)
    if (!dayMap[key]) dayMap[key] = { minutes: 0, pages: 0 }
    dayMap[key].minutes += s.minutesRead
    dayMap[key].pages += s.pagesRead
  }
  const dayValues = Object.values(dayMap)
  const bestDayMinutes = dayValues.reduce((a, d) => Math.max(a, d.minutes), 0)
  const bestDayPages = dayValues.reduce((a, d) => Math.max(a, d.pages), 0)

  // Longest streak
  const sortedDays = Object.keys(dayMap).sort()
  let longestStreak = 0
  let run = 0
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) {
      run = 1
    } else {
      const prev = new Date(sortedDays[i - 1])
      const curr = new Date(sortedDays[i])
      run = differenceInCalendarDays(curr, prev) === 1 ? run + 1 : 1
    }
    longestStreak = Math.max(longestStreak, run)
  }

  // Consistency %
  const allDates = filtered.map((s) => s.date).filter(Boolean)
  let consistencyPct = 0
  if (allDates.length > 0) {
    const first = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const span = differenceInCalendarDays(new Date(), first) + 1
    consistencyPct = Math.round((sortedDays.length / span) * 1000) / 10
  }

  // Favorite book (highest avgRating among books that have at least one rating)
  const bookMap = {}
  for (const s of filtered) {
    const key = s.bookTitle.toLowerCase()
    if (!bookMap[key]) bookMap[key] = { bookTitle: s.bookTitle, ratings: [], count: 0 }
    if (s.rating > 0) bookMap[key].ratings.push(s.rating)
    bookMap[key].count++
  }
  const favoriteBook = Object.values(bookMap)
    .filter((b) => b.count >= 1 && b.ratings.length > 0)
    .map((b) => ({
      bookTitle: b.bookTitle,
      avgRating: b.ratings.reduce((a, r) => a + r, 0) / b.ratings.length,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)[0]?.bookTitle ?? null

  // Top author
  const authorMap = {}
  for (const s of filtered) {
    authorMap[s.author] = (authorMap[s.author] ?? 0) + s.minutesRead
  }
  const topAuthor =
    Object.entries(authorMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Highlight stat
  const longDayCount = dayValues.filter((d) => d.minutes >= 180).length
  const highlightStat =
    longDayCount > 0
      ? `Read for 3+ hours on ${longDayCount} day${longDayCount > 1 ? 's' : ''}`
      : totalMinutes > 0
      ? `${Math.round(totalMinutes / 60 * 10) / 10} total hours read`
      : 'No reading data for this period'

  return {
    participant,
    period,
    totalMinutes,
    totalPages,
    totalSessions,
    completedBooks,
    longestSession,
    bestDayMinutes,
    bestDayPages,
    longestStreak,
    favoriteBook,
    topAuthor,
    consistencyPct,
    highlightStat,
  }
}

// ─── Books finished over time ─────────────────────────────────────────────────

// Cumulative count of a participant's completed books, keyed by the day each book
// was last read (its "finished" date). Mirrors computeCumulative in Analytics.jsx.
export function getFinishedBooksOverTime(sessions, name) {
  const books = getBooksByParticipant(sessions, name).filter(
    (b) => b.completed && b.lastRead
  )

  const dayMap = {}
  for (const b of books) {
    const key = toDay(b.lastRead)
    dayMap[key] = (dayMap[key] ?? 0) + 1
  }

  const days = Object.keys(dayMap).sort()
  let cumulative = 0
  return days.map((date) => {
    cumulative += dayMap[date]
    return { date, finished: dayMap[date], cumulative }
  })
}

// ─── Competitive splits / divisions ───────────────────────────────────────────

// The one hard-coded boundary: everything on or before Sept 2, 2026 is the
// "Summer Split". Months after this split by calendar month; Sept 2026 therefore
// starts Sept 3 so it doesn't overlap the Summer Split.
export const SUMMER_END = new Date(2026, 8, 2, 23, 59, 59, 999)

// Build the ordered list of selectable divisions from the data present.
// Each: { id, label, window: [start, end] | null }. window null === all-time.
export function getDivisions(sessions) {
  const dates = sessions.map((s) => s.date).filter(Boolean)
  const divisions = [{ id: 'lifetime', label: 'All-Time', window: null }]
  if (dates.length === 0) return divisions

  const earliest = new Date(Math.min(...dates.map((d) => d.getTime())))
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())))

  // Yearly divisions — one per calendar year present, newest first.
  const years = [...new Set(dates.map((d) => d.getFullYear()))].sort((a, b) => b - a)
  for (const y of years) {
    divisions.push({
      id: `year-${y}`,
      label: `Year ${y}`,
      window: [startOfYear(new Date(y, 0, 1)), endOfYear(new Date(y, 0, 1))],
    })
  }

  // Summer Split — earliest entry through the hard-coded boundary. Skip it
  // entirely when the earliest entry is already past the boundary (a fresh
  // post-summer dataset): otherwise the window would be inverted (start > end),
  // which date-fns silently reorders, crowning a bogus Summer Split champion.
  const summerStart = startOfDay(earliest)
  if (summerStart <= SUMMER_END) {
    divisions.push({
      id: 'summer',
      label: 'Summer Split',
      window: [summerStart, SUMMER_END],
    })
  }

  // Monthly divisions — newest first. Candidates are any month with entries after
  // the Summer Split, PLUS the current and previous calendar month (so recent
  // splits are always one click away even before data lands). A month that ends
  // on or before SUMMER_END is entirely inside the Summer Split and is skipped.
  const summerStartClamp = new Date(SUMMER_END.getTime() + 1) // Sept 3, 2026 00:00
  const now = new Date()
  const monthKeys = new Set()
  for (const d of dates) {
    if (d > SUMMER_END) monthKeys.add(format(d, 'yyyy-MM'))
  }
  monthKeys.add(format(now, 'yyyy-MM'))               // current month
  monthKeys.add(format(subMonths(now, 1), 'yyyy-MM')) // previous month
  const sortedMonths = [...monthKeys].sort().reverse()
  for (const key of sortedMonths) {
    const [y, m] = key.split('-').map(Number)
    const monthDate = new Date(y, m - 1, 1)
    const monthEnd = endOfMonth(monthDate)
    if (monthEnd <= SUMMER_END) continue // fully within the Summer Split
    const start = startOfMonth(monthDate)
    divisions.push({
      id: `month-${key}`,
      label: format(monthDate, 'MMM yyyy'),
      window: [start < summerStartClamp ? summerStartClamp : start, monthEnd],
    })
  }

  // Keep `latest` referenced so unused-var linters stay quiet; also handy for callers.
  void latest
  return divisions
}

// Restrict sessions to a division's window (all-time when window is null).
export function filterByDivision(sessions, division) {
  if (!division || !division.window) return sessions
  const [start, end] = division.window
  return sessions.filter(
    (s) => s.date && isWithinInterval(s.date, { start, end })
  )
}

// A division is "finished" once its window end is in the past.
export function isDivisionFinished(division, now = new Date()) {
  return !!(division && division.window && division.window[1] < now)
}

// The champion the top-of-page gold ribbon should celebrate: the most-recently
// finished calendar month, falling back to the Summer Split until the first
// month has finished. Yearly / all-time divisions are intentionally ignored so
// the ribbon always reflects "last month's winner" (or the Summer seed).
export function getRibbonChamp(sessions, now = new Date()) {
  const finished = getFinishedSplits(sessions, now)
  return (
    finished.find((f) => f.id.startsWith('month-')) ??
    finished.find((f) => f.id === 'summer') ??
    null
  )
}

// Every finished split with its Total-Minutes champion, newest-first. Divisions
// are already newest-first from getDivisions (barring the leading 'lifetime').
export function getFinishedSplits(sessions, now = new Date()) {
  return getDivisions(sessions)
    .filter((d) => isDivisionFinished(d, now))
    .map((d) => {
      const stats = getStatsByParticipant(filterByDivision(sessions, d))
      const ranked = Object.entries(stats)
        .map(([name, s]) => ({ name, totalMinutes: s.totalMinutes }))
        .sort((a, b) => b.totalMinutes - a.totalMinutes)
      const winner = ranked[0]
      return {
        id: d.id,
        label: d.label,
        winner: winner && winner.totalMinutes > 0 ? winner.name : null,
        totalMinutes: winner ? winner.totalMinutes : 0,
      }
    })
}
