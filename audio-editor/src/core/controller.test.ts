import { describe, it, expect } from 'vitest'
import { ProjectController } from './controller'
import type { AudioIO, FileSystem, PlaybackEngine } from '../model/contracts'
import { createAudioData } from '../model/project'
import { checkInvariants } from '../model/invariants'
import { ok, err } from '../model/types'

// ---------- Fakes (A3 2.3: the controller is tested without real files or audio) ----------

function fakeFs(files: Record<string, string>, failWrites = false) {
  const store = new Map<string, string | ArrayBuffer>(Object.entries(files))
  const fs: FileSystem = {
    async readFile(p) {
      const d = store.get(p)
      if (d === undefined) return err('not found')
      return ok(typeof d === 'string' ? new TextEncoder().encode(d).buffer as ArrayBuffer : d)
    },
    async writeFile(p, data) {
      if (failWrites) { store.set(p, 'partial'); return err('disk full') }   // simulates a half-written file
      store.set(p, data)
      return ok(undefined)
    },
    async exists(p) { return store.has(p) },
    async rename(from, to) {
      const d = store.get(from)
      if (d === undefined) return err('not found')
      store.delete(from); store.set(to, d)
      return ok(undefined)
    },
    async remove(p) { store.delete(p) },
  }
  return { fs, store }
}

function fakeIO() {
  const counter = { decodes: 0 }
  const io: AudioIO = {
    async decode(path, _bytes, sr) {
      counter.decodes++
      return path.includes('corrupt') ? err('bad data') : ok(createAudioData(path, [new Float32Array(1000)], sr))
    },
    encodeWav: () => new ArrayBuffer(44),
  }
  return { io, counter }
}

function fakePlayback() {
  const state = { playing: false, position: 0, calls: [] as string[] }
  const engine: PlaybackEngine = {
    play(_project, from) { state.playing = true; state.position = from; state.calls.push(`play ${from}`) },
    pause() { state.playing = false; state.calls.push('pause') },
    stop() { state.playing = false; state.calls.push('stop') },
    isPlaying: () => state.playing,
    position: () => state.position,
    updateAudibility() { state.calls.push('audibility') },
  }
  return { engine, state }
}

function setup(files: Record<string, string> = { 'voice.wav': 'audio', 'music.wav': 'audio' }, failWrites = false) {
  const { fs, store } = fakeFs(files, failWrites)
  const { io, counter } = fakeIO()
  const { engine, state } = fakePlayback()
  const ctl = new ProjectController({
    fs, io, playback: engine,
    waveform: (_buf, w) => ({ windowSize: w, peak: new Float32Array(0), rms: new Float32Array(0) }),
    renderMix: async () => ok([new Float32Array(10)]),
  })
  return { ctl, store, counter, playback: state }
}

// ---------- Tests ----------

describe('import (FR1, ER1)', () => {
  it('places clips one after another and decodes each file once', async () => {
    const { ctl, counter } = setup()
    const t = ctl.addTrack('Voice')
    await ctl.importAudio('voice.wav', t.id)
    await ctl.importAudio('voice.wav', t.id)
    expect(t.clips.map(c => c.start)).toEqual([0, 1000])
    expect(counter.decodes).toBe(1)
    expect(ctl.project.buffers.get('voice.wav')!.refCount).toBe(2)
    expect(checkInvariants(ctl.project)).toEqual([])
  })

  it('T5: rejects a text file and a corrupted wav, leaving nothing behind', async () => {
    const { ctl } = setup({ 'notes.txt': 'hello', 'corrupt.wav': 'garbage' })
    const t = ctl.addTrack('Voice')
    const r1 = await ctl.importAudio('notes.txt', t.id)
    const r2 = await ctl.importAudio('corrupt.wav', t.id)
    if (!r1.ok) expect(r1.error).toBe('Unsupported file format')
    else throw new Error('should have failed')
    if (!r2.ok) expect(r2.error).toBe('Unsupported or corrupted file')
    else throw new Error('should have failed')
    expect(t.clips).toHaveLength(0)
    expect(ctl.project.buffers.size).toBe(0)
  })
})

describe('moving clips (FR2)', () => {
  it('moves a clip to another track', async () => {
    const { ctl } = setup()
    const a = ctl.addTrack('A')
    const b = ctl.addTrack('B')
    const clip = await ctl.importAudio('voice.wav', a.id)
    if (!clip.ok) throw new Error(clip.error)
    expect(ctl.moveClip(clip.value.id, b.id, 500).ok).toBe(true)
    expect(a.clips).toHaveLength(0)
    expect(b.clips[0].start).toBe(500)
    expect(checkInvariants(ctl.project)).toEqual([])
  })

  it('rejects a move onto an occupied spot on another track, changing nothing', async () => {
    const { ctl } = setup()
    const a = ctl.addTrack('A')
    const b = ctl.addTrack('B')
    const moving = await ctl.importAudio('voice.wav', a.id)
    await ctl.importAudio('music.wav', b.id)                  // B is busy from 0 to 1000
    if (!moving.ok) throw new Error(moving.error)
    expect(ctl.moveClip(moving.value.id, b.id, 500).ok).toBe(false)
    expect(a.clips).toHaveLength(1)
    expect(a.clips[0].start).toBe(0)
    expect(b.clips).toHaveLength(1)
  })
})

