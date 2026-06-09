# Reading Log Dashboard — CLAUDE.md
<!-- Max 200 lines. Keep concise. -->

## Project Overview
Electron + React + Vite desktop app for visualizing a group reading log exported from Google Forms as CSV.

## Stack
- Electron 42 (main process, IPC, file dialog)
- React 19 + Vite 8 (renderer)
- Tailwind CSS v3 + PostCSS
- Zustand 5 (global state)
- PapaParse 5 (CSV parsing)
- date-fns 4 (date parsing/math)
- react-router-dom 7 (HashRouter — required for Electron file:// in production)
- lucide-react (icons)
- Recharts (charts)
- electron-builder (production packaging)
- electron-store **8** (persistent settings; pinned to v8 — v9+ is ESM-only and can't be `require()`d from CommonJS main)
- concurrently + wait-on + cross-env (dev tooling)

## Scripts
| Command | Action |
|---------|--------|
| `npm run dev` | Vite + Electron concurrently (wait-on ensures Vite ready first) |
| `npm run build` | vite build → electron-builder |
| `npm run package` | `NODE_ENV=production vite build` → electron-builder → installer in `release/` |
| `npm run preview` | vite preview |

**Run dev:** type `! npm run dev` in the Claude Code prompt (needs interactive shell for Electron GUI).

## File Structure
```
Reading_Log_Dashboard/
├── electron/
│   ├── main.js        ← Electron entry; file + Sheets IPC; electron-store; isDev = !app.isPackaged
│   └── preload.js     ← contextBridge exposes window.electronAPI
├── src/
│   ├── App.jsx        ← Routes; startup auto-sync (checking→syncing→ready); loader w/ Sheets URL input
│   ├── main.jsx       ← React root; wraps with <HashRouter>
│   ├── index.css      ← Tailwind directives
│   ├── components/
│   │   ├── Layout.jsx          ← Sidebar (Refresh from Sheets / Change Source) + content loading overlay
│   │   ├── LoadData.jsx        ← "Load CSV File" fallback button; reused in loader screen
│   │   └── HeatmapCalendar.jsx ← GitHub-style 12-month contribution calendar (Phase 6)
│   ├── pages/
│   │   ├── Competition.jsx ← DONE (Phase 4): race + standings; single-participant fallback (Phase 9)
│   │   ├── Analytics.jsx   ← DONE (Phase 5A+6): selector, books, 4 chart sections
│   │   └── Wrapped.jsx     ← DONE (Phase 7): period/participant dropdowns, highlight + ranked stat cards
│   ├── lib/
│   │   ├── parseCSV.js        ← raw CSV string → normalized sessions (parseCSV + parseCSVFromString)
│   │   ├── fetchSheetData.js  ← MAIN-process CommonJS; fetch+validate published-CSV URL (Phase 10)
│   │   └── stats.js           ← Pure stat functions over sessions array
│   └── store/
│       └── useStore.js    ← Zustand store
├── build/                ← electron-builder icons (icon.png/.ico/.icns; placeholder, generated)
├── scripts/
│   └── generate-icons.cjs ← regenerates the placeholder icons (zero deps)
├── release/              ← electron-builder output (installer + win-unpacked); gitignore
├── example_csv/
│   └── reading_log.csv ← Real sample export; use to verify parsing/stats math
├── index.html          ← <title> Reading Log Dashboard
├── vite.config.js     ← base: './', port 5173
├── tailwind.config.js ← content: index.html + src/**
└── postcss.config.js
```

## Routing (App.jsx)
- **Startup (Phase 10):** App boots through phases `checking` (look up saved URL) → `syncing` ("Syncing from Google Sheets…" spinner, only if a URL is saved) → `ready`. On a saved URL it auto-fetches + parses + loads; on failure it falls through to the loader with an error banner.
- `sessions.length === 0` → loader screen: **Google Sheets published-CSV URL** input + "Connect & Load" (validates `https://docs.google.com/spreadsheets` prefix), plus "Or load a local CSV file" fallback (LoadData).
- `sessions.length > 0` → `<Layout />` shell with nested routes:
  - `/` or `/competition` → `<Competition />`
  - `/analytics` → `<Analytics />`
  - `/wrapped` → `<Wrapped />`
- Sidebar (Phase 10): **Refresh from Sheets** re-syncs in place (button spinner + "Last synced: [time]"); **Change Source** clears the saved URL, calls `resetState()`, and navigates back to the loader.

## CSV Schema (Google Form export)
Headers carry the full Form question text and vary. Real example file (`example_csv/reading_log.csv`):
`Timestamp, Date, Name, Book Title, Book Series (if applicable), Author, Time Read (in minutes, only input the number), Pages Read (only input the number), Rating`
**Do not match headers by exact string.** `parseCSV.js` resolves columns by normalized prefix matching (`FIELD_MATCHERS`) so instructional suffixes / trailing whitespace don't break parsing.

## Normalized Session Object (from parseCSV)
```js
{
  timestamp: string,
  date: Date,          // parsed via date-fns
  name: string,        // trimmed
  bookTitle: string,   // trimmed
  bookSeries: string,  // trimmed
  author: string,      // trimmed
  minutesRead: number,
  pagesRead: number,
  rating: number,
}
```

## Zustand Store (useStore.js)
| State | Type | Default |
|-------|------|---------|
| sessions | array | [] |
| selectedParticipants | string[] | [] |
| competitionMetric | string | 'totalMinutes' |
| wrappedPeriod | 'week'\|'month'\|'alltime' | 'alltime' |
| wrappedParticipant | string | 'Overall' |
| lastSynced | Date \| null | null |
| isLoading | boolean | false |

Actions: `loadSessions`, `setSelectedParticipants`, `setCompetitionMetric`, `setWrappedPeriod`, `setWrappedParticipant`, `setLastSynced`, `setLoading`, `resetState`, `syncFromSheets`
- `syncFromSheets()` (async): toggles `isLoading`, fetches via IPC, parses with `parseCSVFromString`, sets `sessions` + `lastSynced`. **Throws without mutating `sessions`** so a failed refresh leaves data intact. Shared by startup, loader, and sidebar refresh.
- `resetState()`: returns all state above to defaults (used by "Change Source").

## IPC Bridge (window.electronAPI)
| Method | IPC Channel | Returns |
|--------|-------------|---------|
| `openFileDialog()` | `dialog:openFile` | file path string \| null |
| `readFile(path)` | `file:read` | raw file content string |
| `getSheetsUrl()` | `sheets:getUrl` | saved URL string (`''` if none) |
| `setSheetsUrl(url)` | `sheets:setUrl` | `{ success }` — validates `docs.google.com/spreadsheets` prefix, else throws |
| `clearSheetsUrl()` | `sheets:clearUrl` | `{ success }` — added so "Change Source" can clear (setUrl rejects empty) |
| `fetchSheetsData()` | `sheets:fetchData` | raw CSV string from the stored URL |

**Architecture note:** renderer has `contextIsolation: true` / `nodeIntegration: false`. All Node.js file I/O + network fetch goes through IPC. The Sheets fetch runs in **main** (`src/lib/fetchSheetData.js`, CommonJS) — not the renderer — because Google's published-CSV endpoint sends no CORS headers, so a `file://` renderer fetch would be blocked. `parseCSV` / `parseCSVFromString` receive a content string from the renderer.

## Stats Functions (stats.js)
| Function | Returns |
|----------|---------|
| `getParticipants(sessions)` | sorted unique name array |
| `getStatsByParticipant(sessions)` | `{ name → { totalMinutes, totalPages, totalSessions, currentStreak, percentDaysRead } }` |
| `getBooksByParticipant(sessions, name)` | `[{ bookTitle, bookSeries, author, avgRating, sessionCount, totalMinutes, totalPages }]` |
| `getDayOfWeekData(sessions, name)` | 7-item array `{ day, sessions, minutes, pages }` |
| `getOverTimeData(sessions, name)` | daily grouped `{ date, minutes, pages, sessions }` |
| `getWrappedStats(sessions, participant, period)` | wrapped summary object |

`getWrappedStats` period values: `'week' | 'month' | 'alltime'`. Pass `'Overall'` as participant for all-participant view.

> Note: `currentStreak` is still computed here but is **no longer surfaced** on the Competition page (metric removed — see Phase 4 deviation below). Reserved for the Wrapped page.

## Phase Status
- [x] Phase 1 — Scaffold (Electron + React + Vite + Tailwind shell)
- [x] Phase 2 — Data Layer (parseCSV, stats, Zustand store, LoadData, IPC bridge)
- [x] Phase 3 — App Shell & Navigation (HashRouter, Layout sidebar, loader screen, 3 page placeholders)
- [x] Phase 4 — Competition Page (metric dropdown, animated race track, ranked standings)
- [x] Phase 5A — Analytics Part A (participant selector, Top-Rated Books, single/side-by-side layout)
- [x] Phase 6 — Analytics Part B (recharts; HeatmapCalendar.jsx + day-of-week / over-time / cumulative charts)
- [x] Phase 7 — Wrapped Page (period/participant dropdowns; highlight callout + stat cards; subtext = per-category rank)
- [x] Phase 8 — Packaging & Distribution (electron-builder NSIS/DMG; placeholder icons; signed installer)
- [x] Phase 9 — Polish, Edge Cases & QA (parse hardening, empty states, loading overlay, resetState, a11y)
- [x] Phase 10 — Auto-Pull from Google Sheets (electron-store URL; auto-sync on launch; refresh/change-source)

### Deviations from original plan (`prompting plan.md`)
- **Phase 4 — "Current Reading Streak (days)" metric removed** from the Competition dropdown per user request. Remaining metrics: Total Minutes, Total Pages, Total Sessions, % of Days Read. The `currentStreak` case was also dropped from `formatValue` in Competition.jsx.
- **Phase 6 — "Session Averages (7-day rolling)" chart replaced** with a **Cumulative Totals** chart (`CumulativeChart` + `computeCumulative` in Analytics.jsx). Shows running totals of minutes/pages/sessions over time, three toggleable series via checkboxes (Minutes + Pages on by default; Sessions off since it shares the Y-axis and is much smaller). The `computeRolling7` helper was removed.
- **Phase 7 — Wrapped stat-card subtext = ranking, not raw labels** (per user request). Each numeric card shows where the selection ranks among readers for that period (e.g. `🥇 1st of 5 readers`); "Overall" shows the category leader instead. `getWrappedStats` exposes only `favoriteBook`/`topAuthor` as strings and no best-day date, so those cards render the available value without author/stars/date.
- **Phase 8 — installer output is `release/`, not `dist/`** as the template said. Vite already builds the renderer into `dist/`; pointing electron-builder at the same dir makes it auto-exclude (or Vite wipe) the renderer. Icons are solid-indigo placeholders generated by `scripts/generate-icons.cjs`.
- **Phase 10 — `fetchSheetData.js` authored as CommonJS in `src/lib/`** (runs in main, never bundled by Vite) and explicitly added to electron-builder `files` so it ships in the asar. Pinned **electron-store v8** (v9+ ESM-only). Added a `clearSheetsUrl` channel beyond the prompt's three (Change Source needs to clear; `setSheetsUrl` rejects empty).
- **Phase 9 ⟂ Phase 10 ordering:** executed 7→8→10→9. Phase 9's "Reload Data" button no longer existed (Phase 10 renamed it), so its "clear all state" intent was wired into **Change Source** via `resetState()`.

## Resolved Issues
- **Minutes & Pages tracking (FIXED)** — root cause was a header-text mismatch, not type coercion. The real Google Form CSV (`example_csv/reading_log.csv`) carries the full question text as the header, including instructional suffixes:
  - `Time Read (in minutes, only input the number)` (schema assumed `Time Read (in minutes)`)
  - `Pages Read (only input the number)` (schema assumed `Pages Read`)
  - `Book Series (if applicable) ` also had trailing whitespace.
  - Exact-string lookups (`row['Pages Read']`) returned `undefined` → `toNum` → 0, zeroing every session.
  - **Fix:** `parseCSV.js` now resolves columns via normalized prefix/substring matching (`resolveHeaders` + `FIELD_MATCHERS`) instead of hardcoded keys, so it survives Form-question wording changes. Kept `transformHeader` trim + `toNum` from earlier. Verified: parser totals (4191 min / 3580 pages) match an independent raw-column sum of the example CSV. A `console.warn` fires if a numeric column ever fails to resolve.

## Key Decisions & Gotchas
- `postcss.config.js` uses ESM export but package.json has no `"type": "module"` → Node warns about re-parsing. Harmless; do not add `"type": "module"` as it would break `electron/main.js` (CommonJS require).
- `electron/main.js` and `electron/preload.js` must stay CommonJS (`require`/`module.exports`).
- `src/` files are ESM (Vite handles them).
- `HashRouter` is required (not `BrowserRouter`) — Electron loads `file://` in production; HTML5 history API breaks without a server.
- `window.__STORE__` debug hook is in App.jsx — remove before shipping.
- Date parsing tries multiple formats via date-fns `parse`; falls back to `new Date()`.
- `currentStreak` in `getStatsByParticipant` counts consecutive days ending on or before **today** (stops at first missing day going backward).
- `percentDaysRead` denominator is total span from **first log entry across all participants** to today.
- **parseCSV row hardening (Phase 9):** skips rows missing name/date/(blank) minutes with a `console.warn` count; clamps a present rating to 1–5 but **leaves `0` as the "unrated" sentinel** (`rating > 0` = has rating); `minutesRead`/`pagesRead` NaN → 0 via `toNum`.
- **Prod load path:** `electron/main.js` uses `isDev = !app.isPackaged` (not `NODE_ENV`); prod loads `path.join(app.getAppPath(), 'dist', 'index.html')` from the asar.
- **Window title** set both on `BrowserWindow({ title })` and `index.html <title>` (matching, so no override flicker).
- **Sheets URL must be the published-CSV link** (`…/pub?output=csv`), not the normal share link — only that returns raw CSV and passes `fetchSheetData`'s header validation (`Timestamp`/`Date`/`Name`).
- Active sidebar nav gets `aria-current="page"` automatically from react-router `NavLink`; selects carry explicit `aria-label`s (Phase 9 a11y).
