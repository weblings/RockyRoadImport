# MusicXML vocals consumer built (2026-10-03)

Closed RockyRoadImport-m2g: Score-side vocals consumer per the bead's
build-readiness comment — no deviations except FormatVocals ported without
the psarc '+' → '\n' step (no MusicXML analog; literal '+' stays literal).

New: SongConverter/src/vocals.ts (all-staff lyric scan at verse 0 with
tick+text dedupe, begin/middle/end run-join, FormatVocals port) and
SongConverter/src/vocals.test.ts (8 tests: merge/format units plus
hand-authored single, two-part, and lyric-free fixtures). Wired into
scoreConverter.ts (ScoreConvertResult.lyrics) and the MusicXML tab in
main.ts (vocals-only gate, auto-pick vs <select>, lyric source excluded
from skipped, vocals.json + vocals part + length fold-in, status text).

Verified: full suite 36/36, tsc clean. One surprise: alphaTab rewrites
U+0020 to U+00A0 in track names (identical-looking assert diff) — lesson
filed, fixtures use single-word names.

Open after this: downstream renderer acceptance of vocals-only songs;
verse-select UI and GP parity deferred; msr upstream filing batches with
ic6; 0fx piano scope; tak Phase 7 docs (root README staleness predates
this change).
