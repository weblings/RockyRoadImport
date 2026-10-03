# MusicXML piano scoped and sequenced, repeats bug found (2026-10-03)

Closed RockyRoadImport-0fx: piano MusicXML is in scope now. RockyRoadImport-ngd
(the old TODO's "piano notation output") is confirmed as MusicXML piano per the
archived docs-migration plan, and is now the umbrella bead for the piano work.
Plan in [[musicxml-support]] Phase 8; doc `Status:` and lyrics section brought
current (m2g/msr outcomes).

Probe (throwaway hand-built grand-staff file, installed alphaTab 1.8.4):
- Works as-is: staff index = hand, `realValue` = sounding pitch (ottava
  applied), `bar.sustainPedals` carries `ratioPosition`, grace timing.
- Missing `<midi-program>` reads program 0, same as acoustic grand: program
  alone can't detect piano. Corrected the Phase 3 claim.
- Dynamics leak across staves: `_currentDynamics` is part-wide and
  parse-ordered, so the bass staff after `<backup>` gets later treble marks
  (`p` at t=0 reads `f`). Third upstream-fix candidate.
- Pedal markers sit only on the staff the `<direction>` attached to.

Repeats probe (alphaTex `\ro`/`\rc 2`): 8 notes, expected 16. The Score path
never expands repeats, for GP and MusicXML guitar too. Filed RockyRoadImport-3sp.

Beads: ngd.1 export survey → ngd.2 detection+gate → ngd.3 note mapping →
ngd.4 dynamics / ngd.5 pedal → ngd.6 output/UI/docs. Upstream filing moved to
RockyRoadImport-aio (after ngd, 3sp, tak; decided: wait until guitar and piano
both work); msr now waits on aio.

Open: no real piano export on hand for ngd.1.
