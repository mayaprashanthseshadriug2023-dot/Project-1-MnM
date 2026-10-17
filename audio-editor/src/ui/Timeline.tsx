import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Clip, Project } from '../model/types'
import { drawTimeline, type Preview } from './draw'
import { RULER_H, ROW_H, rowAt, samplesAt, xOf, type View } from './geometry'
import { hitTest, type ClipPart } from './hit'

/** An edit the user made by dragging. The App passes it to the controller. */
export type Edit =
  | { kind: 'move'; clipId: string; trackId: string; start: number }
  | { kind: 'trim'; clipId: string; edge: 'left' | 'right'; delta: number }
  | { kind: 'fades'; clipId: string; fadeIn: number; fadeOut: number }

interface Drag { part: ClipPart; clip: Clip; row: number; startX: number; startY: number }

interface Props {
  project: Project
  version: number                       // changes whenever the project changes, so the canvas redraws
  view: View
  cursor: number                        // cursor position in samples
  selectedClip: string | null
  onSelectClip: (id: string | null) => void
  onSelectTrack: (index: number) => void
  onSeek: (samples: number) => void
  onEdit: (edit: Edit) => void
  canMove: (clipId: string, trackId: string, start: number) => boolean
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))
const CLICK = 3                         // moving less than this many px is a click, not a drag

export function Timeline(props: Props) {
  const { project, version, view, cursor, selectedClip, onSelectClip, onSelectTrack, onSeek, onEdit, canMove } = props
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Drag | null>(null)
  const [width, setWidth] = useState(0)
  const [preview, setPreview] = useState<Preview | null>(null)
  const height = RULER_H + project.tracks.length * ROW_H

  // The canvas covers only the visible width (A3 3.4)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Redraw only when something visible changes, never on every frame
  useEffect(() => {
    const c = canvas.current
    if (!c || width === 0) return
    const dpr = window.devicePixelRatio || 1
    c.width = width * dpr
    c.height = height * dpr
    c.style.width = `${width}px`
    c.style.height = `${height}px`
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawTimeline(ctx, project, view, width, height, selectedClip, preview)
  }, [project, version, view.pps, view.scrollX, view.sampleRate, width, height, selectedClip, preview])  // eslint-disable-line react-hooks/exhaustive-deps

  function pointer(e: { clientX: number; clientY: number }) {
    const rect = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  /** Turns a drag into the edit it would make, plus a preview to draw. */
  function editFor(d: Drag, x: number, y: number): { edit: Edit; preview: Preview } {
    const dx = Math.round(((x - d.startX) / view.pps) * view.sampleRate)   // how far, in samples
    const c = d.clip
    switch (d.part) {
      case 'body': {
        const row = clamp(rowAt(y), 0, project.tracks.length - 1)
        const start = Math.max(0, c.start + dx)
        const trackId = project.tracks[row].id
        return {
          edit: { kind: 'move', clipId: c.id, trackId, start },
          preview: { row, start, duration: c.duration, fadeIn: c.fadeIn, fadeOut: c.fadeOut,
            valid: canMove(c.id, trackId, start) },
        }
      }
      case 'left': {
        const delta = Math.min(dx, c.duration - 1)                         // > 0 shortens
        return {
          edit: { kind: 'trim', clipId: c.id, edge: 'left', delta },
          preview: { row: d.row, start: c.start + delta, duration: c.duration - delta, fadeIn: 0, fadeOut: 0,
            valid: c.offset + delta >= 0 && c.start + delta >= 0 },
        }
      }
      case 'right': {
        const delta = Math.min(-dx, c.duration - 1)                        // dragging right extends
        return {
          edit: { kind: 'trim', clipId: c.id, edge: 'right', delta },
          preview: { row: d.row, start: c.start, duration: c.duration - delta, fadeIn: 0, fadeOut: 0, valid: true },
        }
      }
      case 'fadeIn': {
        const fadeIn = clamp(c.fadeIn + dx, 0, c.duration - c.fadeOut)
        return {
          edit: { kind: 'fades', clipId: c.id, fadeIn, fadeOut: c.fadeOut },
          preview: { row: d.row, start: c.start, duration: c.duration, fadeIn, fadeOut: c.fadeOut, valid: true },
        }
      }
      case 'fadeOut': {
        const fadeOut = clamp(c.fadeOut - dx, 0, c.duration - c.fadeIn)
        return {
          edit: { kind: 'fades', clipId: c.id, fadeIn: c.fadeIn, fadeOut },
          preview: { row: d.row, start: c.start, duration: c.duration, fadeIn: c.fadeIn, fadeOut, valid: true },
        }
      }
    }
  }

  function onMouseDown(e: MouseEvent<HTMLCanvasElement>) {
    const { x, y } = pointer(e)
    const hit = hitTest(project, view, x, y)
    if (hit.kind === 'ruler') { onSeek(samplesAt(x, view)); return }      // click on the ruler moves the cursor
    if (hit.kind === 'lane') { onSelectTrack(hit.row); onSelectClip(null); return }
    if (hit.kind !== 'clip') return
    onSelectTrack(hit.row)
    onSelectClip(hit.clip.id)
    drag.current = { part: hit.part, clip: hit.clip, row: hit.row, startX: x, startY: y }
  }

  // Show what the mouse can do here
  function onHover(e: MouseEvent<HTMLCanvasElement>) {
    if (drag.current) return
    const { x, y } = pointer(e)
    const hit = hitTest(project, view, x, y)
    e.currentTarget.style.cursor =
      hit.kind === 'ruler' ? 'pointer' : hit.kind !== 'clip' ? 'default' : hit.part === 'body' ? 'grab' : 'ew-resize'
  }

  // While dragging, follow the mouse anywhere on the page
  useEffect(() => {
    const isClick = (d: Drag, x: number, y: number) => Math.abs(x - d.startX) < CLICK && Math.abs(y - d.startY) < CLICK
    function move(e: globalThis.MouseEvent) {
      const d = drag.current
      if (!d) return
      const { x, y } = pointer(e)
      if (!isClick(d, x, y)) setPreview(editFor(d, x, y).preview)        // only the preview moves
    }
    function up(e: globalThis.MouseEvent) {
      const d = drag.current
      if (!d) return
      drag.current = null
      setPreview(null)
      const { x, y } = pointer(e)
      if (!isClick(d, x, y)) onEdit(editFor(d, x, y).edit)              // the model changes once, on drop
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  })

  const cursorX = xOf(cursor, view)
  return (
    <div className="timeline" ref={wrap}>
      <canvas ref={canvas} onMouseDown={onMouseDown} onMouseMove={onHover} />
      {/* The cursor is a separate line, so it can move every frame without redrawing the canvas */}
      {cursorX >= 0 && cursorX <= width && (
        <div className="cursor" style={{ transform: `translateX(${cursorX}px)`, height }} />
      )}
    </div>
  )
}