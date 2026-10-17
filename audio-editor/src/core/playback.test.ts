import { describe, it, expect } from 'vitest'
import { Playback, type AudioBackend } from './playback'
import { createClip, createProject, createTrack } from '../model/project'

// A fake audio system with a clock we control (A3 2.3: Playback Engine tested with a fake clock).
function setup() {
  const project = createProject(1000)              // 1000 samples per second keeps the maths easy
  const a = createTrack('A')
  a.clips = [createClip('x', 500, 0), createClip('x', 500, 2000)]
  const b = createTrack('B')
  b.clips = [createClip('x', 500, 1000)]
  project.tracks = [a, b]                          // the project ends at 2500

  const state = {
    time: 0,
    scheduled: [] as { start: number; track: string; when: number; from: number }[],
    calls: [] as string[],
  }
  const backend: AudioBackend = {
    now: () => state.time,
    start: () => { state.calls.push('start') },
    schedule: (clip, track, when, from) => { state.scheduled.push({ start: clip.start, track, when, from }) },
    updateAudibility: () => { state.calls.push('audibility') },
    stopAll: () => { state.calls.push('stopAll') },
  }
  const timer = { running: false }
  const engine = new Playback(backend, () => { timer.running = true; return () => { timer.running = false } })
  return { project, a, b, engine, state, timer }
}

describe('Playback (Algorithm 5)', () => {
  it('schedules only the clips inside the look-ahead window', () => {
    const { project, a, engine, state } = setup()
    engine.play(project, 0)
    expect(state.scheduled).toHaveLength(1)
    expect(state.scheduled[0]).toMatchObject({ start: 0, track: a.id, from: 0 })
    expect(state.scheduled[0].when).toBeCloseTo(0.05)
  })

  it('schedules later clips as the clock advances', () => {
    const { project, b, engine, state } = setup()
    engine.play(project, 0)
    state.time = 0.97                              // position 920; window reaches 1020
    engine.tick()
    const clipB = state.scheduled.find(s => s.track === b.id)!
    expect(clipB.start).toBe(1000)
    expect(clipB.when).toBeCloseTo(1.05)
  })

  it('schedules each clip exactly once, however many ticks run', () => {
    const { project, engine, state } = setup()
    engine.play(project, 0)
    for (const t of [0.5, 0.5, 1.0, 1.0, 1.5, 2.0, 2.0, 2.4]) { state.time = t; engine.tick() }
    expect(state.scheduled.map(s => s.start).sort((x, y) => x - y)).toEqual([0, 1000, 2000])
  })

  it('times every track from one shared clock, so nothing drifts', () => {
    const { project, engine, state } = setup()
    engine.play(project, 0)
    for (const t of [1.0, 2.0]) { state.time = t; engine.tick() }
    for (const s of state.scheduled) expect(s.when - s.start / 1000).toBeCloseTo(0.05)   // same origin t0
  })

  it('starts part-way through a clip after a seek', () => {
    const { project, engine, state } = setup()
    engine.play(project, 200)
    expect(state.scheduled[0]).toMatchObject({ start: 0, from: 200 })
  })

  it('reads the cursor position from the audio clock', () => {
    const { project, engine, state } = setup()
    engine.play(project, 1000)
    expect(engine.position()).toBe(1000)           // still within the start delay
    state.time = 0.55
    expect(engine.position()).toBe(1500)
  })

  it('pause freezes the position and stops the sound and the timer', () => {
    const { project, engine, state, timer } = setup()
    engine.play(project, 0)
    expect(timer.running).toBe(true)
    state.time = 0.55
    engine.pause()
    expect(engine.isPlaying()).toBe(false)
    expect(state.calls).toContain('stopAll')
    expect(timer.running).toBe(false)
    state.time = 5
    expect(engine.position()).toBe(500)
  })

  it('stop returns the position to 0', () => {
    const { project, engine } = setup()
    engine.play(project, 1000)
    engine.stop()
    expect(engine.position()).toBe(0)
  })

  it('stops by itself at the end of the project', () => {
    const { project, engine, state } = setup()
    engine.play(project, 0)
    state.time = 3
    engine.tick()
    expect(engine.isPlaying()).toBe(false)
  })

  it('passes volume/mute/solo changes on only while playing', () => {
    const { project, engine, state } = setup()
    engine.updateAudibility(project)
    expect(state.calls).not.toContain('audibility')
    engine.play(project, 0)
    engine.updateAudibility(project)
    expect(state.calls).toContain('audibility')
  })
})