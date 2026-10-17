import { describe, it, expect } from 'vitest'
import { encodeWav, toInt16 } from './wav'

const text = (view: DataView, offset: number, n: number) =>
  String.fromCharCode(...Array.from({ length: n }, (_, i) => view.getUint8(offset + i)))

describe('toInt16 (clamping)', () => {
  it('maps -1, 0, 1 to the 16-bit range', () => {
    expect(toInt16(0)).toBe(0)
    expect(toInt16(1)).toBe(32767)
    expect(toInt16(-1)).toBe(-32768)
  })

  it('clamps a mix louder than [-1, 1] instead of wrapping (A3 2.4)', () => {
    expect(toInt16(1.5)).toBe(32767)
    expect(toInt16(-2)).toBe(-32768)
  })
})

describe('encodeWav', () => {
  it('writes a correct WAV header', () => {
    const view = new DataView(encodeWav([new Float32Array(10), new Float32Array(10)], 44100))
    expect(text(view, 0, 4)).toBe('RIFF')
    expect(text(view, 8, 4)).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(2)          // channels
    expect(view.getUint32(24, true)).toBe(44100)      // sample rate
    expect(view.getUint16(34, true)).toBe(16)         // bits per sample
    expect(view.getUint32(40, true)).toBe(10 * 2 * 2) // samples x channels x 2 bytes
    expect(view.byteLength).toBe(44 + 40)
  })

  it('interleaves the channels: L, R, L, R', () => {
    const left = new Float32Array([0.5, 0])
    const right = new Float32Array([-0.5, 1])
    const view = new DataView(encodeWav([left, right], 44100))
    expect(view.getInt16(44, true)).toBe(toInt16(0.5))   // L0
    expect(view.getInt16(46, true)).toBe(toInt16(-0.5))  // R0
    expect(view.getInt16(48, true)).toBe(0)              // L1
    expect(view.getInt16(50, true)).toBe(32767)          // R1
  })

  it('handles an empty mix', () => {
    expect(encodeWav([new Float32Array(0)], 44100).byteLength).toBe(44)
  })
})