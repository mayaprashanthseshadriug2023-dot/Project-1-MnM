// Project Controller (A2 Section 4): the single entry point for every UI command.
// It calls the algorithm, system and playback modules; the UI never calls them directly.
import type { AudioIO, FileSystem, GenerateWaveform, PlaybackEngine, RenderMix } from '../model/contracts'
import type { Clip, Project, Result, Samples, Track } from '../model/types'
import { ok, err, clipEnd } from '../model/types'
import { createClip, createProject, createTrack, WAVEFORM_WINDOW } from '../model/project'
import { canPlace, placeClip, trimLeft, trimRight, splitClip, removeClip } from '../algorithms/timeline'
import { loadProject, saveProject } from '../system/storage'
import { exportWav } from './export'

/** Everything the controller needs from other modules (contracts.ts). Tests pass fakes. */
export interface ControllerDeps {
  fs: FileSystem
  io: AudioIO
  waveform: GenerateWaveform
  playback: PlaybackEngine
  renderMix: RenderMix
}

type TrackSettings = Partial<Pick<Track, 'volume' | 'mute' | 'solo'>>

export class ProjectController {
  project: Project
  dirty = false                     // unsaved changes: the UI shows * in the title (A3 4.4)
  private deps: ControllerDeps

  constructor(deps: ControllerDeps, sampleRate = 44100) {
    this.deps = deps
    this.project = createProject(sampleRate)
  }

  // ---------- Lookup ----------

  findTrack(id: string): Track | undefined {
    return this.project.tracks.find(t => t.id === id)
  }

  findClip(id: string): { track: Track; clip: Clip } | undefined {
    for (const track of this.project.tracks) {
      const clip = track.clips.find(c => c.id === id)
      if (clip) return { track, clip }
    }
    return undefined
  }

  /** Marks the project as changed when an edit succeeds. */
  private done<T>(result: Result<T>): Result<T> {
    if (result.ok) this.dirty = true
    return result
  }

  // ---------- Tracks ----------

  addTrack(name: string): Track {
    const track = createTrack(name)
    this.project.tracks.push(track)
    this.dirty = true
    return track
  }

  /** Volume, mute and solo (FR4). Applied at once if playback is running. */
  setTrack(trackId: string, settings: TrackSettings): Result {
    const track = this.findTrack(trackId)
    if (!track) return err('Track not found')
    if (settings.volume !== undefined && !(settings.volume >= 0))
      return err('Volume cannot be negative')
    Object.assign(track, settings)
    if (this.deps.playback.isPlaying()) this.deps.playback.updateAudibility(this.project)
    return this.done(ok(undefined))
  }

  // ---------- Import (FR1, ER1) ----------

  async importAudio(path: string, trackId: string): Promise<Result<Clip>> {
    const track = this.findTrack(trackId)
    if (!track) return err('Track not found')
    if (!/\.(wav|mp3)$/i.test(path)) return err('Unsupported file format')

    const { buffers, sampleRate } = this.project
    let buf = buffers.get(path)
    if (!buf) {                                              // decode each file once (DS5)
      const bytes = await this.deps.fs.readFile(path)
      if (!bytes.ok) return err(`Could not read ${path}`)
      const decoded = await this.deps.io.decode(path, bytes.value, sampleRate)
      if (!decoded.ok || decoded.value.length === 0) return err('Unsupported or corrupted file')
      buf = decoded.value
      buf.refCount = 0
      buf.waveform = await this.deps.waveform(buf, WAVEFORM_WINDOW)
    }

    // New clip goes after the last clip on the track (A2 Algorithm 1)
    const last = track.clips[track.clips.length - 1]
    const clip = createClip(path, buf.length)
    const placed = placeClip(track, clip, last ? clipEnd(last) : 0)
    if (!placed.ok) return placed

    buffers.set(path, buf)                                   // only kept once placement succeeds
    buf.refCount++
    this.dirty = true
    return ok(clip)
  }

  // ---------- Editing (FR2, FR3, FR5) ----------

  /** Move a clip in time and/or to another track. Nothing changes if the move is rejected. */
  moveClip(clipId: string, toTrackId: string, start: Samples): Result {
    const found = this.findClip(clipId)
    const target = this.findTrack(toTrackId)
    if (!found || !target) return err('Clip or track not found')
    const { clip, track: source } = found
    if (source === target) return this.done(placeClip(target, clip, start))

    const index = source.clips.indexOf(clip)
    const placed = placeClip(target, clip, start)            // check the new track first
    if (!placed.ok) return placed
    source.clips.splice(index, 1)                            // then leave the old one
    return this.done(placed)
  }
    /** For the drag preview: would this move be accepted? Changes nothing. */
  canMove(clipId: string, toTrackId: string, start: Samples): boolean {
    const found = this.findClip(clipId)
    const target = this.findTrack(toTrackId)
    return !!found && !!target && canPlace(target, found.clip, start)
  }
  
