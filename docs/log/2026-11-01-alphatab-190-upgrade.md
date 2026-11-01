# alphaTab 1.9.0 upgrade: patch cut to the syllabic hunk (2026-11-01)

Id: alphatab-190-upgrade

Closed RockyRoadImport-xdv. `@coderline/alphatab` ^1.9.0; `patches/@coderline+alphatab+1.9.0.patch`
now holds only `Beat.lyricsSyllabic` (RockyRoadImport-msr). Hammer-on, pedal, harmonics and
dynamics hunks are upstream. Suite 180/180 + `tsc` clean.

**Dynamics:** upstream's `_applyDynamics` fills `beat.dynamics` part-wide, so `scoreConverter.ts`
dropped the dej shared-mark timeline and reads `beat.dynamics` directly. One test changed meaning:
a later mark on either staff now reaches both (was "staff keeps its own marks").

**Old vs new sweep** (1.8.4+patch vs 1.9.0; the 69-file library is gone, so alphaTab's 24
musicxml-samples/testsuite files plus repo fixtures, 97 files):
- Velocity: ~23 piano notes in 4 files went from pp/p to default F (Ave Maria, Brahms, 2 Mozart).
  Upstream attaches a mark to the next *note*, so a dynamic written before a leading rest never
  reaches the other staff's notes at that position. Regression vs dej; accepted, not patched.
- Tempo: dotted-beat metronomes (DebuMand 126 dotted = 189, first-bar-tempo) now honor the beat
  unit, so beat/lyric times shift. Matches the `<sound tempo>` values, so an upstream fix.
- BrookeWest: 1.8.4 set `isHammerPullOrigin` on `type="stop"` notes too, so 2 chord notes got a
  spurious `HammerOn`; 1.9.0 only marks starts (the file has 2 pull-off pairs). Upstream fix.
- 31d: `<beat-unit>long</beat-unit>` gave negative times (vocals in reverse order) in 1.8.4;
  1.9.0 is monotonic and matches 1600 quarters/min. Upstream fix.
- Echigo: 1.9.0 keeps `<text>` U+3000 placeholders that 1.8.4 trimmed to empty, adding 5 blank
  vocals. `vocals.ts` now skips whitespace-only text (test added); output matches 1.8.4 again.
