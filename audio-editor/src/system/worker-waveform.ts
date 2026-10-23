// Sends waveform jobs to the worker and returns each result as a Promise (A3 3.4).
// If the worker cannot run (e.g. blocked in some environments), falls back to the main thread.
import type { GenerateWaveform } from '../model/contracts'
import type { AudioData, Samples, WaveformCache } from '../model/types'
import { generateWaveform } from '../algorithms/waveform'

interface Job { buf: AudioData; windowSize: Samples; resolve: (cache: WaveformCache) => void }

export function createWorkerWaveform(): GenerateWaveform {
  let worker: Worker | null = null
  try {
    worker = new Worker(new URL('./waveform.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    worker = null
  }
  const pending = new Map<number, Job>()        // job id -> who is waiting
  let nextId = 0

  function fallBack() {                         // finish waiting jobs here, and stop using the worker
    worker?.terminate()
    worker = null
    for (const [id, job] of pending) {
      job.resolve(generateWaveform(job.buf, job.windowSize))
      pending.delete(id)
    }
  }

  if (worker) {
    worker.onmessage = (e: MessageEvent<{ id: number; cache: WaveformCache }>) => {
      pending.get(e.data.id)?.resolve(e.data.cache)
      pending.delete(e.data.id)
    }
    worker.onerror = fallBack
  }

  return (buf, windowSize) => {
    if (!worker) return generateWaveform(buf, windowSize)
    return new Promise(resolve => {
      const id = nextId++
      pending.set(id, { buf, windowSize, resolve })
      worker!.postMessage({ id, channels: buf.channels, windowSize })   // the samples are copied to the worker
    })
  }
}