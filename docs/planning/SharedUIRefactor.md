# Shared tokens and UI components across Aurora, RockyRoad, RockyRoadImport and the Website

Status: in progress (React direction chosen 2026-10-30. Name chosen 2026-11-06: Grille. RockyRoadImport migration shipped, see [[rri-react-migration]]; split to weblings/GrilleDS done, and RockyRoadImport consumes it by pinned commit on `dev` (PR #5, CI passed), see Split readiness; RockyRoad/Aurora adoption not started)
Id: shared-ui-refactor

Findings from a survey (2026-10-29) of how the four projects share design tokens and web UI
components today, and options for a shared package. Lives here because RockyRoadImport is the
smallest consumer and the first adopter. Only the React direction, the RockyRoadImport sequence and
the name are settled (see Decisions and Name below).

---

## Current state

| Project | UI stack | How tokens/components arrive |
|---|---|---|
| Aurora `web/ui` | Plain static ESM + CSS, no build step, no npm. Embedded in the app binary | Source of `styles/tokens.css` (`--aurora-*` vars). Demo gets byte-identical copies via `web/demo/vendor/sync-webui.py` + `MANIFEST.json` |
| RockyRoad desktop | TypeScript + Vite, DOM screens in `src/desktop/` | Same grayscale values as literal hex in `desktop.html` and `src/xr/panel.css` |
| RockyRoad XR | IWSDK + uikitml (`ui/*.uikitml`), migrated off html2canvas | Same values hand-converted px / 10 into cm units |
| RockyRoadImport | TypeScript + Vite + React on React Aria | Generated from DTCG JSON in `SongConverter/src/ui/tokens/` since the migration |
| Website | Next.js 16 + React 19 + Bootstrap 4 | Separate palette (blues, `#facade`), no CSS custom properties |

- One grayscale system is hand-copied four times. Aurora's `tokens.css` header says it was verified
  against RockyRoad and RockyRoadImport sources, so drift is managed by hand today.
- Components are ported, not shared. Aurora's `Dropdown.js` started from RockyRoad's `Dropdown.ts`
  and then gained the full WAI-ARIA collapsible listbox pattern. RockyRoad's desktop copy has almost
  no ARIA (12 `aria-` uses across `src/desktop`).
- Aurora's vendor sync (manifest, commit stamp, closure check, CI drift failure) is a working
  copy-based sharing mechanism worth reusing for any no-npm consumer.
- The Website shares no components or palette with the apps. Its components (Hero, ProjectCard,
  BadgeGroup, NavBar) are portfolio-specific.

## Licensing

- Git history shows a single author across Aurora `web/ui`, RockyRoad and RockyRoadImport's `src/ui`
  plus its token and boundary scripts, so these files can be published under MIT in a new repo. The
  GPL copies in their original repos are unaffected.
- **Must stay out of an MIT package** (comments state huenicorn-derived code):
  - Aurora `screens/DashboardScreen.js` ("Ported close to verbatim from huenicorn's own real WebUI.js")
  - Aurora `screens/ZoneMappingScreen.js` ("Ported from huenicorn's real `ScreenWidget.js`")
  - Aurora `ZoneCanvas.js` ("Ported drag behavior/comments preserved from the original")
- **Clean to extract:** `styles/tokens.css`, `Dropdown.js`, `SliderFill.js`, `AccordionSection.js`,
  `Tooltips.js`. `ZoneActiveToggle.js` mentions huenicorn only to contrast with it.
- Inter is OFL-1.1, so its license ships with the font files, including in Aurora's vendored copy.
- Aurora's `web/ui` README currently says the design "carries the same license forward". Reword it
  if the tokens move, so they aren't read as GPL-derived. Not legal advice.

## Proposed layering

Three layers so logic can be shared without forcing a theme:

| Layer | Contents | Theming impact |
|---|---|---|
| `tokens` | W3C DTCG token JSON (format stable since 2025.10), built to CSS vars, a TS module and other targets | Values only |
| `behavior` | ARIA, keyboard, focus and open/closed state. Emits attributes and `data-state`, never styles | None |
| `skin` (optional) | Default CSS reading semantic vars with fallbacks, inside `@layer ui` | Opt-in |

- Two token tiers: primitives (`gray-800: #333`) and semantic roles (`--ui-button-bg`). Skins read
  only semantic tokens, so a consumer like the Website remaps them to its own palette.
- `@layer` lets unlayered project CSS always win regardless of specificity. That cuts both ways: an
  unlayered reset zeroed padding on every `ui-*` control in the RockyRoad trial, so each consumer must
  put its reset in `@layer reset`.
- The package CSS declares `@layer reset, app, ui;`, so import order can't demote `ui`. Those layer
  names are public API, and `@layer app` rules can't override `ui`. Only unlayered rules can.
- Distribution: a git repo pinned by commit (`github:weblings/GrilleDS#<commit>`) is enough for one
  developer. Start tagging releases when a second consumer arrives.
  It needs a `prepare` script, since compiled output and generated tokens aren't committed, and a
  public repo so consumer CI needs no token. Aurora consumes it through the existing sync-script
  vendoring pattern while it stays no-build.
- One package with subpath exports, not separate `-tokens` and `-react` packages: npm can't install a
  subfolder of a git repo. React is an optional peer, and the DTCG JSON sits at the repo root so
  non-React generators don't touch React code.

## Existing component libraries as a base

No library makes a product "WCAG 2.2 compliant". Conformance is per page. Libraries supply
WAI-ARIA APG keyboard and role behavior. Contrast, target size (2.5.8), focus not obscured
(2.4.11) and dragging alternatives (2.5.7, relevant to Aurora's ZoneCanvas and sliders) stay with us.

| Option | Fit | Blocker |
|---|---|---|
| React Aria Components | Unstyled, `data-*` state, strongest cross-browser and screen reader testing | React only |
| Radix, Ariakit, Headless UI | Good ARIA | React only |
| Zag.js | Unstyled, framework-agnostic state machines with vanilla and React adapters | Vanilla wiring is manual. Machines are DOM-bound, so no uikit or Compose reuse |
| Lion (ING) | White-label, accessibility-focused web components | Shadow DOM complicates overrides and canvas capture |
| Web Awesome / Shoelace, Spectrum WC, Material Web | Mature | Each ships its own theme. Material Web is in maintenance mode |

## Effect of a long-term move to React

- RockyRoad XR stays non-React regardless. IWSDK is ECS-based and uikitml is vanilla. A React
  uikit binding exists (`@react-three/uikit`) but would mean leaving IWSDK patterns. So `tokens`
  must stay framework-neutral.
- For DOM UIs, a React target means **skipping the hand-written vanilla `behavior` layer** and using
  React Aria Components instead. Zag.js only earns its place if the transition runs long enough that
  vanilla and React screens need the same widget at once.
- Aurora already has a React precedent: `web/graph-editor` (React 19 + Vite) built by
  `web/graph-editor/cmake/GraphEditor.cmake`, with a prebuilt-dist escape hatch that skips npm.
  Converting `web/ui` would follow that path.
- Costs for Aurora: a larger embedded UI (React plus React Aria), and its plain `node X.test.mjs`
  suites moving to Vitest with Testing Library (RockyRoadImport already uses Vitest).
- To verify before swapping Aurora's Dropdown for React Aria `Select`: Aurora deliberately does not
  commit a selection on arrow keys, since `onSelect` can switch devices or call the REST API. React
  Aria adds typeahead, which Aurora's version cut.
- Next.js consumer notes: ship compiled JS (avoids `transpilePackages`) and mark interactive
  components `'use client'`.

## Non-DOM targets: uikitml and Jetpack Compose

- Share tokens and per-component behavior specs (states, keys, roles), not code.
- uikitml has no documented `var()` support, which is why RockyRoad hand-converts values. Generate
  colors only: desktop and XR sizes were tuned separately, so sizes don't carry over.
- uikit renders text in WebGL with no screen reader exposure. IWSDK docs point to 2D HTML menus
  outside XR when accessibility matters, which RockyRoad's desktop/XR split already supports.
- Compose: Style Dictionary can emit a Kotlin token object from the same DTCG source (verify the
  `compose/object` format before relying on it). Behavior gets reimplemented with Compose semantics.

## Decisions (2026-10-30)

- **React for DOM UIs.** Shared components wrap React Aria Components. The hand-written vanilla
  `behavior` layer is dropped. Zag.js stays unneeded if long transitions use React islands (below).
- **Incubate in RockyRoadImport, extract later.** Components and tokens start in
  `SongConverter/src/ui/`, shaped as the future package (own `index.ts`, no app imports, lint
  enforced). Split to `weblings/GrilleDS`, with history. Originally timed to RockyRoad desktop work, but
  the consumers are treated as ready as of 2026-11-06, so the split goes ahead now.
- **Wrap, don't re-export.** App code never imports `react-aria-components` directly. The wrapper
  API is the stable surface other projects depend on.

## Name (2026-11-06)

The shared system is **Grille**: package `@weblings/grille`, repo `weblings/GrilleDS`.

- **Why:** a speaker or amp grille is the visible face that sound passes through, as a UI layer is
  the surface in front of the engine. It is also French for "grid", and a Cardan grille is a stencil.
  It avoids "web", "ui" and "react" so it still fits XR and native targets.
- **Known costs:** people will type "grill", and the word carries barbecue and jewelry associations.
- **Neighbors:** [imohanvadivel/grille](https://github.com/imohanvadivel/grille) is a small CSS grid
  system, last pushed in 2022. Unscoped `grille` on npm is a spreadsheet CMS, so use the scope.
- **Not checked:** no trademark search was done. Do one before any public or commercial branding.
- **CSS names:** `--ui-*` vars, `.ui-*` classes and `@layer ui`. They deliberately avoid the name, so
  a trademark problem wouldn't touch every variable.

Top contenders, in case the name is revisited. Availability is as of this date:

| Name | Why it was considered | Why it lost |
|---|---|---|
| Gobo | Stage light stencil that puts one pattern on any surface. Best cross-platform and Aurora fit | [gobo](https://github.com/nicholaspjm/gobo-dmx-live-code), a browser lighting app, sits close to Aurora |
| Understudy | Theater role that learns the parts and steps in. Best learning and support fit | Can imply "second best" |
| Stagedive | A leap trusting the crowd. Best excitement fit | Sounds a little reckless |
| Cobblestone | Rocky road, "cobbled together", small pieces forming a road | Long, and also a Minecraft block |
| Etude | A piece written to practice a skill | [etudes](https://github.com/andrewscwei/etudes) is an active React library, and two sheet music apps use the name |
| Fathom | Depth and understanding. Best immersion fit | Used by other products, not checked in depth |
| Troupe | Small company of traveling performers | Less tied to these projects than the others |

Good names already taken by design systems or UI libraries: Roadie (Oztix), Encore (Spotify),
Backline (Festicket), Alpenglow, Basalt, Motif, Fringe (Axo), Repertoire, Tutti and Overture.

## Constraints on the first adopter

RockyRoadImport doesn't need these itself, but builds them in so RockyRoad and Aurora don't force rework:

- **No single-root assumption.** Mount through a `mountIsland(el, node)` helper. No required
  top-level provider. Skin CSS keys on component classes or `data-*` attributes in `@layer`, never
  on ancestor selectors, since popovers portal outside the island. Global resets stay in each app.
- **Logic in plain TS stores** (`subscribe`/`getSnapshot`, read via `useSyncExternalStore`), side
  effects included. Same shape RockyRoad's `App` needs to share state between its WebGL scene and
  React menus.
- **Token rules:** semantic names only in consumer CSS, dimensions as px numbers, stylelint `color-no-hex` in consumers.
- **Fonts ship in the package** (Inter files in its `files` list), so Aurora's offline vendoring
  copies them.
- **Compiled output** (ESM, `.d.ts`, CSS) with a React `^19` peer range. Add `'use client'` when the
  Website adopts it, since the build doesn't emit it yet.
  Declarations must type-check under the oldest consumer TypeScript (RockyRoadImport's 5.9).
- **Component checks live with the package:** a playground page plus Testing Library and axe per
  component. Apps keep only page-level screenshots.
- **Shared skins are not tied to one behavior.** RockyRoadImport's tab pills match RockyRoad's
  filter chips visually, but chips are a toggle group. Share the pill skin, not tab semantics.

## Gaps for RockyRoad and Aurora

- **Aurora transition.** ~40 `web/ui` modules means a long mixed period. Plan per-screen React
  islands inside the vanilla shell. `sync-webui.py` would then vendor built output instead of source.
- **RockyRoad's canvases.** The WebGL renderer (`App.ts`, `Scene3D` family) and `TextBatch`'s
  canvas-to-texture text stay canvas, with React only for overlays around them. The desktop
  tuner's `large` layout (`TunerScreen.drawCanvas()`) is also still 2D canvas, beside DOM boxes for
  `medium`/`narrow`. Its colors (`#ffffff`, `#8b8b8b`, `#515151`, `#c8c8c8`, meter `#44CC44`/`#CC8800`)
  and font string are literals the CSS token work never reached. Short term: use the TS token
  module. With the desktop React move: rebuild `large` as SVG updated per frame through refs, which
  reads CSS vars, reuses `public/*.svg` icons directly and can expose a throttled live region.
- **Token coverage.** Aurora's tokens are grayscale-only by design, but consumers use link
  (`#4d9fff`), warning amber (`#f0a824`, `#CC8800`), success (`#44CC44`) and muted text (`#8c8c8c`).
  Add a status/link category to the shared set. Aurora simply doesn't use it.
- **Aurora naming.** Generate an alias layer (`--aurora-x: var(--ui-x)`) from the same JSON rather
  than renaming Aurora's vars. Newer Aurora-only values (`--aurora-surface-hover`) need homes too.
- **Fonts.** Aurora's `tokens.css` names Inter but its embedded UI never loads it, so it renders in
  `system-ui`. Bundling Inter in the package fixes this.
- **Toolchain spread.** RockyRoad Vite `^7`, RockyRoadImport Vite `^8` + TS `~5.9`, Aurora
  `graph-editor` Vite `8.3.2` + TS `7.0.2` + React `19.3.0`. Compiled package output keeps these
  independent. RockyRoad needs `@vitejs/plugin-react` 5.2.0, since 6.x requires Vite 8 and the IWSDK
  plugins require Vite 7. That stays a RockyRoad dependency, not a Grille one.
- **Cross-repo dev loop.** Linked packages can load a second React ("Invalid hook call"). Use React
  as a peer dependency plus `resolve.dedupe: ['react','react-dom']` for `file:` links.
- **DTCG tooling.** Style Dictionary 5.5.0 added 2025.10 object-form dimensions. Pin the version and
  keep string dimensions until every target reads objects. Compose output is still unverified.
- **No CI guard for drift.** Add visual regression and axe checks per component in the package and
  per page in each app.

## Split readiness

The boundary lint passes, nothing in `src/ui` imports app code, and all 25 `src/ui` tests pass. A trial
in a clean copy replaced `src/ui` with a packed package: `tsc`, stylelint and all 12 e2e and screenshot
tests passed after the layer fix, and built CSS kept the same hash. Installing from a git tag was only
tested against a local repo URL.

Done in this repo before the split (2026-11-06):

- The layer order is declared in `ui.css`. Importing `ui.css` before `base.css` broke 5 screenshot
  tests in the trial while `tsc` and unit tests stayed green.
- Tokens are renamed to `--ui-*`. `tokens.ts` names are unchanged.
- `src/ui/fonts.css` and `src/ui/tokens.css` are the entry points, so apps no longer import font
  packages or generated paths.
- `mountIsland` has tests. Import has no caller, but RockyRoad's screen adapters depend on it.

During the split (done 2026-11-06, Import pins `61e83a7`):

- **New repo:** `package.json` with subpath exports, build, `prepare`, MIT license, CI.
- **Move with `git filter-repo`, on a fresh clone:** `src/ui`, `scripts/build-tokens.mjs`,
  `playground.html` and `src/playground.tsx`. The playground needs a local reset instead of the app's
  `base.css`. Copy `.stylelintrc.json`, since Import still lints its own CSS.
- **Split `check-ui-boundary.mjs`:** the inward check moves, and the "no direct React Aria" check stays
  in each consumer. Import's is `scripts/check-react-aria-imports.mjs`.
- **Import cleanup:** point the files using `./ui` at the package, delete `src/ui`, and remove the
  `build:tokens`, `predev` and `lint:ui-boundary` scripts and the CI token step.
- **Not moving yet:** `createStore` and `useStore`. `src/ui` doesn't import them. When RockyRoad needs
  them, `createStore` goes in a React-free `./store` export so XR can share stores.
- **This doc** stays in Import for now, since it cites [[rri-react-migration]].
- **Installing:** `npm install <package>` skips Import's `patch-package` step, so run a plain
  `npm install` afterward. A clean `npm ci` works on Linux without SSH, and npm skips the integrity
  check for git dependencies.

## Adoption findings for other repos

From the RockyRoad trial. Each repo tracks its own work.

- **Component gaps.** All additive, so Import needs no edits. Keep `className` blocked on Button, since
  per-screen drift is part of why this exists. Parents handle layout.

| Component | Needed |
|---|---|
| Field components | Shared `hideLabel` |
| Button | `size`, `icon`, `fullWidth` |
| Select | `{id, label}` options, `formatValue`, `fullWidth`, `onOpenChange` |
| Slider | `onChangeEnd`, filled track |
| TextField | `placeholder`, plus a separate `SearchField` for library search |
| Missing | Switch, Modal, ToggleButtonGroup (reuses the tab pill skin), IconButton, Meter, ColorInput (native input first, to limit bundle size) |

- **Select is modal.** The popover locks page scroll and makes the rest of the page inert, so switching
  dropdowns takes two clicks. Keep it and expose `onOpenChange`, so the Play bar can hold its fade.
  `isNonModal` also turns off closing on outside click, which Grille would then own.
- **Commit-only selection.** The wrapper already ignores selection changes while closed, which matches
  Aurora's rule. Keep a test on that guard.
- **Bundle.** RockyRoad's desktop entry grew by about 136 kB gzip. The XR chunk stayed byte-identical.
- **RockyRoad safety net.** It has no test runner or CI, so those come before any screen conversion.
- **Versioning.** During 0.x, a minor may break and a patch may not. Consumers pin exact tags.

## Order

1. RockyRoadImport migration per [[rri-react-migration]]: tests, stores, tokens, React islands,
   shell, extraction readiness.
2. Split `src/ui` into `weblings/GrilleDS` (done). Add the uikitml color target and the Aurora alias
   output when those consumers adopt it.
3. RockyRoad desktop: replace `Dropdown.ts`, move tuner colors to tokens, React for menu screens,
   canvases kept as islands. XR consumes tokens only.
4. Aurora `web/ui` last, through the `graph-editor` CMake path with per-screen islands. Verify the
   `Select` commit-only contract against `onSelect` device switching before swapping `Dropdown.js`.
5. Compose and uikit against behavior specs when those targets need them.

The Website's compact mobile navbar is being built standalone first (Website bead), shaped so its
`useDisclosure` hook can later seed the shared `Disclosure` primitive.

## Sources

- [Zag.js introduction](https://zagjs.com/overview/introduction)
- [Design Tokens spec reaches first stable version](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
- [Design Tokens Format Module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)
- [IWSDK spatial UI overview](https://developers.meta.com/horizon/documentation/iwsdk/concepts/spatial-ui/)
- [IWSDK UIKitML](https://developers.meta.com/horizon/documentation/iwsdk/concepts/spatial-ui/uikitml/)
- [WAI-ARIA APG disclosure navigation example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
