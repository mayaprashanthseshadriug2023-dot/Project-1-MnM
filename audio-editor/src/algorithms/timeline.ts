// Timeline Editing (A2 Algorithms 3 and 4). Pure functions on the model; no UI or audio.
import type { Clip, Project, Result, Samples, Track } from '../model/types'
import { ok, err, clipEnd } from '../model/types'
import { createClip } from '../model/project'

/** Binary search: first index i with clips[i].start >= s. O(log n). */
export function lowerBound(clips: Clip[], s: Samples): number {
  let lo = 0
  let hi = clips.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (clips[mid].start < s) lo = mid + 1
    else hi = mid
  }
  return lo
}

// ---------- Algorithm 3: placement ----------

/** The overlap check of Algorithm 3, without changing anything. Also used for the red drag preview. */
export function canPlace(track: Track, c: Clip, s: Samples): boolean {
  if (!Number.isInteger(s) || s < 0) return false
  const clips = track.clips
  const i = lowerBound(clips, s)

  // Neighbours of position s, skipping c itself if it is already on the track
  let p = i - 1
  let n = i
  if (clips[p] === c) p--
  if (clips[n] === c) n++
  const prev = clips[p]
  const next = clips[n]

  // Only the two neighbours can overlap, because clips are sorted and non-overlapping
  return !((prev && clipEnd(prev) > s) || (next && s + c.duration > next.start))
}

/**
 * Place clip c on track at start s, or reject with the track unchanged (FR2, ER2).
 * c may already be on the track (a move) or be new (an import).
 */
export function placeClip(track: Track, c: Clip, s: Samples): Result {
  if (!Number.isInteger(s) || s < 0) return err('Clip cannot start before 0')
  if (!canPlace(track, c, s)) return err('Clip overlaps another clip')

  // All checks passed: now change the track
  const clips = track.clips
  const old = clips.indexOf(c)
  if (old !== -1) clips.splice(old, 1)
  c.start = s
  clips.splice(lowerBound(clips, s), 0, c)
  return ok(undefined)
}

// ---------- Algorithm 4: trim, split, remove ----------

/** Keeps fadeIn + fadeOut <= duration. Called after every trim or split. */
export function fitFades(c: Clip): void {
  c.fadeIn = Math.min(c.fadeIn, c.duration)
  c.fadeOut = Math.min(c.fadeOut, c.duration - c.fadeIn)
}

/** Finds c's index by binary search (start times are unique on a track). */
function indexOf(track: Track, c: Clip): number {
  const i = lowerBound(track.clips, c.start)
  return track.clips[i] === c ? i : -1
}

/** Move the left edge by delta: delta > 0 shortens the clip, delta < 0 extends it. */
export function trimLeft(track: Track, c: Clip, delta: Samples): Result {
  const i = indexOf(track, c)
  if (i === -1) return err('Clip is not on this track')
  const prev = track.clips[i - 1]

  const offset = c.offset + delta
  const start = c.start + delta
  const duration = c.duration - delta
  if (offset < 0) return err('Cannot extend before the start of the audio')
  if (start < 0) return err('Clip cannot start before 0')
  if (duration <= 0) return err('Clip would have no length')
  if (prev && clipEnd(prev) > start) return err('Clip overlaps another clip')

  c.offset = offset
  c.start = start
  c.duration = duration
  fitFades(c)
  return ok(undefined)
}

/** Move the right edge by delta: delta > 0 shortens the clip, delta < 0 extends it. */
export function trimRight(project: Project, track: Track, c: Clip, delta: Samples): Result {
  const i = indexOf(track, c)
  if (i === -1) return err('Clip is not on this track')
  const next = track.clips[i + 1]
  const buf = project.buffers.get(c.bufferId)

  const duration = c.duration - delta
  if (duration <= 0) return err('Clip would have no length')
  if (buf && !buf.missing && c.offset + duration > buf.length)
    return err('Cannot extend past the end of the audio')
  if (next && c.start + duration > next.start) return err('Clip overlaps another clip')

  c.duration = duration
  fitFades(c)
  return ok(undefined)
}

/** Split c at timeline position p into two clips sharing the same buffer. */
export function splitClip(project: Project, track: Track, c: Clip, p: Samples): Result<[Clip, Clip]> {
  const i = indexOf(track, c)
  if (i === -1) return err('Clip is not on this track')
  if (!(c.start < p && p < clipEnd(c))) return err('Split point must be inside the clip')

  const d = p - c.start
  const c1 = createClip(c.bufferId, d, c.start, c.offset)
  c1.fadeIn = c.fadeIn                     // first half keeps the fade-in
  const c2 = createClip(c.bufferId, c.duration - d, p, c.offset + d)
  c2.fadeOut = c.fadeOut                   // second half keeps the fade-out
  fitFades(c1)
  fitFades(c2)

  track.clips.splice(i, 1, c1, c2)         // replace c with c1, c2 right after it
  const buf = project.buffers.get(c.bufferId)
  if (buf) buf.refCount++                  // one clip became two
  return ok([c1, c2])
}

/** Remove c; free its buffer when no clip uses it any more. */
export function removeClip(project: Project, track: Track, c: Clip): Result {
  const i = indexOf(track, c)
  if (i === -1) return err('Clip is not on this track')
  track.clips.splice(i, 1)

  const buf = project.buffers.get(c.bufferId)
  if (buf) {
    buf.refCount--
    if (buf.refCount === 0) project.buffers.delete(c.bufferId)
  }
  return ok(undefined)
}