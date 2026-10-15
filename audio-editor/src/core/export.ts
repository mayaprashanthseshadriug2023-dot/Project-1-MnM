// Export (A2 Algorithm 1 + 6): render the mix, encode as WAV, write safely (ER4).
import type { AudioIO, FileSystem, RenderMix } from '../model/contracts'
import type { Project, Result } from '../model/types'
import { err } from '../model/types'

export async function exportWav(
  project: Project, path: string, renderMix: RenderMix, io: AudioIO, fs: FileSystem,
): Promise<Result> {
  if (project.tracks.every(t => t.clips.length === 0)) return err('Nothing to export')

  const mix = await renderMix(project)                         // Algorithm 6 (Mrinalini)
  if (!mix.ok) return err(`Export failed: ${mix.error}`)
  const bytes = io.encodeWav(mix.value, project.sampleRate)    // clamps to [-1, 1]

  // Write to a temporary file, then rename: a failed export never leaves a partial file
  const tmp = path + '.tmp'
  const written = await fs.writeFile(tmp, bytes)
  if (!written.ok) {
    await fs.remove(tmp)
    return err(`Export failed: ${written.error}`)
  }
  return fs.rename(tmp, path)
}