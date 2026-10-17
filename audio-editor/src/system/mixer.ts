// Effects and Mixing, Web Audio part (A2 Algorithm 6). Builds the mixing graph from the maths in
// algorithms/mixing.ts. Used by both playback (real-time) and export (offline), so they always match.
import type { RenderMix } from '../model/contracts'
import type { AudioData, Clip, Project } from '../model/types'
import { ok, err } from '../model/types'
import { envelopePoints, mixLength, trackGains } from '../algorithms/mixing'

const OUTPUT_CHANNELS = 2   // export and play in stereo; mono clips are spread to both sides

// ---------- Track nodes: volume, mute and solo ----------

/** One gain node per track, connected to the output (A2: ApplyAudibility). */
export function buildTrackNodes(ctx: BaseAudioContext, project: Project): Map<string, GainNode> {
  const nodes = new Map<string, GainNode>()
  for (const t of project.tracks) {
    const node = ctx.createGain()
    node.connect(ctx.destination)
    nodes.set(t.id, node)
  }
  applyAudibility(project, nodes)
  return nodes
}

/** Sets each track's gain: its volume if audible, 0 if muted or not soloed. */
export function applyAudibility(project: Project, nodes: Map<string, GainNode>): void {
  for (const [id, gain] of trackGains(project.tracks)) {
    const node = nodes.get(id)
    if (node) node.gain.value = gain
  }
}

// ---------- Clips ----------

const audioBuffers = new WeakMap<AudioData, AudioBuffer>()

/** Our AudioData as a Web Audio AudioBuffer, created once per buffer and reused. */
function toAudioBuffer(buf: AudioData): AudioBuffer {
  let ab = audioBuffers.get(buf)
  if (!ab) {
    ab = new AudioBuffer({ length: buf.length, numberOfChannels: buf.channels.length, sampleRate: buf.sampleRate })
    buf.channels.forEach((data, ch) => ab!.getChannelData(ch).set(data))
    audioBuffers.set(buf, ab)
  }
  return ab
}

/**
 * ScheduleClip: play `clip` at clock time `when` (seconds), starting `from` samples into it.
 * source -> envelope gain (fades) -> track node. Returns the source so playback can stop it.
 */
export function scheduleClip(
  ctx: BaseAudioContext, project: Project, clip: Clip, trackNode: AudioNode, when: number, from = 0,
): AudioBufferSourceNode | null {
  const buf = project.buffers.get(clip.bufferId)
  if (!buf || buf.missing) return null                 // placeholder clips are silent (ER3)
  const sr = project.sampleRate

  const source = ctx.createBufferSource()
  source.buffer = toAudioBuffer(buf)
  const env = ctx.createGain()
  source.connect(env)
  env.connect(trackNode)

  // Fade envelope: set the starting value, then ramp linearly to each later point
  const [first, ...rest] = envelopePoints(clip, from)
  env.gain.setValueAtTime(first.value, when)
  for (const p of rest) env.gain.linearRampToValueAtTime(p.value, when + (p.at - from) / sr)

  // Play only the clip's part of the source: from offset + from, for the rest of its duration
  source.start(when, (clip.offset + from) / sr, (clip.duration - from) / sr)
  return source
}

// ---------- Export render ----------

/** ExportMix: renders the whole project offline, faster than real time (A3 3.4). */
export const renderMix: RenderMix = async (project) => {
  const length = mixLength(project)
  if (length === 0) return err('Nothing to export')
  try {
    const ctx = new OfflineAudioContext(OUTPUT_CHANNELS, length, project.sampleRate)
    const nodes = buildTrackNodes(ctx, project)
    for (const t of project.tracks)
      for (const c of t.clips) scheduleClip(ctx, project, c, nodes.get(t.id)!, c.start / project.sampleRate)
    const out = await ctx.startRendering()          // the audio system sums all nodes: that sum is the mix
    return ok(Array.from({ length: out.numberOfChannels }, (_, ch) => out.getChannelData(ch).slice()))
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Rendering failed')
  }
}