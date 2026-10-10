# MusicXML tab status text polish (2026-10-10)

Closed RockyRoadImport-we6. The MusicXML tab's success status (`main.ts`
`musicxmlInput` change handler) had grown into a dense paragraph on every
upload: track names, piano note count, the internal `keys.json` filename, a
static velocity/pedal/repeats caveat, and an unconditional "slap, pop, harmonic
detail not imported" line that fired even on piano-only files with no fretted
track at all.

Rewrote it to only report what needs attention — skipped tracks, piano
hand-fallback, ambiguous multi-track lyrics — and leave it blank on a clean
parse; the enabled download button is the success signal. Dropped the
`keys.json` filename and the static caveat text from the per-file status.

Before touching the guitar-technique caveat, checked whether it was still true
rather than assuming it was stale: grepped the installed alphaTab source
(`node_modules/@coderline/alphatab/dist/alphaTab.core.mjs`, `MusicXmlImporter`
at lines 22285–28412) for `.slap`/`.pop`/`.tap`/`harmonicType` assignments —
zero matches. Those fields are only ever set by the GP and AlphaTex importers;
our alphaTab patch doesn't touch MusicXML import for them either. So the
caveat is accurate, just needed to stop firing unconditionally — now gated on
there being actual fretted content in the file.

Also trimmed the root README's format-list sentence, which mixed "song" /
"file" / "score" nouns across formats and gave MusicXML's `keys.json` merge a
level of internal detail none of the other formats get in that sentence. That
detail already lives in the Troubleshooting section.

`tsc --noEmit`: clean for the touched files (pre-existing `lyricsSyllabic`
errors in `vocals.ts`/`musicXml.test.ts` confirmed present on `main` too,
unrelated). No test run this pass.
