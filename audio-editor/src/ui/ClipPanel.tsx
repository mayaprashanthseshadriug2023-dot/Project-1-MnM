// Controls for the selected clip, so fades and editing can be found without knowing
// the mouse handles or keyboard shortcuts (issue: "no option to add fade in / fade out").
import { useEffect, useState } from 'react'
import type { ProjectController } from '../core/controller'
import type { Result } from '../model/types'

interface Props {
  controller: ProjectController
  clipId: string | null
  onResult: (result: Result<unknown>, success: string) => void   // show the message and redraw
  onClipGone: () => void                                         // the clip was split or deleted
}

const seconds = (samples: number, sr: number) => (samples / sr).toFixed(2)

export function ClipPanel({ controller, clipId, onResult, onClipGone }: Props) {
  const clip = clipId ? controller.findClip(clipId)?.clip : undefined
  const sr = controller.project.sampleRate
  const [fadeIn, setFadeIn] = useState('0.00')
  const [fadeOut, setFadeOut] = useState('0.00')

  // Show the clip's current fades when the selection changes, or after a handle is dragged
  useEffect(() => {
    if (clip) { setFadeIn(seconds(clip.fadeIn, sr)); setFadeOut(seconds(clip.fadeOut, sr)) }
  }, [clip, clip?.fadeIn, clip?.fadeOut, sr])

  if (!clip) return null
  const name = clip.bufferId.split(/[\\/]/).pop()

  const applyFades = () => {
    const fi = Math.round(Number(fadeIn) * sr)
    const fo = Math.round(Number(fadeOut) * sr)
    if (fi === clip.fadeIn && fo === clip.fadeOut) return
    const result = controller.setFades(clip.id, fi, fo)
    if (!result.ok) { setFadeIn(seconds(clip.fadeIn, sr)); setFadeOut(seconds(clip.fadeOut, sr)) }   // undo the typing
    onResult(result, 'Fades updated')
  }

  const fadeBox = (label: string, value: string, set: (v: string) => void) => (
    <label>{label}
      <input type="number" min={0} step={0.1} value={value} aria-label={`${label} (seconds)`}
        onChange={e => set(e.target.value)} onBlur={applyFades}
        onKeyDown={e => { if (e.key === 'Enter') applyFades() }} /> s
    </label>
  )

  return (
    <div className="clip-panel" role="group" aria-label="Selected clip">
      <strong className="clip-panel-name" title={name}>{name}</strong>
      {fadeBox('Fade in', fadeIn, setFadeIn)}
      {fadeBox('Fade out', fadeOut, setFadeOut)}
      <span className="clip-panel-hint">Tip: you can also drag the yellow squares on the clip</span>
      <button title="Split at the cursor (S)" onClick={() => {
        const r = controller.splitClipAt(clip.id, controller.position())
        if (r.ok) onClipGone()
        onResult(r, 'Clip split at the cursor')
      }}>Split at cursor</button>
      <button title="Delete clip (Delete)" onClick={() => {
        const r = controller.deleteClip(clip.id)
        if (r.ok) onClipGone()
        onResult(r, 'Clip removed')
      }}>Delete clip</button>
    </div>
  )
}