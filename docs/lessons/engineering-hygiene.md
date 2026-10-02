# Engineering hygiene

General software-design principles, each demonstrated via a real bug hit in this codebase. See
[`README.md`](README.md) for how entries get routed here vs. elsewhere.

---

## Tests and a clean build don't prove correctness against real content
Tags: testing, fixtures, real-files
Applies-when: verifying a converter or format-mapping change

`scoreConverter.ts`'s alphaTex-based unit tests all passed, `tsc`/`npm run build` were clean, yet
converting one real `.gp5` file surfaced three separate rendering bugs (`HandFret`, chord
`ChordID`, `Fingers`/`Frets` sentinel mismatch) that no synthetic fixture had exercised.

**Fix:** before calling a converter/format-mapping change done, run it against at least one real
source file and check the actual downstream consumer's output — not just that types check and
hand-written fixtures pass.

---

## An optional-looking field can gate whether something renders at all
Tags: schema, optional-fields, renderer
Applies-when: leaving a schema field unpopulated

`SongNote.HandFret` reads like a cosmetic hint, but RockyRoad's renderer uses it to position
open-string notes *and* to resolve which chord to draw — leaving it `undefined` produced `NaN`
geometry and silently dropped every open string and chord in GP-converted songs.

**Fix:** before leaving a schema field unpopulated, grep every consumer of that field rather than
assuming it's cosmetic because its own type/doc comment reads that way.

---

## Tagging data with a flag that implies a companion reference must guarantee that reference resolves
Tags: flags, foreign-keys, chords
Applies-when: setting a flag that implies a downstream lookup

`scoreConverter.ts` tagged the first note of any multi-note beat as `Chord`, but only built a real
`ChordID`/`SongChord` entry when the source format happened to have a *named* chord association —
so most real chords got the flag with no resolvable chord behind it, and the renderer silently
drew nothing for that note.

**Fix:** if a flag's presence implies a downstream lookup (a *ChordID*, a foreign key, an index
into another array), the producer must guarantee that lookup succeeds whenever it sets the flag —
never set the flag "optimistically" and leave the reference to fail quietly.

---

## A shared "unset" sentinel must use the same value in every parallel array a consumer reads together
Tags: sentinels, parallel-arrays, renderer
Applies-when: adding a parallel array read positionally alongside another

`SongChord.Frets` uses `-1` for an unplayed string; `scoreConverter.ts`'s `Fingers` array (no real
fingering data available) used `0` for "unknown" instead. The renderer only skips a string when
*both* `Frets[str]` and `Fingers[str]` are `-1` — mismatching the sentinel in just one of the two
arrays made every unplayed string render as a phantom note.

**Fix:** when two arrays are read together positionally, their "not applicable here" sentinel must
match exactly — check how the consumer actually combines them, not just how each array looks in
isolation.

---

## Vite's `base` config can't rewrite a path it never sees
Tags: vite, base-path, github-pages, wasm
Applies-when: referencing a public asset by URL in a runtime-built string

**Symptom:** Deployed to GitHub Pages under `/RockyRoadImport/` (not domain root) — the Rocksmith
2014 wasm tab silently failed to load, even after setting `base` in `vite.config.ts`.

**Root cause:** The wasm loader works around a Vite dev-server limitation by injecting a real
`<script type="module">` tag whose `textContent` is a plain string containing
`import { dotnet } from '/psarc-wasm/dotnet.js'`. That string is never parsed by Vite's own
HTML/module-graph processing — it's just JS building a string at runtime — so `base` has nothing to
rewrite it against, same as any other hardcoded absolute-root path used outside Vite's own asset
pipeline.

**Fix:** Build the path from `import.meta.env.BASE_URL` instead of a literal leading `/`, same
treatment as any other runtime string referencing a public asset by URL, not just ones Vite happens
to compile through its normal `<script src>`/`<link href>` handling.

---

## Grep the whole repo before renaming a shared project folder — a `.gitignore` pattern can be functional, not cosmetic
Tags: renames, gitignore, grep
Applies-when: renaming a shared folder

**Symptom:** Renamed `BrowserPianoMidiConverter/` to `SongConverter/`. Everything built fine, but
`.gitignore`'s own pattern for the wasm build's generated output directory still pointed at the old
path name.

**Root cause:** A stale `.gitignore` entry doesn't error or warn — it just silently stops ignoring
the generated directory it used to cover, so the next `git status` (or worse, the next commit)
starts tracking build output that was always meant to be regenerated, not committed.

**Fix:** Before any folder rename, grep the whole repo for the old name — not just build configs
and source imports. `.gitignore` patterns, CI configs, and docs are all just as capable of silently
breaking as code is, and none of them fail loudly when they do.

---

## A required field added to a shared type is only enforced where a construction site is explicitly annotated with that type
Tags: typescript, type-annotation, songinfo
Applies-when: adding a required field to a shared type

