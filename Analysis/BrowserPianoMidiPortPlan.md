# Browser Piano MIDI Port Plan

This document covers what it would take to port the MIDI → OpenSongChart conversion logic to TypeScript so it can run entirely in a browser. It draws on the existing ChartConverter C# codebase and the ThreeCP (ChartPlayer → Three.js) conversion as a reference.

---

## Scope

This plan covers only the **piano MIDI → OpenSongChart** path. It intentionally excludes:
- PSARC (Rocksmith) conversion — requires Wwise audio decoding with no browser equivalent
- Rock Band Phase Shift conversion — depends on Rock Band-specific track naming conventions
- Live MIDI device I/O (`MidiIn`/`MidiOut`) — Windows-only P/Invoke, not needed for file conversion

The piano MIDI path is the cleanest subset: standard MIDI binary parsing, pure note mapping logic, and JSON output. No native dependencies, no external tools.

---

## Why This Subset Is Tractable

| Factor | PSARC/RockBand | Piano MIDI |
|---|---|---|
| Binary parsing | PSARC container + SNG + Wwise banks | Standard MIDI only |
| Native code | Wwise decompression, ww2ogg | None |
| Win32 P/Invoke | 42 calls in MidiInterop.cs | None (file converter never uses MidiIn/MidiOut) |
| File sidecar required | song.ini required | Not required — title/artist embedded in MIDI text meta events |
| Audio extraction | Complex (Wwise → OGG) | Not applicable |

The ThreeCP conversion showed that audio got *simpler* in browser (AudioContext replaces a full Vorbis+RubberBand stack). Piano MIDI conversion has no audio extraction at all — the output is pure JSON.

---

## Reference: ThreeCP Conversion Lessons

The ChartPlayer → Three.js port (in `/home/andrew/Documents/MusicThing/ThreeCP/`) is the closest prior art. Key takeaways that apply here:

- **Pure logic ported 1:1** — `NoteUtil.ts`, `SongFormat.ts`, math helpers needed zero redesign
- **Binary reading** — replaced .NET `BinaryReader` with a `DataView` wrapper over `ArrayBuffer`
- **Frame-rate-dependent lerps** — not relevant here (converter, not renderer)
- **Audio pipeline** — ThreeCP dropped Vorbis/RubberBand entirely; piano MIDI similarly has nothing to drop
- **ThreeCP's `SongFormat.ts`** already defines most of the data models needed — check before rewriting
- **JSON handling** — ThreeCP uses native `JSON.parse()` / `JSON.stringify()` throughout with no third-party library; the same approach applies here (see JSON section below)

---

## Existing MIDI Parsing Libraries

Rather than porting all 24 MIDI event classes from scratch, an existing JS/TS library could replace Groups 1–5 entirely. Research across 8 libraries found two viable options:

### `midi-file` — recommended for stability
- **npm:** `midi-file` — MIT, no dependencies, ~10 kB minified
- **Browser:** Yes — accepts `Uint8Array` directly from the File API
- **TypeScript:** Bundled `.d.ts`
- **Maintenance:** Inactive since 2022, but stable and complete. Used internally by `@tonejs/midi` which drives its reliability
- **API:** `parseMidi(buffer)` returns `{ header, tracks[] }` where each track is a flat array of raw event objects with `deltaTime`, `type`, and typed fields — closest equivalent to what the C# `MidiFile` class produces
- **Coverage:** Full — note on/off, all meta events (tempo, time sig, track name, text, lyrics, markers), CC, pitch bend, sysex, program change

### `midi-json-parser` — recommended for active maintenance
- **npm:** `midi-json-parser` — MIT, no dependencies
- **Browser:** Yes — accepts `ArrayBuffer` natively, promise-based
- **TypeScript:** Native (library is written in TypeScript), 24 typed event interfaces
- **Maintenance:** Actively maintained — released March 2026
- **API:** `parseArrayBuffer(buffer)` returns a Promise resolving to `{ division, format, tracks[] }` with strongly-typed event objects
- **Coverage:** Full — same event coverage as `midi-file` including sysex

### Libraries to avoid
| Library | Reason |
|---|---|
| `midi-parser-js` | GPL-3.0 license — copyleft contamination |
| `jasmid` | Explicitly abandoned, README says "UNMAINTAINED" |
| `@tonejs/midi` | Stalled since 2022, hides raw events behind abstraction — can't access tick-level data |
| `midi-writer-js`, `jsmidgen` | Writers only, cannot parse binary MIDI |

