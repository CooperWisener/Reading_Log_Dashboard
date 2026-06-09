/*
 * Runs in the Electron MAIN process (Node), invoked by the 'sheets:fetchData'
 * IPC handler — it is NEVER bundled into the Vite renderer. Fetching here (not
 * in the renderer) sidesteps CORS: Google's published-CSV endpoint sends no
 * Access-Control-Allow-Origin header, so a renderer fetch from file:// would be
 * blocked in the packaged app.
 *
 * Authored as CommonJS so main.js can require() it directly and so it loads
 * correctly from inside the asar. (See "files" in package.json — this single
 * src/ file is explicitly included in the package.)
 */

const REQUIRED_HEADERS = ['timestamp', 'date', 'name']

async function fetchSheetData(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('No Google Sheets URL configured.')
  }
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is unavailable in this runtime.')
  }

  let res
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    })
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'request timed out' : err?.message
    throw new Error(`Network error while fetching Google Sheets: ${reason}`)
  }

  if (!res.ok) {
    throw new Error(`Google Sheets returned HTTP ${res.status} ${res.statusText}.`)
  }

  const text = await res.text()

  // Validate it actually looks like the reading-log CSV. A wrong/unpublished
  // URL typically returns an HTML sign-in page, which would otherwise parse into
  // garbage sessions.
  const firstLine = (text.split(/\r?\n/, 1)[0] || '').toLowerCase()
  const missing = REQUIRED_HEADERS.filter((h) => !firstLine.includes(h))
  if (missing.length > 0) {
    throw new Error(
      `Response does not look like the expected reading-log CSV ` +
        `(missing header${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}). ` +
        `Make sure the sheet is published to the web as CSV.`
    )
  }

  return text
}

module.exports = { fetchSheetData }
