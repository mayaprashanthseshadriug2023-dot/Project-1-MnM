// WAV encoding (A2 Algorithm 1, export): 16-bit PCM, every sample clamped to [-1, 1].

/** Clamp to [-1, 1], then scale to a 16-bit integer, so a loud mix clips instead of wrapping. */
export function toInt16(x: number): number {
  const s = Math.max(-1, Math.min(1, x))
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
}

function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}

/** Builds a WAV file: a 44-byte header, then the samples interleaved (L, R, L, R, ...). */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = channels.length
  const length = channels[0]?.length ?? 0
  const blockAlign = numChannels * 2                 // bytes per frame (2 bytes per sample)
  const dataSize = length * blockAlign

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // Header (all numbers little-endian)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)             // size of the rest of the file
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)                       // size of the fmt section
  view.setUint16(20, 1, true)                        // 1 = uncompressed PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)  // bytes per second
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)                       // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Samples
  let pos = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      view.setInt16(pos, toInt16(channels[ch][i]), true)
      pos += 2
    }
  }
  return buffer
}