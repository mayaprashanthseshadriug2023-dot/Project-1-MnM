# Demo script (about 6 minutes)

Run `npm run app` in `audio-editor/` before starting. Have the `samples/` folder ready.

1. **Open `samples/podcast-intro.json`** (UC4). Three tracks load with waveforms; audio is found from
   relative paths. Point out the fade lines on the music clip and the Music track at volume 0.5.
2. **Play** (Space). The red cursor moves; all tracks are in sync from one audio clock (Alg. 5).
   **Click the ruler** to jump. Click inside the music fade-in: it starts part-way up, not silent.
3. **Mute / Solo** while playing (FR4). Solo Voice, then also mute it: solo overrides mute (A1 4.1.6).
4. **Move** a clip along its track and onto another track (FR2). **Drag it over another clip**: the
   preview turns red, and on drop it returns with "Clip overlaps another clip" (ER2, A3 4.5).
5. **Trim** an edge, then **fade** with the yellow squares (FR3, FR5). Status bar confirms each edit;
   the title shows `*` (unsaved).
6. **Split**: click the ruler inside the narration, select it, press **S**. Select one half, **Delete**
   (Alg. 4: non-destructive; both halves share one buffer).
7. **Import** a real recording (FR1). Then import a non-audio file renamed to `.wav`: the error names
   the file and nothing is added (ER1, T5).
8. **Export** a WAV (Alg. 6) and play it in Finder: it matches the preview, because playback and export
   use the same mixing graph (A3 R1).
9. **Open `samples/missing-file.json`** (ER3): yellow banner, grey clip, **Relink** fixes it.
10. **Open `samples/music-demo.json`**: two bass clips playing different halves of one file (offset);
    the muted Lead track was restored from the file.
11. Finish in the terminal: `npm test` (110 passing) and `npx vitest run src/performance.test.ts`
    (A1 timing targets met at 8 tracks / 50 clips).