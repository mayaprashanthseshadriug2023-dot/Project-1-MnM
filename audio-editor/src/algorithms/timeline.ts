// Timeline Editing (A2 Algorithms 3 and 4). Pure functions on the model; no UI or audio.
import type { Clip, Result, Samples, Track } from '../model/types'
import { ok, err, clipEnd } from '../model/types'

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

/**
 * Algorithm 3: place clip c on track at start s, or reject with the track unchanged (FR2, ER2).
 * c may already be on the track (a move) or be new (an import).
 */
export function placeClip(track: Track, c: Clip, s: Samples): Result {
  if (!Number.isInteger(s) || s < 0) return err('Clip cannot start before 0')

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
  if ((prev && clipEnd(prev) > s) || (next && s + c.duration > next.start))
    return err('Clip overlaps another clip')

  // All checks passed: now change the track
  const old = clips.indexOf(c)
  if (old !== -1) clips.splice(old, 1)
  c.start = s
  clips.splice(lowerBound(clips, s), 0, c)
  return ok(undefined)
}