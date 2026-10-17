import { describe, it, expect } from 'vitest'
import { envGain, envelopePoints, mixLength, trackGains } from './mixing'
import { createClip, createProject, createTrack } from '../model/project'

describe('trackGains (mute/solo, FR4)', () => {
  it('uses each track volume, and 0 for muted tracks', () => {
    const a = createTrack('A'); a.volume = 0.5
    const b = createTrack('B'); b.mute = true
    const g = trackGains([a, b])
    expect(g.get(a.id)).toBe(0.5)
    expect(g.get(b.id)).toBe(0)
  })

  it('plays only soloed tracks when any track is soloed', () => {
    const a = createTrack('A'); a.solo = true
    const b = createTrack('B')
    const g = trackGains([a, b])
    expect(g.get(a.id)).toBe(1)
    expect(g.get(b.id)).toBe(0)
  })

  it('solo overrides mute (A1 4.1.6)', () => {
    const a = createTrack('A'); a.solo = true; a.mute = true
    expect(trackGains([a]).get(a.id)).toBe(1)
  })
})

describe('envGain (FR5)', () => {
  it('ramps 0 -> 1 during the fade-in and 1 -> 0 during the fade-out', () => {
    expect(envGain(0, 1000, 100, 200)).toBe(0)
    expect(envGain(50, 1000, 100, 200)).toBe(0.5)
    expect(envGain(500, 1000, 100, 200)).toBe(1)
    expect(envGain(900, 1000, 100, 200)).toBe(0.5)
  })

  it('is always 1 with no fades', () => {
    expect(envGain(0, 1000, 0, 0)).toBe(1)
    expect(envGain(999, 1000, 0, 0)).toBe(1)
  })

  it('works when the fades fill the whole clip (A3 2.4)', () => {
    expect(envGain(250, 1000, 500, 500)).toBe(0.5)
    expect(envGain(500, 1000, 500, 500)).toBe(1)
    expect(envGain(750, 1000, 500, 500)).toBe(0.5)
  })
})

describe('envelopePoints', () => {
  it('describes a full clip: fade in, hold, fade out', () => {
    const c = createClip('a.wav', 1000); c.fadeIn = 100; c.fadeOut = 200
    expect(envelopePoints(c)).toEqual([
      { at: 0, value: 0 }, { at: 100, value: 1 }, { at: 800, value: 1 }, { at: 1000, value: 0 },
    ])
  })

  it('starts at the right value when seeking into the middle of a fade-in (A3 2.4)', () => {
    const c = createClip('a.wav', 1000); c.fadeIn = 100
    expect(envelopePoints(c, 50)).toEqual([{ at: 50, value: 0.5 }, { at: 100, value: 1 }])
  })

  it('starts at the right value when seeking into the fade-out', () => {
    const c = createClip('a.wav', 1000); c.fadeOut = 200
    expect(envelopePoints(c, 900)).toEqual([{ at: 900, value: 0.5 }, { at: 1000, value: 0 }])
  })
})

describe('mixLength', () => {
  it('is the latest clip end across all tracks', () => {
    const p = createProject()
    const a = createTrack('A'); a.clips = [createClip('a.wav', 1000, 0), createClip('a.wav', 500, 3000)]
    const b = createTrack('B'); b.clips = [createClip('b.wav', 2000, 2000)]
    p.tracks = [a, b]
    expect(mixLength(p)).toBe(4000)
  })
})