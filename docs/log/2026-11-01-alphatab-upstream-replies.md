# alphaTab upstream: dynamics fixed, syllabic needs a use case (2026-11-01)

Id: alphatab-upstream-replies

Follow-up on RockyRoadImport-aio after the maintainer replied to both filings.

**#2979 dynamics: fixed by PR #2996** (merged 2026-10-29, `f50d775f`), shipped in stable
npm 1.9.0 (2026-10-31). Upstream split the question in two: a dynamic is *drawn* only on its
own staff (new `beat.showDynamics`), but it *plays* part-wide in time order (`beat.dynamics`),
since MusicXML can't tell "this hand" from "both hands". Checked on 1.9.0: 43e staff 2 plays
FFFF then P and draws no marking. Our patch made dynamics strictly per staff and put the
both-hands guess in our converter (RockyRoadImport-dej); upstream put that guess in the
importer instead.

**Patch status:** #2914 (hammer-on), #2938 (pedal), #2947 and #2996 are all in `v1.9.0`.
Upgrading from 1.8.4 leaves only the syllabic hunk of our patch. The dej shared-mark timeline
probably becomes redundant, but that needs checking against our piano fixtures first.

**#2980 syllabic:** the maintainer asked how we would use the data and raised its memory cost.
They pointed at #2908 ("Expose Lyrics in public API", milestone 1.10). Something we hadn't
noticed before: GP and alphaTex lyrics already reach `beat.lyrics` as `"Tra-"`, `"la-"`,
`"la,"`, because the `Lyrics` parser keeps the dash on each chunk. MusicXML gives bare
`"Tra"`, `"la"`, `"la,"`. A MusicXML → GP7 export loses word joins for the same reason.

**Our setup vs. #2908:**
- Our parallel `Beat.lyricsSyllabic` array: full fidelity, but a new public field, memory on
  every lyric beat, and nothing in alphaTab would use it.
- #2908's `Lyrics` text: it can't rebuild full text from MusicXML syllables without knowing
  dash vs. space, so it needs the syllabic bit anyway.
- Preferred: the importer appends `-` on `begin`/`middle`. That needs no field and no memory,
  makes MusicXML lyrics match GP lyrics on the beats, fixes the GP export, and gives #2908 its
  join rule. The cost is that MusicXML lyrics render with dashes, as GP lyrics already do.
  Fallback: a `continuesWord` flag on #2908's per-syllable objects.

On our side, GP lyrics already flow through `extractTrackLyrics` as per-syllable `"Tra-"`
entries, the same as the PSARC path's Rocksmith lyrics. Only MusicXML merges each word into
one entry (`mergeLyricEntries`). With the dash convention, both paths could use one rule.

Reply posted: https://github.com/CoderLine/alphaTab/discussions/2980#discussioncomment-19337395 (proposal plus fallback).
