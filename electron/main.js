const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')
const { fetchSheetData } = require('../src/lib/fetchSheetData')

// Canonical dev/prod check: app.isPackaged is false only when running via
// `electron .` (dev), and true inside a packaged build — independent of NODE_ENV.
const isDev = !app.isPackaged

// Persistent settings (stored in userData). Only the published-CSV URL so far.
const store = new Store({
  schema: {
    sheetsUrl: { type: 'string', default: '' },
  },
})

const SHEETS_URL_PREFIX = 'https://docs.google.com/spreadsheets'

function createWindow() {
  // Window icon for dev (where build/ exists on disk). In a packaged build,
  // build/ is the buildResources dir and is excluded from the app, so this path
  // is absent and we fall back to the icon electron-builder embeds in the .exe
  // (which is what the Windows taskbar/title bar use anyway).
  const iconPath = path.join(app.getAppPath(), 'build', 'icon.png')

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Reading Log Dashboard',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Harden navigation: deny all window.open, and block renderer-initiated
  // navigation to anything but the app's own dev/prod origin.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
      event.preventDefault()
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    // In a packaged build, app.getAppPath() resolves to the asar root, where
    // the Vite output lives under dist/ (see "files" in package.json build).
    win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }
}

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
})

ipcMain.handle('file:read', async (_event, filePath) => {
  // Only used by the local-CSV picker (which already filters to .csv). Refuse
  // anything else so the renderer can't read arbitrary files off disk.
  if (typeof filePath !== 'string' || !filePath.toLowerCase().endsWith('.csv')) {
    throw new Error('Refused to read non-CSV file.')
  }
  return fs.readFileSync(filePath, 'utf-8')
})

// ─── Google Sheets persistence + fetch ───────────────────────────────────────

ipcMain.handle('sheets:getUrl', () => store.get('sheetsUrl'))

ipcMain.handle('sheets:setUrl', (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith(SHEETS_URL_PREFIX)) {
    throw new Error(`URL must start with ${SHEETS_URL_PREFIX}`)
  }
  store.set('sheetsUrl', url)
  return { success: true }
})

ipcMain.handle('sheets:clearUrl', () => {
  store.set('sheetsUrl', '')
  return { success: true }
})

ipcMain.handle('sheets:fetchData', async () => {
  const url = store.get('sheetsUrl')
  if (!url) throw new Error('No Google Sheets URL saved.')
  return fetchSheetData(url)
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
