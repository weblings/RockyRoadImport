# Migrate docs infra to Aurora's system (+ beads)

Status: done 2026-09-30 — steps 6–8 executed, both check scripts green, archived
Id: aurora-docs-migration

Owner-context: assessed 2026-09-30 from Aurora's live tree. No code touched — this doc is the
whole deliverable so far. Next agent: work the plan below top to bottom; each step lists its done-criteria.

## Source material (Aurora)

- System map: `/home/andrew/Documents/Aurora/Aurora/docs/README.md` (layout, `Id:`/`[[id]]` convention, reorg checklist)
- Filing contract: `/home/andrew/Documents/Aurora/Aurora/AGENTS.md` ("Where things go" section)
- Link checker + id index generator: `/home/andrew/Documents/Aurora/Aurora/docs/check-links.sh` (Python despite the name)
- Lessons guard: `/home/andrew/Documents/Aurora/Aurora/docs/check-lessons.sh`
- Lessons shape: `/home/andrew/Documents/Aurora/Aurora/docs/lessons/README.md`
- Log shape: `/home/andrew/Documents/Aurora/Aurora/docs/log/INDEX.md` plus dated `log/*.md` files
- Skill routing: `/home/andrew/Documents/Aurora/Aurora/.claude/skills/*/SKILL.md` (7 buckets; likely overkill here — see step 7)

## Current state (this repo)

- Docs: [[piano-midi-analysis]], [[browser-piano-midi-port-plan]] (both moved from the old analysis folder),
  [[native-logic-reuse-decision]] (ex-`SongConverter/docs/`). No `Status:`/`Id:` lines, no active-vs-settled split.
- Lessons: `../lessons/` (`../lessons/README.md`, `../lessons/engineering-hygiene.md`) — single file, entries predate Aurora's
  `Tags:`/`Applies-when:` retrieval contract (prose + `**Fix:**` only).
- Tasks: old TODO-list checkboxes + `CHANGELOG.txt`. No beads (no `.beads/`; `bd` binary exists at
  `/home/andrew/.local/bin/bd`). No `log/`, no check scripts, no CI/hooks, no `.claude/`.
- `CLAUDE.md` hard-coded the old analysis-folder lessons path — updated in step 7.

## Target state

- `docs/` tree mirroring Aurora: `archive/`, `planning/`, `log/` (+`../log/INDEX.md`), `lessons/`, root `README.md`,
  generated `../_ids.md`, both check scripts runnable and green.
- All docs carry `Status:` + `Id:`; new citations use `[[id]]`; old path citations keep resolving (no flag-day rewrite).
- Lessons entries all carry `Tags:`/`Applies-when:`; `check-lessons.sh` green.
- Tasks in beads; old TODO list retired (deleted after migration); `.beads/issues.jsonl` export tracked in git.
- `CLAUDE.md` updated to the new paths + beads workflow (export before commit, import after pull).

## Open decisions (recommendations inline)

1. **Rename analysis folder → `docs/`?** Recommended yes — both check scripts and every Aurora convention assume
   `docs/` at root; keeping the old name means forking the scripts for no benefit.
2. **Native-logic-reuse doc location?** ([[native-logic-reuse-decision]], ex-`SongConverter/docs/`.) Recommended: move into `docs/` root as
   evergreen reference (it's a general principle doc, not SongConverter-specific), leaving nothing behind
   but a deleted dir. Aurora keeps one docs tree for all subprojects.
3. **Skills (`.claude/skills/`)?** Recommended: skip for now — routing pays off at Aurora's ~200-entry scale,
   not at our single-file scale. Revisit when lessons split.
4. **Backfill `log/`?** Recommended: no — start the log at migration day; history stays in git + `CHANGELOG.txt`
   (keep `CHANGELOG.txt` as-is, it serves a different reader than `log/`).

## Plan

1. **Triage the 3 docs.** DONE 2026-09-30: both analysis/plan docs shipped (port-plan phases 0–7 all
   present in `SongConverter/src/main.ts`, incl. zip + album art) → `docs/archive/`; `native-logic-reuse-decision.md`
   is evergreen → `docs/` root. MusicXML (TODO's "piano notation output") is still just planning → planning bead
   in step 6, no doc yet.
2. **Restructure.** DONE 2026-09-30: `git mv Analysis docs`; `archive/`, `planning/`, `log/` created;
   analysis + port plan → `archive/`, this plan → `planning/`, native-logic-reuse → `docs/` root;
   `SongConverter/docs/` removed. Renames detected by git.
3. **Tag docs.** DONE 2026-09-30: all 4 docs carry `Status:` + `Id:`; `docs/README.md` written
   (adapted map + `[[id]]` convention + after-move checklist); `log/INDEX.md` started with headers only
   (rows get added as milestones close, none closed yet).
4. **Port the scripts.** MOSTLY DONE 2026-09-30: both scripts copied; `GRANDFATHERED` emptied;
   `check-lessons.sh` unmodified and green. `check-links.sh` still red at last run — remaining dead refs were
   edited after that run but NOT re-verified. Next agent: run `python3 docs/check-links.sh` (twice — first run
   generates `../_ids.md`, which resolves its own citation) and fix whatever is left.
5. **Reformat lessons.** DONE 2026-09-30: all 7 entries carry `Tags:`/`Applies-when:`; index converted
   to Aurora's table shape (count 7); `check-lessons.sh` passes. STOPPING POINT — steps 6–8 not started.
6. **Migrate tasks to beads.** DONE 2026-09-30: `bd init --non-interactive --skip-hooks --skip-agents`
   (prefix `RockyRoadImport`); 4 beads created, one per unchecked TODO-list item
   (`RockyRoadImport-ngd` piano notation, `RockyRoadImport-wxl` psarc song.json type-check,
   `RockyRoadImport-9im` Rock Band conversion, `RockyRoadImport-df9` multi-difficulty tweak with the
   RockBandConverter.cs detail pasted verbatim); `bd export -o .beads/issues.jsonl`; TODO list file
   deleted. Export commit left for the user (commit needs explicit go-ahead).
7. **Wire up the contract.** DONE 2026-09-30: `CLAUDE.md` now points at `docs/lessons/`, documents the
   `Status:`/`Id:`/`[[id]]` rule with the generated `_ids.md` lookup, the beads loop (`bd ready`/`bd list`,
   export before `git add`, `bd import` after `git pull` — all confirmed against local `bd --help`),
   and the archive-on-close requirement.
8. **Convert citations.** DONE 2026-09-30: repo-wide grep found live stale cites only in `CLAUDE.md`
   (fixed in step 7). Archive's same-dir `PIANO_MIDI_ANALYSIS.md` mentions and lessons self-refs resolve,
   so they stay untouched — no dead refs, both check scripts green.

## Verification (all must hold before calling it done)

- `python3 docs/check-links.sh` → `links OK`; `bash docs/check-lessons.sh` → `lessons OK`.
- `bd ready` shows the 4 ex-TODO-list items; `.beads/issues.jsonl` is exported and current.
- No `*.md` outside `node_modules/` references the old analysis-folder path or the retired TODO-list filename.
- `git status` shows renames detected (not delete+add) for moved docs.

## Out of scope

- `.claude/skills/` routing (decision 3); `log/` backfill (decision 4); CI/pre-commit wiring for the
  check scripts (Aurora runs them manually/by hook — hooks are a follow-up, not part of this migration).