describe('editing through the controller (FR3, FR5)', () => {
  it('rejects fades that do not fit, accepts ones that do', async () => {
    const { ctl } = setup()
    const t = ctl.addTrack('A')
    const clip = await ctl.importAudio('voice.wav', t.id)      // 1000 samples long
    if (!clip.ok) throw new Error(clip.error)
    expect(ctl.setFades(clip.value.id, 600, 600).ok).toBe(false)
    expect(ctl.setFades(clip.value.id, 200, 300).ok).toBe(true)
    expect(clip.value).toMatchObject({ fadeIn: 200, fadeOut: 300 })
  })

  it('split then delete keeps the project valid', async () => {
    const { ctl } = setup()
    const t = ctl.addTrack('A')
    const clip = await ctl.importAudio('voice.wav', t.id)
    if (!clip.ok) throw new Error(clip.error)
    const halves = ctl.splitClipAt(clip.value.id, 400)
    if (!halves.ok) throw new Error(halves.error)
    expect(ctl.deleteClip(halves.value[0].id).ok).toBe(true)
    expect(t.clips).toHaveLength(1)
    expect(ctl.project.buffers.get('voice.wav')!.refCount).toBe(1)
    expect(checkInvariants(ctl.project)).toEqual([])
  })
})

describe('track settings and playback (FR4, A1 Flow 2)', () => {
  it('re-applies volume/mute/solo while playing', () => {
    const { ctl, playback } = setup()
    const t = ctl.addTrack('A')
    ctl.play()
    expect(ctl.setTrack(t.id, { mute: true }).ok).toBe(true)
    expect(t.mute).toBe(true)
    expect(playback.calls).toContain('audibility')
  })

  it('rejects a negative volume', () => {
    const { ctl } = setup()
    const t = ctl.addTrack('A')
    expect(ctl.setTrack(t.id, { volume: -1 }).ok).toBe(false)
    expect(t.volume).toBe(1)
  })

  it('pause freezes the cursor, seek restarts playback, stop returns to 0', () => {
    const { ctl, playback } = setup()
    ctl.play()
    playback.position = 4410                                   // the audio clock has moved on
    ctl.pause()
    expect(ctl.project.cursor).toBe(4410)
    ctl.play()
    ctl.seek(100)
    expect(playback.calls[playback.calls.length - 1]).toBe('play 100')
    ctl.stop()
    expect(ctl.project.cursor).toBe(0)
  })
})

describe('save and load through the controller (UC4)', () => {
  it('save clears the unsaved flag and load replaces the project', async () => {
    const { ctl } = setup()
    const t = ctl.addTrack('Voice')
    await ctl.importAudio('voice.wav', t.id)
    expect(ctl.dirty).toBe(true)
    await ctl.save('p.json')
    expect(ctl.dirty).toBe(false)

    ctl.addTrack('Extra')
    expect((await ctl.load('p.json')).ok).toBe(true)
    expect(ctl.project.tracks.map(tr => tr.name)).toEqual(['Voice'])
    expect(ctl.dirty).toBe(false)
  })

  it('a failed load keeps the current project', async () => {
    const { ctl } = setup({ 'bad.json': '{ nope' })
    ctl.addTrack('Keep me')
    expect((await ctl.load('bad.json')).ok).toBe(false)
    expect(ctl.project.tracks.map(tr => tr.name)).toEqual(['Keep me'])
  })
})

describe('export (ER4)', () => {
  it('writes the WAV file and leaves no temporary file', async () => {
    const { ctl, store } = setup()
    const t = ctl.addTrack('A')
    await ctl.importAudio('voice.wav', t.id)
    expect((await ctl.exportWav('out.wav')).ok).toBe(true)
    expect(store.has('out.wav')).toBe(true)
    expect(store.has('out.wav.tmp')).toBe(false)
  })

  it('leaves no partial file when writing fails', async () => {
    const { ctl, store } = setup(undefined, true)
    const t = ctl.addTrack('A')
    await ctl.importAudio('voice.wav', t.id)
    expect((await ctl.exportWav('out.wav')).ok).toBe(false)
    expect(store.has('out.wav')).toBe(false)
    expect(store.has('out.wav.tmp')).toBe(false)
  })

  it('refuses to export an empty project', async () => {
    const { ctl } = setup()
    const result = await ctl.exportWav('out.wav')
    if (!result.ok) expect(result.error).toBe('Nothing to export')
    else throw new Error('should have failed')
  })
})

describe('relinking a missing file (ER3)', () => {
  it('points the clips at the new file and clears the missing flag', async () => {
    const { ctl, store } = setup()
    const t = ctl.addTrack('Voice')
    await ctl.importAudio('voice.wav', t.id)
    await ctl.save('p.json')
    store.delete('voice.wav')                     // the audio file has gone...
    store.set('found.wav', 'audio')               // ...and the user finds a copy elsewhere

    const loaded = await ctl.load('p.json')
    if (!loaded.ok) throw new Error(loaded.error)
    expect(loaded.value).toEqual(['voice.wav'])
    expect((await ctl.relink('voice.wav', 'found.wav')).ok).toBe(true)
    expect(ctl.project.tracks[0].clips[0].bufferId).toBe('found.wav')
    expect(ctl.project.buffers.get('found.wav')!.missing).toBe(false)
    expect(checkInvariants(ctl.project)).toEqual([])
  })
})