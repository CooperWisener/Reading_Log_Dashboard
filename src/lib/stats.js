import {
  startOfDay,
  differenceInCalendarDays,
  format,
  isWithinInterval,
  subDays,
  subWeeks,
  subMonths,
  parseISO,
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
      }
    }
    const b = bookMap[key]
    if (s.rating > 0) b.ratings.push(s.rating)
    b.sessionCount++
    b.totalMinutes += s.minutesRead
    b.totalPages += s.pagesRead
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
  }))
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
    participant === 'Overall'
      ? filterByPeriod(sessions, period)
      : filterByPeriod(
          sessions.filter((s) => s.name === participant),
          period
        )

  const totalMinutes = filtered.reduce((a, s) => a + s.minutesRead, 0)
  const totalPages = filtered.reduce((a, s) => a + s.pagesRead, 0)
  const totalSessions = filtered.length
  const longestSession = filtered.reduce((a, s) => Math.max(a, s.minutesRead), 0)

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
