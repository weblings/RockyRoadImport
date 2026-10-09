# ngd.3 note mapping verified against real files, bead closed (2026-10-09)

Claimed RockyRoadImport-ngd.3 (implementation had landed 2026-10-04, bead
still open). Focused suite green: `pianoNotes.test.ts` + `pianoConverter.test.ts`,
11/11. Then a scratch probe (removed after the run) converted two real library
files through `convertMusicXml`: moonlight 3rd, 6132 beats to 4855 notes
(2289 right / 2566 left, staff hands, 164 ties merged, 86 grace beats, sections
0); Bach Toccata, 5367 beats to 4122 notes, 51 ties merged, 88 ottava beats
with 115 `realValue != displayValue` notes through `Note=realValue`, sections 0.
Closes the bead's ottava/grace-in-real-file gap; findings appended to the bead
note. 1-/3+-staff fallback stays hand-fixture covered (no library source).

Footnote: alphaTab's ottava enum is spelled `Ottavia` (`beat.ottava` type), and
it is numeric — a `String(x) !== 'None'` check counts every beat. Compare
against `Ottavia.Regular` directly.

Closing ngd.3 unblocks ngd.4 (dynamics) and ngd.5 (pedal); `bd ready` now 8.
Bead notes updated, `bd export` staged with the close.
