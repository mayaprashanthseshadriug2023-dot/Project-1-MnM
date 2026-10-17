// Audio I/O (A2 Algorithm 1): decode imports with the Web Audio API, encode exports as WAV.
import type { AudioIO } from '../model/contracts'
import { ok, err } from '../model/types'
import { createAudioData } from '../model/project'
import { encodeWav } from './wav'

/** The part of the Web Audio API we use for decoding. Tests pass a fake. */
export interface Decoder {
  decodeAudioData(bytes: ArrayBuffer): Promise<{
    numberOfChannels: number
    getChannelData(channel: number): Float32Array
  }>
}

/** By default, decode with an OfflineAudioContext at the project sample rate (it resamples for us). */
const browserDecoder = (sampleRate: number): Decoder => new OfflineAudioContext(1, 1, sampleRate)

export function createAudioIO(makeDecoder: (sampleRate: number) => Decoder = browserDecoder): AudioIO {
  return {
    async decode(path, bytes, sampleRate) {
      try {
        // slice(0) copies the bytes: the browser decoder empties the buffer it is given
        const audio = await makeDecoder(sampleRate).decodeAudioData(bytes.slice(0))
        const channels = Array.from({ length: audio.numberOfChannels },
          (_, ch) => audio.getChannelData(ch).slice())          // our own copy of the samples
        if (channels.length === 0 || channels[0].length === 0)
          return err('Unsupported or corrupted file')
        return ok(createAudioData(path, channels, sampleRate))
      } catch {
        return err('Unsupported or corrupted file')            // the decoder could not read it (ER1)
      }
    },
    encodeWav,
  }
}