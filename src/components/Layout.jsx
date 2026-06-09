import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Home, BarChart2, Gift, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import useStore from '../store/useStore'

const navLinks = [
  { to: '/competition', label: 'Competition', icon: Home },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/wrapped', label: 'Wrapped', icon: Gift },
]

export default function Layout() {
  const navigate = useNavigate()
  const resetState = useStore((s) => s.resetState)
  const syncFromSheets = useStore((s) => s.syncFromSheets)
  const lastSynced = useStore((s) => s.lastSynced)
  const isLoading = useStore((s) => s.isLoading)

  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  async function handleRefresh() {
    setError(null)
    setRefreshing(true)
    try {
      // On failure this throws before mutating state, so current data survives.
      await syncFromSheets()
    } catch (err) {
      console.error(err)
      setError('Could not refresh from Google Sheets. Check your connection.')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleChangeSource() {
    try {
      await window.electronAPI.clearSheetsUrl()
    } catch (err) {
      console.error(err)
    }
    // Wipe sessions + selections + metric/period back to defaults; empty
    // sessions makes the routes fall back to the loader screen.
    resetState()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#0f172a' }}>
      <aside className="w-[220px] shrink-0 flex flex-col" style={{ backgroundColor: '#1e293b' }}>
        <div className="px-6 py-6">
          <span className="text-white font-bold text-base leading-tight">Reading Log Dashboard</span>
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-3">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 flex flex-col gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh from Sheets'}
          </button>

          {lastSynced && (
            <p className="text-slate-500 text-xs text-center">
              Last synced: {format(lastSynced, 'p')}
            </p>
          )}

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <button
            onClick={handleChangeSource}
            className="w-full px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            Change Source
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 relative" style={{ backgroundColor: '#0f172a' }}>
        {isLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}
            role="status"
            aria-live="polite"
            aria-label="Loading data"
          >
            <div className="w-10 h-10 border-4 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
