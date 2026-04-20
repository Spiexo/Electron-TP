const { app, BrowserWindow, ipcMain, dialog, Menu, Notification, Tray, nativeImage } = require('electron')
const fs = require('node:fs/promises')

const path = require('node:path')

let tray = null

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // En développement, on charge l'URL du serveur Vite
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../app/dist/index.html'))
  }

  // F10 : Confirmation de fermeture si non sauvegardé
  let isQuitting = false
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.webContents.send('window:close-request')
    }
  })

  ipcMain.on('window:confirm-close', (e, ok) => {
    if (ok) {
      isQuitting = true
      win.close()
    }
  })
}

app.whenReady().then(() => {
  // Handler pour ouvrir un fichier
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    })
    if (!canceled) {
      const content = await fs.readFile(filePaths[0], 'utf8')
      return { path: filePaths[0], content }
    }
  })

  // Handler pour enregistrer
  ipcMain.handle('file:save', async (event, { path, content }) => {
    await fs.writeFile(path, content, 'utf8')
    
    // F11 : Notification OS
    new Notification({
      title: 'Markdownitor',
      body: `Fichier enregistré : ${path.split(/[\\/]/).pop()}`,
      silent: false
    }).show()

    return { success: true }
  })

  // Handler pour "Enregistrer sous"
  ipcMain.handle('file:saveAs', async (event, { content }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (!canceled) {
      await fs.writeFile(filePath, content, 'utf8')

      // F11 : Notification OS
      new Notification({
        title: 'Markdownitor',
        body: `Fichier créé : ${filePath.split(/[\\/]/).pop()}`
      }).show()

      return { path: filePath }
    }
  })

  // Changement d'état "modifié" (MacOS principalement)
  ipcMain.on('window:setModified', (event, isModified) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.setDocumentEdited(isModified)
  })

  createWindow()
  createMenu()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

function createTray() {
  // On crée une icône simple (un petit carré blanc) si le fichier n'existe pas
  // Pour le TP, utilisez idéalement une image .png ou .ico
  const iconPath = path.join(__dirname, 'icon.png') 
  const icon = nativeImage.createFromPath(iconPath)
  
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Ouvrir Markdownitor', click: () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          if (win.isMinimized()) win.restore()
          win.show()
          win.focus()
        }
    }},
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() }
  ])
  
  tray.setToolTip('Markdownitor')
  tray.setContextMenu(contextMenu)

  // Double-clic sur l'icône pour restaurer
  tray.on('double-click', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
    }
  })
}

// F9 Menu natif
function createMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        { label: 'Ouvrir', accelerator: 'CmdOrCtrl+O', click: (menuItem, browserWindow) => browserWindow.webContents.send('menu:action', 'open') },
        { label: 'Enregistrer', accelerator: 'CmdOrCtrl+S', click: (menuItem, browserWindow) => browserWindow.webContents.send('menu:action', 'save') },
        { label: 'Enregistrer sous...', accelerator: 'CmdOrCtrl+Shift+S', click: (menuItem, browserWindow) => browserWindow.webContents.send('menu:action', 'save-as') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

