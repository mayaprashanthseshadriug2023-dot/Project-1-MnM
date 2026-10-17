import { describe, it, expect } from 'vitest'
import { RULER_H, ROW_H, rowAt, samplesAt, tickStep, xOf } from './geometry'

const view = { pps: 100, scrollX: 50, sampleRate: 44100 }

describe('timeline geometry', () => {
  it('converts samples to pixels and back', () => {
    expect(xOf(44100, view)).toBe(50)              // 1 s = 100 px, minus 50 px of scroll
    expect(samplesAt(50, view)).toBe(44100)
  })

  it('never returns a time before 0', () => {
    expect(samplesAt(-500, view)).toBe(0)
  })

  it('finds the row under the mouse', () => {
    expect(rowAt(10)).toBe(-1)                     // the ruler
    expect(rowAt(RULER_H)).toBe(0)
    expect(rowAt(RULER_H + ROW_H)).toBe(1)
  })

  it('spaces ruler labels sensibly at any zoom', () => {
    expect(tickStep(100)).toBe(1)                  // 1 s apart at 100 px/s
    expect(tickStep(10)).toBe(10)
    expect(tickStep(1000)).toBe(0.1)
  })
})