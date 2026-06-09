import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useStore from './store/useStore'
import Layout from './components/Layout'
import LoadData from './components/LoadData'
import Competition from './pages/Competition'
import Analytics from './pages/Analytics'
import Wrapped from './pages/Wrapped'

// Temporary debug hook — remove after verification
if (typeof window !== 'undefined') {
  import('./store/useStore').then((m) => {
    window.__STORE__ = m.default.getState
  })
}

const SHEETS_URL_PREFIX = 'https://docs.google.com/spreadsheets'

function Spinner({ className = '' }) {
  return (
    <div
      className={`border-4 border-slate-600 border-t-indigo-500 rounded-full animate-spin ${className}`}
    />
  )
}

// Full-screen state shown on launch while pulling fresh data from a saved URL.
function SyncingScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: '#0f172a' }}
    >
      <Spinner className="w-10 h-10" />
      <p className="text-slate-300 text-lg font-medium">Syncing from Google Sheets…</p>
    </div>
  )
}

// Brief neutral state while we check whether a URL is even saved (avoids
// flashing the "Syncing…" message when there is nothing to sync).
function CheckingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0f172a' }}
    >
      <Spinner className="w-8 h-8" />
    </div>
  )
}

function LoaderScreen({ bootError }) {
  const syncFromSheets = useStore((s) => s.syncFromSheets)

  const [url, setUrl] = useState('')
  const [validationError, setValidationError] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [connecting, setConnecting] = useState(false)

  async function handleConnect() {
    setValidationError(null)
    setFetchError(null)

    const trimmed = url.trim()
    if (!trimmed.startsWith(SHEETS_URL_PREFIX)) {
      setValidationError(`URL must start with ${SHEETS_URL_PREFIX}`)
      return
    }

    setConnecting(true)
    try {
      await window.electronAPI.setSheetsUrl(trimmed)
      // Populates sessions → routing auto-navigates to /competition.
      await syncFromSheets()
    } catch (err) {
      console.error(err)
      setFetchError(err?.message || 'Failed to load from Google Sheets.')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-4"
      style={{ backgroundColor: '#0f172a' }}
    >
      <h1 className="text-white text-4xl font-bold">Reading Log Dashboard</h1>

      {bootError && (
        <div className="w-full max-w-md rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
          <p className="text-red-300 text-sm text-center">{bootError}</p>
        </div>
      )}

      <div className="flex flex-col items-stretch gap-3 w-full max-w-md">
        <label htmlFor="sheets-url" className="text-slate-300 text-sm font-medium">
          Google Sheets published CSV URL
        </label>
        <input
          id="sheets-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !connecting) handleConnect()
          }}
          placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
          className="w-full px-4 py-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-600 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {connecting && <Spinner className="w-4 h-4 border-2" />}
          {connecting ? 'Connecting…' : 'Connect & Load'}
        </button>

        {validationError && <p className="text-red-400 text-sm">{validationError}</p>}
        {fetchError && <p className="text-red-400 text-sm">Error: {fetchError}</p>}
      </div>

      {/* Secondary fallback — local CSV file */}
      <div className="flex flex-col items-center gap-3 w-full max-w-md">
        <p className="text-slate-500 text-sm">Or load a local CSV file</p>
        <LoadData />
      </div>
    </div>
  )
}

export default function App() {
  const sessions = useStore((s) => s.sessions)
  const syncFromSheets = useStore((s) => s.syncFromSheets)
  const hasData = sessions.length > 0

  // 'checking' → looking up saved URL; 'syncing' → pulling data; 'ready' → routes.
  const [phase, setPhase] = useState('checking')
  const [bootError, setBootError] = useState(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const url = await window.electronAPI?.getSheetsUrl?.()
        if (cancelled) return

        if (url) {
          setPhase('syncing')
          await syncFromSheets()
          if (cancelled) return
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setBootError(
            'Could not load from Google Sheets. Please check your connection or reload manually.'
          )
        }
      } finally {
        if (!cancelled) setPhase('ready')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [syncFromSheets])

  if (phase === 'checking') return <CheckingScreen />
  if (phase === 'syncing') return <SyncingScreen />

  return (
    <Routes>
      <Route
        path="/"
        element={
          hasData ? <Navigate to="/competition" replace /> : <LoaderScreen bootError={bootError} />
        }
      />
      <Route element={hasData ? <Layout /> : <Navigate to="/" replace />}>
        <Route path="competition" element={<Competition />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="wrapped" element={<Wrapped />} />
      </Route>
    </Routes>
  )
}
