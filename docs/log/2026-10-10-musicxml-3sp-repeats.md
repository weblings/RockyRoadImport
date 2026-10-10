# Score repeats/voltas played out in performance order (2026-10-10)

Fixed RockyRoadImport-3sp. `convertScore()` timed notes from linear score
ticks, so repeat barlines/voltas played once. New `buildPlaybackOrder()` in
`scoreConverter.ts` ports alphaTab's internal `MidiPlaybackController`
normal-repeat path (all inputs public; D.C./D.S. jumps stay straight
through) into per-bar occurrences with tick shifts; guitar, piano, pedal,
vocals, and arrangement beats all convert per occurrence, sections stay
first-occurrence-only.

Verification: new `piano-repeat-volta.musicxml` fixture (2x repeat +
endings, MuseScore barline encoding) plays 1,2,3,4,2,3,5 — 14 notes with
exact pitch/time sequences, 28 structure beats; alphaTex guitar repeat test
(5 notes from 3 bars). Full suite 76/76 + `tsc` clean. Throwaway sweep of
all 69 local library files: no crashes, 12_Variations 325 bars -> 635
plays, zero-repeat Bach_Toccata unchanged at 143, Entertainer split-file
still skipped (known 1+1-part detection gap, untouched by this fix).

Docs: status line now reports repeats/endings played out; one lessons
entry (port over internals); no stale README claims (limit was only in the
status line). Planning doc untouched — status lives here.
