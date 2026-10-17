// Playback Engine (A2 Algorithm 5): synchronized multi-track playback from one shared clock.
import type { AudioOutput, PlaybackEngine } from '../model/contracts'
import type { Clip, Project, Samples } from '../model/types'
import { clipEnd } from '../model/types'
import { lowerBound } from '../algorithms/timeline'
import { mixLength } from '../algorithms/mixing'

export const LOOKAHEAD = 0.1      // seconds scheduled ahead, so a slow frame causes no gap (A3 3.4)
export const START_DELAY = 0.05   // seconds: gives the audio system time to start every clip on time
const TICK_MS = 25

/** What the engine needs from the audio system. The real one is in system/web-audio-output.ts. */
export interface AudioBackend extends AudioOutput {
  start(project: Project): void                                            // build the track nodes
  schedule(clip: Clip, trackId: string, when: number, from: Samples): void // ScheduleClip
  updateAudibility(project: Project): void                                 // ApplyAudibility
  stopAll(): void                                                          // silence everything
}

type StartTimer = (tick: () => void) => () => void      // starts repeating ticks; returns a stop function

const intervalTimer: StartTimer = (tick) => {
  const id = setInterval(tick, TICK_MS)
  return () => clearInterval(id)
}

export class Playback implements PlaybackEngine {
  private backend: AudioBackend
  private startTimer: StartTimer
  private project: Project | null = null       // null when not playing
  private t0 = 0                               // clock time (seconds) that matches timeline position p
  private p: Samples = 0                       // where playback started on the timeline
  private pointers = new Map<string, number>() // per track: index of the next clip to schedule
  private stopTimer: (() => void) | null = null
  private stoppedAt: Samples = 0               // position to report when not playing

  constructor(backend: AudioBackend, startTimer: StartTimer = intervalTimer) {
    this.backend = backend
    this.startTimer = startTimer
  }

  /** Play(p): one shared origin t0 for every track. */
  play(project: Project, from: Samples): void {
    this.halt()
    this.project = project
    this.p = from
    this.backend.start(project)
    this.t0 = this.backend.now() + START_DELAY

    for (const track of project.tracks) {
      const i = lowerBound(track.clips, from)       // first clip starting at or after `from`
      const prev = track.clips[i - 1]
      if (prev && clipEnd(prev) > from)             // a clip already playing at `from`:
        this.backend.schedule(prev, track.id, this.t0, from - prev.start)   // start part-way in
      this.pointers.set(track.id, i)
    }
    this.tick()
    this.stopTimer = this.startTimer(() => this.tick())
  }

  /** Tick: schedule every clip that starts within the look-ahead window, each exactly once. */
  tick(): void {
    if (!this.project) return
    const sr = this.project.sampleRate
    const pos = this.position()
    if (pos >= mixLength(this.project)) { this.halt(); return }   // reached the end

    const horizon = pos + LOOKAHEAD * sr
    for (const track of this.project.tracks) {
      let i = this.pointers.get(track.id) ?? track.clips.length
      while (i < track.clips.length && track.clips[i].start < horizon) {
        const c = track.clips[i]
        this.backend.schedule(c, track.id, this.t0 + (c.start - this.p) / sr, 0)
        i++
      }
      this.pointers.set(track.id, i)
    }
  }

  /** The cursor position, read from the audio clock so it cannot drift from the sound. */
  position(): Samples {
    if (!this.project) return this.stoppedAt
    const elapsed = Math.round((this.backend.now() - this.t0) * this.project.sampleRate)
    return this.p + Math.max(0, elapsed)
  }

  isPlaying(): boolean {
    return this.project !== null
  }

  pause(): void {
    this.halt()
  }

  stop(): void {
    this.halt()
    this.stoppedAt = 0
  }

  updateAudibility(project: Project): void {
    if (this.project) this.backend.updateAudibility(project)
  }

  private halt(): void {
    if (!this.project) return
    this.stoppedAt = this.position()
    this.stopTimer?.()
    this.stopTimer = null
    this.backend.stopAll()
    this.project = null
    this.pointers.clear()
  }
}