import Papa from 'papaparse'
import { parse, isValid } from 'date-fns'

const DATE_FORMATS = [
  'M/d/yyyy',
  'MM/dd/yyyy',
  'yyyy-MM-dd',
  'M/d/yyyy H:mm:ss',
  'MM/dd/yyyy H:mm:ss',
]

function parseDate(raw) {
  if (!raw) return null
  const str = raw.trim()
  for (const fmt of DATE_FORMATS) {
    const d = parse(str, fmt, new Date())
    if (isValid(d)) return d
  }
  const fallback = new Date(str)
  return isValid(fallback) ? fallback : null
}

// Strips whitespace and thousand-separator commas, then coerces to a finite number.
function toNum(val) {
  const n = parseFloat(String(val ?? '').trim().replace(/,/g, ''))
  return isFinite(n) ? n : 0
}

// Interprets a "completed" cell as a boolean. Google Sheets checkboxes export as
// TRUE/FALSE, but a hand-typed checkmark column might hold "yes", "x", "✓", "1",
// etc. Anything truthy-looking counts as completed; blank / FALSE → false.
const TRUTHY = new Set(['true', 'yes', 'y', 'x', '✓', '1', 'done', 'complete', 'completed'])
function toBool(val) {
  return TRUTHY.has(String(val ?? '').trim().toLowerCase())
}

// ─── Flexible header resolution ───────────────────────────────────────────────
// Google Form column headers carry the full question text, which often includes
// instructional suffixes (e.g. "Time Read (in minutes, only input the number)").
// Match each logical field by a normalized substring so the parser survives
// wording tweaks instead of relying on brittle exact strings.

const norm = (s) => String(s ?? '').toLowerCase().trim()

// Order matters: more specific matchers first so generic ones don't steal a column.
const FIELD_MATCHERS = [
  ['timestamp', (k) => k.startsWith('timestamp')],
  ['date', (k) => k === 'date' || (k.startsWith('date') && !k.includes('time'))],
  ['name', (k) => k === 'name' || k.startsWith('name')],
  ['bookTitle', (k) => k.startsWith('book title') || k.startsWith('title')],
  ['bookSeries', (k) => k.startsWith('book series') || k.startsWith('series')],
  ['author', (k) => k.startsWith('author')],
  ['minutesRead', (k) => k.startsWith('time read') || k.includes('minute')],
  ['pagesRead', (k) => k.startsWith('pages read') || k.includes('page')],
  ['rating', (k) => k.startsWith('rating')],
  ['completed', (k) => k.startsWith('complete') || k.includes('finish') || k.includes('done')],
]

// Build { field → actualHeaderKey } from the parsed header list.
function resolveHeaders(headers) {
  const map = {}
  const taken = new Set()
  for (const [field, matches] of FIELD_MATCHERS) {
    const found = headers.find((h) => !taken.has(h) && matches(norm(h)))
    if (found) {
      map[field] = found
      taken.add(found)
    }
  }
  return map
}

// Accepts raw CSV file content string (reading is done via IPC in the main process)
export function parseCSV(fileContent) {

  const { data, errors, meta } = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  if (errors.length) {
    console.warn('PapaParse warnings:', errors)
  }

  const headers = meta?.fields ?? (data[0] ? Object.keys(data[0]) : [])
  const col = resolveHeaders(headers)

  // Warn loudly if a numeric column never resolved — the most common cause of
  // zeroed-out stats. Helps diagnose unexpected CSV exports.
  for (const field of ['minutesRead', 'pagesRead']) {
    if (!col[field]) {
      console.warn(
        `parseCSV: could not match a column for "${field}". Headers seen:`,
        headers
      )
    }
  }

  const get = (row, field) => (col[field] ? row[col[field]] : undefined)

  const isBlank = (v) => v == null || String(v).trim() === ''

  const out = []
  let skipped = 0

  for (const row of data) {
    const name = get(row, 'name')?.trim() ?? ''
    const date = parseDate(get(row, 'date'))
    const rawMinutes = get(row, 'minutesRead')

    // Skip incomplete rows: a log entry needs at minimum who read, when, and
    // how long. toNum() below already coerces NaN → 0, so this guards the
    // *missing*-cell case (a blank minutes cell is a different problem than a
    // garbage one, which we keep as 0).
    if (!name || !date || isBlank(rawMinutes)) {
      skipped++
      continue
    }

    // Clamp a real rating into 1–5; leave 0 as the "unrated" sentinel that the
    // rest of the app already relies on (rating > 0 === has a rating).
    let rating = toNum(get(row, 'rating'))
    rating = rating > 0 ? Math.min(5, Math.max(1, rating)) : 0

    out.push({
      timestamp: get(row, 'timestamp')?.trim() ?? '',
      date,
      name,
      bookTitle: get(row, 'bookTitle')?.trim() ?? '',
      bookSeries: get(row, 'bookSeries')?.trim() ?? '',
      author: get(row, 'author')?.trim() ?? '',
      minutesRead: toNum(rawMinutes), // NaN → 0
      pagesRead: toNum(get(row, 'pagesRead')), // NaN → 0
      rating,
      completed: toBool(get(row, 'completed')), // absent column → false
    })
  }

  if (skipped > 0) {
    console.warn(`parseCSV: skipped ${skipped} row(s) missing name, date, or minutes.`)
  }

  return out
}

// Parse a raw CSV *string* (e.g. fetched from a published Google Sheets URL).
// parseCSV already operates on file *content* (a string), so normalization is
// shared verbatim — this is a named alias for call-site clarity at the fetch
// path, without touching the existing file-based parser.
export function parseCSVFromString(csvString) {
  return parseCSV(csvString)
}
