# Multi-Track Audio Editor — Team MnM

CS-3810 Design Practices in Computer Science, Ashoka University.
Maya Prashanth Seshadri (1020231379) · Mrinalini Jindal (1020231397)

A lightweight desktop editor for layered audio (podcasts, voiceovers, music demos). Import audio files,
arrange them as clips on independent tracks, trim, split, fade, set volume, mute and solo, preview with
synchronized playback, save and reopen projects, and export the mix as a single WAV file.

Design documents: Assignment 1 (requirements), Assignment 2 (technical design), Assignment 3 (testing, UX, plan).

---

## Running it

Requires **Node.js 18 or newer**.

```bash
cd audio-editor
npm install
npm run app        # desktop app (Electron): real files and native dialogs
```

| Command | What it does |
|---|---|
| `npm run app` | Desktop app (the intended way to use it, A2 Section 5) |
| `npm run dev` | Browser version at http://localhost:5173 (no access to files by path; see Limitations) |
| `npm test` | All unit, integration and UI tests (110 tests) |
| `npx vitest run src/performance.test.ts` | Performance tests, printing measured timings |
| `npm run build` | Type-checks and builds the app |
| `npm run samples` | Regenerates the sample audio and projects in `samples/` |

### Sample projects (`samples/`)

Open these with **Open** in the desktop app:

| File | Shows |
|---|---|
| `podcast-intro.json` | Narration over a quieter music bed that fades in and out, plus sound effects |
| `music-demo.json` | Kick on every beat, a bass split into two clips from one file, a muted lead with fades |
| `missing-file.json` | A clip whose audio file does not exist: the missing-file banner and **Relink** (ER3) |

`samples/audio/` holds short generated WAV files, including `tone-440.wav`, a 440 Hz sine wave.

### Controls

| Action | How |
|---|---|
| Import audio | **Import** (WAV or MP3) onto the selected track |
| Move a clip | Drag it, including onto another track. It turns red over an invalid spot and returns on drop |
| Trim | Drag a clip's left or right edge |
| Fade in / out | Drag the yellow squares on a clip's top corners |
| Split | Select a clip, place the cursor inside it, press **S** |
| Delete | Select a clip, press **Delete** |
| Play / pause | **Space**, or the toolbar buttons |
| Move the cursor | Click the ruler |
| Volume / mute / solo | Slider, **M** and **S** on each track header |
| Zoom / scroll | **− / +** in the toolbar; swipe sideways or Shift+scroll |

---

## Architecture (A2 Section 4)

Five layers. Dependencies point one way only, downwards. The UI changes the project only through the
Project Controller and never touches audio samples.

| Layer | Folder | Modules |
|---|---|---|
| Presentation / UI | `src/ui/` | `App`, `TrackHeader`, `Timeline` (canvas), `draw`, `hit` (hit testing), `geometry`, `format` |
| Core application logic | `src/core/` | `controller` (Project Controller), `playback` (Playback Engine), `export` |
| Algorithms | `src/algorithms/` | `timeline` (Alg. 3, 4), `waveform` (Alg. 2), `mixing` (Alg. 6 maths) |
| Data / model | `src/model/` | `types` (DS1–DS5), `contracts` (module interfaces), `project`, `invariants` |
| System interface | `src/system/` | `audio-io`, `wav`, `storage`, `mixer` (Web Audio graph), `web-audio-output`, `browser-fs`, `desktop`, `file-picker`, waveform worker |

- `src/setup.ts` is the composition root: the one place that plugs real modules into the controller
  (Electron files and dialogs on the desktop, in-memory files in a browser). Tests plug in fakes instead.
- `electron/` holds the Electron main process and the preload bridge. The page has no direct access to
  Node.js (`contextIsolation` on, `nodeIntegration` off); only seven file and dialog operations are exposed.
- `src/model/contracts.ts` fixed the interfaces between modules at the start (A3 Risk R4), so modules
  could be written and tested separately.

**Change from A2:** Algorithm 6 is split in two. The maths (fade envelopes, mute/solo gains, mix length)
is in `algorithms/mixing.ts` and fully unit-tested; building Web Audio nodes from it is in
`system/mixer.ts`. This keeps platform code in the system layer, following A2's design principle.

## Algorithms → source (A2 Section 2)

