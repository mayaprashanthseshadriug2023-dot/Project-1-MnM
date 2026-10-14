import { describe, it, expect } from 'vitest'
import { lowerBound, placeClip } from './timeline'
import { createClip, createTrack } from '../model/project'
import type { Track } from '../model/types'

// Helper: a track with clips of the given [start, duration] pairs, already sorted.
function trackWith(...ranges: [number, number][]): Track {
  const t = createTrack('T')
  t.clips = ranges.map(([start, duration]) => createClip('a.wav', duration, start))
  return t
}
const starts = (t: Track) => t.clips.map(c => c.start)

describe('lowerBound', () => {
  it('finds the first clip starting at or after s', () => {
    const t = trackWith([0, 100], [200, 100], [400, 100])
    expect(lowerBound(t.clips, 0)).toBe(0)
    expect(lowerBound(t.clips, 150)).toBe(1)
    expect(lowerBound(t.clips, 200)).toBe(1)
    expect(lowerBound(t.clips, 999)).toBe(3)
  })
})

describe('placeClip (Algorithm 3)', () => {
  it('T1: accepts a clip that touches both neighbours exactly', () => {
    const t = trackWith([0, 1000], [2000, 1000])
    const c = createClip('a.wav', 1000)
    expect(placeClip(t, c, 1000).ok).toBe(true)
    expect(starts(t)).toEqual([0, 1000, 2000])
  })

  it('T2: rejects an overlapping move and leaves the track unchanged', () => {
    const t = trackWith([0, 1000], [2000, 1000])
    const moving = t.clips[1]
    const result = placeClip(t, moving, 500)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Clip overlaps another clip')
    expect(starts(t)).toEqual([0, 2000])
    expect(moving.start).toBe(2000)
  })

  it('rejects a one-sample overlap with the next clip', () => {
    const t = trackWith([2000, 1000])
    expect(placeClip(t, createClip('a.wav', 1000), 1001).ok).toBe(false)
  })

  it('places a clip on an empty track', () => {
    const t = createTrack('T')
    expect(placeClip(t, createClip('a.wav', 500), 300).ok).toBe(true)
    expect(starts(t)).toEqual([300])
  })

  it('inserts a new clip in sorted position', () => {
    const t = trackWith([0, 1000], [5000, 1000])
    placeClip(t, createClip('a.wav', 1000), 2000)
    expect(starts(t)).toEqual([0, 2000, 5000])
  })

  it('allows moving a clip over its own old position', () => {
    const t = trackWith([0, 1000])
    expect(placeClip(t, t.clips[0], 500).ok).toBe(true)
    expect(starts(t)).toEqual([500])
  })

  it('re-sorts the track when a clip moves past another', () => {
    const t = trackWith([0, 1000], [2000, 1000])
    const first = t.clips[0]
    expect(placeClip(t, first, 4000).ok).toBe(true)
    expect(starts(t)).toEqual([2000, 4000])
    expect(t.clips[1]).toBe(first)
  })

  it('rejects a negative start (ER2)', () => {
    const t = createTrack('T')
    expect(placeClip(t, createClip('a.wav', 100), -1).ok).toBe(false)
    expect(t.clips).toHaveLength(0)
  })
})