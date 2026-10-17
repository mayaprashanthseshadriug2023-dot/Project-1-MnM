// checkInvariants (A3 Section 2.1): returns a list of problems; empty means the project is valid.
import type { Project } from './types'
import { clipEnd } from './types'

export function checkInvariants(project: Project): string[] {
  const errors: string[] = []
  const uses = new Map<string, number>()   // bufferId -> number of clips using it

  for (const track of project.tracks) {
    track.clips.forEach((c, i) => {
      const where = `${track.name} clip ${i}`

      // 1. Sorted by start and no overlaps (touching is allowed)
      if (i > 0 && clipEnd(track.clips[i - 1]) > c.start)
        errors.push(`${where}: overlaps or is out of order`)

      // 2. offset >= 0, duration > 0, offset + duration <= buffer length
      if (c.start < 0 || c.offset < 0 || c.duration <= 0)
        errors.push(`${where}: invalid start, offset or duration`)
      const buf = project.buffers.get(c.bufferId)
      if (!buf) errors.push(`${where}: buffer not found`)
      else if (!buf.missing && c.offset + c.duration > buf.length)
        errors.push(`${where}: runs past the end of its buffer`)

      // 3. fadeIn + fadeOut <= duration
      if (c.fadeIn < 0 || c.fadeOut < 0 || c.fadeIn + c.fadeOut > c.duration)
        errors.push(`${where}: fades do not fit`)

      uses.set(c.bufferId, (uses.get(c.bufferId) ?? 0) + 1)
    })
  }

  // 4. Each buffer's refCount equals the number of clips using it
  for (const [id, buf] of project.buffers) {
    const used = uses.get(id) ?? 0
    if (buf.refCount !== used)
      errors.push(`buffer ${id}: refCount ${buf.refCount} but used by ${used} clips`)
  }
  return errors
}