| A2 algorithm | Source | Tests |
|---|---|---|
| 1. Import, export, save, load | `system/audio-io.ts`, `system/wav.ts`, `core/export.ts`, `system/storage.ts` | `audio-io`, `wav`, `storage`, `paths`, `controller` |
| 2. Waveform (peak/RMS) | `algorithms/waveform.ts`, run in `system/waveform.worker.ts` | `waveform` |
| 3. Clip placement and overlap check | `algorithms/timeline.ts`: `placeClip`, `canPlace` | `timeline` (T1, T2), `canplace` |
| 4. Trim, split, remove | `algorithms/timeline.ts`: `trimLeft`, `trimRight`, `splitClip`, `removeClip`, `fitFades` | `editing` (T3, T4) |
| 5. Playback with a shared clock | `core/playback.ts`, `system/web-audio-output.ts` | `playback` (fake clock) |
| 6. Mixing graph | `algorithms/mixing.ts`, `system/mixer.ts` | `mixing` |

Data structures DS1–DS5 are in `model/types.ts`; the invariants from A3 2.1 are checked by
`model/invariants.ts` after edits in the tests.

## Project file format

Projects are JSON. Audio is never stored in the project, only file paths. Paths may be absolute, or
relative to the project file (as in the samples). All times are integer **sample counts** at
`sampleRate` (A2: time unit).

```json
{
  "version": 1,
  "sampleRate": 44100,
  "tracks": [
    {
      "name": "Music",
      "volume": 0.5,
      "mute": false,
      "solo": false,
      "clips": [
        { "file": "audio/music-bed.wav", "offset": 0, "duration": 441000,
          "start": 0, "fadeIn": 44100, "fadeOut": 88200 }
      ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `version` | Format version (1). Other values are rejected |
| `sampleRate` | Project sample rate; every position below is in samples at this rate |
| `volume` | Track gain multiplier (1 = unchanged) |
| `mute`, `solo` | Track flags. If any track is soloed, only soloed tracks play |
| `file` | Audio file the clip plays from |
| `offset` | Where in the file the clip begins (trimming changes this, never the audio) |
| `duration` | How long the clip plays |
| `start` | Where the clip sits on the timeline |
| `fadeIn`, `fadeOut` | Fade lengths; always `fadeIn + fadeOut ≤ duration` |

On load, the file is validated before anything is replaced. Malformed files and overlapping clips are
rejected, and missing audio files become placeholders that can be relinked (ER3).

## Testing (A3 Section 2)

110 automated tests (`npm test`), all passing, plus a manual checklist.

| A3 test case | Where |
|---|---|
| T1 touching clips allowed · T2 overlapping move rejected, track unchanged | `algorithms/timeline.test.ts` |
| T3 split keeps the right fades and offsets · T4 fades always fit after trim | `algorithms/editing.test.ts` |
| T5 a text file and a corrupted WAV are rejected, nothing left behind | `core/controller.test.ts` |

- **Unit tests** for every algorithm, including A3 2.4 boundary cases (touching vs one-sample overlap,
  split at an edge, fades filling a clip, seeking into a fade, clamping a loud mix).
- **Integration tests** through the Project Controller with fake files, decoder and playback (A3 2.3).
- **UI tests** with React Testing Library: a drag sends the right position, once, on drop; an error shows
  a message naming the file (A3 2.6).
- **Performance tests** at A1's scale (8 tracks, 50 clips): results in [docs/performance.md](docs/performance.md).
- **Manual checklist** for full flows with real audio: [docs/manual-checklist.md](docs/manual-checklist.md).

## Limitations

From A3 Section 5.3, plus what we found while building:

- Export is WAV only; MP3 export was left out in A2 to avoid an MP3 encoder.
- Clips cannot overlap on one track, so there are no crossfades on a single track.
- Effects are limited to volume and linear fades; loud mixes are clipped, with no limiter.
- The desktop app runs from source with `npm run app`; it is not packaged as an installer.
- Export shows "Exporting…" rather than a progress bar (A3 4.4), because the browser's offline renderer
  does not report progress.
- The browser version cannot reopen audio by path; after reloading, audio must be relinked. This is why
  A2 chose a desktop app.
- An edit made during playback restarts playback from the current position.
- The end-to-end "sine wave at 1.0 s" export check (A3 2.3) needs a real audio engine, so it is a manual
  check; its parts (WAV encoding, envelopes, scheduling) are unit-tested.

## Team

Both members wrote Assignments 1–3. Mrinalini was unwell during implementation, so Maya also implemented
the audio modules originally assigned to her in A3 Section 6 (decoding, WAV export, waveform, mixing,
playback). Work was done on feature branches merged through pull requests (A3 6.1).