### Impact on scope

Using `midi-file` or `midi-json-parser` eliminates Groups 1–5 from the plan (enums, BinaryReader, 17 event classes, MidiEventCollection, MidiFile parser) — roughly **22 files and 2–3 days of work**. The converter logic in Group 7 (`MidiPianoConverter.ts`, `RockBandConverter.ts`) would call the library's parse output directly instead of the C# classes.

The tradeoff is a small external dependency vs. full control over the parsing layer. Given both options are MIT and the C# MIDI classes themselves were adapted from NAudio (also MIT), using a library is the pragmatic choice.

---

## JSON Serialization

No third-party library needed. ThreeCP confirmed this pattern — it uses native `JSON.parse()` and `JSON.stringify()` throughout:

- `SongIndex.ts` — `JSON.parse(await (await fh.getFile()).text())` to load `song.json`
- `ActiveSceneScreen.ts` — `JSON.parse(await file.text()) as T` for instrument note files
- `Settings.ts` — `JSON.parse` / `JSON.stringify` for localStorage persistence

The C# side uses `System.Text.Json` (also built-in), so both sides independently made the same call. Native JSON is the right choice here.

The one nuance worth carrying over from the C# serializer: it **omits default values** to keep output compact (e.g. skipping `-1` fret fields, empty arrays). This is handled with a `replacer` function passed to `JSON.stringify` — not a library concern:

```typescript
JSON.stringify(data, (key, value) => {
    if (value === -1 || value === null) return undefined;
    if (Array.isArray(value) && value.length === 0) return undefined;
    return value;
}, 2)
```

No additional dependency required.

---

## Files to Drop (Windows-Only, Not Needed)

These 7 classes are live MIDI hardware I/O. A file converter never calls them:

- `MidiInterop.cs` — 42 `[DllImport("winmm.dll")]` P/Invoke declarations
- `MidiIn.cs` — MIDI input device via Windows callbacks
- `MidiOut.cs` — MIDI output device
- `MidiInCapabilities.cs` — Windows MME marshaling struct
- `MidiOutCapabilities.cs` — Windows MME marshaling struct
- `MidiOutTechnology.cs` — Windows-specific enum
- `MidiInMessageEventArgs.cs` — event args for Windows device callbacks (data holder only, but unused without MidiIn)

---

## Files to Create

### Group 1 — Enums & Constants (~1–2 hours)

Trivial direct translation. Enum values copy verbatim with syntax changes.

| TypeScript file | From C# source |
|---|---|
| `MidiCommandCode.ts` | `MidiCommandCode.cs` |
| `MetaEventType.ts` | `MetaEventType.cs` |
| `MidiController.ts` | `MidiController.cs` |

---

### Group 2 — Binary Reader Glue (~1–2 hours)

Not in the C# codebase — needed as a bridge between browser `ArrayBuffer` and the MIDI parsing logic that assumes a `BinaryReader`-style API.

```
BinaryReader.ts
```

Key methods:
- `readByte()` / `readBytes(n)`
- `readUInt16BE()` / `readUInt32BE()` — MIDI is big-endian
- `readVarLen()` — MIDI variable-length quantity encoding

---

### Group 3 — MIDI Event Classes (~1–2 days)

Pure binary parsing. The only translation work is replacing `System.IO.BinaryReader` calls with the `BinaryReader.ts` wrapper above.

