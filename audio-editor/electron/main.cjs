// Electron main process (A2, A3 Phase 6): opens the app window and gives the page real file access.
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 850,
    title: 'Multi-Track Audio Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,       // the page cannot reach Node.js directly, only through the bridge
      nodeIntegration: false,
    },
  })

  // Closing with unsaved changes asks first (A3 4.5)
  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Close without saving', 'Cancel'],
      defaultId: 1,
      message: 'You have unsaved changes. Close anyway?',
    })
    if (choice === 0) event.preventDefault()
  })

  win.loadURL(process.env.APP_URL ?? 'http://localhost:5173')
}

// Wraps a file operation so the page always gets { ok, value } or { ok: false, error }, like our Result type
const safe = (fn) => async (_event, ...args) => {
  try { return { ok: true, value: await fn(...args) } }
  catch (e) { return { ok: false, error: e.message } }
}

ipcMain.handle('fs:readFile', safe(async (p) => {
  const b = await fs.readFile(p)
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
}))
ipcMain.handle('fs:writeFile', safe(async (p, data) => {
  await fs.writeFile(p, typeof data === 'string' ? data : Buffer.from(data))
}))
ipcMain.handle('fs:exists', async (_event, p) => fs.access(p).then(() => true, () => false))
ipcMain.handle('fs:rename', safe((from, to) => fs.rename(from, to)))
ipcMain.handle('fs:remove', async (_event, p) => { await fs.rm(p, { force: true }) })

// Native Open and Save dialogs
ipcMain.handle('dialog:open', async (event, { multiple, filters }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win, {
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters,
  })
  if (result.canceled) return []
  return Promise.all(result.filePaths.map(async (p) => ({ path: p, size: (await fs.stat(p)).size })))
})
ipcMain.handle('dialog:save', async (event, { defaultPath, filters }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showSaveDialog(win, { defaultPath, filters })
  return result.canceled ? null : result.filePath
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())