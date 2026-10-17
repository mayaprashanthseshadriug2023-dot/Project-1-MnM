import { describe, it, expect } from 'vitest'
import { canPlace } from './timeline'
import { createClip, createTrack } from '../model/project'

describe('canPlace', () => {
  it('answers like placeClip but changes nothing', () => {
    const t = createTrack('T')
    t.clips = [createClip('a', 1000, 0), createClip('a', 1000, 2000)]
    const c = createClip('a', 1000)
    expect(canPlace(t, c, 1000)).toBe(true)     // touches both neighbours (T1)
    expect(canPlace(t, c, 500)).toBe(false)     // overlaps
    expect(t.clips).toHaveLength(2)             // nothing was inserted
  })

  it('rejects a negative start', () => {
    expect(canPlace(createTrack('T'), createClip('a', 10), -1)).toBe(false)
  })
})