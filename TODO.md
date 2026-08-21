# TODO

Future
- [ ] Add Rock Band conversion to Browser
- [ ] Tweak Rock Band conversion logic to support multiple difficulties
Rock Band conversion tweak: in RockBandConverter.cs, stop discarding Easy/Medium/Hard octave-tier notes at the difficulty == Expert gate — instead keep Expert as the default Notes and push each lower tier into notes.AlternateLevels as a SongDifficultyLevel (ordinal Difficulty 0/1/2, StartTime/EndTime spanning the whole song). This mirrors PsarcConverter.cs's existing hardest-tier-default/lower-tiers-as-alternates pattern, just without phrase-scoping since Rock Band's tiers cover the full song rather than individual phrases.

