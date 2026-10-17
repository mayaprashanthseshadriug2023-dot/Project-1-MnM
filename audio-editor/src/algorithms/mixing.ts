// Effects and Mixing (A2 Algorithm 6): the maths of fades, volume and mute/solo.
// Pure functions; the Web Audio wiring that uses them is in system/mixer.ts.
import type { Clip, Project, Samples, Track } from '../model/types'
import { clipEnd } from '../model/types'

/** ApplyAudibility: soloed tracks if any track is soloed, otherwise all unmuted tracks. */
export function trackGains(tracks: Track[]): Map<string, number> {
  const anySolo = tracks.some(t => t.solo)
  const gains = new Map<string, number>()
  for (const t of tracks) {
    const audible = anySolo ? t.solo : !t.mute
    gains.set(t.id, audible ? t.volume : 0)        // muted = gain 0, not removed (A2)
  }
  return gains
}

/** EnvGain: the fade multiplier at sample t of a clip (0 <= t < duration). */
export function envGain(t: Samples, duration: Samples, fadeIn: Samples, fadeOut: Samples): number {
  if (t < fadeIn) return t / fadeIn                              // fade-in: 0 -> 1
  if (t >= duration - fadeOut) return (duration - t) / fadeOut   // fade-out: 1 -> 0
  return 1
}

export interface EnvelopePoint { at: Samples; value: number }    // `at` is relative to the clip start

/**
 * The fade envelope as points for the audio system to ramp between, starting `from` samples
 * into the clip (from > 0 after a seek). The first point is set; the rest are linear ramps.
 */
export function envelopePoints(c: Clip, from: Samples = 0): EnvelopePoint[] {
  const points: EnvelopePoint[] = [{ at: from, value: envGain(from, c.duration, c.fadeIn, c.fadeOut) }]
  if (from < c.fadeIn) points.push({ at: c.fadeIn, value: 1 })   // finish the fade-in
  if (c.fadeOut > 0) {
    const holdEnd = c.duration - c.fadeOut
    if (from < holdEnd) points.push({ at: holdEnd, value: 1 })   // hold at full volume
    points.push({ at: c.duration, value: 0 })                    // fade out to silence
  }
  return points
}

/** Length of the exported mix (S): the latest clip end. Clips are sorted, so check each track's last. */
export function mixLength(project: Project): Samples {
  let end = 0
  for (const t of project.tracks) {
    const last = t.clips[t.clips.length - 1]
    if (last) end = Math.max(end, clipEnd(last))
  }
  return end
}