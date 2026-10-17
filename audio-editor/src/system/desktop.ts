// Desktop version (Electron): real files on disk and native dialogs, through the bridge in electron/preload.cjs.
import type { FileSystem } from '../model/contracts'
import type { Result } from '../model/types'
import type { FilePicker, PickedFile } from './file-picker'

type Filters = { name: string; extensions: string[] }[]

export interface DesktopBridge {
  readFile(path: string): Promise<Result<ArrayBuffer>>
  writeFile(path: string, data: ArrayBuffer | string): Promise<Result>
  exists(path: string): Promise<boolean>
  rename(from: string, to: string): Promise<Result>
  remove(path: string): Promise<void>
  openDialog(options: { multiple: boolean; filters: Filters }): Promise<{ path: string; size: number }[]>
  saveDialog(options: { defaultPath: string; filters: Filters }): Promise<string | null>
}

declare global {
  interface Window { desktop?: DesktopBridge }    // present only when running inside Electron
}

export function createDesktopFs(d: DesktopBridge): FileSystem {
  return {
    readFile: (path) => d.readFile(path),
    writeFile: (path, data) => d.writeFile(path, data),
    exists: (path) => d.exists(path),
    rename: (from, to) => d.rename(from, to),
    remove: (path) => d.remove(path),
  }
}

const AUDIO: Filters = [{ name: 'Audio', extensions: ['wav', 'mp3'] }]
const PROJECT: Filters = [{ name: 'Project', extensions: ['json'] }]
const WAV: Filters = [{ name: 'WAV audio', extensions: ['wav'] }]

const toPicked = (f: { path: string; size: number }): PickedFile =>
  ({ path: f.path, name: f.path.split(/[\\/]/).pop() ?? f.path, sizeMB: f.size / 1048576 })

export function createDesktopPicker(d: DesktopBridge): FilePicker {
  return {
    async pickAudio(multiple) {
      return (await d.openDialog({ multiple, filters: AUDIO })).map(toPicked)
    },
    async pickProject() {
      const [file] = await d.openDialog({ multiple: false, filters: PROJECT })
      return file ? toPicked(file) : null
    },
    chooseSavePath: (suggested, kind) =>
      d.saveDialog({ defaultPath: suggested, filters: kind === 'project' ? PROJECT : WAV }),
  }
}