// File access for the browser version (until Electron, A3 Phase 6): files the user picks are kept
// in memory; a finished save or export is downloaded.
import type { FileSystem } from '../model/contracts'
import { ok, err } from '../model/types'

export interface BrowserFileSystem extends FileSystem {
  addFile(file: File): Promise<string>     // a file the user picked; returns its name to use as a path
}

function download(name: string, data: ArrayBuffer | string): void {
  const url = URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function createBrowserFs(): BrowserFileSystem {
  const files = new Map<string, ArrayBuffer | string>()
  return {
    async addFile(file) {
      files.set(file.name, await file.arrayBuffer())
      return file.name
    },
    async readFile(path) {
      const data = files.get(path)
      if (data === undefined) return err(`File not found: ${path}`)
      return ok(typeof data === 'string' ? new TextEncoder().encode(data).buffer as ArrayBuffer : data)
    },
    async writeFile(path, data) {
      files.set(path, data)
      return ok(undefined)
    },
    async exists(path) {
      return files.has(path)
    },
    async rename(from, to) {
      const data = files.get(from)
      if (data === undefined) return err(`File not found: ${from}`)
      files.delete(from)
      files.set(to, data)
      download(to, data)            // save and export both end with a rename, so this is the finished file
      return ok(undefined)
    },
    async remove(path) {
      files.delete(path)
    },
  }
}