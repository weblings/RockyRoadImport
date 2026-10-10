# MusicXML docs pass (tak) + piano umbrella audit (ngd) (2026-10-10)

Closed RockyRoadImport-tak. Root README now covers MusicXML in Quick Start and
has a troubleshooting entry (tab-staff requirement, piano detection, known
limits). Plan doc Phase 7 marked resolved; Status line updated.

Audit of the ngd piano path (plus guitar wiring) found three issues, all fixed:
- Tie merge stretched a stale same-pitch note when a repeat replayed a tie-stop
  (probe: C4 held 3s-7s over a D4). Now merges only into a note ending at the
  onset; regression test in `pianoNotes.test.ts`; 1 lesson filed.
- GP tab lost piano tracks from its "Skipped" status once piano detection moved
  them out of `skipped`; now listed again (GP ships no keys.json).
- MusicXML tab let an empty detected piano part open the download (song.json
  with no parts); gate now counts keys notes.

Otherwise sound: patch re-applies, per-staff dynamics/pedal/repeats verified by
existing tests. 77 tests + `tsc` clean. ngd itself left open for the user.
