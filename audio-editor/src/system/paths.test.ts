import { describe, it, expect } from 'vitest'
import { resolvePath } from './storage'

describe('resolvePath (sample projects work on any computer)', () => {
  it('keeps absolute paths as they are', () => {
    expect(resolvePath('/Users/maya/p.json', '/Music/a.wav')).toBe('/Music/a.wav')
    expect(resolvePath('C:\\proj\\p.json', 'D:\\a.wav')).toBe('D:\\a.wav')
  })

  it('resolves relative paths against the project file folder', () => {
    expect(resolvePath('/Users/maya/samples/p.json', 'audio/a.wav')).toBe('/Users/maya/samples/audio/a.wav')
  })

  it('leaves paths alone when the project has no folder (browser version)', () => {
    expect(resolvePath('p.json', 'a.wav')).toBe('a.wav')
  })
})