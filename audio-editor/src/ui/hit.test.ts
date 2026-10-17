import { describe, it, expect } from 'vitest'
import { hitTest } from './hit'
import { RULER_H, ROW_H } from './geometry'
import { createClip, createProject, createTrack } from '../model/project'

// 1000 samples per second at 100 px per second: the clip covers x = 100 to 300
function setup() {
  const project = createProject(1000)
  const track = createTrack('T')
  const clip = createClip('a.wav', 2000, 1000)
  clip.fadeIn = 500                                    // fade-in handle at x = 150
  track.clips = [clip]
  project.tracks = [track]
  return { project, view: { pps: 100, scrollX: 0, sampleRate: 1000 } }
}
const MID = RULER_H + ROW_H / 2                        // vertical middle of track 0

describe('hitTest', () => {
  it('finds the ruler', () => {
    const { project, view } = setup()
    expect(hitTest(project, view, 200, 10).kind).toBe('ruler')
  })

  it('finds the clip body and its edges', () => {
    const { project, view } = setup()
    expect(hitTest(project, view, 200, MID)).toMatchObject({ kind: 'clip', part: 'body' })
    expect(hitTest(project, view, 102, MID)).toMatchObject({ kind: 'clip', part: 'left' })
    expect(hitTest(project, view, 298, MID)).toMatchObject({ kind: 'clip', part: 'right' })
  })

  it('finds a fade handle on the top edge', () => {
    const { project, view } = setup()
    expect(hitTest(project, view, 150, RULER_H + 4)).toMatchObject({ kind: 'clip', part: 'fadeIn' })
  })

  it('finds empty lane space and empty rows', () => {
    const { project, view } = setup()
    expect(hitTest(project, view, 500, MID)).toEqual({ kind: 'lane', row: 0 })
    expect(hitTest(project, view, 200, RULER_H + ROW_H + 10).kind).toBe('none')
  })
})