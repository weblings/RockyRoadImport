# Shared tokens and UI components across Aurora, RockyRoad, RockyRoadImport and the Website

Status: planning (React direction chosen 2026-10-30. RockyRoadImport migration planned in [[rri-react-migration]], nothing else started)
Id: shared-ui-refactor

Findings from a survey (2026-10-29) of how the four projects share design tokens and web UI
components today, and options for a shared package. Lives here because RockyRoadImport is the
smallest consumer and the first adopter. Only the React direction and the RockyRoadImport sequence
are settled (see Decisions below).

---

## Current state

| Project | UI stack | How tokens/components arrive |
|---|---|---|
| Aurora `web/ui` | Plain static ESM + CSS, no build step, no npm. Embedded in the app binary | Source of `styles/tokens.css` (`--aurora-*` vars). Demo gets byte-identical copies via `web/demo/vendor/sync-webui.py` + `MANIFEST.json` |
| RockyRoad desktop | TypeScript + Vite, DOM screens in `src/desktop/` | Same grayscale values as literal hex in `desktop.html` and `src/xr/panel.css` |
| RockyRoad XR | IWSDK + uikitml (`ui/*.uikitml`), migrated off html2canvas | Same values hand-converted px / 10 into cm units |
| RockyRoadImport | TypeScript + Vite, single 193-line `SongConverter/index.html` | Same values as literal hex |
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

- Git history shows a single author across Aurora `web/ui` and RockyRoad, so these files can be
  published under MIT in a new repo. The GPL copies in their original repos are unaffected.
- **Must stay out of an MIT package** (comments state huenicorn-derived code):
  - Aurora `screens/DashboardScreen.js` ("Ported close to verbatim from huenicorn's own real WebUI.js")
  - Aurora `screens/ZoneMappingScreen.js` ("Ported from huenicorn's real `ScreenWidget.js`")
  - Aurora `ZoneCanvas.js` ("Ported drag behavior/comments preserved from the original")
- **Clean to extract:** `styles/tokens.css`, `Dropdown.js`, `SliderFill.js`, `AccordionSection.js`,
  `Tooltips.js`. `ZoneActiveToggle.js` mentions huenicorn only to contrast with it.
- Aurora's `web/ui` README currently says the design "carries the same license forward". Reword it
  if the tokens move, so they aren't read as GPL-derived. Not legal advice.

## Proposed layering

Three layers so logic can be shared without forcing a theme:

| Layer | Contents | Theming impact |
|---|---|---|
| `tokens` | W3C DTCG token JSON (format stable since 2025.10), built to CSS vars, a TS module and other targets | Values only |
| `behavior` | ARIA, keyboard, focus and open/closed state. Emits attributes and `data-state`, never styles | None |
| `skin` (optional) | Default CSS reading semantic vars with fallbacks, inside `@layer shared` | Opt-in |

- Two token tiers: primitives (`gray-800: #333`) and semantic roles (`--ui-button-bg`). Skins read
  only semantic tokens, so a consumer like the Website remaps them to its own palette.
- `@layer` lets unlayered project CSS always win regardless of specificity.
- Distribution: a git repo with tags (`github:<owner>/<repo>#v0.1.0`) is enough for one developer.
  Aurora consumes it through the existing sync-script vendoring pattern while it stays no-build.

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
  a token partial or TS constants at build time with a px to cm (/ 10) transform.
- uikit renders text in WebGL with no screen reader exposure. IWSDK docs point to 2D HTML menus
  outside XR when accessibility matters, which RockyRoad's desktop/XR split already supports.
- Compose: Style Dictionary can emit a Kotlin token object from the same DTCG source (verify the
  `compose/object` format before relying on it). Behavior gets reimplemented with Compose semantics.

## Decisions (2026-10-30)

- **React for DOM UIs.** Shared components wrap React Aria Components. The hand-written vanilla
  `behavior` layer is dropped. Zag.js stays unneeded if long transitions use React islands (below).
- **Incubate in RockyRoadImport, extract later.** Components and tokens start in
  `SongConverter/src/ui/`, shaped as the future package (own `index.ts`, no app imports, lint
  enforced). Split to the shared repo, with history, when RockyRoad desktop work starts. Cross-repo
  linking before a second consumer exists is overhead.
- **Wrap, don't re-export.** App code never imports `react-aria-components` directly. The wrapper
  API is the stable surface other projects depend on.

## Constraints on the first adopter

RockyRoadImport doesn't need these itself, but builds them in so RockyRoad and Aurora don't force rework:

- **No single-root assumption.** Mount through a `mountIsland(el, node)` helper. No required
  top-level provider. Skin CSS keys on component classes or `data-*` attributes in `@layer`, never
  on ancestor selectors, since popovers portal outside the island. Global resets stay in each app.
- **Logic in plain TS stores** (`subscribe`/`getSnapshot`, read via `useSyncExternalStore`), side
  effects included. Same shape RockyRoad's `App` needs to share state between its WebGL scene and
  React menus.
- **Token rules:** semantic names only in consumer CSS, dimensions as px numbers (XR divides by 10
  for cm), stylelint `color-no-hex` in consumers.
- **Fonts ship in the package** (Inter files in its `files` list), so Aurora's offline vendoring
  copies them.
- **Compiled output** (ESM, `.d.ts`, CSS, `'use client'` preserved) with a React `^19` peer range.
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
  independent.
- **Cross-repo dev loop.** Linked packages can load a second React ("Invalid hook call"). Use React
  as a peer dependency plus `resolve.dedupe: ['react','react-dom']` for `file:` links.
- **DTCG tooling.** Style Dictionary 5.5.0 added 2025.10 object-form dimensions. Pin the version and
  keep string dimensions until every target reads objects. Compose output is still unverified.
- **No CI guard for drift.** Add visual regression and axe checks per component in the package and
  per page in each app.

## Order

1. RockyRoadImport migration per [[rri-react-migration]]: tests, stores, tokens, React islands,
   shell, extraction readiness.
2. Split `src/ui` into the shared repo when RockyRoad desktop starts. Add the uikitml token target
   (px / 10) and the Aurora alias output then.
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
