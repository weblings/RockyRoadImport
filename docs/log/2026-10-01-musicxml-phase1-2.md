# MusicXML Phases 1–2, finished (2026-10-01)

Closed the [[musicxml-support]] Phase 1 survey (RockyRoadImport-e6d) and implemented the
Phase 2 core (RockyRoadImport-ic6, verified green; upstream filing left as a paste-ready
draft on the bead).

Shipped this session:
- Exporter-source survey: MuseScore emits `<staff-tuning>` + TAB clef on tab staves and its
  `P.M.` default text matches alphaTab's literal words+dashes path; TuxGuitar emits per-string
  tuning + TAB clef with palm mute via the `<play><mute>palm</mute>` formal path. Guitar Pro
  export and Sibelius/Finale/Dorico remain unverified.
- `convertMusicXml(bytes)` entry sharing `convertScore`; `Gp*` types and `gpConverter.*`
  renamed `Score*`/`scoreConverter.*` (guitar-only v1, piano-open); duplicate part names need
  no code change (positional fallback proven by test).
- `SongConverter/patches/@coderline+alphatab+1.8.4.patch` via a `patch-package` postinstall:
  re-indexes `noteStringLookup` on `<string>` and evicts the stale `-1` entry. New
  `musicXml.test.ts` (hand-built fixture, no real song) failed pre-patch and passes post;
  full suite 23 passed, `tsc` clean.
- Plan doc updated (Phase 1 follow-up, Phase 2 decided/implemented lines, rename fallout
  fixed); two lessons entries added.

Surprises:
- alphaTab normalizes `movement-title` whitespace (`Tube Test` came back with a non-breaking
  space) — single-word fixture title sidesteps it.
- The bundled dep ships four copies of the code (ESM/CJS/min/vite); only the resolved entry
  chain (`core.mjs`, used by both vitest and vite) needed the patch.
- `check-links.sh` only scans markdown link targets, so all 21 stale `gpConverter.ts` refs passed
  green — caught by repo-wide grep instead.

Open: upstream alphaTab issue (draft on ic6); one manual Guitar Pro export test; `e86` UI tab,
`l1i` fallbacks, `0fx` piano-later remainder.
