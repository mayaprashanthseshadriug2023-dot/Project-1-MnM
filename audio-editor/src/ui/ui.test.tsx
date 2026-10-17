// @vitest-environment jsdom
// UI component tests (A3 2.6): components are rendered in a pretend browser and clicked like a user would.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from './App'
import { TrackHeader } from './TrackHeader'
import { Timeline } from './Timeline'
import { RULER_H, ROW_H } from './geometry'
import { ProjectController } from '../core/controller'
import { createAudioData, createClip, createProject, createTrack } from '../model/project'
import { ok, err } from '../model/types'
import type { FilePicker, PickedFile } from '../system/file-picker'

beforeAll(() => {
  // The pretend browser has no ResizeObserver; the timeline only needs it to exist
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
})
afterEach(cleanup)        // remove each test's page before the next test

describe('TrackHeader', () => {
  it('sends mute, solo and volume changes', () => {
    const onChange = vi.fn()
    render(<TrackHeader track={createTrack('Voice')} selected={false} onSelect={() => {}} onChange={onChange} />)
    fireEvent.click(screen.getByTitle('Mute'))
    expect(onChange).toHaveBeenCalledWith({ mute: true })
    fireEvent.click(screen.getByTitle('Solo'))
    expect(onChange).toHaveBeenCalledWith({ solo: true })
    fireEvent.change(screen.getByLabelText('Voice volume'), { target: { value: '0.5' } })
    expect(onChange).toHaveBeenCalledWith({ volume: 0.5 })
  })
})

describe('Timeline', () => {
  // 1000 samples per second at 100 px per second: the clip is drawn from x = 100 to x = 300
  function renderTimeline(onEdit: (edit: unknown) => void) {
    const project = createProject(1000)
    const track = createTrack('T')
    const clip = createClip('a.wav', 2000, 1000)
    track.clips = [clip]
    project.tracks = [track]
    const { container } = render(
      <Timeline project={project} version={0} view={{ pps: 100, scrollX: 0, sampleRate: 1000 }} cursor={0}
        selectedClip={null} onSelectClip={() => {}} onSelectTrack={() => {}} onSeek={() => {}}
        onEdit={onEdit} canMove={() => true} />,
    )
    return { canvas: container.querySelector('canvas')!, track, clip }
  }
  const MID = RULER_H + ROW_H / 2          // vertical middle of the first track

  it('a drag sends the right position to the controller, once, on drop (A3 2.6)', () => {
    const onEdit = vi.fn()
    const { canvas, track, clip } = renderTimeline(onEdit)
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: MID })   // grab the middle of the clip
    fireEvent.mouseMove(window, { clientX: 230, clientY: MID })
    fireEvent.mouseMove(window, { clientX: 250, clientY: MID })   // 50 px to the right = 0.5 s = 500 samples
    fireEvent.mouseUp(window, { clientX: 250, clientY: MID })
    expect(onEdit).toHaveBeenCalledTimes(1)                       // not once per mouse move (A3 3.4)
    expect(onEdit).toHaveBeenCalledWith({ kind: 'move', clipId: clip.id, trackId: track.id, start: 1500 })
  })

  it('a click without moving selects but does not edit', () => {
    const onEdit = vi.fn()
    const { canvas } = renderTimeline(onEdit)
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: MID })
    fireEvent.mouseUp(window, { clientX: 200, clientY: MID })
    expect(onEdit).not.toHaveBeenCalled()
  })
})

describe('App', () => {
  // A real controller with fake audio and files, and a file picker that "picks" the given files
  function renderApp(picked: PickedFile[]) {
    const files: FilePicker = {
      pickAudio: async () => picked,
      pickProject: async () => null,
      chooseSavePath: async () => null,
    }
    const controller = new ProjectController({
      fs: {
        readFile: async () => ok(new ArrayBuffer(8)),
        writeFile: async () => ok(undefined),
        exists: async () => true,
        rename: async () => ok(undefined),
        remove: async () => {},
      },
      io: {
        decode: async (path, _bytes, sr) =>
          path.includes('corrupt') ? err('bad data') : ok(createAudioData(path, [new Float32Array(1000)], sr)),
        encodeWav: () => new ArrayBuffer(44),
      },
      waveform: (_buf, w) => ({ windowSize: w, peak: new Float32Array(0), rms: new Float32Array(0) }),
      playback: { play() {}, pause() {}, stop() {}, isPlaying: () => false, position: () => 0, updateAudibility() {} },
      renderMix: async () => ok([new Float32Array(10)]),
    })
    render(<App controller={controller} files={files} />)
  }

  it('shows a controller error as a message that names the file (A3 2.6, 4.5)', async () => {
    renderApp([{ path: 'notes.txt', name: 'notes.txt', sizeMB: 0 }])
    fireEvent.click(screen.getByText('+ Track'))
    fireEvent.click(screen.getByText('Import'))
    expect(await screen.findByText('notes.txt: Unsupported file format')).toBeTruthy()
  })

  it('imports a clip and marks the project as unsaved (A3 4.4)', async () => {
    renderApp([{ path: 'voice.wav', name: 'voice.wav', sizeMB: 0 }])
    fireEvent.click(screen.getByText('+ Track'))
    fireEvent.click(screen.getByText('Import'))
    expect(await screen.findByText(/Imported voice\.wav/)).toBeTruthy()
    expect(document.title.startsWith('*')).toBe(true)
  })
})