/** Samples -> "mm:ss.mmm" for display (A3 4.7). */
export function formatTime(samples: number, sampleRate: number): string {
  const totalMs = Math.round((samples / sampleRate) * 1000)
  const m = Math.floor(totalMs / 60000)
  const s = Math.floor(totalMs / 1000) % 60
  const ms = totalMs % 1000
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}