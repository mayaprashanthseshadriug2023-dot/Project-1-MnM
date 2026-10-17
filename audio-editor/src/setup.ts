// Composition root: the one place where real modules are plugged into the Project Controller.
// Tests plug in fakes instead; nothing else in the app needs to know which is which.
import { ProjectController } from './core/controller'
import { Playback } from './core/playback'
import { generateWaveform } from './algorithms/waveform'
import { createAudioIO } from './system/audio-io'
import { createBrowserFs } from './system/browser-fs'
import { renderMix } from './system/mixer'
import { createWebAudioOutput } from './system/web-audio-output'

export function createApp() {
  const fs = createBrowserFs()
  const controller = new ProjectController({
    fs,
    io: createAudioIO(),
    waveform: generateWaveform,
    playback: new Playback(createWebAudioOutput()),
    renderMix,
  })
  return { controller, fs }
}