| TypeScript file | From C# source | Notes |
|---|---|---|
| `MidiEvent.ts` | `MidiEvent.cs` | Factory method + base reading; main complexity here |
| `MetaEvent.ts` | `MetaEvent.cs` | Factory for meta event subtypes |
| `NoteEvent.ts` | `NoteEvent.cs` | Includes static drum kit name table |
| `NoteOnEvent.ts` | `NoteOnEvent.cs` | Paired note-on/off with calculated duration |
| `ControlChangeEvent.ts` | `ControlChangeEvent.cs` | CC number + value; needed for sustain pedal (CC 64) |
| `PatchChangeEvent.ts` | `PatchChangeEvent.cs` | Includes GM instrument name table (128 entries) |
| `PitchWheelChangeEvent.ts` | `PitchWheelChangeEvent.cs` | 14-bit pitch bend value |
| `ChannelAfterTouchEvent.ts` | `ChannelAfterTouchEvent.cs` | Trivial |
| `SysexEvent.ts` | `SysexEvent.cs` | Read bytes until `0xF7` (EOX marker) |
| `TempoEvent.ts` | `TempoEvent.cs` | Microseconds per quarter note → BPM |
| `TimeSignatureEvent.ts` | `TimeSignatureEvent.cs` | Numerator/denominator/metronome clicks |
| `KeySignatureEvent.ts` | `KeySignatureEvent.cs` | Sharps/flats, major/minor |
| `TextEvent.ts` | `TextEvent.cs` | Track names, lyrics, section markers |
| `RawMetaEvent.ts` | `RawMetaEvent.cs` | Fallback for unknown meta event types |
| `TrackSequenceNumberEvent.ts` | `TrackSequenceNumberEvent.cs` | Rarely relevant |
| `SmpteOffsetEvent.ts` | `SmpteOffsetEvent.cs` | Rarely relevant |
| `SequencerSpecificEvent.ts` | `SequencerSpecificEvent.cs` | Rarely relevant |

---

### Group 4 — Collection & Sorting (~half day)

| TypeScript file | From C# source | Notes |
|---|---|---|
| `MidiEventCollection.ts` | `MidiEventCollection.cs` | Multi-track event container; handles type 0 ↔ type 1 conversion |
| `MidiEventComparer.ts` | `MidiEventComparer.cs` | Stable sort: by absolute time, EndTrack last, meta before note |
| `MidiMessage.ts` | `MidiMessage.cs` | Packed 32-bit short message; bit manipulation only |

---

### Group 5 — MidiFile Parser (~half day)

| TypeScript file | From C# source | Notes |
|---|---|---|
| `MidiFile.ts` | `MidiFile.cs` | Entry point. Accepts `ArrayBuffer` (from File API) instead of a file path. Parses MThd/MTrk chunks, pairs note-on/off, builds event collection. |

This is the only file where the input API changes meaningfully. The browser `File` object is read via `file.arrayBuffer()` (a Promise), then handed to `MidiFile` as an `ArrayBuffer`.

---

### Group 6 — SongFormat Data Models (~half day)

The C# source lives in a git submodule (`Dependencies/OpenSongChart/SongFormat/`) that is not cloned in this repo. The types are fully inferrable from usage in `RockBandConverter.cs`. **Check ThreeCP's `SongFormat.ts` first** — it may already define most of these.

| TypeScript file | Contents |
|---|---|
| `SongFormat.ts` | `SongData`, `SongInstrumentPart`, `ESongInstrumentType`, `StringTuning` |
| `SongStructure.ts` | `SongStructure`, `SongBeat`, `SongSection` |
| `SongNotes.ts` | `SongInstrumentNotes`, `SongNote`, `SongChord`, `ESongNoteTechnique` |
| `SongDrumNotes.ts` | `SongDrumNotes`, `SongDrumNote`, `EDrumKitPiece`, `EDrumArticulation` |
| `SongKeyboardNotes.ts` | `SongKeyboardNotes`, `SongKeyboardNote` (extend with hand + pedal fields per PIANO_MIDI_ANALYSIS.md) |
| `SongVocal.ts` | `SongVocal` |

---

### Group 7 — Converter Logic (~1–2 days)

