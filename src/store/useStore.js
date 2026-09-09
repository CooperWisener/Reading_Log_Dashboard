import { create } from 'zustand'
import { parseCSVFromString } from '../lib/parseCSV'

// Default values, also used by resetState() to return to a pristine state.
const DEFAULTS = {
  sessions: [],
  selectedParticipants: [],
  competitionMetric: 'totalMinutes',
  competitionYear: null,
  competitionMonth: null,
  wrappedPeriod: 'alltime',
  wrappedParticipant: 'Combined',
  lastSynced: null,
  isLoading: false,
}

const useStore = create((set) => ({
  ...DEFAULTS,

  loadSessions: (sessions) => set({ sessions }),

  setLastSynced: (date) => set({ lastSynced: date }),

  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),

  // Wipe all state back to defaults (used by the sidebar's "Change Source"
  // before returning to the loader screen).
  resetState: () => set({ ...DEFAULTS }),

  // Pull the saved published-CSV URL via IPC, parse, and load into state.
  // Shared by startup auto-sync, the loader "Connect & Load", and the sidebar
  // "Refresh from Sheets". On failure it throws WITHOUT mutating sessions, so a
  // failed refresh leaves existing data intact. Returns the parsed sessions.
  syncFromSheets: async () => {
    set({ isLoading: true })
    try {
      const csv = await window.electronAPI.fetchSheetsData()
      const sessions = parseCSVFromString(csv)
      set({ sessions, lastSynced: new Date() })
      return sessions
    } finally {
      set({ isLoading: false })
    }
  },

  setSelectedParticipants: (names) => set({ selectedParticipants: names }),

  setCompetitionMetric: (metric) => set({ competitionMetric: metric }),

  setCompetitionYear: (year) => set({ competitionYear: year }),

  setCompetitionMonth: (month) => set({ competitionMonth: month }),

  setWrappedPeriod: (period) => set({ wrappedPeriod: period }),

  setWrappedParticipant: (name) => set({ wrappedParticipant: name }),
}))

export default useStore
