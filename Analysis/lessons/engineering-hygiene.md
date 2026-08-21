# Engineering hygiene

General software-design principles, each demonstrated via a real bug hit in this codebase. See
[`README.md`](README.md) for how entries get routed here vs. elsewhere.

---

## Tests and a clean build don't prove correctness against real content

`gpConverter.ts`'s alphaTex-based unit tests all passed, `tsc`/`npm run build` were clean, yet
converting one real `.gp5` file surfaced three separate rendering bugs (`HandFret`, chord
`ChordID`, `Fingers`/`Frets` sentinel mismatch) that no synthetic fixture had exercised.

**Fix:** before calling a converter/format-mapping change done, run it against at least one real
source file and check the actual downstream consumer's output — not just that types check and
hand-written fixtures pass.

---

## An optional-looking field can gate whether something renders at all

`SongNote.HandFret` reads like a cosmetic hint, but RockyRoad's renderer uses it to position
open-string notes *and* to resolve which chord to draw — leaving it `undefined` produced `NaN`
geometry and silently dropped every open string and chord in GP-converted songs.

**Fix:** before leaving a schema field unpopulated, grep every consumer of that field rather than
assuming it's cosmetic because its own type/doc comment reads that way.

---

## Tagging data with a flag that implies a companion reference must guarantee that reference resolves

`gpConverter.ts` tagged the first note of any multi-note beat as `Chord`, but only built a real
`ChordID`/`SongChord` entry when the source format happened to have a *named* chord association —
so most real chords got the flag with no resolvable chord behind it, and the renderer silently
drew nothing for that note.

**Fix:** if a flag's presence implies a downstream lookup (a *ChordID*, a foreign key, an index
into another array), the producer must guarantee that lookup succeeds whenever it sets the flag —
never set the flag "optimistically" and leave the reference to fail quietly.

---

## A shared "unset" sentinel must use the same value in every parallel array a consumer reads together

`SongChord.Frets` uses `-1` for an unplayed string; `gpConverter.ts`'s `Fingers` array (no real
fingering data available) used `0` for "unknown" instead. The renderer only skips a string when
*both* `Frets[str]` and `Fingers[str]` are `-1` — mismatching the sentinel in just one of the two
arrays made every unplayed string render as a phantom note.

**Fix:** when two arrays are read together positionally, their "not applicable here" sentinel must
match exactly — check how the consumer actually combines them, not just how each array looks in
isolation.

---

## Vite's `base` config can't rewrite a path it never sees

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

**Symptom:** Renamed `BrowserPianoMidiConverter/` to `SongConverter/`. Everything built fine, but
`.gitignore`'s own pattern for the wasm build's generated output directory still pointed at the old
path name.

**Root cause:** A stale `.gitignore` entry doesn't error or warn — it just silently stops ignoring
the generated directory it used to cover, so the next `git status` (or worse, the next commit)
starts tracking build output that was always meant to be regenerated, not committed.

**Fix:** Before any folder rename, grep the whole repo for the old name — not just build configs
and source imports. `.gitignore` patterns, CI configs, and docs are all just as capable of silently
breaking as code is, and none of them fail loudly when they do.
