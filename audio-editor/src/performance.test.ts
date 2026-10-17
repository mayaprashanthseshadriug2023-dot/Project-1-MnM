// Performance tests (A3 2.7): A1's targets at A1's scale (8 tracks, 50 clips). Prints measured timings.
import { describe, expect, it } from 'vitest'
import { canPlace, placeClip } from './algorithms/timeline'
import { generateWaveform } from './algorithms/waveform'
import { Playback, START_DELAY, type AudioBackend } from './core/playback'
import { checkInvariants } from './model/invariants'
import { createAudioData, createClip, createProject, createTrack, WAVEFORM_WINDOW } from './model/project'
import { drawTimeline } from './ui/draw'
import { RULER_H, ROW_H } from './ui/geometry'

const SR = 44100

/** Runs fn `runs` times, prints and returns the average time in milliseconds. */
function time(label: string, fn: () => void, runs = 1): number {
  const t0 = performance.now()
  for (let i = 0; i < runs; i++) fn()
  const ms = (performance.now() - t0) / runs
  console.log(`  ${label}: ${ms.toFixed(3)} ms`)
  return ms
}

/** A1's target scale: 8 tracks and 50 clips of 5 s, all using one minute-long file. */
function bigProject() {
  const project = createProject(SR)
  const buf = createAudioData('long.wav', [new Float32Array(SR * 60)], SR)
  buf.waveform = generateWaveform(buf, WAVEFORM_WINDOW)
  buf.refCount = 50
  project.buffers.set(buf.id, buf)
  for (let t = 0; t < 8; t++) project.tracks.push(createTrack(`Track ${t + 1}`))
  for (let i = 0; i < 50; i++) {
    const track = project.tracks[i % 8]
    const last = track.clips[track.clips.length - 1]
    const start = last ? last.start + last.duration + SR : 0          // 1 s gap between clips
    track.clips.push(createClip('long.wav', SR * 5, start, (i % 10) * SR * 5))
  }
  return project
}

/** A pretend canvas that accepts every drawing call, so we time our drawing code itself. */
const fakeCanvas = () =>
  new Proxy({}, { get: () => () => {}, set: () => true }) as unknown as CanvasRenderingContext2D

describe('performance at the A1 target scale (8 tracks, 50 clips)', () => {
  it('builds a valid project', () => {
    expect(checkInvariants(bigProject())).toEqual([])
  })

  it('redraws the whole timeline well within 100 ms (A1)', () => {
    const p = bigProject()
    const view = { pps: 100, scrollX: 0, sampleRate: SR }
    const ms = time('full timeline redraw, 1400 px wide', () =>
      drawTimeline(fakeCanvas(), p, view, 1400, RULER_H + 8 * ROW_H), 20)
    expect(ms).toBeLessThan(100)
  })

  it('checks a dragged position much faster than one frame (16 ms)', () => {
    const p = bigProject()
    const ms = time('drag preview check (canPlace)', () => canPlace(p.tracks[3], p.tracks[0].clips[0], 123456), 1000)
    expect(ms).toBeLessThan(1)
  })

  it('applies an edit and re-checks every invariant quickly', () => {
    const p = bigProject()
    const track = p.tracks[0]
    const clip = track.clips[0]
    const ms = time('move a clip + checkInvariants', () => { placeClip(track, clip, clip.start); checkInvariants(p) }, 100)
    expect(ms).toBeLessThan(5)
  })

  it('starts playback well within 200 ms (A1)', () => {
    const p = bigProject()
    const backend: AudioBackend = { now: () => 0, start() {}, schedule() {}, updateAudibility() {}, stopAll() {} }
    const engine = new Playback(backend, () => () => {})
    const ms = time('playback start (scheduling only)', () => engine.play(p, 0), 100)
    console.log(`  playback start incl. ${START_DELAY * 1000} ms start delay: ${(ms + START_DELAY * 1000).toFixed(1)} ms`)
    expect(ms + START_DELAY * 1000).toBeLessThan(200)
  })

  it('generates a one-minute stereo waveform quickly (in the app this runs in a worker)', () => {
    const buf = createAudioData('a.wav', [new Float32Array(SR * 60), new Float32Array(SR * 60)], SR)
    const ms = time('waveform for 1 min of stereo audio', () => generateWaveform(buf, WAVEFORM_WINDOW))
    expect(ms).toBeLessThan(2000)
  })
})