// Sends waveform jobs to the worker and returns each result as a Promise.
import type { GenerateWaveform } from '../model/contracts'
import type { WaveformCache } from '../model/types'

export function createWorkerWaveform(): GenerateWaveform {
  const worker = new Worker(new URL('./waveform.worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, (cache: WaveformCache) => void>()   // job id -> who is waiting
  let nextId = 0

  worker.onmessage = (e: MessageEvent<{ id: number; cache: WaveformCache }>) => {
    pending.get(e.data.id)?.(e.data.cache)
    pending.delete(e.data.id)
  }

  return (buf, windowSize) => new Promise(resolve => {
    const id = nextId++
    pending.set(id, resolve)
    worker.postMessage({ id, channels: buf.channels, windowSize })   // the samples are copied to the worker
  })
}