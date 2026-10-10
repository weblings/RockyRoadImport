# Upstream dependencies

Gotchas in third-party packages, their importer/parser internals, `patch-package`
patches, the fork workflow, and the upstream issue/PR process. See
[`README.md`](README.md) for how entries get routed here vs. elsewhere.

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

## Patch the bundle your toolchain resolves, not the package's other copies
Tags: patch-package, vendoring, bundles
Applies-when: patching a dependency that ships multiple build artifacts

`@coderline/alphatab` ships a facade `alphaTab.mjs` re-exporting `alphaTab.core.mjs`,
a CJS `alphaTab.js`, and min builds. Vite/vitest resolve the ESM chain, so the
hammer-on and syllabic patches target `dist/alphaTab.core.mjs` — while `dist/alphaTab.js`
carries its own copy of the same importer code, still unpatched. Patching the wrong
copy would pass no test and fix no user path, silently.

**Fix:** before writing a dependency patch, confirm which artifact your runner and
bundler actually load (facade re-exports, the exports-map `import` vs `require`
conditions), scope the patch there, and write down which copies stay unpatched so
nobody later assumes coverage.

---

## A new model field must be pinned at every layer it crosses
Tags: codegen, serialization, testing
Applies-when: adding a field to a shared model

`Beat.lyricsSyllabic` needed five coordinated touches: the model field, the
auto-generated cloner and serializer (running `generate-typescript` produced
exactly those lines with no noise — hand-editing generated files would have
been both riskier and unnecessary), the parser case, and the JSON round-trip,
which generic `stringify` carries for free but was asserted rather than
assumed. Rendering needed nothing: the field is data-only, so the fork test
uses the no-render `loadFile` precedent instead of a PNG fixture that would
prove nothing.

**Fix:** enumerate every layer a new field crosses (model, clone, serialize,
parse, round-trip, render) and pin each with an assertion — or a written
reason it is unaffected. A green focused test that only exercises one layer
is not coverage of the others.

---

## Check for orphaned state near the bug before designing a dependency fix
Tags: upstream, patching, dead-state
Applies-when: fixing a dependency's internal state handling

alphaTab's MusicXML importer declared a per-staff `StaffContext.currentDynamics`
that nothing read or wrote, alongside the buggy part-wide `_currentDynamics`
behind the cross-staff dynamics leak. Wiring the 5 use sites to the dead field
made the patch minimal and upstream-plausible instead of inventing new state.

**Fix:** grep the dependency for unread/unwritten fields around the bug first —
dead state often marks where the maintainer meant the fix to go.

---

## A per-container guard drops spans that end in a later container
Tags: importer, spans, patch-package
Applies-when: trusting an importer timeline built from span-ending marks

alphaTab's MusicXML importer kept a pedal `stop` only when its own bar
already held a marker, so a stop ending a span in a later bar vanished and
sustain stuck down to the piece end. The bar chain needed for the check only
exists after `finish()` synthesis, so the patch walks back through
`previousBar` at parse time instead.

**Fix:** probe a span that crosses containers before trusting any importer
timeline — same-bar fixtures pass while real multi-bar spans silently stick.

---

## An internal playback walk ports cleanly when the model fields are public
Tags: upstream, repeats, porting
Applies-when: reusing dependency playback semantics without touching internals

alphaTab plays repeats through an internal `MidiPlaybackController` (not in
the public typings), but every field its walk reads (`repeatGroup`,
`alternateEndings`, `repeatCount`, `start`, `calculateDuration()`) is public.
Porting the ~50-line normal-repeat path beat reaching into internals, and the
port's output matched the generator's own tick math exactly.

**Fix:** before casting into internals or vendoring a bundles file, check
whether the internal walk's inputs are all public — a port stays typed and
survives upgrades.

---

## alphaTab fills unused voices with empty beats that carry default state
Tags: alphatab, voices, model-defaults
Applies-when: deriving change points or "last value" state from a Bar's voices

A bar with six voices may have real notes in one; the rest hold `isEmpty` filler beats whose
`dynamics` is the default F. Reading them as data turned every mark into a same-tick "back to F",
flattening real scores (69-file sweep caught it; hand-authored fixtures have no filler voices).

**Fix:** skip `beat.isEmpty` before treating any per-beat field as authored content.
