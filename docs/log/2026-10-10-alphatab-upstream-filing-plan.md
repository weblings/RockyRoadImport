# alphaTab upstream: what still needs filing, and how (2026-10-10)

Rechecked our four local alphaTab patch fixes against `develop` (a89101c2, fetched
2026-10-10) for RockyRoadImport-aio.

**Already fixed upstream - dropped:** hammer-on/pull-off string re-index (ic6, #2914),
pedal stop in a later bar (ngd.5, #2938). Also fixed there, never ours to file: dead
notes (#2914), harmonics (#2947), per-note palm-mute/let-ring, `<credit-words>` titles.
Slap/pop has no MusicXML element, so there is nothing to report.

**Still to file (two issues):**
- Per-staff dynamics (ngd.4) - bug. `develop` still keeps dynamics part-wide in parse
  order. Repro is the MusicXML suite's own 43e: the bass draws a `p` leaked from a
  later treble mark, though 43e says the mark is treble-only. The fix reuses the unused
  `StaffContext.currentDynamics` and changes 11 visual refs (an unmarked staff draws
  the default `f`), so the maintainers must pick the rendering - issue first.
- Lyric syllabic (msr) - feature request. `develop` still skips `<syllabic>`; the fix
  adds a model field, so expect upstream to design the API.

Ave Maria's shared `pp` and 43e's staff-only `ffff` are encoded identically, so no
importer rule fits both; the "mark covers both hands" guess stays in our converter
(RockyRoadImport-dej), not upstream.

**Process (alphaTab AGENTS rules):** no PR without an accepted issue; issue bodies
describe symptoms only (no diffs, file/line pointers, or links to our branches); real
values in their template; mandatory `alphatab-ai-authored-v1` disclosure block. Fix
branches in `../alphaTab` (`fix/musicxml-staff-dynamics` 8a989f9b,
`fix/musicxml-lyric-syllabic` 7ac8c281, both on current `develop`) wait for an accepted
issue; no fork remote until then.

**Local patch stays whole:** stable npm is 1.8.4 and the latest alpha
(1.9.0-alpha.1891, 2026-08-10) predates #2914/#2938, so all four fixes stay in our
patch until a release built from `develop` after 2026-10-08.
