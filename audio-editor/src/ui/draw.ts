// Draws the ruler, track lanes and clips (with waveforms and fades) onto the timeline canvas.
import type { Clip, Project } from '../model/types'
import { RULER_H, ROW_H, type View, tickStep, xOf } from './geometry'

const C = {
  bg: '#14161a', lane: '#181b20', line: '#2c3038', ruler: '#1d2026', text: '#9aa0a6',
  clip: '#2a3550', clipBorder: '#4f8cff', peak: '#7fa8ff', rms: '#c3d6ff',
  missing: '#3a3d44', fade: '#f2c94c', label: '#e8eaed',
}

export function drawTimeline(ctx: CanvasRenderingContext2D, project: Project, v: View, width: number, height: number): void {
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, width, height)
  drawRuler(ctx, v, width)
  project.tracks.forEach((track, row) => {
    const top = RULER_H + row * ROW_H
    ctx.fillStyle = C.lane
    ctx.fillRect(0, top, width, ROW_H)
    ctx.fillStyle = C.line
    ctx.fillRect(0, top + ROW_H - 1, width, 1)
    for (const clip of track.clips) drawClip(ctx, project, clip, v, top, width)
  })
}

function drawRuler(ctx: CanvasRenderingContext2D, v: View, width: number): void {
  ctx.fillStyle = C.ruler
  ctx.fillRect(0, 0, width, RULER_H)
  const step = tickStep(v.pps)
  const first = Math.floor(v.scrollX / v.pps / step) * step
  ctx.fillStyle = C.text
  ctx.font = '11px system-ui'
  ctx.textBaseline = 'middle'
  for (let s = first; ; s += step) {
    const x = s * v.pps - v.scrollX
    if (x > width) break
    ctx.fillRect(Math.round(x), RULER_H - 8, 1, 8)
    ctx.fillText(`${+s.toFixed(2)}s`, x + 3, RULER_H / 2 - 2)
  }
}

function drawClip(ctx: CanvasRenderingContext2D, project: Project, clip: Clip, v: View, top: number, width: number): void {
  const x = xOf(clip.start, v)
  const w = (clip.duration / v.sampleRate) * v.pps
  if (x > width || x + w < 0) return                     // off screen: skip (draw only the visible range)

  const y = top + 4
  const h = ROW_H - 8
  const buf = project.buffers.get(clip.bufferId)
  const missing = !buf || buf.missing
  ctx.fillStyle = missing ? C.missing : C.clip
  ctx.fillRect(x, y, w, h)

  // Waveform: one column per pixel, using only the windows inside the clip's offset and duration
  if (buf?.waveform && !missing) {
    const { peak, rms, windowSize } = buf.waveform
    const mid = y + h / 2
    const samplesPerPx = v.sampleRate / v.pps
    const from = Math.max(0, Math.floor(-x))
    const to = Math.min(w, width - x)
    for (let px = from; px < to; px++) {
      const s0 = clip.offset + px * samplesPerPx
      const i0 = Math.floor(s0 / windowSize)
      const i1 = Math.max(i0 + 1, Math.floor((s0 + samplesPerPx) / windowSize))
      let p = 0
      let r = 0
      for (let i = i0; i < i1 && i < peak.length; i++) { p = Math.max(p, peak[i]); r = Math.max(r, rms[i]) }
      ctx.fillStyle = C.peak
      ctx.fillRect(x + px, mid - (p * h) / 2, 1, p * h)
      ctx.fillStyle = C.rms
      ctx.fillRect(x + px, mid - (r * h) / 2, 1, r * h)
    }
  }

  // Fades as yellow lines
  ctx.strokeStyle = C.fade
  ctx.lineWidth = 1.5
  if (clip.fadeIn > 0) {
    const fx = x + (clip.fadeIn / v.sampleRate) * v.pps
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(fx, y); ctx.stroke()
  }
  if (clip.fadeOut > 0) {
    const fx = x + w - (clip.fadeOut / v.sampleRate) * v.pps
    ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(x + w, y + h); ctx.stroke()
  }

  // Border and name (missing files are grey and labelled, ER3)
  ctx.strokeStyle = missing ? C.text : C.clipBorder
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.fillStyle = C.label
  ctx.font = '12px system-ui'
  ctx.textBaseline = 'top'
  const name = missing ? `${clip.bufferId} (missing)` : clip.bufferId
  ctx.fillText(name, Math.max(x, 0) + 6, y + 4, Math.max(0, w - 12))
}