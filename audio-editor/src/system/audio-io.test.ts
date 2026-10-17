import { describe, it, expect } from 'vitest'
import { createAudioIO, type Decoder } from './audio-io'

// A fake browser decoder: "decodes" into fixed samples, or fails like a real one would.
function fakeDecoder(channels: Float32Array[] | 'fail'): () => Decoder {
  return () => ({
    async decodeAudioData() {
      if (channels === 'fail') throw new Error('EncodingError')
      return { numberOfChannels: channels.length, getChannelData: (ch: number) => channels[ch] }
    },
  })
}

describe('AudioIO.decode (FR1, ER1)', () => {
  it('turns decoded audio into an AudioData buffer', async () => {
    const left = new Float32Array([0.1, 0.2, 0.3])
    const right = new Float32Array([0.4, 0.5, 0.6])
    const io = createAudioIO(fakeDecoder([left, right]))
    const result = await io.decode('song.wav', new ArrayBuffer(8), 44100)
    if (!result.ok) throw new Error(result.error)
    expect(result.value).toMatchObject({ id: 'song.wav', length: 3, sampleRate: 44100, refCount: 0, missing: false })
    expect(result.value.channels).toHaveLength(2)
  })

  it('keeps its own copy of the samples', async () => {
    const samples = new Float32Array([0.5, 0.5])
    const io = createAudioIO(fakeDecoder([samples]))
    const result = await io.decode('a.wav', new ArrayBuffer(8), 44100)
    if (!result.ok) throw new Error(result.error)
    samples[0] = 0
    expect(result.value.channels[0][0]).toBe(0.5)
  })

  it('reports a file the decoder cannot read (ER1)', async () => {
    const io = createAudioIO(fakeDecoder('fail'))
    const result = await io.decode('garbage.wav', new ArrayBuffer(8), 44100)
    if (!result.ok) expect(result.error).toBe('Unsupported or corrupted file')
    else throw new Error('should have failed')
  })

  it('rejects a file that decodes to no samples', async () => {
    const io = createAudioIO(fakeDecoder([new Float32Array(0)]))
    expect((await io.decode('empty.wav', new ArrayBuffer(8), 44100)).ok).toBe(false)
  })
})