  trimClip(clipId: string, edge: 'left' | 'right', delta: Samples): Result {
    const found = this.findClip(clipId)
    if (!found) return err('Clip not found')
    return this.done(edge === 'left'
      ? trimLeft(found.track, found.clip, delta)
      : trimRight(this.project, found.track, found.clip, delta))
  }

  splitClipAt(clipId: string, at: Samples): Result<[Clip, Clip]> {
    const found = this.findClip(clipId)
    if (!found) return err('Clip not found')
    return this.done(splitClip(this.project, found.track, found.clip, at))
  }

  deleteClip(clipId: string): Result {
    const found = this.findClip(clipId)
    if (!found) return err('Clip not found')
    return this.done(removeClip(this.project, found.track, found.clip))
  }

  setFades(clipId: string, fadeIn: Samples, fadeOut: Samples): Result {
    const found = this.findClip(clipId)
    if (!found) return err('Clip not found')
    const c = found.clip
    if (!Number.isInteger(fadeIn) || !Number.isInteger(fadeOut) ||
        fadeIn < 0 || fadeOut < 0 || fadeIn + fadeOut > c.duration)
      return err('Fades do not fit in the clip')
    c.fadeIn = fadeIn
    c.fadeOut = fadeOut
    return this.done(ok(undefined))
  }

  // ---------- Playback (A1 Flow 2) ----------

  play(): void {
    this.deps.playback.play(this.project, this.project.cursor)
  }

  pause(): void {
    this.project.cursor = this.deps.playback.position()      // cursor freezes where it stopped
    this.deps.playback.pause()
  }

  stop(): void {
    this.deps.playback.stop()
    this.project.cursor = 0
  }

  seek(position: Samples): void {
    this.project.cursor = Math.max(0, Math.round(position))
    if (this.deps.playback.isPlaying()) this.play()          // restart from the new position
  }

    /** Where the cursor is now: from the audio clock while playing (A2 Alg. 5), otherwise the saved cursor. */
  position(): Samples {
    return this.deps.playback.isPlaying() ? this.deps.playback.position() : this.project.cursor
  }

  isPlaying(): boolean {
    return this.deps.playback.isPlaying()
  }
  // ---------- Save, load, export (UC4, ER3, ER4) ----------

  async save(path: string): Promise<Result> {
    const result = await saveProject(this.project, path, this.deps.fs)
    if (result.ok) this.dirty = false
    return result
  }

    /** Relink a missing audio file (ER3): its clips now play from `newPath`. */
  async relink(missingPath: string, newPath: string): Promise<Result> {
    const old = this.project.buffers.get(missingPath)
    if (!old?.missing) return err('That file is not missing')
    if (newPath !== missingPath && this.project.buffers.has(newPath)) return err('That file is already in the project')

    const bytes = await this.deps.fs.readFile(newPath)
    if (!bytes.ok) return err(`Could not read ${newPath}`)
    const decoded = await this.deps.io.decode(newPath, bytes.value, this.project.sampleRate)
    if (!decoded.ok) return err('Unsupported or corrupted file')
    const buf = decoded.value

    const clips = this.project.tracks.flatMap(t => t.clips).filter(c => c.bufferId === missingPath)
    if (clips.some(c => c.offset + c.duration > buf.length))
      return err('That file is shorter than the clips that use it')   // would break invariant 2

    buf.waveform = await this.deps.waveform(buf, WAVEFORM_WINDOW)
    buf.refCount = clips.length
    for (const c of clips) c.bufferId = newPath
    this.project.buffers.delete(missingPath)
    this.project.buffers.set(newPath, buf)
    this.dirty = true
    return ok(undefined)
  }
  
  /** Returns the list of missing audio files, so the UI can offer to relink them. */
  async load(path: string): Promise<Result<string[]>> {
    const result = await loadProject(path, this.deps.fs, this.deps.io, this.deps.waveform)
    if (!result.ok) return result                            // current project is untouched
    this.deps.playback.stop()
    this.project = result.value.project
    this.dirty = false
    return ok(result.value.missing)
  }

  exportWav(path: string): Promise<Result> {
    return exportWav(this.project, path, this.deps.renderMix, this.deps.io, this.deps.fs)
  }
}