# MusicXML piano: shared dynamics marks across staves (2026-10-10)

Fixed RockyRoadImport-dej. The ngd.4 importer patch keeps dynamics per staff, so
a part marked once (on the treble) left the bass at default F. Found while porting
that patch to alphaTab `develop`: Ave Maria's shared `pp` and the MusicXML suite's
staff-only 43e `ffff` are encoded identically, so the importer stays per-staff and
the guess lives in `scoreConverter.ts`: each staff's change points form a timeline;
a staff with no mark yet borrows the latest earlier mark from any staff (never a
later one), and keeps its own once it has one.

Verification: 2 new tests (borrow, own-mark priority) fail on the old velocity
source and pass now; full suite 79/79 + `tsc` clean. 69-file library sweep, no
crashes: 51 of 70 parts change, all toward fewer default-F notes (e.g. Fur Elise,
Gymnopedie bass 100% F -> 0%; Maple Leaf treble 100% -> 7%). First sweep caught
empty filler-voice beats injecting fake "back to F" marks (Moonlight bass 3.5% ->
62% F); skipping `isEmpty` fixed it. 1 lesson.

Known gap: an explicit start-of-staff f equals the default and can't be detected.
