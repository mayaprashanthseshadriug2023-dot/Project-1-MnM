// Helpers to create empty model objects (DS1, DS3, DS4, DS5).
import type { AudioData, Clip, Project, Samples, Track } from './types'

export function createProject(sampleRate = 44100): Project {
  return { sampleRate, tracks: [], cursor: 0, buffers: new Map() }
}

export function createTrack(name: string): Track {
  return { id: crypto.randomUUID(), name, volume: 1, mute: false, solo: false, clips: [] }
}

export function createClip(bufferId: string, duration: Samples, start: Samples = 0, offset: Samples = 0): Clip {
  return { id: crypto.randomUUID(), bufferId, offset, duration, start, fadeIn: 0, fadeOut: 0 }
}

export function createAudioData(id: string, channels: Float32Array[], sampleRate: number): AudioData {
  return {
    id, channels, sampleRate,
    length: channels[0]?.length ?? 0,
    refCount: 0, waveform: null, missing: false,
  }
}