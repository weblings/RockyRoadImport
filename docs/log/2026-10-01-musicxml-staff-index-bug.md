# MusicXML real-file test surfaces staff-index bug, fixed (2026-10-01)

Ran a real TuxGuitar 2.1 export (`the-beatles-let_it_be.musicxml`) through `convertMusicXml`
to validate [[musicxml-support]] Phase 1/2/5 behaviors end-to-end against real-world content,
not just synthetic/W3C-suite fixtures. The track came back fully skipped.

Root cause: `convertScore()` read `track.staves[0]` to decide if a track is fretted. TuxGuitar
(and MuseScore) put standard notation on staff 1 and the TAB staff — the one with tuning data —
on staff 2. Every GP fixture and alphaTex-built test happens to be single-staff, so this never
surfaced before.

Fixed: `convertScore()` now searches all of `track.staves` for one that `isStringed` and isn't
`isPercussion`, instead of assuming index 0 (`SongConverter/src/scoreConverter.ts`).

Filed and closed RockyRoadImport-3yj (bug) for this. Added a regression test —
a hand-authored two-staff fixture (standard notation on staff 1, TAB on staff 2) in
`musicXml.test.ts` — confirmed it fails against the pre-fix code and passes post-fix.

Re-ran the real file post-fix: Guitar track converts (was 0, now 134 notes), 3 hammer-on + 3
pull-off pairs correctly linked (matches the source markup — also a second, real-world data
point for `ic6`'s patch-package fix beyond the W3C suite), tuning read correctly as standard
EADGBE. tsc clean, full suite (26 tests) green.

One lesson added to `docs/lessons/engineering-hygiene.md`: a structural position (`staves[0]`)
that holds the right data in every fixture isn't a guarantee — search by the property that
actually matters instead of trusting position.

Open: upstream alphaTab issue (draft on ic6); one manual Guitar Pro export test; `1mi`
tests/fixture, `tak` docs/lessons, `0fx` piano-later remainder.
