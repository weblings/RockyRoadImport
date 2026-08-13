# TODO

- [ ] Handle git submodule versioning
- [x] Add support for all parts of psarc
- [x] Add support for album art to psarc
- [x] Add support for to ogg to psarc

- [x] Fix: Add arrangment.json support for psarc processing
The wasm interop wrapper (PsarcChartCore.Wasm/Program.cs's ConvertAllPsarc) needs a SongStructure/Structure field added to PsarcPartResult, and needs to copy result.Value.SongStructure into it for each part instead of discarding it — mirroring PsarcExporter.cs's existing "keep whichever part's structure has the most beats" logic to pick one canonical structure for the song. BrowserPianoMidiConverter/src/main.ts's psarc download handler then needs to write that returned structure to arrangement.json, the same way its MIDI download handler already does with _structure.

- [ ] Add to song.json the multiple difficulties present
SongFormat.cs needs an AvailableDifficulties (or similar) List<float> field on SongInstrumentPart instead of a bare bool, and PsarcConverter.cs needs to set it — in the same per-part method — from songAsset.Arrangements.Select(a => a.Difficulty).Distinct().ToList(), which is already available before the phrase loop runs so it costs no extra iteration. Same downstream propagation as before: no change needed in BrowserPianoMidiConverter/src's pass-through psarc path, just its songformat.ts type mirror for accuracy.

- [ ] Add Rock Band conversion to Browser
- [ ] Tweak Rock Band conversion logic to support multiple difficulties
Rock Band conversion tweak: in RockBandConverter.cs, stop discarding Easy/Medium/Hard octave-tier notes at the difficulty == Expert gate — instead keep Expert as the default Notes and push each lower tier into notes.AlternateLevels as a SongDifficultyLevel (ordinal Difficulty 0/1/2, StartTime/EndTime spanning the whole song). This mirrors PsarcConverter.cs's existing hardest-tier-default/lower-tiers-as-alternates pattern, just without phrase-scoping since Rock Band's tiers cover the full song rather than individual phrases.

- [ ] Update the visuals to use similar components to ChartPlayer
