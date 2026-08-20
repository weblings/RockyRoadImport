# Lessons learned — index and filing rules

Gotchas, non-obvious findings, and hard-won decisions that aren't obvious from reading the code or
planning docs. Add here whenever something costs more than 30 minutes to diagnose.

**This directory is the only lessons-learned location in the repo** — for every subproject
(`BrowserPianoMidiConverter`, `PsarcChartCore`), not just whichever one is being touched. Don't
start a new `LessonsLearned.md` elsewhere; if unsure whether one already exists,
`find . -iname "*lesson*"` first.

## Index

- [`engineering-hygiene.md`](engineering-hygiene.md) — general design principles, small enough to
  read whole, no sub-index needed.

## Where a new lesson goes

1. About *my own* verification/reliability habits, not code/design? → persistent memory
   (`feedback_*`), not the repo.
2. General software-design principle, demonstrated by a real bug here? → `engineering-hygiene.md`.
3. Everything else, for now — this repo is small enough that one file covers it. Split into
   topic-specific sibling files (mirroring RockyRoad's `Analysis/lessons/` shape) once
   `engineering-hygiene.md` gets too long to skim (rough proxy: 15+ entries).

Tied to now-removed code? Keep the principle if it still applies, drop the dead specifics, and say
the origin is historical.
