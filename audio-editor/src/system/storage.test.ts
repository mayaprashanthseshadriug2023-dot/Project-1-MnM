import { describe, it, expect } from 'vitest'
import { loadProject, saveProject, serializeProject } from './storage'
import type { AudioIO, FileSystem, GenerateWaveform } from '../model/contracts'
import { createAudioData, createClip, createProject, createTrack } from '../model/project'
import { checkInvariants } from '../model/invariants'
import { ok, err } from '../model/types'

// ---------- Fakes (A3: tests run without a real disk or decoder) ----------

function fakeFs(files: Record<string, string> = {}): FileSystem & { files: Map<string, string> } {
  const store = new Map(Object.entries(files))
  return {
    files: store,
    async readFile(p) {
      const s = store.get(p)
      return s === undefined ? err('not found') : ok(new TextEncoder().encode(s).buffer as ArrayBuffer)
    },
    async writeFile(p, data) { store.set(p, typeof data === 'string' ? data : 'binary'); return ok(undefined) },
    async exists(p) { return store.has(p) },
    async rename(from, to) {
      const s = store.get(from)
      if (s === undefined) return err('not found')
      store.delete(from); store.set(to, s); return ok(undefined)
    },
    async remove(p) { store.delete(p) },
  }
}

const fakeIO: AudioIO = {
  async decode(path, _bytes, sr) {
    return path.endsWith('.bad') ? err('corrupted') : ok(createAudioData(path, [new Float32Array(10000)], sr))
  },
  encodeWav: () => new ArrayBuffer(0),
}

const fakeWaveform: GenerateWaveform = (_buf, w) =>
  ({ windowSize: w, peak: new Float32Array(0), rms: new Float32Array(0) })

// ---------- A small project: two tracks, three clips, fades, volume, mute ----------

function sampleProject() {
  const p = createProject(44100)
  const voice = createTrack('Voice'); voice.volume = 0.8
  const music = createTrack('Music'); music.mute = true
  const c1 = createClip('voice.wav', 1000, 0); c1.fadeIn = 200
  const c2 = createClip('voice.wav', 500, 2000, 1000)
  const c3 = createClip('music.wav', 3000, 0); c3.fadeOut = 300
  voice.clips = [c1, c2]
  music.clips = [c3]
  p.tracks = [voice, music]
  for (const id of ['voice.wav', 'music.wav'])
    p.buffers.set(id, createAudioData(id, [new Float32Array(10000)], 44100))
  p.buffers.get('voice.wav')!.refCount = 2
  p.buffers.get('music.wav')!.refCount = 1
  return p
}

const audioFiles = { 'voice.wav': 'audio', 'music.wav': 'audio' }

const fileWith = (clips: object[]) => JSON.stringify({
  version: 1, sampleRate: 44100,
  tracks: [{ name: 'T', volume: 1, mute: false, solo: false, clips }],
})
const clipAt = (start: number, duration: number) =>
  ({ file: 'voice.wav', offset: 0, duration, start, fadeIn: 0, fadeOut: 0 })

// ---------- Tests ----------

describe('save and load (UC4)', () => {
  it('restores the project exactly', async () => {
    const fs = fakeFs(audioFiles)
    const original = sampleProject()
    expect((await saveProject(original, 'p.json', fs)).ok).toBe(true)

    const loaded = await loadProject('p.json', fs, fakeIO, fakeWaveform)
    if (!loaded.ok) throw new Error(loaded.error)
    expect(serializeProject(loaded.value.project)).toBe(serializeProject(original))
    expect(checkInvariants(loaded.value.project)).toEqual([])
    expect(loaded.value.missing).toEqual([])
  })

  it('leaves no temporary file after saving', async () => {
    const fs = fakeFs(audioFiles)
    await saveProject(sampleProject(), 'p.json', fs)
    expect(fs.files.has('p.json')).toBe(true)
    expect(fs.files.has('p.json.tmp')).toBe(false)
  })

  it('turns a missing audio file into a placeholder (ER3)', async () => {
    const fs = fakeFs({ 'music.wav': 'audio' })          // voice.wav has been deleted
    await saveProject(sampleProject(), 'p.json', fs)

    const loaded = await loadProject('p.json', fs, fakeIO, fakeWaveform)
    if (!loaded.ok) throw new Error(loaded.error)
    expect(loaded.value.missing).toEqual(['voice.wav'])
    expect(loaded.value.project.buffers.get('voice.wav')!.missing).toBe(true)
    expect(loaded.value.project.tracks[0].clips).toHaveLength(2)   // clips kept for relinking
  })

  it('rejects malformed JSON', async () => {
    const fs = fakeFs({ 'p.json': '{ not json' })
    const loaded = await loadProject('p.json', fs, fakeIO, fakeWaveform)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) expect(loaded.error).toContain('not valid JSON')
  })

  it('rejects a clip with zero duration', async () => {
    const fs = fakeFs({ ...audioFiles, 'p.json': fileWith([clipAt(0, 0)]) })
    const loaded = await loadProject('p.json', fs, fakeIO, fakeWaveform)
    if (!loaded.ok) expect(loaded.error).toContain('invalid clip')
    else throw new Error('should have failed')
  })

  it('rejects overlapping clips in the file', async () => {
    const fs = fakeFs({ ...audioFiles, 'p.json': fileWith([clipAt(0, 1000), clipAt(500, 1000)]) })
    const loaded = await loadProject('p.json', fs, fakeIO, fakeWaveform)
    if (!loaded.ok) expect(loaded.error).toContain('overlaps')
    else throw new Error('should have failed')
  })
})