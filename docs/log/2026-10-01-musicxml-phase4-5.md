# MusicXML Phases 4–5, finished (2026-10-01)

Wired the [[musicxml-support]] MusicXML tab (RockyRoadImport-e86) and handled the
unpopulated techniques (RockyRoadImport-l1i). Both beads closed.

Shipped this session:
- New `MusicXML` tab in `main.ts` mirroring the GP tab (`musicxml-*` IDs,
  `accept=".musicxml,.xml,.mxl"`, same metadata/zip flow). IDs are format-scoped so a
  future piano tab won't collide; the generic `data-tab` switcher needed no changes.
- Foreign-file probe resolved the plan's last Phase 4 open: arbitrary XML and plain text
  both throw out of `ScoreLoader` (no AlphaTex garbage score), surfaced as
  `Error parsing MusicXML file: …` — pinned by a rejection case in `musicXml.test.ts`.
- Dead-note workaround in `buildNote()`: X notehead (any of the 5 duration variants via
  `alphaTab.model.MusicFontSymbol`) ORs in `FretHandMute`. Test failed pre-fix, green
  post-fix. Palm mute needed no code (Phase 1 survey).
- Success status appends a static `Known MusicXML limits: slap, pop, and harmonic detail
  are not imported.` suffix; plan's Phase 5 open marked resolved. One lessons entry added
  (state untraceable gaps statically).

Surprises:
- `bd close` refused on dependency order twice (`e86`, `l1i` both "blocked" by `ic6`,
  which stays open only for the manual upstream paste) — closed with `--force` and the
  rationale on each bead. Dependency order tracks filing sequence, not functional need,
  once the depended-on code is committed.
- The X-notehead enum lives at `alphaTab.model.MusicFontSymbol`, not the package root —
  confirmed by a runtime probe before writing the workaround.

Open: upstream alphaTab issue (draft on ic6); one manual Guitar Pro export test; `1mi`
tests/fixture (partly pre-covered by `musicXml.test.ts`), `tak` docs/lessons, `0fx`
piano-later remainder.
