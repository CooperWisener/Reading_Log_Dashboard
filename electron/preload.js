const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),

  // Google Sheets auto-pull
  getSheetsUrl: () => ipcRenderer.invoke('sheets:getUrl'),
  setSheetsUrl: (url) => ipcRenderer.invoke('sheets:setUrl', url),
  clearSheetsUrl: () => ipcRenderer.invoke('sheets:clearUrl'),
  fetchSheetsData: () => ipcRenderer.invoke('sheets:fetchData'),
})
