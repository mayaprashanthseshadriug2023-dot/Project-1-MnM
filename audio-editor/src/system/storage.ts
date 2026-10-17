// Project Storage (A2 Algorithm 1: SaveProject / LoadProject; UC4, ER3).
import type { AudioIO, FileSystem, GenerateWaveform } from '../model/contracts'
import type { AudioData, Project, Result } from '../model/types'
import { ok, err } from '../model/types'
import { createAudioData, createClip, createProject, createTrack, WAVEFORM_WINDOW } from '../model/project'
import { checkInvariants } from '../model/invariants'

/** The JSON format on disk. Audio is not stored, only file paths. */
export interface ProjectFile {
  version: 1
  sampleRate: number
  tracks: {
    name: string; volume: number; mute: boolean; solo: boolean
    clips: { file: string; offset: number; duration: number; start: number; fadeIn: number; fadeOut: number }[]
  }[]
}

// ---------- Save ----------

export function serializeProject(project: Project): string {
  const file: ProjectFile = {
    version: 1,
    sampleRate: project.sampleRate,
    tracks: project.tracks.map(t => ({
      name: t.name, volume: t.volume, mute: t.mute, solo: t.solo,
      clips: t.clips.map(c => ({
        file: c.bufferId, offset: c.offset, duration: c.duration,
        start: c.start, fadeIn: c.fadeIn, fadeOut: c.fadeOut,
      })),
    })),
  }
  return JSON.stringify(file, null, 2)
}

/** Writes to a temporary file first, so a failed save never corrupts the old project file. */
export async function saveProject(project: Project, path: string, fs: FileSystem): Promise<Result> {
  const tmp = path + '.tmp'
  const written = await fs.writeFile(tmp, serializeProject(project))
  if (!written.ok) {
    await fs.remove(tmp)
    return err(`Could not save project: ${written.error}`)
  }
  return fs.rename(tmp, path)
}

// ---------- Load ----------

const isInt = (x: unknown, min = 0): boolean => Number.isInteger(x) && (x as number) >= min

/** Checks the JSON has the right shape before anything is built from it. */
export function parseProjectFile(text: string): Result<ProjectFile> {
  let f: ProjectFile
  try { f = JSON.parse(text) } catch { return err('Project file is not valid JSON') }

  if (typeof f !== 'object' || f === null || f.version !== 1)
    return err('Not a project file (unknown version)')
  if (!isInt(f.sampleRate, 1) || !Array.isArray(f.tracks))
    return err('Project file is missing its sample rate or tracks')

  for (const t of f.tracks) {
    if (typeof t?.name !== 'string' || typeof t.volume !== 'number' ||
        typeof t.mute !== 'boolean' || typeof t.solo !== 'boolean' || !Array.isArray(t.clips))
      return err('Project file has an invalid track')
    for (const c of t.clips) {
      if (typeof c?.file !== 'string' || !isInt(c.offset) || !isInt(c.duration, 1) ||
          !isInt(c.start) || !isInt(c.fadeIn) || !isInt(c.fadeOut))
        return err('Project file has an invalid clip')
    }
  }
  return ok(f)
}

export async function loadProject(
  path: string, fs: FileSystem, io: AudioIO, waveform: GenerateWaveform,
): Promise<Result<{ project: Project; missing: string[] }>> {
  // 1. Read and validate the file first; a bad file changes nothing
  const read = await fs.readFile(path)
  if (!read.ok) return err(`Could not open project: ${read.error}`)
  const parsed = parseProjectFile(new TextDecoder().decode(read.value))
  if (!parsed.ok) return parsed
  const file = parsed.value

  // 2. Decode each distinct audio file once; missing files become placeholders (ER3)
  const project = createProject(file.sampleRate)
  const missing: string[] = []
  const paths = new Set(file.tracks.flatMap(t => t.clips.map(c => c.file)))
  for (const p of paths) {
    const buf = await loadAudio(p, fs, io, file.sampleRate)
    if (buf) buf.waveform = await waveform(buf, WAVEFORM_WINDOW)
    else missing.push(p)
    project.buffers.set(p, buf ?? placeholder(p, file.sampleRate))
  }

  // 3. Rebuild tracks and clips, sorted by start, counting references
  for (const t of file.tracks) {
    const track = createTrack(t.name)
    track.volume = t.volume
    track.mute = t.mute
    track.solo = t.solo
    for (const c of t.clips) {
      const clip = createClip(c.file, c.duration, c.start, c.offset)
      clip.fadeIn = c.fadeIn
      clip.fadeOut = c.fadeOut
      track.clips.push(clip)
      project.buffers.get(c.file)!.refCount++
    }
    track.clips.sort((a, b) => a.start - b.start)
    project.tracks.push(track)
  }

  // 4. Reject files that break the invariants (e.g. overlapping clips)
  const problems = checkInvariants(project)
  if (problems.length > 0) return err(`Project file is invalid: ${problems[0]}`)
  return ok({ project, missing })
}

async function loadAudio(path: string, fs: FileSystem, io: AudioIO, sampleRate: number): Promise<AudioData | null> {
  if (!(await fs.exists(path))) return null
  const bytes = await fs.readFile(path)
  if (!bytes.ok) return null
  const decoded = await io.decode(path, bytes.value, sampleRate)
  if (!decoded.ok) return null
  decoded.value.refCount = 0     // counted again in step 3
  return decoded.value
}

function placeholder(path: string, sampleRate: number): AudioData {
  const buf = createAudioData(path, [], sampleRate)
  buf.missing = true
  return buf
}