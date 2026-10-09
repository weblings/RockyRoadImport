# Lessons learned — index and filing rules

Gotchas, non-obvious findings, and hard-won decisions that aren't obvious from reading the code or
planning docs. Add here whenever something costs more than 30 minutes to diagnose.

**This directory is the only lessons-learned location in the repo** — for every subproject
(`SongConverter`, `PsarcChartCore`), not just whichever one is being touched. Don't
start a new LessonsLearned-style doc elsewhere; if unsure whether one already exists,
`find . -iname "*lesson*"` first.

## Index

| File | Scope | Entries | File here when |
|---|---|---|---|
| [engineering-hygiene.md](engineering-hygiene.md) | general design principles | 12 | general principle, demonstrated by a real bug here |
| [upstream-dependencies.md](upstream-dependencies.md) | dependency behavior, patching, upstream process | 8 | bug/fix lives in a third-party package, its importer, a patch, or the upstream filing process |

Counts as of 2026-10-09 — bump the count when adding entries
(`grep -c '^## '` per file).

## Where a new lesson goes

1. About *my own* verification/reliability habits, not code/design? → persistent memory
   (`feedback_*`), not the repo.
2. About a third-party package, its importer/parser internals, a `patch-package`
   patch, the fork workflow, or the upstream issue/PR process? → `upstream-dependencies.md`.
3. General software-design principle, demonstrated by a real bug here? → `engineering-hygiene.md`.
4. New topics get their own sibling file once an existing file's scope gets muddy —
   query vocabulary (Tags) decides, not entry count.

Tied to now-removed code? Keep the principle if it still applies, drop the dead specifics, and say
the origin is historical.
