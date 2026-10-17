// Generates the sample audio and sample projects in ../samples (A3 7.8). Run: npm run samples
// Uses the app's own WAV encoder and checkInvariants, so every sample is valid by construction.
import { mkdirSync, writeFileSync } from 'node:fs'
import { encodeWav } from '../src/system/wav'
import { serializeProject } from '../src/system/storage'
import { checkInvariants } from '../src/model/invariants'
import { createAudioData, createClip, createProject, createTrack } from '../src/model/project'
import type { Project, Track } from '../src/model/types'

const SR = 44100
const OUT = '../samples'
mkdirSync(`${OUT}/audio`, { recursive: true })

// ---------- Short audio files (a few seconds each, so nothing large is committed) ----------

const lengths: Record<string, number> = {}

function makeWav(name: string, seconds: number, wave: (t: number) => number): void {
  const samples = new Float32Array(Math.round(seconds * SR))
  for (let i = 0; i < samples.length; i++) samples[i] = wave(i / SR)
  writeFileSync(`${OUT}/audio/${name}`, Buffer.from(encodeWav([samples], SR)))
  lengths[name] = samples.length
}

const tone = (freq: number, amp: number) => (t: number) => amp * Math.sin(2 * Math.PI * freq * t)

makeWav('tone-440.wav', 2, tone(440, 0.5))                                    // A3 2.3: the sine-wave test file
makeWav('narration.wav', 8, t => (Math.floor(t * 2) % 2 === 0 ? tone(220, 0.6)(t) : 0))  // stand-in "speech" bursts
makeWav('music-bed.wav', 10, t => tone(261.6, 0.2)(t) + tone(329.6, 0.2)(t) + tone(392, 0.2)(t))  // C major chord
makeWav('kick.wav', 0.5, t => 0.9 * Math.sin(2 * Math.PI * (120 - 160 * t) * t) * Math.exp(-8 * t))
makeWav('bass.wav', 4, tone(110, 0.4))

// ---------- Sample projects ----------

interface ClipOptions { duration?: number; offset?: number; fadeIn?: number; fadeOut?: number }

/** Adds a clip (times in seconds). Clips must be added to each track in time order. */
function addClip(p: Project, track: Track, file: string, startSec: number, o: ClipOptions = {}): void {
  const path = `audio/${file}`                       // relative to the project file
  let buf = p.buffers.get(path)
  if (!buf) {
    buf = createAudioData(path, [new Float32Array(lengths[file] ?? 0)], SR)   // only used to check the project
    buf.missing = !(file in lengths)
    p.buffers.set(path, buf)
  }
  buf.refCount++
  const s = (sec: number) => Math.round(sec * SR)
  const clip = createClip(path, o.duration !== undefined ? s(o.duration) : lengths[file], s(startSec), s(o.offset ?? 0))
  clip.fadeIn = s(o.fadeIn ?? 0)
  clip.fadeOut = s(o.fadeOut ?? 0)
  track.clips.push(clip)
}

function saveProject(name: string, p: Project): void {
  const problems = checkInvariants(p)
  if (problems.length) throw new Error(`${name}: ${problems.join('; ')}`)
  writeFileSync(`${OUT}/${name}`, serializeProject(p))
  console.log(`wrote samples/${name}`)
}

// Podcast intro: music bed fades in and out under the narration, quieter than the voice
{
  const p = createProject(SR)
  const voice = createTrack('Voice')
  const music = createTrack('Music')
  music.volume = 0.5
  const fx = createTrack('Effects')
  addClip(p, voice, 'narration.wav', 1.5)
  addClip(p, music, 'music-bed.wav', 0, { fadeIn: 1, fadeOut: 2 })
  addClip(p, fx, 'kick.wav', 0.5)
  addClip(p, fx, 'kick.wav', 9.5)
  p.tracks = [voice, music, fx]
  saveProject('podcast-intro.json', p)
}

// Music demo: a kick on every beat, a bass split into two clips, a lead tone with fades; the lead is muted
{
  const p = createProject(SR)
  const drums = createTrack('Drums')
  const bass = createTrack('Bass')
  const lead = createTrack('Lead')
  lead.mute = true
  for (let beat = 0; beat < 8; beat++) addClip(p, drums, 'kick.wav', beat)
  addClip(p, bass, 'bass.wav', 0, { duration: 2 })
  addClip(p, bass, 'bass.wav', 4, { duration: 2, offset: 2 })      // second half of the same file (non-destructive)
  addClip(p, lead, 'tone-440.wav', 2, { fadeIn: 0.5, fadeOut: 0.5 })
  p.tracks = [drums, bass, lead]
  saveProject('music-demo.json', p)
}

// Missing file (ER3): refers to a file that does not exist, to show the banner and Relink
{
  const p = createProject(SR)
  const voice = createTrack('Voice')
  addClip(p, voice, 'narration.wav', 0)
  addClip(p, voice, 'deleted-take.wav', 9, { duration: 3 })          // this file is deliberately not generated
  p.tracks = [voice]
  saveProject('missing-file.json', p)
}