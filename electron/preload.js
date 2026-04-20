const { contextBridge, ipcRenderer } = require('electron')

// On expose l'objet electronAPI au monde "renderer" (votre app web)
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data) => ipcRenderer.invoke('file:save', data),
  saveFileAs: (data) => ipcRenderer.invoke('file:saveAs', data),
  setWindowModified: (isModified) => ipcRenderer.send('window:setModified', isModified),
  onMenuAction: (callback) => ipcRenderer.on('menu:action', (_event, value) => callback(value)),
  // Comfirmation close
  onBeforeClose: (callback) => ipcRenderer.on('window:close-request', () => callback()),
  confirmClose: (ok) => ipcRenderer.send('window:confirm-close', ok)
})

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
})
