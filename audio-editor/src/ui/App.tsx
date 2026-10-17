import { useEffect, useRef, useState } from 'react'
import type { ProjectController } from '../core/controller'
import type { Result } from '../model/types'
import { TrackHeader } from './TrackHeader'
import { formatTime } from './format'

interface Props {
  controller: ProjectController                    // the UI's only way to change anything (A2 Section 4)
  registerFile: (file: File) => Promise<string>    // hands a picked file to the system layer, returns its path
}

export function App({ controller, registerFile }: Props) {
  const [, setVersion] = useState(0)
  const refresh = () => setVersion(v => v + 1)     // redraw after the controller changes the project
  const [status, setStatus] = useState('Add a track, then import an audio file')
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [time, setTime] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const project = controller.project

  /** Shows a command's error in the status bar (or a success message), then redraws. */
  function run(result: Result<unknown>, success?: string) {
    if (!result.ok) setStatus(result.error)
    else if (success) setStatus(success)
    refresh()
  }

  // Move the time display during playback, at most once per frame (A3 3.4)
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
      // Error messages name the file (A3 4.5)
      setStatus(result.ok ? `Imported ${file.name}` : `${file.name}: ${result.error}`)
      refresh()
    }
  }

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
        <span className="time" aria-label="Cursor time">{formatTime(time, project.sampleRate)}</span>
      </header>

      <main className="tracks">
        {project.tracks.length === 0 && <p className="empty">No tracks yet. Click “+ Track” to start.</p>}
        {project.tracks.map(track => (
          <div className="track-row" key={track.id}>
            <TrackHeader track={track} selected={track.id === selectedTrack}
              onSelect={() => setSelectedTrack(track.id)}
              onChange={settings => run(controller.setTrack(track.id, settings))} />
            <div className="track-clips">
              {track.clips.map(c => (
                <span className="clip-chip" key={c.id}>
                  {c.bufferId} · {formatTime(c.start, project.sampleRate)}–{formatTime(c.start + c.duration, project.sampleRate)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </main>

      <footer className="status-bar">
        <span>{project.sampleRate / 1000} kHz</span>
        <span role="status">{status}</span>
      </footer>
    </div>
  )
}