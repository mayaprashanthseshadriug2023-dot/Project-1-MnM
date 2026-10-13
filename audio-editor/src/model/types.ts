// Shared data types (A2 Section 3). Both team members import from here.

/** Integer sample count at the project sample rate (A2: time unit). */
export type Samples = number

/** Result of any operation that can fail: success with a value, or an error message. */
export type Result<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const err = (error: string): Result<never> => ({ ok: false, error })

/** DS2: Waveform Cache — peak and RMS per window of w samples. */
export interface WaveformCache {
  windowSize: Samples
  peak: Float32Array
  rms: Float32Array
}

/** DS1: Audio Buffer — decoded samples of one file, shared by many clips. */
export interface AudioData {
  id: string                       // file path; key in Project.buffers
  channels: Float32Array[]         // one array per channel
  sampleRate: number
  length: Samples
  refCount: number                 // number of clips using this buffer
  waveform: WaveformCache | null   // null until generated
  missing: boolean                 // true if the file was not found on load (ER3)
}

/** DS3: Clip — which part of a buffer plays where. Holds no audio. */
export interface Clip {
  id: string
  bufferId: string                 // key into Project.buffers
  offset: Samples                  // where in the source the clip begins
  duration: Samples
  start: Samples                   // position on the timeline
  fadeIn: Samples
  fadeOut: Samples
}

/** DS4: Track — clips sorted by start, never overlapping. */
export interface Track {
  id: string
  name: string
  volume: number                   // gain multiplier, 1 = unchanged
  mute: boolean
  solo: boolean
  clips: Clip[]
}

/** DS5: Project — root of everything played, exported and saved. */
export interface Project {
  sampleRate: number
  tracks: Track[]
  cursor: Samples
  buffers: Map<string, AudioData>  // file path -> buffer, so each file is decoded once
}

/** Helper: end of a clip on the timeline (A2: x.end = x.start + x.duration). */
export const clipEnd = (c: Clip): Samples => c.start + c.duration
