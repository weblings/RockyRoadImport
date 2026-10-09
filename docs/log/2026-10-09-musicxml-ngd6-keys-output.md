# MusicXML piano output: keys.json merge + shared song.json builder (2026-10-09)

Built RockyRoadImport-ngd.6 (uncommitted, unclaimed — bead DB untouched, see
environment note). New `SongConverter/src/songBuilder.ts`: `mergePianoTracks`
(all Score piano parts into one time-sorted `keys.json`, empty Sections like
the MIDI path), `keysInstrumentPart`, and one `buildSongInfo` now shared by
all three song.json sites (MIDI, GP, MusicXML) instead of a fourth ad-hoc
one. MusicXML tab ships `keys.json` + `keys`/`Keys` part, folds keys into
`SongLengthSeconds`, and reports piano parts with the approximations
(dynamics-derived velocity, hairpins ignored, pedal + repeats not expanded,
hand-fallback warning). A detected-but-empty piano part ships no keys file.

Decisions: `credit-words`-only titles stay manual via the metadata form (no
v1 code); repeat-heavy files ship with the disclosed limit rather than
waiting on RockyRoadImport-3sp; `SustainActive` stays absent until ngd.5
lands, as the status line says.

Verification: full suite 69/69 (64 existing + 5 new `songBuilder.test.ts`),
`tsc` clean, working tree holds only the four intended files.

Docs: root README format lists now claim MusicXML piano-to-`keys.json`; one
lessons entry (shared module must not import the lazily-loaded dependency);
no other stale claims found. Planning doc untouched — status lives here.
Bead still reads `open`, blocked on ngd.4/ngd.5 in the export.

Environment note: plain-sandbox shell still fails (`bwrap: loopback`), so
tests/tsc/git ran via per-command escalated approvals, as in the ngd.4 entry.
