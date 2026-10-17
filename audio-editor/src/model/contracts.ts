// Interfaces between modules (A3 Risk R4: fixed as TypeScript types at the start).
// Mrinalini implements these; the Project Controller calls them.
import type { AudioData, Project, Result, Samples, WaveformCache } from './types'

/** System layer: the sound device's clock. Tests use a fake clock (A3 2.3). */
export interface AudioOutput {
  now(): number                       // current audio-clock time in seconds
}

/** System layer: file access. Electron provides the real one; tests use a fake. */
export interface FileSystem {
  readFile(path: string): Promise<Result<ArrayBuffer>>
  writeFile(path: string, data: ArrayBuffer | string): Promise<Result>
  exists(path: string): Promise<boolean>
  rename(from: string, to: string): Promise<Result>
  remove(path: string): Promise<void>
}

/** Audio I/O (Algorithm 1): decode and validate imports, encode exports. */
export interface AudioIO {
  decode(path: string, bytes: ArrayBuffer, sampleRate: number): Promise<Result<AudioData>>  // ER1
  encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer                       // clamps to [-1, 1]
}

/** Waveform Analysis (Algorithm 2). */
export type GenerateWaveform = (buf: AudioData, windowSize: Samples) => WaveformCache | Promise<WaveformCache>

/** Playback Engine (Algorithm 5). */
export interface PlaybackEngine {
  play(project: Project, from: Samples): void
  pause(): void
  stop(): void
  isPlaying(): boolean
  position(): Samples                 // read from the audio clock, for the cursor
  updateAudibility(project: Project): void   // re-apply volume/mute/solo while playing
}

/** Effects and Mixing (Algorithm 6): render the whole mix offline. */
export type RenderMix = (project: Project) => Promise<Result<Float32Array[]>>