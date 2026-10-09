# MusicXML piano pedal: SustainActive timeline + cross-bar stop patch (2026-10-09)

Implemented RockyRoadImport-ngd.5 (bead left `open`). Part-wide pedal
timeline in `scoreConverter.ts`: every staff's bars feed one Down/Up timeline
(Hold leaves state), `SustainActive` set at note-start ticks and omitted when
false like the MIDI path. Status line reports sustain now.

Findings: the importer drops change/resume/discontinue at parse (a no-op
for at-start booleans — a retake stays down on both sides) and any stop
alone in its bar, so real multi-bar spans stuck down to the piece end.
Patched via a `previousBar` walk-back — 4th upstream candidate for the aio
batch. `ratioPosition` is a proper bar fraction in files carrying
`<divisions>`; wild values traced to a sample missing it, clamped
defensively. Reference samples used throwaway-only; damper-pedal stays
fix-on-find.

Verification: 4 new pedal tests on a hand-authored grand-staff fixture
(part-wide, mid-bar stop, change-hold, cross-bar pin); 73/73 + `tsc` clean.
