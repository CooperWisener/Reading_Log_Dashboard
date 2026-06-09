import { useState } from 'react'
import { parseCSV } from '../lib/parseCSV'
import useStore from '../store/useStore'

export default function LoadData() {
  const loadSessions = useStore((s) => s.loadSessions)
  const setLoading = useStore((s) => s.setLoading)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  async function handleLoad() {
    setError(null)
    setStatus(null)
    try {
      const filePath = await window.electronAPI.openFileDialog()
      if (!filePath) return

      setLoading(true)
      const content = await window.electronAPI.readFile(filePath)
      const sessions = parseCSV(content)
      loadSessions(sessions)
      setStatus(`${sessions.length} sessions loaded`)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleLoad}
        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
      >
        Load CSV File
      </button>
      {status && <p className="text-green-400 text-sm">{status}</p>}
      {error && <p className="text-red-400 text-sm">Error: {error}</p>}
    </div>
  )
}
