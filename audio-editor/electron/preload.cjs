// The bridge between the page and Electron: only these operations are exposed, nothing else.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  readFile: (p) => ipcRenderer.invoke('fs:readFile', p),
  writeFile: (p, data) => ipcRenderer.invoke('fs:writeFile', p, data),
  exists: (p) => ipcRenderer.invoke('fs:exists', p),
  rename: (from, to) => ipcRenderer.invoke('fs:rename', from, to),
  remove: (p) => ipcRenderer.invoke('fs:remove', p),
  openDialog: (options) => ipcRenderer.invoke('dialog:open', options),
  saveDialog: (options) => ipcRenderer.invoke('dialog:save', options),
})