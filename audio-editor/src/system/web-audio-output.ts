// Audio Output (A2 system layer): the sound device and its clock, for the Playback Engine.
import type { AudioBackend } from '../core/playback'
import { applyAudibility, buildTrackNodes, scheduleClip } from './mixer'

export function createWebAudioOutput(ctx: AudioContext = new AudioContext()): AudioBackend {
  let nodes = new Map<string, GainNode>()          // one gain node per track
  let sources: AudioBufferSourceNode[] = []        // every clip currently scheduled
  let project: Parameters<AudioBackend['start']>[0] | null = null

  return {
    now: () => ctx.currentTime,                     // the audio clock: the single shared clock

    start(p) {
      project = p
      void ctx.resume()                             // browsers only allow sound after a user action
      nodes = buildTrackNodes(ctx, p)
    },

    schedule(clip, trackId, when, from) {
      const node = nodes.get(trackId)
      if (!node || !project) return
      const source = scheduleClip(ctx, project, clip, node, when, from)   // same function as export
      if (source) sources.push(source)
    },

    updateAudibility(p) {
      applyAudibility(p, nodes)                     // takes effect at once, nothing rescheduled
    },

    stopAll() {
      for (const s of sources) {
        try { s.stop() } catch { /* already finished */ }
      }
      sources = []
      for (const n of nodes.values()) n.disconnect()
      nodes = new Map()
      project = null
    },
  }
}