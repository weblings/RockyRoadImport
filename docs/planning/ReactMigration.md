# RockyRoadImport: migrate SongConverter's UI to React

Status: planning (sequence agreed 2026-10-30, no work started)
Id: rri-react-migration

Scoped plan for moving `SongConverter`'s page from one `innerHTML` template plus DOM wiring in
`src/main.ts` to React components on React Aria. RockyRoadImport is the first adopter of the shared
UI work in [[shared-ui-refactor]], so its pieces are shaped for RockyRoad and Aurora even where this
page doesn't need it. Tracked as beads under the epic listed at the bottom.

---

## Goals

- Same output files and same look as today, proven by tests rather than by eye.
- Converter logic lives in plain TS stores that React (and any vanilla code) only reads and calls.
- A `src/ui/` folder that can later be split out as the shared package without rework.
- Fix the accessibility gaps the current page has, as a side effect of using React Aria.

## Out of scope

- Normalizing per-format output differences (see below). Each gets its own bead and golden update.
- New features: drag-and-drop (`DropZone`), multi-file loads.
- Creating the shared repo, the Aurora token alias consumer and the uikitml token target. Those land
  with RockyRoad's adoption.
- Any visual redesign.

## Findings that shape the plan

**Per-format output quirks (preserve, don't "fix" in passing):**

- MIDI's zip JSON drops `null` and empty arrays via a replacer. GP, MusicXML and `.psarc` don't.
- `.psarc` trims name fields and maps an empty album to `undefined`. GP and MusicXML fall back to the
  parsed name with `||` and keep an empty album string.

**Async bugs in the `.psarc` tab (fix in Phase 1, with regression tests):**

- Album art is fetched fire-and-forget. A new file picked mid-fetch can receive the previous song's art.
- Clicking Download before that fetch resolves silently ships a zip without `albumart.png`.

**Accessibility gaps today:**

- Metadata labels are `<td>` cells, so text inputs have no accessible name.
- Text inputs set `outline: none` on focus (fails WCAG 2.4.7).
- Tab buttons have no `tablist`/`tab`/`tabpanel` roles or arrow-key handling.
- Status lines (`#psarc-status` etc.) are not live regions.

**React Aria behavior to plan around:**

- `TabPanel` unmounts inactive panels by default, and a file `<input>` can't be refilled
  programmatically. Chosen files and metadata must live in stores, and the file field shows the
  filename from store state.

## Structure

- `src/stores/` (or one store per format next to its converter): `loadFile`, `setMeta`,
  `setAttachment(File)`, `buildFiles()`, phase `idle | parsing | ready | error`. A per-load request
  id drops stale results. Side effects (wasm load, file reads) stay here. Downloading stays in the
  shell via `triggerZipDownload`.
- `src/ui/`: future shared package. Own `index.ts` and `tokens/`, no imports from app code (lint
  enforced). Every component wraps React Aria, so app code never imports `react-aria-components`
  directly and the wrapper API is what other projects depend on.
- Skin CSS sits in `@layer`, keyed on component classes or `data-*` attributes, never on ancestor
  selectors like `#app .x` (popovers render outside the island). Global reset and page layout stay
  in the app, not in `src/ui/`.
- Tokens: DTCG JSON built by a pinned Style Dictionary to CSS vars and a TS module. Semantic names
  only in consumer CSS. Dimensions authored as px numbers (RockyRoad XR converts px / 10 to cm).
  Includes link, warning and muted-text roles, which only this project uses today.

## Phases

Each phase lands on its own and keeps the GitHub Pages demo deployable.

| Phase | Work | Exit check |
|---|---|---|
| 0. Safety net | Add a small MIDI fixture. Move each format's file-map assembly into a function, verbatim. Golden tests: fixture + metadata gives these zip entries. Playwright screenshots of each tab, empty and loaded. Record main-chunk size | Green against today's behavior. `.psarc` goldens need the wasm build under Node (`test-node.mjs` suggests it works), else a documented manual check |
| 1. Stores (vanilla) | One store per format as above. `.psarc` wasm loader moves into its store. `buildFiles()` awaits album art. `main.ts` only binds DOM to stores | Goldens unchanged. Regression tests for both async bugs. Art-no-longer-dropped noted as the one intended change |
| 2. Tokens and CSS (vanilla) | Move `<style>` and inline `style=` into CSS files. Generated token vars replace literal hex. Self-host Inter (`@fontsource/inter`). stylelint `color-no-hex`. Define a focus-ring token | Screenshots match within a small tolerance for the local font |
| 3. React islands, one tab each | Add React 19 and `@vitejs/plugin-react` (versions aligned with Aurora's `graph-editor`), tsconfig `jsx`. Mount each panel into the existing vanilla tabs with `mountIsland(el, node)` | Goldens and screenshots pass after every tab |
| 4. Shell | React Aria `Tabs`, demo ribbon, single `createRoot`. Delete the `innerHTML` template. CSS grid replaces the metadata `<table>` | `main.ts` gone or trivial. axe clean. Keyboard pass: arrows move tabs, Tab reaches each panel |
| 5. Extraction readiness | Confirm `src/ui` boundary. Playground page rendering every component. Testing Library + axe test per component. Compare bundle size with Phase 0 | Ready to split out. The split itself waits for RockyRoad desktop |

**Phase 3 tab order** (each tab adds about one component family):

1. Guitar Pro: `Button`, `TextField`, `FileTrigger` with filename from store, field layout.
2. MusicXML: `Select`. Contract: `onChange` fires only on a committed choice (Aurora's Dropdown rule).
3. MIDI: `Slider`, `Disclosure` (debug log), `Callout` (hand-fallback warning).
4. `.psarc`: polite live status region for wasm-load and parse messages.

The shell comes last so the tabs work across mixed vanilla and React panels, which is the same
coexistence pattern Aurora needs.

## Phase 0 baseline

- Main chunk (`vite build`, 2026-10-30): 1,196.25 kB, 291.56 kB gzip. Phase 5 compares against this.
- After 3a (React, React Aria, GP island): 1,467.16 kB, 373.43 kB gzip (+271 kB, +82 kB gzip).
- After 3b (MusicXML island, `Select`): 1,598.87 kB, 418.85 kB gzip.
- After 3c (MIDI island, `Slider`, `Disclosure`, `Callout`): 1,617.65 kB, 423.90 kB gzip.
- After 3d (`.psarc` island, live status region): 1,617.25 kB, 423.53 kB gzip.
- After 4 and 5 (Tabs shell, playground excluded from build): 1,624.69 kB, 424.62 kB gzip.
  Total vs Phase 0: +428.44 kB, +133.06 kB gzip.
- Boundary: `npm run lint:ui-boundary` allows only `react`, `react-dom`, `react-aria-components` in `src/ui`.
  Playground: `npm run dev`, then `/playground.html` (dev only).
- Goldens: `src/zipFiles.test.ts` (`npm test`). `.psarc` is pinned from a hand-built result, so the
  wasm parse path needs a manual check: `node wasm/PsarcChartCore.Wasm/test-node.mjs <file.psarc>`.
- Screenshots: `npm run test:e2e`. Baselines are win32 only. `.psarc` has no loaded state (no fixture).

## Risks

- **Bundle size.** React plus React Aria is large next to today's main chunk. alphaTab and the wasm
  build are already lazy. Budget set in Phase 0, checked in Phase 5.
- **Stalling mid-Phase 3.** A half-converted page is fine short term. Each tab is sized for one sitting.
- **Toolchain drift.** Pin `@vitejs/plugin-react` to the release `graph-editor` uses with Vite 8.

## Beads

Epic `RockyRoadImport-74l`, children chained in order:

| Bead | Phase |
|---|---|
| `74l.1` | 0. Safety net |
| `74l.2` | 1. Stores |
| `74l.3` | 2. Tokens and CSS |
| `74l.4` to `74l.7` | 3a GP, 3b MusicXML, 3c MIDI, 3d `.psarc` |
| `74l.8` | 4. Shell |
| `74l.9` | 5. Extraction readiness |

Follow-up outside the epic: `RockyRoadImport-61n` (normalize per-format zip output), unblocked by Phase 1.
