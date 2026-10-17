// Picking files to open and places to save: the browser and desktop versions differ, the UI does not.
import type { BrowserFileSystem } from './browser-fs'

export interface PickedFile { path: string; name: string; sizeMB: number }

export interface FilePicker {
  pickAudio(multiple: boolean): Promise<PickedFile[]>
  pickProject(): Promise<PickedFile | null>
  chooseSavePath(suggestedName: string, kind: 'project' | 'audio'): Promise<string | null>
}

/** Opens the browser's file chooser and returns the files picked ([] if cancelled). */
function chooseInBrowser(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.oncancel = () => resolve([])
    input.click()
  })
}

/** Browser version: picked files are copied into the in-memory file system; saving asks for a name. */
export function createBrowserPicker(fs: BrowserFileSystem): FilePicker {
  const register = async (f: File): Promise<PickedFile> =>
    ({ path: await fs.addFile(f), name: f.name, sizeMB: f.size / 1048576 })
  return {
    async pickAudio(multiple) {
      return Promise.all((await chooseInBrowser('.wav,.mp3,audio/*', multiple)).map(register))
    },
    async pickProject() {
      const [file] = await chooseInBrowser('.json,application/json', false)
      return file ? register(file) : null
    },
    async chooseSavePath(suggested, kind) {
      const ext = kind === 'project' ? '.json' : '.wav'
      const name = window.prompt(kind === 'project' ? 'Project name' : 'Export file name', suggested)?.trim()
      if (!name) return null
      return name.toLowerCase().endsWith(ext) ? name : name + ext
    },
  }
}