import { useEffect, useRef, useState } from 'react'
import type { ProjectController } from '../core/controller'
import type { Result } from '../model/types'
import { TrackHeader } from './TrackHeader'
import { Timeline } from './Timeline'
import { formatTime } from './format'
import { projectEnd } from './geometry'

interface Props {
  controller: ProjectController                    // the UI's only way to change anything (A2 Section 4)
  registerFile: (file: File) => Promise<string>    // hands a picked file to the system layer, returns its path
}

export function App({ controller, registerFile }: Props) {
  const [version, setVersion] = useState(0)
  const refresh = () => setVersion(v => v + 1)     // redraw after the controller changes the project
  const [status, setStatus] = useState('Add a track, then import an audio file')
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [time, setTime] = useState(0)
  const [pps, setPps] = useState(100)              // zoom: pixels per second
  const [scrollX, setScrollX] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const hscroll = useRef<HTMLDivElement>(null)
  const project = controller.project
  const view = { pps, scrollX, sampleRate: project.sampleRate }
  const contentWidth = (projectEnd(project) / project.sampleRate + 30) * pps   // 30 s of room after the last clip

  /** Shows a command's error in the status bar (or a success message), then redraws. */
  function run(result: Result<unknown>, success?: string) {
    if (!result.ok) setStatus(result.error)
    else if (success) setStatus(success)
    refresh()
  }

  // Move the time display and cursor during playback, at most once per frame (A3 3.4)
  useEffect(() => {
    let frame = 0
    const loop = () => { setTime(controller.position()); frame = requestAnimationFrame(loop) }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [controller])

  // Window title shows * while there are unsaved changes (A3 4.4)
  useEffect(() => {
    document.title = `${controller.dirty ? '* ' : ''}Multi-Track Audio Editor`
  })

  function addTrack() {
    const track = controller.addTrack(`Track ${project.tracks.length + 1}`)
    setSelectedTrack(track.id)
    refresh()
  }

  async function importFiles(files: FileList | null) {
    const trackId = selectedTrack ?? project.tracks[0]?.id
    if (!trackId) { setStatus('Add a track first'); return }
    for (const file of Array.from(files ?? [])) {
      setStatus(`Loading ${file.name}…`)           // feedback while decoding (A3 4.4)
      const path = await registerFile(file)
      const result = await controller.importAudio(path, trackId)
      setStatus(result.ok ? `Imported ${file.name}` : `${file.name}: ${result.error}`)   // names the file (A3 4.5)
      refresh()
    }
  }

  const zoom = (factor: number) => setPps(p => Math.min(2000, Math.max(5, p * factor)))

  return (
    <div className="app">
      <header className="toolbar">
        <button onClick={addTrack}>+ Track</button>
        <button onClick={() => fileInput.current?.click()}>Import</button>
        <input ref={fileInput} type="file" accept=".wav,.mp3,audio/*" multiple hidden
          onChange={e => { void importFiles(e.target.files); e.target.value = '' }} />
        <span className="divider" />
        <button onClick={() => { controller.play(); refresh() }} disabled={controller.isPlaying()}>Play</button>
        <button onClick={() => { controller.pause(); refresh() }}>Pause</button>
        <button onClick={() => { controller.stop(); refresh() }}>Stop</button>
        <span className="divider" />
        <button onClick={() => zoom(1 / 1.5)} title="Zoom out" aria-label="Zoom out">−</button>
        <span className="zoom-label">Zoom</span>
        <button onClick={() => zoom(1.5)} title="Zoom in" aria-label="Zoom in">+</button>
        <span className="time" aria-label="Cursor time">{formatTime(time, project.sampleRate)}</span>
      </header>

      {project.tracks.length === 0 ? (
        <p className="empty">No tracks yet. Click “+ Track” to start.</p>
      ) : (
        <main className="editor">
          <div className="editor-body"
            onWheel={e => {                                      // trackpad swipe or Shift+wheel scrolls sideways
              const dx = e.shiftKey ? e.deltaY : e.deltaX
              if (dx && hscroll.current) hscroll.current.scrollLeft += dx
            }}>
            <div className="headers">
              <div className="ruler-corner" />
              {project.tracks.map(track => (
                <TrackHeader key={track.id} track={track} selected={track.id === selectedTrack}
                  onSelect={() => setSelectedTrack(track.id)}
                  onChange={settings => run(controller.setTrack(track.id, settings))} />
              ))}
            </div>
            <Timeline project={project} version={version} view={view} cursor={time}
              onSeek={s => { controller.seek(s); refresh() }}
              onSelectTrack={i => setSelectedTrack(project.tracks[i].id)} />
          </div>
          <div className="hscroll" ref={hscroll} onScroll={e => setScrollX(e.currentTarget.scrollLeft)}>
            <div style={{ width: contentWidth }} />
          </div>
        </main>
      )}

      <footer className="status-bar">
        <span>{project.sampleRate / 1000} kHz</span>
        <span role="status">{status}</span>
      </footer>
    </div>
  )
}