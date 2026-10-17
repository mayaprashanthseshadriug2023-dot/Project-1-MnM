// Waveform Analysis (A2 Algorithm 2): peak and RMS per window of w samples, for display only.
import type { AudioData, Samples, WaveformCache } from '../model/types'

export function generateWaveform(buf: AudioData, windowSize: Samples): WaveformCache {
  const n = buf.length
  const points = Math.ceil(n / windowSize)
  const peak = new Float32Array(points)
  const rms = new Float32Array(points)

  for (let i = 0; i < points; i++) {
    const from = i * windowSize
    const to = Math.min(from + windowSize, n)        // the last window may be shorter
    let max = 0
    let sumSquares = 0
    for (const channel of buf.channels) {
      for (let j = from; j < to; j++) {
        const x = channel[j]
        if (Math.abs(x) > max) max = Math.abs(x)
        sumSquares += x * x
      }
    }
    peak[i] = max                                                   // loudest sample in the window
    rms[i] = Math.sqrt(sumSquares / ((to - from) * buf.channels.length))  // average loudness
  }
  return { windowSize, peak, rms }
}

/** The waveform points a clip should draw: only the windows inside its offset and duration. */
export function waveformRange(cache: WaveformCache, offset: Samples, duration: Samples): [number, number] {
  const first = Math.floor(offset / cache.windowSize)
  const last = Math.min(Math.ceil((offset + duration) / cache.windowSize), cache.peak.length)
  return [first, last]
}