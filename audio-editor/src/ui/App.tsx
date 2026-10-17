import { useEffect, useRef, useState } from 'react'
import type { ProjectController } from '../core/controller'
import type { Result } from '../model/types'
import { TrackHeader } from './TrackHeader'
import { Timeline, type Edit } from './Timeline'
import { formatTime } from './format'
import { projectEnd } from './geometry'

interface Props {
  controller: ProjectController                    // the UI's only way to change anything (A2 Section 4)
  registerFile: (file: File) => Promise<string>    // hands a picked file to the system layer, returns its path
}

const HELP = 'Drag clips to move · drag edges to trim · drag yellow squares for fades · S split · Delete remove · Space play'
const LARGE_FILE_MB = 50                           // warn before importing files this big (A3 3.5)

export function App({ controller, registerFile }: Props) {
  const [version, setVersion] = useState(0)
  const refresh = () => setVersion(v => v + 1)     // redraw after the controller changes the project
  const [status, setStatus] = useState('Add a track, then import an audio file')
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [selectedClip, setSelectedClip] = useState<string | null>(null)
  const [time, setTime] = useState(0)
  const [pps, setPps] = useState(100)              // zoom: pixels per second
  const [scrollX, setScrollX] = useState(0)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)          // true while exporting
  const importInput = useRef<HTMLInputElement>(null)
  const openInput = useRef<HTMLInputElement>(null)
  const relinkInput = useRef<HTMLInputElement>(null)
  const relinkTarget = useRef<string | null>(null)
  const hscroll = useRef<HTMLDivElement>(null)
  const project = controller.project
  const sr = project.sampleRate
  const view = { pps, scrollX, sampleRate: sr }
  const contentWidth = (projectEnd(project) / sr + 30) * pps   // 30 s of room after the last clip
  const missing = [...project.buffers.values()].filter(b => b.missing).map(b => b.id)

  /** Shows a command's error in the status bar (or a success message), then redraws. */
  function run(result: Result<unknown>, success?: string) {
    if (!result.ok) setStatus(result.error)
    else if (success) setStatus(success)
    refresh()
  }

  /** After an edit during playback, restart from the current position so the change is heard at once. */
  function afterEdit() {
    if (controller.isPlaying()) controller.seek(controller.position())
  }

  function applyEdit(edit: Edit) {
    if (edit.kind === 'move') run(controller.moveClip(edit.clipId, edit.trackId, edit.start), `Clip moved to ${formatTime(edit.start, sr)}`)
    else if (edit.kind === 'trim') run(controller.trimClip(edit.clipId, edit.edge, edit.delta), 'Clip trimmed')
    else run(controller.setFades(edit.clipId, edit.fadeIn, edit.fadeOut), 'Fades updated')
    afterEdit()
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
    document.title = `${controller.dirty ? '* ' : ''}${projectName ?? 'Untitled'} – Multi-Track Audio Editor`
  })

  // Closing the page with unsaved changes asks first (A3 4.5)
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (controller.dirty) e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [controller])

  // Keyboard shortcuts (A3 4.2): Space play/pause, S split, Delete remove
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return          // leave keys alone in the volume sliders
      if (e.code === 'Space') {
        e.preventDefault()
        if (controller.isPlaying()) controller.pause()
        else controller.play()
        refresh()
      } else if (e.key === 's' || e.key === 'S') {
        if (!selectedClip) { setStatus('Select a clip to split'); return }
        run(controller.splitClipAt(selectedClip, controller.position()), 'Clip split at the cursor')
        setSelectedClip(null)
        afterEdit()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedClip) return
        run(controller.deleteClip(selectedClip), 'Clip removed')
        setSelectedClip(null)
        afterEdit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function addTrack() {
    const track = controller.addTrack(`Track ${project.tracks.length + 1}`)
    setSelectedTrack(track.id)
    setStatus(HELP)
    refresh()
  }

  async function importFiles(files: FileList | null) {
    const trackId = selectedTrack ?? project.tracks[0]?.id
    if (!trackId) { setStatus('Add a track first'); return }
    for (const file of Array.from(files ?? [])) {
      const mb = file.size / 1024 / 1024
      if (mb > LARGE_FILE_MB &&
          !window.confirm(`${file.name} is large (${Math.round(mb)} MB) and may use a lot of memory. Import anyway?`))
        continue                                    // memory warning for very large imports (A3 3.5)
      setStatus(`Loading ${file.name}…`)           // feedback while decoding (A3 4.4)
      const path = await registerFile(file)
      const result = await controller.importAudio(path, trackId)
      setStatus(result.ok ? `Imported ${file.name}. ${HELP}` : `${file.name}: ${result.error}`)   // names the file (A3 4.5)
      refresh()
    }
  }

  // ---------- Save, Open, Export (UC4, ER3, ER4) ----------

  async function save() {
    const name = projectName ?? window.prompt('Project name', 'my-project')?.trim()
    if (!name) return
    setProjectName(name)
    const result = await controller.save(`${name}.json`)
    run(result, `Saved ${name}.json`)
  }

  async function open(file: File | undefined) {
    if (!file) return
    if (controller.dirty && !window.confirm('You have unsaved changes. Open another project anyway?')) return
    const result = await controller.load(await registerFile(file))
    if (!result.ok) { setStatus(`${file.name}: ${result.error}`); return }   // current project is untouched
    setProjectName(file.name.replace(/\.json$/i, ''))
    setSelectedClip(null)
    setSelectedTrack(controller.project.tracks[0]?.id ?? null)
    const gone = result.value
    setStatus(gone.length ? `Opened ${file.name}. ${gone.length} audio file(s) missing: use Relink` : `Opened ${file.name}`)
    refresh()
  }

  async function relink(file: File | undefined) {
    const target = relinkTarget.current
    if (!file || !target) return
    const result = await controller.relink(target, await registerFile(file))
    run(result, `Relinked ${target} to ${file.name}`)
  }

  async function exportMix() {
    const name = projectName ?? 'mix'
    setBusy(true)
    setStatus('Exporting…')
    const result = await controller.exportWav(`${name}.wav`)
    setBusy(false)
    run(result, `Exported ${name}.wav`)
  }

  const zoom = (factor: number) => setPps(p => Math.min(2000, Math.max(5, p * factor)))

  return (
    <div className="app">
      <header className="toolbar">
        <button onClick={() => importInput.current?.click()}>Import</button>
        <button onClick={() => void save()}>Save</button>
        <button onClick={() => openInput.current?.click()}>Open</button>
        <button onClick={() => void exportMix()} disabled={busy}>{busy ? 'Exporting…' : 'Export'}</button>
        <span className="divider" />
        <button onClick={() => { controller.play(); refresh() }} disabled={controller.isPlaying()}>Play</button>
        <button onClick={() => { controller.pause(); refresh() }}>Pause</button>
        <button onClick={() => { controller.stop(); refresh() }}>Stop</button>
        <span className="divider" />
        <button onClick={addTrack}>+ Track</button>
        <button onClick={() => zoom(1 / 1.5)} title="Zoom out" aria-label="Zoom out">−</button>
        <span className="zoom-label">Zoom</span>
        <button onClick={() => zoom(1.5)} title="Zoom in" aria-label="Zoom in">+</button>
        <span className="time" aria-label="Cursor time">{formatTime(time, sr)}</span>

        <input ref={importInput} type="file" accept=".wav,.mp3,audio/*" multiple hidden
          onChange={e => { void importFiles(e.target.files); e.target.value = '' }} />
        <input ref={openInput} type="file" accept=".json,application/json" hidden
          onChange={e => { void open(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={relinkInput} type="file" accept=".wav,.mp3,audio/*" hidden
          onChange={e => { void relink(e.target.files?.[0]); e.target.value = '' }} />
      </header>

      {/* Missing files (ER3): say which, and offer to relink each one */}
      {missing.length > 0 && (
        <div className="missing-banner" role="alert">
          <span>Missing audio:</span>
          {missing.map(path => (
            <span key={path} className="missing-item">
              {path}
              <button onClick={() => { relinkTarget.current = path; relinkInput.current?.click() }}>Relink…</button>
            </span>
          ))}
        </div>
      )}

      {project.tracks.length === 0 ? (
        <p className="empty">No tracks yet. Click “+ Track” to start, or “Open” a saved project.</p>
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
              selectedClip={selectedClip} onSelectClip={setSelectedClip}
              onSelectTrack={i => setSelectedTrack(project.tracks[i].id)}
              onSeek={s => { controller.seek(s); refresh() }}
              onEdit={applyEdit}
              canMove={(id, trackId, start) => controller.canMove(id, trackId, start)} />
          </div>
          <div className="hscroll" ref={hscroll} onScroll={e => setScrollX(e.currentTarget.scrollLeft)}>
            <div style={{ width: contentWidth }} />
          </div>
        </main>
      )}

      <footer className="status-bar">
        <span>{sr / 1000} kHz</span>
        <span role="status">{status}</span>
      </footer>
    </div>
  )
}