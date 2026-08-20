# Piano MIDI → OpenSongChart: Gap Analysis

This document analyzes what would be required to add support for converting general piano MIDI files to OpenSongChart format, given the existing PSARC and Phase Shift converters as reference.

---

## How the Existing Converters Work

### PSARC (Rocksmith)

Extracts guitar/bass/vocals from Rocksmith's binary SNG format. Note data is richly structured: fret/string positions, techniques (hammer-on, pull-off, bend, slide, harmonic, etc.), explicit chord definitions with finger positions, difficulty levels pre-authored by Rocksmith, and tuning/capo metadata. Audio is decoded from Wwise banks to OGG.

### Phase Shift / Rock Band (MIDI)

Reads a `notes.mid` file alongside a `song.ini` metadata file. Track identity is determined by **Rock Band track naming conventions** (e.g. track names ending in `*drums`, `*real_keys_x`, `*real_bass`, `*vocals`). Difficulty levels are encoded by MIDI note octave range. Bass fret positions are encoded in note velocity. The keys track stores raw MIDI pitch + velocity as `SongKeyboardNote`.

Both converters share the same output pipeline: `SongData`, `SongStructure`, `SongInstrumentPart`, and typed note collections serialized to JSON.

---

## What a Piano MIDI Converter Would Need

### 1. General-Purpose MIDI Track Importer (Missing)

The Phase Shift converter depends on Rock Band-specific track naming and encoding conventions. A standalone piano `.mid` has none of that structure. A new converter would need to identify piano tracks by:

- GM patch number (0–7 = acoustic/electric piano family)
- MIDI channel (channel 1 is common for piano in single-instrument files)
- Track name keywords (`piano`, `keys`, `right hand`, `left hand`, etc.)
- Fallback: treat all tracks as piano if the file has only one or two tracks

**Suggested class:** `MidiPianoConverter` — analogous to `RockBandConverter`, but accepts a plain `.mid` file plus optional metadata (song name, artist, BPM override).

### 2. `SongKeyboardNote` Is Too Minimal

`SongKeyboardNote` currently stores:

```
TimeOffset   float
TimeLength   float
Note         int     (MIDI pitch 0–127)
Velocity     int
```

For piano this is missing:

| Field | Reason Needed |
|---|---|
| Hand assignment (left/right) | Piano parts split at a register boundary; needed for rendering and learning |
| Sustain pedal state | CC 64 extends effective note duration past note-off |
| Fingering | Analogous to `FingerID` on `SongNote`; useful for learning apps |

### 3. No Control Change (CC) Event Processing

`RockBandConverter` ignores all `ControlChangeEvent`s. Piano MIDI relies heavily on CCs:

| CC | Name | Effect |
|---|---|---|
| 64 | Sustain pedal | Extends notes; changes effective `TimeLength` |
| 67 | Soft pedal | Dynamics modifier |
| 66 | Sostenuto | Selective sustain |
| 11 | Expression | Volume curve during playback |

At minimum, CC 64 (sustain) needs to be read to produce correct note lengths.

### 4. No Difficulty Generation

Rocksmith provides pre-authored difficulty levels. Rock Band MIDI encodes difficulty by note octave range. A raw piano MIDI has no difficulty encoding. Generating difficulty tiers would require an algorithm to thin notes, for example:

- **Easy:** melody line only (highest note per time window)
- **Medium:** melody + bass line, simplified chords
- **Hard/Expert:** full voicing

This logic does not exist anywhere in the current codebase.

### 5. No Hand-Part Splitting

Piano MIDI files are typically either:
- A single track with all notes interleaved
- Two tracks labeled "Piano R" / "Piano L" or similar

Neither case is handled today. Auto-splitting by pitch threshold (e.g. notes below middle C → left hand) would cover the single-track case. Track-name detection would cover the two-track case.

### 6. No Chord Recognition

Guitar parts have explicit `SongChord` definitions authored in Rocksmith. Piano MIDI is purely note-by-note. Converting to a display that groups simultaneous or near-simultaneous notes into chords (for score-like rendering) would require onset-clustering logic. This does not exist today, though it would mirror the existing `SongChord` / `ChordID` pattern on `SongNote`.

---

## What Is Already Reusable

The MIDI infrastructure is comprehensive (30 classes). Very little would need to be written from scratch:

| Component | Reuse |
|---|---|
| `MidiFile`, all event classes | Direct reuse — full MIDI parsing done |
| Tempo map → wall-clock seconds | Direct reuse |
| `SongData`, `SongStructure`, `SongBeat`, `SongSection` | Unchanged |
| `SongKeyboardNote` | Extend with hand + pedal fields |
| OGG audio handling | Unchanged |
| JSON serialization pipeline | Unchanged |

---

## song.ini Is Not a Real Dependency

The `RockBandConverter` requires a `song.ini` alongside the MIDI file and will null-reference crash if it is absent (`LoadSongIni()` returns `null` when the file doesn't exist, and `ConvertSong()` immediately dereferences `ini.Song`).

However, the ini file is very simple — only these fields are read:

| Field | Used for | Notes |
|---|---|---|
| `name` | Song title | Can be read from MIDI text meta events |
| `artist` | Artist name | Can be read from MIDI text meta events |
| `album` | Album name | Optional; can default to empty |
| `delay` | MIDI timing offset (ms) | Optional; defaults to 0 |
| `icon` | `rb4` format flag | Not relevant for piano |
| `diff_bass/vocals/keys/drums` | Difficulty ratings 0–5 | Optional; can default to 0 |

Crucially, a standard piano MIDI file already embeds the song title and composer as `SequenceTrackName` or general `TextEvent` meta events — exactly what the existing `MidiFile` parser surfaces. The Für Elise test file, for example, contains `"Fur Elise"` and `"Beethoven"` as text meta events in the first track.

A `MidiPianoConverter` could read these events directly and populate the metadata struct in code, with no ini file required on disk. The only field that can't be derived from MIDI is `album`, which is optional.

---

## Suggested Implementation Scope

A minimal but useful first version would:

1. Accept a plain `.mid` file with no sidecar files required
2. Read song title and artist from MIDI text meta events (track name, sequence name)
3. Detect piano tracks by GM patch, channel, or track name keywords
4. Read CC 64 to adjust note lengths for sustain
5. Optionally split into left/right hand by pitch threshold (configurable)
6. Populate existing `SongKeyboardNote` (extended with a hand field) and the existing structure types
7. Skip difficulty generation initially — export a single "Expert" arrangement

Difficulty generation and chord recognition can be added later without changing the output format.
