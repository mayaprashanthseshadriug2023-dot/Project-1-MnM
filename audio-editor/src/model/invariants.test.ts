import { describe, it, expect } from 'vitest'
import { checkInvariants } from './invariants'
import { createAudioData, createClip, createProject, createTrack } from './project'
import type { Clip, Project } from './types'

// Helper: one track using one buffer of the given length, refCount set correctly.
function projectWith(clips: Clip[], bufLength = 10000): Project {
  const p = createProject()
  const buf = createAudioData('a.wav', [new Float32Array(bufLength)], 44100)
  buf.refCount = clips.length
  p.buffers.set(buf.id, buf)
  const t = createTrack('T')
  t.clips = clips
  p.tracks.push(t)
  return p
}

describe('checkInvariants', () => {
  it('accepts a valid project', () => {
    const p = projectWith([createClip('a.wav', 1000, 0), createClip('a.wav', 1000, 2000)])
    expect(checkInvariants(p)).toEqual([])
  })

  it('accepts clips that touch exactly (T1 boundary)', () => {
    const p = projectWith([createClip('a.wav', 1000, 0), createClip('a.wav', 1000, 1000)])
    expect(checkInvariants(p)).toEqual([])
  })

  it('rejects clips that overlap by one sample', () => {
    const p = projectWith([createClip('a.wav', 1000, 0), createClip('a.wav', 1000, 999)])
    const errors = checkInvariants(p)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('overlaps')
  })

  it('rejects clips that are out of order', () => {
    const p = projectWith([createClip('a.wav', 1000, 2000), createClip('a.wav', 1000, 0)])
    expect(checkInvariants(p)[0]).toContain('out of order')
  })

  it('rejects a clip that runs past the end of its buffer', () => {
    const p = projectWith([createClip('a.wav', 1000, 0, 9500)])   // offset 9500 + 1000 > 10000
    expect(checkInvariants(p)[0]).toContain('past the end')
  })

  it('rejects fades that do not fit', () => {
    const c = createClip('a.wav', 1000, 0)
    c.fadeIn = 600
    c.fadeOut = 600                                              // 1200 > 1000
    expect(checkInvariants(projectWith([c]))[0]).toContain('fades')
  })

  it('rejects a wrong refCount', () => {
    const p = projectWith([createClip('a.wav', 1000, 0)])
    p.buffers.get('a.wav')!.refCount = 5
    expect(checkInvariants(p)[0]).toContain('refCount')
  })

  it('skips the length check for a missing file (ER3)', () => {
    const p = projectWith([createClip('a.wav', 1000, 0)], 0)    // buffer has no samples
    p.buffers.get('a.wav')!.missing = true
    expect(checkInvariants(p)).toEqual([])
  })
})