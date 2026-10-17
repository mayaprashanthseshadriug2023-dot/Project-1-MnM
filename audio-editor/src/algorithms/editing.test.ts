import { describe, it, expect } from 'vitest'
import { splitClip, trimLeft, trimRight, removeClip } from './timeline'
import { createAudioData, createClip, createProject, createTrack } from '../model/project'
import { checkInvariants } from '../model/invariants'

// Helper: a project with one track using one 10000-sample buffer.
function setup(...ranges: [number, number][]) {
  const project = createProject()
  const buf = createAudioData('a.wav', [new Float32Array(10000)], 44100)
  buf.refCount = ranges.length
  project.buffers.set('a.wav', buf)
  const track = createTrack('T')
  track.clips = ranges.map(([start, duration]) => createClip('a.wav', duration, start))
  project.tracks.push(track)
  return { project, track, buf }
}

describe('splitClip (Algorithm 4)', () => {
  it('T3: splits a clip and shares its fades between the halves', () => {
    const { project, track, buf } = setup([0, 1000])
    const c = track.clips[0]
    c.offset = 100; c.fadeIn = 300; c.fadeOut = 300

    const result = splitClip(project, track, c, 400)
    if (!result.ok) throw new Error(result.error)
    const [c1, c2] = result.value

    expect(c1).toMatchObject({ offset: 100, duration: 400, start: 0, fadeIn: 300, fadeOut: 0 })
    expect(c2).toMatchObject({ offset: 500, duration: 600, start: 400, fadeIn: 0, fadeOut: 300 })
    expect(buf.refCount).toBe(2)
    expect(checkInvariants(project)).toEqual([])
  })

  it('is lossless: the halves cover exactly the original source range', () => {
    const { project, track } = setup([2000, 1000])
    const result = splitClip(project, track, track.clips[0], 2300)
    if (!result.ok) throw new Error(result.error)
    const [c1, c2] = result.value
    expect(c1.offset + c1.duration).toBe(c2.offset)          // no gap or overlap in the source
    expect(c2.offset + c2.duration).toBe(1000)               // ends where the original ended
    expect(c1.start + c1.duration).toBe(c2.start)            // touch on the timeline
  })

  it('rejects a split exactly at a clip edge (A3 2.4)', () => {
    const { project, track, buf } = setup([0, 1000])
    expect(splitClip(project, track, track.clips[0], 0).ok).toBe(false)
    expect(splitClip(project, track, track.clips[0], 1000).ok).toBe(false)
    expect(track.clips).toHaveLength(1)
    expect(buf.refCount).toBe(1)
  })
})

describe('trimLeft and trimRight (Algorithm 4)', () => {
  it('T4: trimming keeps the fades inside the clip', () => {
    const { project, track } = setup([0, 1000])
    const c = track.clips[0]
    c.fadeIn = 400; c.fadeOut = 400

    expect(trimRight(project, track, c, 500).ok).toBe(true)
    expect(c).toMatchObject({ duration: 500, fadeIn: 400, fadeOut: 100 })
    expect(checkInvariants(project)).toEqual([])
  })

  it('is non-destructive: the audio buffer never changes', () => {
    const { project, track, buf } = setup([0, 1000])
    buf.channels[0][50] = 0.5
    const samples = buf.channels[0]
    trimLeft(track, track.clips[0], 100)
    expect(buf.channels[0]).toBe(samples)                    // same array, not a copy
    expect(buf.channels[0][50]).toBe(0.5)                    // trimmed-away audio still there
    expect(checkInvariants(project)).toEqual([])
  })

  it('trimLeft moves start and offset together', () => {
    const { track } = setup([1000, 1000])
    const c = track.clips[0]
    trimLeft(track, c, 200)
    expect(c).toMatchObject({ start: 1200, offset: 200, duration: 800 })
  })

  it('rejects extending before the start of the audio', () => {
    const { track } = setup([1000, 1000])
    expect(trimLeft(track, track.clips[0], -10).ok).toBe(false)   // offset is already 0
  })

  it('rejects extending past the end of the audio', () => {
    const { project, track } = setup([0, 10000])
    expect(trimRight(project, track, track.clips[0], -1).ok).toBe(false)
  })

  it('rejects trimLeft into the previous clip', () => {
    const { track } = setup([0, 1000], [1000, 1000])
    track.clips[1].offset = 500                              // room to extend in the source
    expect(trimLeft(track, track.clips[1], -1).ok).toBe(false)
    expect(track.clips[1].start).toBe(1000)
  })

  it('rejects trimRight into the next clip', () => {
    const { project, track } = setup([0, 1000], [1000, 1000])
    expect(trimRight(project, track, track.clips[0], -1).ok).toBe(false)
    expect(track.clips[0].duration).toBe(1000)
  })
})

describe('removeClip (Algorithm 4)', () => {
  it('decreases the reference count', () => {
    const { project, track, buf } = setup([0, 1000], [2000, 1000])
    expect(removeClip(project, track, track.clips[0]).ok).toBe(true)
    expect(buf.refCount).toBe(1)
    expect(project.buffers.has('a.wav')).toBe(true)
    expect(checkInvariants(project)).toEqual([])
  })

  it('frees the buffer when its last clip is removed', () => {
    const { project, track } = setup([0, 1000])
    removeClip(project, track, track.clips[0])
    expect(project.buffers.has('a.wav')).toBe(false)
    expect(checkInvariants(project)).toEqual([])
  })
})