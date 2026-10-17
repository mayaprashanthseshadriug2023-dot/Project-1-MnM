import { describe, it, expect } from 'vitest'
import { generateWaveform, waveformRange } from './waveform'
import { createAudioData } from '../model/project'

const mono = (samples: number[]) => createAudioData('a.wav', [new Float32Array(samples)], 44100)

describe('generateWaveform (Algorithm 2)', () => {
  it('computes peak and RMS per window', () => {
    const w = generateWaveform(mono([1, -1, 0, 0]), 2)
    expect(Array.from(w.peak)).toEqual([1, 0])
    expect(Array.from(w.rms)).toEqual([1, 0])
  })

  it('gives ceil(N / w) points, with a shorter last window', () => {
    const w = generateWaveform(mono([0.5, 0.5, 0.5, 0.5, 0.25]), 2)
    expect(w.peak).toHaveLength(3)
    expect(w.peak[2]).toBeCloseTo(0.25)
    expect(w.rms[2]).toBeCloseTo(0.25)
  })

  it('always shows the loudest sample, even a single spike', () => {
    const samples = new Array(10).fill(0)
    samples[7] = -0.9
    const w = generateWaveform(mono(samples), 4)
    expect(w.peak[1]).toBeCloseTo(0.9)
  })

  it('combines all channels', () => {
    const buf = createAudioData('a.wav', [new Float32Array(4), new Float32Array(4).fill(0.5)], 44100)
    const w = generateWaveform(buf, 4)
    expect(w.peak[0]).toBeCloseTo(0.5)
    expect(w.rms[0]).toBeCloseTo(Math.sqrt(0.125))   // half the samples are 0.5, half are 0
  })

  it('handles an empty buffer', () => {
    expect(generateWaveform(mono([]), 512).peak).toHaveLength(0)
  })
})

describe('waveformRange', () => {
  it('draws only the windows inside a trimmed clip', () => {
    const cache = generateWaveform(mono(new Array(5000).fill(0)), 512)
    expect(waveformRange(cache, 1000, 2000)).toEqual([1, 6])   // samples 1000..3000
  })
})