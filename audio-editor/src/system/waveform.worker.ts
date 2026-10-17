// Runs Algorithm 2 on a separate thread, so the page stays responsive while long files load (A3 3.4).
import { generateWaveform } from '../algorithms/waveform'
import { createAudioData } from '../model/project'

interface Job { id: number; channels: Float32Array[]; windowSize: number }

self.onmessage = (e: MessageEvent<Job>) => {
  const { id, channels, windowSize } = e.data
  const cache = generateWaveform(createAudioData('', channels, 0), windowSize)   // the same tested function
  self.postMessage({ id, cache })
}