// Hit testing: what is under the mouse on the timeline canvas. Pure, so it can be tested.
import type { Clip, Project } from '../model/types'
import { RULER_H, ROW_H, rowAt, xOf, type View } from './geometry'

export type ClipPart = 'body' | 'left' | 'right' | 'fadeIn' | 'fadeOut'
export type Hit =
  | { kind: 'ruler' }
  | { kind: 'clip'; row: number; clip: Clip; part: ClipPart }
  | { kind: 'lane'; row: number }
  | { kind: 'none' }

const EDGE = 6      // px either side of a clip edge that counts as grabbing the edge
const HANDLE = 7    // px around a fade handle that counts as grabbing it

/** Fade handles sit on the clip's top edge, at the end of the fade-in and the start of the fade-out. */
export function fadeHandles(clip: Clip, v: View, top: number): { inX: number; outX: number; y: number } {
  const x = xOf(clip.start, v)
  const w = (clip.duration / v.sampleRate) * v.pps
  return {
    inX: x + (clip.fadeIn / v.sampleRate) * v.pps,
    outX: x + w - (clip.fadeOut / v.sampleRate) * v.pps,
    y: top + 4,
  }
}

export function hitTest(project: Project, v: View, x: number, y: number): Hit {
  const row = rowAt(y)
  if (row === -1) return { kind: 'ruler' }
  const track = project.tracks[row]
  if (!track) return { kind: 'none' }
  const top = RULER_H + row * ROW_H

  for (const clip of track.clips) {
    const cx = xOf(clip.start, v)
    const cw = (clip.duration / v.sampleRate) * v.pps
    if (x < cx - EDGE || x > cx + cw + EDGE) continue
    const h = fadeHandles(clip, v, top)
    if (Math.abs(y - h.y) <= HANDLE) {                                // top edge: fade handles first
      if (Math.abs(x - h.inX) <= HANDLE) return { kind: 'clip', row, clip, part: 'fadeIn' }
      if (Math.abs(x - h.outX) <= HANDLE) return { kind: 'clip', row, clip, part: 'fadeOut' }
    }
    if (Math.abs(x - cx) <= EDGE) return { kind: 'clip', row, clip, part: 'left' }
    if (Math.abs(x - (cx + cw)) <= EDGE) return { kind: 'clip', row, clip, part: 'right' }
    if (x >= cx && x <= cx + cw) return { kind: 'clip', row, clip, part: 'body' }
  }
  return { kind: 'lane', row }
}