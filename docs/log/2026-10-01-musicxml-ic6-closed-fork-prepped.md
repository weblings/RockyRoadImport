# MusicXML: lyrics decisions, ic6 closed, alphaTab fork fix prepared (2026-10-01)

Logged the lyrics-source decisions on [[musicxml-support]] Phase 3 (RockyRoadImport-0fx):
auto-pick a track's lyrics when exactly one part has them, a dropdown in the existing
`musicxml-metadata-form` when more than one does. Split the multi-syllable `<syllabic>`
gap out into its own bead (RockyRoadImport-msr) rather than leaving it buried in 0fx's
notes — it's a real patch-or-not decision, not just a thing to document.

Closed RockyRoadImport-ic6 (Phase 2 core). All local code was already done and tested
(convertMusicXml entry, Score*/scoreConverter renames, the noteStringLookup hammer-on/
pull-off patch) — the one remaining open item was filing the upstream alphaTab issue.

Prepared that fix as a real branch in the alphaTab fork
(`/home/andrew/Documents/RockyRoad/alphaTab`, branch `fix/musicxml-hammer-pull-string-index`)
rather than just a draft issue:
- Found the actual bug location in `MusicXmlImporter.ts`'s `case 'string':` handler (not
  just the `dist`-level patch we already ship) and re-derived the root cause from the real
  TypeScript source. Correction from the originally-drafted write-up: `Note.string` defaults
  to `NaN`, not `-1` — `Beat.addNote()`'s `note.string >= 0` guard simply skips indexing an
  unset note rather than indexing it under a wrong value. The fix location was still right;
  the mechanism description in our earlier draft wasn't.
- Added a new `hammer-pull-destination` reference test (unit assertions + visual PNG
  comparison, mirroring their existing `tie-destination` test) to the fork. Confirmed it
  fails pre-fix — the visual diff showed the hammer-on slur arc missing entirely from the
  render (117% pixel difference) — and passes post-fix. `tsc`/`biome` both clean.
- Did **not** file the issue or open the PR. Reading the fork's own contribution-rules docs
  (a contributing guide plus a dedicated instructions-for-AI-agents doc) turned up rules
  that don't match the Huenicorn-style draft from earlier in this session: every PR needs an
  accepted issue first, issues must describe *observed behavior only* (no diff, no "the bug
  is at line X", no source-code diagnosis), and every AI-assisted submission must carry a
  specific, non-removable disclosure block. Surfaced this to the user before drafting
  anything further, per that doc's own instruction to AI agents to do so.

Deferred: filing the upstream issue for this fix, and for whatever `msr`'s syllabic
investigation produces, until both are ready — submit as one batch rather than two
separate round trips through alphaTab's accept-then-PR process.

One lessons-learned entry added (verify a root-cause theory against primary source, not a
compiled artifact) and one more (read a target repo's own contribution rules before
drafting anything for it, even when another project's style seems like a reasonable
template) — both in `docs/lessons/engineering-hygiene.md`.

Open: `1mi` (now unblocked), `tak`, `0fx` (piano scope remainder), `msr`.
