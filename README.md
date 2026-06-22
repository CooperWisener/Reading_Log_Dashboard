<p align="center">
  <img src="RLA_icon.png" alt="Reading Log Dashboard logo" width="110" />
</p>

# Reading Log Dashboard

> A desktop app that turns a group's Google Form reading log into a competition, analytics, and a Spotify-Wrapped-style highlight reel.

[![Build status](https://github.com/CooperWisener/Reading_Log_Dashboard/actions/workflows/build-mac.yml/badge.svg)](https://github.com/CooperWisener/Reading_Log_Dashboard/actions/workflows/build-mac.yml)

---

Reading Log Dashboard is an Electron desktop app for visualizing a shared reading log. A group logs their reading through a Google Form; the app pulls that data (live from a published Google Sheet, or from a CSV file) and renders three views: a head-to-head **Competition**, per-reader **Analytics**, and a personal **Wrapped** summary.

## Features

### 🏁 Competition
A head-to-head view of everyone in the log. On load, each participant races down a track to their proportional finish, settling into a ranked standings table. Switch the metric from a dropdown to re-run the race:

- Total Minutes Read
- Total Pages Read
- Total Sessions
- % of Days Read (unique days read ÷ days since the first log entry)

### 📊 Analytics
A detailed breakdown per reader — view one participant or several side-by-side:

- **Top-Rated Books** — averaged across all logged sessions, shown with star ratings
- **Reading Heatmap** — a GitHub-style 12-month contribution calendar colored by minutes read per day
- **Days of the Week** — bar chart, toggle between sessions / minutes / pages
- **Progress Over Time** — line chart with toggleable minutes / pages / sessions series
- **Cumulative Totals** — running totals over time

### 🎁 Wrapped
A highlight-reel summary for **This Week / This Month / All Time**, per participant or **Overall**: total minutes, pages, and sessions, longest single session, best single day, longest streak, favorite book, top author, reading consistency, and a generated headline stat (e.g. *"Read for 3+ hours on 4 days"*). Each numeric card shows where you rank against the other readers.

## Download & Install

Grab the latest installer from the **[Releases page](https://github.com/CooperWisener/Reading_Log_Dashboard/releases/latest)**:

| Platform | File |
|----------|------|
| **Windows** | `Reading Log Dashboard Setup x.y.z.exe` (NSIS installer) |
| **macOS** | `Reading Log Dashboard-x.y.z.dmg` (universal — Apple Silicon + Intel) |

The installers are **unsigned** (this is a personal project, not a commercially code-signed app), so your OS will warn you the first time:

- **Windows:** SmartScreen shows *"Windows protected your PC"* → click **More info → Run anyway**.
- **macOS:** Gatekeeper blocks a double-click → **right-click the app → Open → Open** (one time only).

## Setting up your data

The app starts empty and asks for a data source. You have two options.

### Option A — Live from Google Sheets (recommended)

The app pulls fresh data from a **published** Google Sheet every launch, with a manual **Refresh from Sheets** button in the sidebar.

1. Open your reading-log Google Sheet (the one your Form responses feed into).
2. **File → Share → Publish to web**.
3. Choose the response sheet, set the format to **Comma-separated values (.csv)**, and click **Publish**.
4. Copy the generated URL — it looks like `https://docs.google.com/spreadsheets/d/e/…/pub?output=csv`.
5. In the app, paste it into **"Google Sheets published CSV URL"** and click **Connect & Load**.

The URL is saved locally, so every future launch auto-syncs. Use **Change Source** in the sidebar to switch sheets.

> ⚠️ It must be the **Publish to web → CSV** link, not the normal "Share" link — only the published one returns raw CSV.

### Option B — Local CSV file

On the loader screen, click **"Or load a local CSV file"** and pick a `.csv` export. A sample is included at [`example_csv/reading_log.csv`](example_csv/reading_log.csv).

### Expected columns

The parser matches columns by normalized prefix, so the full Google Form question text (with instructional suffixes and stray whitespace) works fine.

| Column | Notes |
|--------|-------|
| Timestamp | Form submission datetime |
| Date | Date of the reading session |
| Name | Participant name |
| Book Title | |
| Book Series (if applicable) | Optional |
| Author | |
| Time Read (in minutes) | Numeric |
| Pages Read | Numeric |
| Rating | 1–5 per session (averaged per book for display) |

Rows missing a Name, Date, or minutes are skipped; ratings outside 1–5 are clamped.

## Running from source

Requires **Node.js 20+**.

```bash
git clone https://github.com/CooperWisener/Reading_Log_Dashboard.git
cd Reading_Log_Dashboard
npm install
npm run dev      # Vite + Electron, hot-reloading dev build
```

## Building installers

```bash
npm run package  # builds the renderer, then an installer for your current OS → release/
```

electron-builder only builds for the OS it runs on (you can't build a `.dmg` on Windows). To build both platforms, this repo includes a **GitHub Actions** workflow (`.github/workflows/build-mac.yml`) that builds the macOS `.dmg` and Windows `.exe` on cloud runners. Push a version tag to publish both to a Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Tech stack

- **[Electron](https://www.electronjs.org/)** — desktop shell, IPC, native file dialog
- **[React](https://react.dev/) + [Vite](https://vite.dev/)** — renderer UI
- **[Tailwind CSS](https://tailwindcss.com/)** — styling
- **[Zustand](https://zustand-demo.pmnd.rs/)** — state management
- **[Recharts](https://recharts.org/)** — charts
- **[PapaParse](https://www.papaparse.com/)** — CSV parsing · **[date-fns](https://date-fns.org/)** — dates
- **[electron-store](https://github.com/sindresorhus/electron-store)** — persisted settings · **[electron-builder](https://www.electron.build/)** — packaging

## Project structure

```
electron/        Main process — IPC handlers, Google Sheets fetch, electron-store
src/
  pages/         Competition, Analytics, Wrapped
  components/    Layout (sidebar), LoadData, HeatmapCalendar
  lib/           parseCSV, fetchSheetData, stats (pure stat functions)
  store/         Zustand store
build/           App icon (icon.png) → platform icons generated at package time
example_csv/     Sample reading log for testing
```

## License

ISC
