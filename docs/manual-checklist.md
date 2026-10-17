# Manual test checklist (A3 2.6)

Run in the desktop app (`npm run app` on the Mac). Fill in Result with Pass or Fail, and add a note for anything odd.

| # | Area | Check | Expected | Result | Notes |
|---|---|---|---|---|---|
| 1 | Import (FR1) | Import a WAV file | Clip appears with waveform | | |
| 2 | Import (FR1) | Import an MP3 file | Clip appears with waveform | | |
| 3 | Import (ER1) | Import a non-audio file (rename a .txt to .wav) | Error names the file; no clip added | | |
| 4 | Arrange (FR2) | Drag a clip along its track | Moves; status shows new time | | |
| 5 | Arrange (FR2) | Drag a clip onto another track | Moves to that track | | |
| 6 | Arrange (ER2) | Drag a clip over another clip | Preview turns red; on drop it returns; error shown | | |
| 7 | Arrange (T1) | Place a clip exactly touching another | Allowed | | |
| 8 | Trim (FR3) | Drag left and right edges | Clip shortens/lengthens; audio matches | | |
| 9 | Split (FR3) | Put cursor in a clip, select it, press S | Two clips; playback sounds unchanged | | |
| 10 | Split (A3 2.4) | Put cursor exactly at a clip's start, press S | Rejected with message | | |
| 11 | Delete (FR3) | Select a clip, press Delete | Clip removed | | |
| 12 | Fades (FR5) | Drag the yellow squares | Fade lines appear; fade is audible | | |
| 13 | Volume (FR4) | Move a track's slider while playing | Volume changes immediately | | |
| 14 | Mute/Solo (FR4) | Mute a track; solo a track; solo a muted track | Muted silent; only soloed play; solo overrides mute | | |
| 15 | Playback | Play / Pause / Stop / Space | Behave as labelled; Stop returns to 0 | | |
| 16 | Playback | Click the ruler, during and outside playback | Cursor jumps; playback continues from there | | |
| 17 | Sync (A2 Alg. 5) | Same file on two tracks at the same start, play | Sounds louder, with no echo (tracks in sync) | | |
| 18 | Seek into fade | Click the ruler inside a fade-in, play | Starts at partial volume, not silent | | |
| 19 | Save/Open (UC4) | Save, quit, reopen, Open | Tracks, clips, fades, volume/mute/solo all restored | | |
| 20 | Missing file (ER3) | Rename the audio in Finder, then Open | Yellow banner; grey clips; Relink restores them | | |
| 21 | Bad project (ER3) | Open a .json that is not a project | Error shown; current project unchanged | | |
| 22 | Export | Export, then play the WAV in another app | Sounds the same as the preview | | |
| 23 | Export (ER4) | Export into a read-only folder (Cmd+Shift+G, type /System) | Error shown; no file created | | |
| 24 | Unsaved (A3 4.4–4.5) | Edit, then check title and try to close | Title starts with *; closing asks first | | |
| 25 | Usability (A1) | Import, trim, mute and export each take 3 or fewer actions | Yes | | |
| 26 | Accessibility (A3 4.7) | Tab through buttons; M/S show letters; times in mm:ss.mmm | Yes | | |
| 27 | Performance (A1) | 8 tracks, many clips: drag, zoom, play | Stays smooth; play starts at once | | |

Tested by: ______  Date: ______