import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Project } from '../model/types'
import { drawTimeline } from './draw'
import { RULER_H, ROW_H, rowAt, samplesAt, xOf, type View } from './geometry'

interface Props {
  project: Project
  version: number                       // changes whenever the project changes, so the canvas redraws
  view: View
  cursor: number                        // cursor position in samples
  onSeek: (samples: number) => void
  onSelectTrack: (index: number) => void
}

export function Timeline({ project, version, view, cursor, onSeek, onSelectTrack }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const height = RULER_H + project.tracks.length * ROW_H

  // The canvas covers only the visible width (A3 3.4)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Redraw only when the project, zoom, scroll or size changes, never on every frame
  useEffect(() => {
    const c = canvas.current
    if (!c || width === 0) return
    const dpr = window.devicePixelRatio || 1           // sharp on Retina screens
    c.width = width * dpr
    c.height = height * dpr
    c.style.width = `${width}px`
    c.style.height = `${height}px`
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawTimeline(ctx, project, view, width, height)
  }, [project, version, view.pps, view.scrollX, view.sampleRate, width, height])  // eslint-disable-line react-hooks/exhaustive-deps

  function onMouseDown(e: MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const row = rowAt(y)
    if (row === -1) onSeek(samplesAt(x, view))          // click on the ruler moves the cursor
    else if (row < project.tracks.length) onSelectTrack(row)
  }

  const cursorX = xOf(cursor, view)
  return (
    <div className="timeline" ref={wrap}>
      <canvas ref={canvas} onMouseDown={onMouseDown} />
      {/* The cursor is a separate line, so it can move every frame without redrawing the canvas */}
      {cursorX >= 0 && cursorX <= width && (
        <div className="cursor" style={{ transform: `translateX(${cursorX}px)`, height }} />
      )}
    </div>
  )
}