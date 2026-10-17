// Converting between timeline samples and canvas pixels. Pure, so it can be tested.
import type { Project } from '../model/types'

export const RULER_H = 28       // height of the time ruler (px)
export const ROW_H = 72         // height of each track lane (px)

/** pps = zoom in pixels per second; scrollX = how far the timeline is scrolled (px). */
export interface View { pps: number; scrollX: number; sampleRate: number }

export const xOf = (samples: number, v: View): number => (samples / v.sampleRate) * v.pps - v.scrollX

export const samplesAt = (x: number, v: View): number =>
  Math.max(0, Math.round(((x + v.scrollX) / v.pps) * v.sampleRate))

/** Which track row is at height y: -1 means the ruler. */
export const rowAt = (y: number): number => (y < RULER_H ? -1 : Math.floor((y - RULER_H) / ROW_H))

/** Seconds between ruler labels, so labels are at least 70 px apart at any zoom. */
export function tickStep(pps: number): number {
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  return steps.find(s => s * pps >= 70) ?? 600
}

/** End of the last clip, for sizing the scroll area. */
export function projectEnd(project: Project): number {
  let end = 0
  for (const t of project.tracks) {
    const last = t.clips[t.clips.length - 1]
    if (last) end = Math.max(end, last.start + last.duration)
  }
  return end
}