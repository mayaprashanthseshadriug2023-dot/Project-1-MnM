# Performance (A3 2.7, 7.6)

Measured by `audio-editor/src/performance.test.ts` at A1's target scale: 8 tracks, 50 clips of 5 s,
44.1 kHz audio. Run with `npx vitest run src/performance.test.ts`.

| Operation | Complexity (A2/A3) | A1 target | Measured |
|---|---|---|---|
| Full timeline redraw, 1400 px wide | O(t + visible clips + width) | < 100 ms after a drag | 2.5 ms |
| Drag preview check (`canPlace`) | O(log n) | < 16 ms (one frame) | 0.001 ms |
| Move a clip + `checkInvariants` | O(n) + O(C) | — | 0.016 ms |
| Playback start (scheduling) | O(t log n) | < 200 ms | 0.013 ms + 50 ms start delay = 50 ms |
| Waveform, 1 min stereo (Algorithm 2) | O(N) | runs in a Web Worker | 20 ms |

## What this shows

- At A1's scale every clip operation takes microseconds. This confirms A3 3.5's decision to keep a
  sorted array instead of an interval tree: the simpler structure is far fast enough.
- Playback start is dominated by the deliberate 50 ms start delay, which lets every track start
  exactly together. It is well under the 200 ms target.
- The redraw time measures our drawing code with a stand-in canvas; the browser's own painting is
  checked by hand in the manual checklist (drag feels instant).
- The main cost remains memory for decoded audio (A3 3.2), not computation.