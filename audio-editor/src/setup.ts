// Composition root: the one place where real modules are plugged into the Project Controller.
// Inside Electron it uses real files and native dialogs; in a browser, in-memory files and downloads.
import { ProjectController } from './core/controller'
import { Playback } from './core/playback'
import type { FileSystem } from './model/contracts'
import { generateWaveform } from './algorithms/waveform'
import { createAudioIO } from './system/audio-io'
import { createBrowserFs } from './system/browser-fs'
import { createDesktopFs, createDesktopPicker } from './system/desktop'
import { createBrowserPicker, type FilePicker } from './system/file-picker'
import { renderMix } from './system/mixer'
import { createWebAudioOutput } from './system/web-audio-output'
import { createWorkerWaveform } from './system/worker-waveform'

export function createApp() {
  let fs: FileSystem
  let files: FilePicker
  if (window.desktop) {
    fs = createDesktopFs(window.desktop)
    files = createDesktopPicker(window.desktop)
  } else {
    const browserFs = createBrowserFs()
    fs = browserFs
    files = createBrowserPicker(browserFs)
  }

  const controller = new ProjectController({
    fs,
    io: createAudioIO(),
    waveform: typeof Worker !== 'undefined' ? createWorkerWaveform() : generateWaveform,
    playback: new Playback(createWebAudioOutput()),
    renderMix,
  })
  return { controller, files }
}