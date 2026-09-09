import { useMemo } from 'react'
import useStore from '../store/useStore'
import { getFinishedSplits } from '../lib/stats'

// Minutes → "Hh Mm" (matches the Competition/Wrapped formatting).
function formatHM(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function Winners() {
  const sessions = useStore((s) => s.sessions)
  const finishedSplits = useMemo(() => getFinishedSplits(sessions), [sessions])

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-white text-3xl font-bold mb-6">Winners</h1>

      {finishedSplits.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ backgroundColor: '#1e293b' }}>
          <p className="text-5xl mb-4">🏆</p>
          <p className="text-white text-lg font-semibold">No splits have finished yet.</p>
          <p className="text-slate-400 text-sm mt-1">
            Champions appear here once a competition window has fully passed.
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-white font-semibold text-lg">Past Winners</h2>
            <p className="text-slate-500 text-xs mt-0.5">Champion by total minutes read</p>
          </div>
          <div>
            {finishedSplits.map((split) => (
              <div
                key={split.id}
                className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-700/50 last:border-0"
              >
                <span className="text-slate-300 text-sm font-medium">{split.label}</span>
                {split.winner ? (
                  <span className="text-sm font-semibold text-amber-300">
                    🏆 {split.winner}
                    <span className="text-slate-500 font-normal">
                      {' '}({formatHM(split.totalMinutes)})
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-600 text-sm">No entries</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