| TypeScript file | From C# source | Notes |
|---|---|---|
| `RockBandConverter.ts` | `RockBandConverter.cs` | Port only the MIDI processing sections: track identification, event loop, tempo map, note extraction. Strip all `System.IO` file reading/writing — those become the caller's responsibility. |
| `MidiPianoConverter.ts` | New (no C# equivalent yet) | Described in `PIANO_MIDI_ANALYSIS.md`. Detects piano tracks by GM patch/channel/track name, reads CC 64 for sustain, optionally splits by pitch threshold into left/right hand. Sources song title/artist from MIDI text meta events — no sidecar file required. |
| `ChartUtil.ts` | `ChartUtil.cs` | Vocal line-breaking utility. ~50 lines of pure string logic. |

---

### Group 8 — Browser Entry Point (~half day)

No C# equivalent. New code specific to the browser environment:

```
main.ts
```

Responsibilities:
- File picker (`<input type="file" accept=".mid">`) or drag-and-drop
- Read selected file as `ArrayBuffer` via `file.arrayBuffer()`
- Parse MIDI meta events to pre-fill metadata fields
- Present metadata form for user review/completion (see below)
- Call `MidiPianoConverter` with confirmed metadata
- Serialize output to JSON
- Trigger download of resulting `.json` files via `Blob` + `URL.createObjectURL`

No backend required. The entire conversion runs client-side.

#### Metadata Form

The original `song.ini` provided fields that the MIDI file only partially covers. These should be surfaced as editable input fields in the browser UI, pre-filled where the data can be auto-detected:

| Field | Source | UI treatment |
|---|---|---|
| Song name | MIDI `SequenceTrackName` / `TextEvent` | Pre-filled, editable text input |
| Artist | MIDI `TextEvent` (first track) | Pre-filled, editable text input |
| Album | Not in MIDI standard | Empty, optional text input |
| MIDI delay (ms) | Not detectable | Defaults to `0`, numeric input |
| Difficulty (0–5) | Not detectable | Defaults to `0`, range slider (optional) |

Pre-filling from MIDI meta events is important — the user shouldn't retype what the converter already knows. The Für Elise test file, for example, already embeds `"Fur Elise"` and `"Beethoven"` and would pre-fill two of the three meaningful fields automatically.

`album` and `difficulty` are genuinely optional. The converter should proceed cleanly if they are left blank (empty string and `0` respectively), consistent with how the C# `RockBandIni` defaults behave.

---

## Phased Implementation Strategy

Each phase has a clear pass criterion — a working input/output you can verify before moving on. Phases build on each other but each is independently testable.

---

### Phase 0 — Project Scaffold

**Goal:** A Vite + TypeScript project that builds and serves a blank page.

**Input:** Nothing
**Output:** `http://localhost:5173` loads without errors; `npm run build` succeeds

**Work:**
- `package.json` — dependencies: `midi-json-parser`; devDependencies: `typescript`, `vite`
- `tsconfig.json` — strict mode, ESNext target (consistent with ThreeCP)
- `vite.config.ts` — minimal, matching ThreeCP's config
- `index.html` — single `<div id="app">` and `<script type="module" src="/src/main.ts">`
- `src/main.ts` — empty entry point, `console.log('ready')`

**C# logic adapted:** None. Pure scaffold.

**Pass criterion:** `npm run dev` serves the page; browser console shows `ready`.

---

### Phase 1 — MIDI File Ingestion

**Goal:** Accept a `.mid` file from the browser and log all parsed events to the console.

**Input:** User selects `beethoven_fur_elise.mid` via a file picker
**Output:** Browser console shows structured event objects — track names, tempo events, note-on/off pairs, text events

**Work:**
- Add `<input type="file" accept=".mid">` to `index.html`
- In `main.ts`: read file as `ArrayBuffer`, pass to `midi-json-parser`'s `parseArrayBuffer()`
- Log the resulting `{ format, division, tracks[] }` structure

**C# logic adapted:** None — this replaces `MidiFile.cs` entirely with the library. Verify the library surfaces:
- `sequenceTrackName` events (for title/artist detection later)
- `setTempo` events (for beat timing)
- `noteOn` / `noteOff` pairs
- `controlChange` events (for CC 64 sustain)

**Pass criterion:** Console output for Für Elise shows `"Fur Elise"` and `"Beethoven"` in text events, tempo events with microsecond values, and note-on/off pairs with delta times.

---

### Phase 2 — SongFormat Data Models

**Goal:** TypeScript interfaces matching the OpenSongChart JSON schema that ThreeCP already consumes.

**Input:** ThreeCP's `SongFormat.ts` as reference
**Output:** A `src/songformat/` folder of interfaces; `tsc` compiles with no errors

**Work:**
- Copy/adapt `SongFormat.ts` from ThreeCP (`SongData`, `SongInstrumentPart`, `ESongInstrumentType`)
- Add `SongStructure.ts` (`SongStructure`, `SongBeat`, `SongSection`)
- Add `SongKeyboardNotes.ts` (`SongKeyboardNotes`, `SongKeyboardNote` with `hand?: 'left'|'right'` and `sustainActive?: boolean` extensions)
- Stub remaining types (`SongNotes.ts`, `SongDrumNotes.ts`, `SongVocal.ts`) — not needed for piano but keep the schema complete

**C# logic adapted:** `SongFormat` shared project (git submodule, not cloned — infer from RockBandConverter.cs usage and ThreeCP's existing TypeScript).

**Pass criterion:** `tsc --noEmit` passes. Manually construct a minimal `SongData` object in `main.ts` and `JSON.stringify` it — confirm the shape matches what ThreeCP's `SongIndex.ts` expects.

---

### Phase 3 — Tempo Map & Song Structure

**Goal:** Convert MIDI delta ticks → wall-clock seconds and produce a valid `SongStructure` JSON file.

**Input:** Parsed MIDI events from Phase 1
**Output:** `arrangement.json` downloaded to disk, containing `beats[]` and `sections[]` with correct timestamps in seconds

**Work:**
- Port the tempo map builder from `RockBandConverter.cs` (lines ~293–346):
  - Walk events in order, accumulate `setTempo` changes into `[(tick, microsecondsPerBeat)]`
  - Implement `ticksToSeconds(tick, tempoMap, division)` — the critical timing conversion
- Extract beat markers: `noteOn` note 12 = measure downbeat, note 13 = other beat (from Rock Band beat track convention; for plain piano MIDI, generate beats from tempo map directly)
- Produce `SongStructure` and serialize with the default-value-omitting `replacer`

**C# logic adapted:** Core of the tempo map section in `RockBandConverter.cs`. This is the most mathematically sensitive part — the tick→seconds formula must match exactly or all note timings will drift.

**Pass criterion:** Download `arrangement.json` for Für Elise; open in ThreeCP and verify beat markers align with the known 3/4 time signature and ~57 BPM of the piece.

---

### Phase 4 — Note Extraction (MidiPianoConverter)

**Goal:** Extract piano notes from the MIDI file and produce a valid `SongKeyboardNotes` JSON file.

**Input:** Parsed MIDI events + tempo map from Phase 3
**Output:** `keys.json` downloaded, containing `notes[]` with correct `timeOffset`, `timeLength`, `note` (MIDI pitch), `velocity`

**Work — new logic (no direct C# equivalent):**
- **Track detection:** Identify piano tracks by priority:
  1. Track name keywords: `piano`, `right hand`, `left hand`, `rh`, `lh`
  2. GM program change patch 0–7 (acoustic/electric piano family)
  3. Fallback: all tracks if file has only one or two non-conductor tracks
- **Note pairing:** Match `noteOn` (velocity > 0) with subsequent `noteOff` (or `noteOn` velocity = 0) on the same channel + pitch; compute `timeLength` from tick difference using tempo map
- **CC 64 sustain:** Track sustain pedal state (CC 64 ≥ 64 = down); set `sustainActive: true` on notes that onset while pedal is held
- **Hand splitting (optional, Phase 4b):** If two tracks are detected with "left"/"right" names, assign `hand` accordingly. For single-track files, split at pitch threshold (default: MIDI note 60 = middle C)
- Apply tempo map conversion to all `timeOffset` and `timeLength` values

**C# logic adapted:** Keys section of `RockBandConverter.cs` (note-on/off pairing, velocity handling) but generalized beyond Rock Band's track naming constraints.

**Pass criterion:** Download `keys.json` for Für Elise; note count is non-zero; first note's `timeOffset` is near 0.0; notes span the expected pitch range (E4–D#6 for Für Elise melody). Load in ThreeCP's `KeysPlayerScene3D` and verify notes render at correct positions.

---

### Phase 5 — Metadata Form & SongData

**Goal:** Extract song metadata from MIDI, present an editable form, and produce `song.json`.

**Input:** Parsed MIDI meta events
**Output:** `song.json` downloaded, containing `SongName`, `ArtistName`, `AlbumName`, `SongLengthSeconds`, and a `Parts` entry for the keys arrangement

**Work:**
- Scan first track's events for `sequenceTrackName` and `text` meta events; use first non-empty value as song name candidate, second as artist candidate
- Render a metadata form (plain HTML, no framework) pre-filled with detected values:
  - Song name (text input, pre-filled)
  - Artist (text input, pre-filled)
  - Album (text input, empty)
  - MIDI delay ms (number input, default 0)
  - Difficulty 0–5 (range slider, default 0)
- On form submit: construct `SongData` with a `SongInstrumentPart` of type `Keys`, serialize and download

**C# logic adapted:** `LoadSongIni()` in `RockBandConverter.cs` — but replaced by MIDI meta event extraction rather than file parsing. The ini's fields map 1:1 to the form fields.

**Pass criterion:** Load Für Elise — form pre-fills "Fur Elise" and "Beethoven". Fill in album "Classical". Download `song.json`; confirm `SongName`, `ArtistName`, `AlbumName` fields are correct and `InstrumentParts` contains one entry with `InstrumentType: "Keys"`.

---

### Phase 6 — End-to-End & Packaged Output

**Goal:** Single user action produces all output files ready for use in ThreeCP/OpenSongChart.

**Input:** User drops a `.mid` file, fills the metadata form, clicks Convert
**Output:** Three files downloaded: `song.json`, `arrangement.json`, `keys.json` — or a single `.zip` containing all three

**Work:**
- Wire Phases 3–5 into a single conversion pipeline triggered by form submit
- Output options (pick one):
  - **Three separate downloads** — simplest, no extra dependency
  - **Zip download** — requires a small library (`fflate`, already in ThreeCP's node_modules, MIT, ~10 kB)
- Add basic error handling: invalid file type, unparseable MIDI, no notes found
- Test with Für Elise end-to-end; load resulting JSON into ThreeCP and verify playback

**C# logic adapted:** `ConvertSong()` orchestration in `RockBandConverter.cs` — the top-level call sequence that writes `song.json`, `arrangement.json`, and instrument files. Here it becomes a browser pipeline that produces Blobs instead of writing to disk.

**Pass criterion:** Load `beethoven_fur_elise.mid`, fill form, click Convert. All three JSON files download. Drop the folder into ThreeCP — song appears in the library, keys arrangement loads, notes scroll correctly in `KeysPlayerScene3D`.

---

### Phase 7 — Finishing Touches

**Goal:** Polish the UI and output for real use.

**Input:** Working Phase 6 converter
**Output:** Cleaner UI; zip contains album art alongside the three JSON files

#### 7a — Remove MIDI debug output from the UI

The `<pre id="output">` panel currently dumps the full MIDI event log into the page. This is useful during development but clutters the UI for end users. Remove or hide it:
- Option A (simpler): Remove the `<pre>` element entirely; keep `console.log` for debugging via DevTools
- Option B: Collapse it behind a "Show debug log" disclosure (`<details><summary>`) so it's accessible but not prominent

#### 7b — Move "Download All (.zip)" button to front

Button order should reflect priority of use. Most users want the zip. Move `Download All (.zip)` before the three individual download buttons.

#### 7c — Album art support

Allow the user to attach album art to the zip output. ThreeCP and OpenSongChart expect an image file (`cover.jpg` or `cover.png`) alongside `song.json` in the song folder.

**Work:**
- Add an optional `<input type="file" accept="image/*">` field to the metadata form (label: "Album Art (optional)")
- When present, read the file as `ArrayBuffer` and include it in the zip as `cover.jpg` (or preserve the original extension)
- The individual download buttons are unaffected — album art only goes in the zip
- Verify the expected filename against ThreeCP's `SongIndex.ts` / `SongLibraryScreen.ts` before shipping (`PsarcConverter.WriteAlbumArtToStream()` is the C# reference)

**Pass criterion:** Load a MIDI + attach a cover image → download zip → unzip → `cover.jpg` is present alongside the three JSON files → drop folder into ThreeCP and verify album art appears in the song library.

---

### Phase Summary

| Phase | Output files | New logic | C# source adapted |
|---|---|---|---|
| 0 | — (scaffold) | Vite project setup | None |
| 1 | — (console log) | File picker + `midi-json-parser` integration | Replaces `MidiFile.cs` |
| 2 | — (types only) | SongFormat interfaces | `SongFormat` submodule + ThreeCP |
| 3 | `arrangement.json` | Tempo map, tick→seconds | `RockBandConverter.cs` tempo section |
| 4 | `keys.json` | Track detection, note pairing, CC64 sustain, hand split | `RockBandConverter.cs` keys section |
| 5 | `song.json` | Meta event extraction, HTML form | `RockBandConverter.cs` `LoadSongIni()` |
| 6 | All three + zip | Pipeline wiring, error handling, zip output | `RockBandConverter.cs` `ConvertSong()` |
| 7 | Zip + cover art | UI polish, album art inclusion | None |

---

## Total Scope

| Group | File count | Estimated effort | Notes |
|---|---|---|---|
| ~~Enums~~ | ~~3~~ | ~~1–2 hours~~ | Eliminated by `midi-json-parser` |
| ~~BinaryReader glue~~ | ~~1~~ | ~~1–2 hours~~ | Eliminated by `midi-json-parser` |
| ~~MIDI event classes~~ | ~~17~~ | ~~1–2 days~~ | Eliminated by `midi-json-parser` |
| ~~Collection & sorting~~ | ~~3~~ | ~~half day~~ | Eliminated by `midi-json-parser` |
| ~~MidiFile parser~~ | ~~1~~ | ~~half day~~ | Eliminated by `midi-json-parser` |
| SongFormat models | 6 | half day | Adapt from ThreeCP |
| Converter logic | 3 | 1–2 days | |
| Browser entry point + form | 1 | half day | |
| **Total** | **~10 files** | **~3–4 days** | |

---

## Suggested File Layout

```
piano-midi-converter/        (or alongside ThreeCP in MusicThing/)
├── src/
│   ├── midi/
│   │   ├── BinaryReader.ts
│   │   ├── MidiCommandCode.ts
│   │   ├── MetaEventType.ts
│   │   ├── MidiController.ts
│   │   ├── MidiEvent.ts
│   │   ├── MetaEvent.ts
│   │   ├── NoteEvent.ts
│   │   ├── NoteOnEvent.ts
│   │   ├── ControlChangeEvent.ts
│   │   ├── PatchChangeEvent.ts
│   │   ├── PitchWheelChangeEvent.ts
│   │   ├── ChannelAfterTouchEvent.ts
│   │   ├── SysexEvent.ts
│   │   ├── TempoEvent.ts
│   │   ├── TimeSignatureEvent.ts
│   │   ├── KeySignatureEvent.ts
│   │   ├── TextEvent.ts
│   │   ├── RawMetaEvent.ts
│   │   ├── TrackSequenceNumberEvent.ts
│   │   ├── SmpteOffsetEvent.ts
│   │   ├── SequencerSpecificEvent.ts
│   │   ├── MidiEventCollection.ts
│   │   ├── MidiEventComparer.ts
│   │   ├── MidiMessage.ts
│   │   └── MidiFile.ts
│   ├── songformat/
│   │   ├── SongFormat.ts
│   │   ├── SongStructure.ts
│   │   ├── SongNotes.ts
│   │   ├── SongDrumNotes.ts
│   │   ├── SongKeyboardNotes.ts
│   │   └── SongVocal.ts
│   ├── converters/
│   │   ├── RockBandConverter.ts
│   │   ├── MidiPianoConverter.ts
│   │   └── ChartUtil.ts
│   └── main.ts
├── public/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts          (Vite is the build tool used in ThreeCP — consistent choice)
```

---

## Key Technical Notes

### BinaryReader vs DataView
The C# code uses `System.IO.BinaryReader` with a `Stream`. In the browser, MIDI files are loaded as `ArrayBuffer` and read via `DataView`. The `BinaryReader.ts` wrapper provides the same sequential-read API so event class logic ports without restructuring.

### Variable-Length Quantities
MIDI delta times and some lengths use a compact variable-length encoding (7 bits per byte, MSB = continuation flag). This is implemented in `MidiEvent.cs` (`ReadVarInt`) and must be faithfully reproduced in `BinaryReader.ts`.

### Big-Endian Byte Order
MIDI files are big-endian. `DataView` methods default to little-endian — pass `false` as the second argument: `view.getUint32(offset, false)`.

### song.ini Not Required
As established in `PIANO_MIDI_ANALYSIS.md`, the `song.ini` sidecar is not needed for piano MIDI files. The converter reads title and artist directly from MIDI `SequenceTrackName` / `TextEvent` meta events. The Für Elise test file (`/home/andrew/Music/Charts/beethoven_fur_elise.mid`) already embeds `"Fur Elise"` and `"Beethoven"` as text meta events.

### SongKeyboardNote Extension
Per `PIANO_MIDI_ANALYSIS.md`, the existing `SongKeyboardNote` model should be extended with:
- `hand?: 'left' | 'right'` — for split-hand display
- `sustainActive?: boolean` — whether CC 64 was held at note onset

### No Backend Required
The entire conversion pipeline — file reading, MIDI parsing, note mapping, JSON serialization — runs in the browser via the File API and standard JS. Output files are downloaded as `Blob` objects. No server needed.
