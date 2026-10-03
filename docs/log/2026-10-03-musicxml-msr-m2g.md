# MusicXML msr patch + fork prep, vocals-consumer bead (2026-10-03)

Created RockyRoadImport-m2g (Score-side vocals consumer: beats-to-`SongVocal`
walk, lyric-source select, `vocals.json`), split from the msr investigation —
the syllabic patch had no Score-side consumer. Investigation confirmed vocals
exist on the PSARC path only (`PsarcConverter.cs` + `part.Notes ?? part.Vocals`);
`scoreConverter.ts` and the MusicXML tab handle notes only.

Updated RockyRoadImport-msr to the parallel-signal contract: the patch
surfaces per-verse syllabic values (`beat.lyricsSyllabic`); run-joining lives
in m2g's consumer, since `SongVocal` has no continues-word flag.

Local patch (`a3e9433` on `feat/MusicXML`): `_parseLyric` case plus
`Beat` type declaration, patch-package regenerated (ic6 hunk intact),
`musicXml.test.ts` pins it — failed pre-patch (`begin`/`end`/`""` vs
`undefined`), green post. `tsc` clean, 28/28 suite.

Fork prep (`../alphaTab`, branch `fix/musicxml-lyric-syllabic`, `3507d05e`):
TS-source `Beat.lyricsSyllabic`, `_parseLyric` case replacing the
`not supported` comment, regenerated cloner + serializer (exact minimal
diff), `lyric-syllabic.xml` fixture + unit test with JSON round-trip —
fails pre, passes post. Importer file 29/29, model dir 163/163,
`tsc`/`biome` clean. No visual fixture: render output is byte-identical.

Deferred: upstream issue/PR filing batches with ic6's held filing (alphaTab
requires issue-before-PR plus AI-disclosure block).

Two lessons entries added (`docs/lessons/engineering-hygiene.md`, now 15 — at
the split threshold): patch the resolved bundle, pin a new model field at
every layer.

README check: root `README.md` still lists only psarc/GP/piano converters —
pre-existing staleness from the Phase 4 tab landing, owned by `tak`
(Phase 7 docs), not by this session's changes. Left for tak.

Open: `m2g` (consumer), `msr` (upstream filing), `tak`, `0fx` (piano scope).

## Close-out (2026-10-03)

Verified ESM-only scope (exports `import` → `alphaTab.mjs` → `alphaTab.core.mjs`, patched; `require` → `alphaTab.js` unpatched by decision) and serializer N/A locally (no Score JSON round-trip; fork covers it). Fallback guard + status caveat intact; focused 16/16, full 36/36, `tsc` clean. Upstream filing waits for the MusicXML workstream end, batched `ic6`+`msr`; piano (`0fx`) unstarted.