Adding `GeneratedBy: string` to `SongInfo` correctly made `tsc` flag the two `song.json` builders
written as `const x: SongInfo = {...}`. The third (.psarc path) builds its object via
`{ ...SongData, SongName: ..., ... }` with no `SongInfo` annotation at all — it flows straight into
`JSON.stringify()`, which accepts anything — so a future edit there could drop `GeneratedBy` (or
any required field) with zero compiler warning.

**Fix:** when a shared type has multiple independent construction sites, "compiles clean" only
proves the annotated ones are actually checked — grep for which sites carry the type annotation,
not just which ones are shaped like it. (Also: `song.json` has three separate ad-hoc builders in
`main.ts` with no shared factory — worth remembering before adding the next `SongInfo` field.)

---

## Re-index a lookup whenever the key field is assigned, not just on attach/remove
Tags: indexes, mutable-keys, parse-order
Applies-when: indexing parsed objects by a field assigned later in the same parse pass

alphaTab's `Beat.addNote()` snapshots each note into `noteStringLookup` keyed by `note.string` —
but its MusicXML importer assigns `note.string` only when `<technical><string>` parses, after
attachment. The map kept the default (`-1`), so hammer-on/pull-off linking searched a stale index
and silently cleared a valid flag. GP's binary format sets the field before attach, which is why
only one import path broke while sharing the same linking code.

**Fix:** treat every key-field assignment as index maintenance, and distrust a passing sibling
path — same shared code with differently-ordered inputs fails exactly there.

---

## A literal match on another tool's default text is coincidence, not contract
Tags: interop, literals, defaults
Applies-when: matching another tool's emitted text or labels exactly

alphaTab detects palm mute only on the literal `<words>` text `P.M.` — which happens to be
MuseScore's style default, while TuxGuitar emits bare `<words>P.M.</words>` with no `<dashes>`,
so that path ignores it entirely (its `<play><mute>palm</mute>` formal element is what works).
Any retyped label or alternate spelling silently disables the flag with no error.

**Fix:** when interop hinges on a literal, verify the exact bytes each real exporter emits from
its source, not its docs — and write down which defaults the match depends on.

---

## A structural position that happens to hold the right data in every fixture isn't a guarantee
Tags: real-files, structural-assumptions, musicxml
Applies-when: picking "which one" from a parallel/indexed collection by position

`convertScore()` read `track.staves[0]` to find a track's fretted staff — correct for every
alphaTab-built fixture and for GP (single-staff, tab-native). A real TuxGuitar export put
standard notation on staff 1 and the actual tab data on staff 2, so the only guitar track in a
real file was silently pushed into `skipped` and never converted.

**Fix:** when a property (here, `isStringed`) determines which element of a same-shaped
collection matters, search for the element with that property instead of trusting a position —
especially when every fixture that validated the position-based code happened to be built
single-staff-first.

---

## A root-cause theory built from a compiled artifact isn't verified until checked against primary source
Tags: root-cause, verification, dist-vs-source
Applies-when: explaining why a fix works, from a patch written against built/vendored output

Our local alphaTab fix (patched against `node_modules/@coderline/alphatab/dist/...`) worked,
and the write-up built from that dist read said the bug was `note.string` defaulting to `-1`
and the lookup map holding a stale wrong value. Reading the real upstream TypeScript source
(once the fork was cloned) showed the actual default is `NaN`, and `Beat.addNote()`'s
`note.string >= 0` guard just skips indexing an unset note — a different mechanism than
described, even though the fix *location* was correct.

**Fix:** a patch that demonstrably works is not the same claim as an accurate explanation of
why. Before writing up root cause for anyone else to read (an upstream issue, a lessons
entry, a PR description), verify the explanation against primary source if it's available —
not just the compiled/vendored copy the original diagnosis was read from.

---

## Read a target repo's own contribution rules before drafting anything for it
Tags: upstream, contributing, process
Applies-when: preparing an issue or PR for a project you don't maintain

A Huenicorn-style upstream write-up (friendly context, grouped fixes, inline diff, "here's
the root cause") was drafted for alphaTab before its contributing guide and dedicated
instructions-for-AI-agents doc had been read. alphaTab's actual rules are stricter and
incompatible with that draft: no PR without an accepted issue first, issues must describe
observed behavior only (no diff, no file/line claims, no source-code diagnosis), and a
non-removable AI-disclosure block is mandatory.

**Fix:** one project's accepted contribution style doesn't transfer to the next one, even
when both are small OSS projects you've contributed to before. Read the target repo's own
contributing guide and any agent-specific instructions doc and issue templates before
drafting anything, not after.

---

## State an untraceable gap statically instead of detecting it per item
Tags: limitations, status-ux, honesty
Applies-when: an upstream gap leaves no trace in the converted output

alphaTab's harmonic handling is a confirmed no-op — nothing lands in the model, so no per-note
check can ever report "this harmonic was dropped." Trying to detect it per file would mean
re-parsing the source XML for what the importer ignored.

**Fix:** when the gap is at the importer level, say so once in the result status (a static
known-limits suffix next to the skipped-track report) rather than building detection for data
that isn't there. Reserve per-item surfacing for gaps with a detectable signal.
