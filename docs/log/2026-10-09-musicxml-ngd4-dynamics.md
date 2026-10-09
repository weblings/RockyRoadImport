# MusicXML piano dynamics: velocity table + cross-staff patch (2026-10-09)

Started RockyRoadImport-ngd.4 (claimed `in_progress`). Both open tracks are
implemented; the bead stays open for ngd.6 wiring and the batched upstream
filing (RockyRoadImport-aio).

Decisions (all open items in the bead notes now settled): the velocity table
mirrors alphaTab's own `MidiUtils.dynamicToVelocity` (min 15, step 16 — F=95,
p=47, ff=111, fff=127; full accent table incl. FP/SFP/SFZ; RF group follows
the code's 95, not its stale "same as FF" comment); hairpins ignored
(`beat.crescendo` carries no target level); no-mark default stays F. Patch,
not workaround: the importer already declares an unused per-staff
`StaffContext.currentDynamics`, and every `_currentDynamics` site already has
its staff in scope — the fix wires those 5 sites to it (direction +
notations writes, two beat-creation reads, new staff parameter on the
single-caller `_createRestForGap`).

Verification: the cross-staff fixture test failed pre-patch in both
directions and passes post-patch; full suite 64/64 plus `tsc` clean; the patch
reverse-applies cleanly. Real-file probe (`moonlight_sonata_3rd_movement.mxl`,
throwaway, removed): 4855 notes / 2289 right / 2566 left, exactly matching
ngd.3's verified counts, with live velocities (pp=31 ×2, p=47 ×2818, f=95
×829, ff=111 ×1206) instead of the old uniform 96.

Lessons: one entry added (orphaned dependency state as the intended fix
seam); `docs/lessons/` split per its README — upstream/dependency entries
moved to `docs/lessons/upstream-dependencies.md`, index and routing updated.

Environment note: sandboxed shell is unusable here (`bwrap: loopback`
failure), so every command ran unsandboxed via per-command approvals.
