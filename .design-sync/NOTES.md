# design-sync notes — beide

Repo-specific quirks a future sync should know before touching anything.
Companion to `.design-sync/config.json`; both are committed.

## Shape and entry

- **`shape: "package"`, but this repo has no published `dist/`.** It is an app,
  not a library. The bundle is built from a generated facade,
  `.design-sync/ds-entry.tsx`, which re-exports every component from `src/`.
  Regenerate it with `node .design-sync/gen-entry.mjs` after adding or moving
  components — it reads `cfg.componentSrcMap` and rewrites the facade.
- **`--entry ./.design-sync/ds-entry.tsx` is mandatory** on every
  `package-build.mjs` / `resync.mjs` run. Without it the converter resolves
  `PKG_DIR` from `package.json#main` and lands somewhere useless.
- **Run the staged copy in `.ds-sync/`, never the skill's own path.** Only
  `.ds-sync/node_modules` has esbuild; invoking the bundled-skills copy dies with
  `Cannot find package 'esbuild'`. The full invocation, all four flags required:

  ```sh
  node .ds-sync/package-build.mjs \
    --config .design-sync/config.json \
    --node-modules ./node_modules \
    --entry ./.design-sync/ds-entry.tsx \
    --out ./ds-bundle
  ```

- **A failed build wipes `ds-bundle/` before it fails.** There is no partial
  output to fall back on, so never treat the previous bundle as a safety net —
  re-running a green build is the only recovery.
- **`tsconfig.ds.json` must set `esModuleInterop` + `allowSyntheticDefaultImports`.**
  Without them esbuild emits `__toESM(mod, 1)` (Node interop), where `default` is
  the whole namespace object regardless of `__esModule` — a CJS/UMD dependency
  imported as a default then renders as `Element type is invalid … got: object`.
  This is what broke `SpiralLoader` (`lottie-react` resolves to its UMD build via
  `package.json#browser`). The app never saw it because `tsconfig.web.json` sets
  both flags.
- The facade uses `export *` for `common/IconButton.tsx` so both `IconButton`
  and the `Icons` record reach `window.Beide`. Do **not** narrow that to a named
  export — several previews rely on `Icons`.
- **One name collision:** `ui/popover.tsx` and
  `agent-elements/input/popover.tsx` both export `Popover`. The facade renames
  the agent-elements one to `InputPopover`. If a third `Popover` ever appears,
  gen-entry will not resolve it for you — add the rename by hand.

## Recompile Tailwind *before* every build after touching a preview

`cfg.buildCmd` runs the Tailwind CLI, but a preview edited in the same session
can still miss the scan — the Dialog trio shipped with `h-[22rem]` absent from
`.cache/tailwind.css` and their `Stage` measured exactly 2px (its two borders),
which reads as `[RENDER_THIN]` and looks like a portal problem when it is a
missing utility class. Run the CLI by hand first, then build:

```sh
node .ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs \
  -i .design-sync/ds-entry.css -o .design-sync/.cache/tailwind.css
grep -c "22rem" .design-sync/.cache/tailwind.css   # the new arbitrary value is in
```

Arbitrary values (`h-[22rem]`) are the ones at risk; stock utilities compile to
`calc(var(--spacing)*n)` and are always present.

## Known, accepted divergences

* `lottie-react` ships `"browser": "build/index.umd.js"`, and esbuild's browser
  platform prefers the `browser` field over `module`. The UMD build reaches
  `SpiralLoader` as a namespace object, not a component — React then throws
  *"Element type is invalid … got: object"* and the card renders empty. Fixed by
  pinning the ESM build in `tsconfig.ds.json` paths
  (`"lottie-react": ["node_modules/lottie-react/build/index.es.js"]`), which the
  converter's tsconfig-paths plugin applies to bare specifiers as an exact match.
  Any future dependency with a UMD `browser` field needs the same pin.
* `[FONT_MISSING] "Cascadia Code", "Fira Code"` is expected and accepted. The
  monospace stack in `src/styles/global.css` lists both ahead of JetBrains Mono
  purely as OS fonts (Windows / Linux dev machines); JetBrains Mono is the one
  the DS actually ships as a webfont, so the design pane renders it. No
  `extraFonts` entry is needed — shipping Cascadia would change the intended
  cascade, not preserve it.

## Five `ui/` components were rewritten, not recovered

`src/components/ui/{collapsible,command,popover,select,toast}.tsx` vanished from
the working tree mid-sync. They had never been committed, so git, the recycle
bin and the editor's local history all had nothing; the 35 components they
export (19% of the system) would otherwise have dropped out of the bundle.

They were **written fresh** against the repo's own house style (`dialog.tsx`,
`dropdown-menu.tsx`, `sheet.tsx`) and against the API the authored previews
already pin. Treat them as new code, not as the originals:

- `collapsible`, `popover`, `select`, `toast` wrap the matching `@base-ui/react`
  primitive, one thin function per part, `data-slot` on every part.
- `command` is **hand-rolled** — `cmdk` is not a dependency here. `Command`
  publishes the query on context; `CommandItem` filters itself and sets
  `hidden`, so `CommandGroup` and `CommandEmpty` resolve their own visibility in
  CSS (`:has(… :not([hidden]))`). If the original was built on
  `@base-ui/react/combobox`, this differs in behaviour while matching the API.
- `Toast` is manager-driven (`ToastProvider` + one `ToastViewport` +
  `useToastManager().add()`); `Toast.Root` needs the `toast` object the viewport
  supplies, which is why it has no authored preview.

Commit these files — a second loss is otherwise unrecoverable in the same way.

## CSS pipeline

- `cfg.cssEntry` points at **`.design-sync/.cache/tailwind.css`, a precompiled
  artifact**, not a source file. `cfg.buildCmd` produces it:

  ```sh
  node .ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs \
    -i .design-sync/ds-entry.css -o .design-sync/.cache/tailwind.css
  ```

- **`preview-rebuild.mjs` does NOT run `buildCmd`.** It compiles preview JS
  only. Any new utility class introduced by a newly authored preview is absent
  from the shipped CSS until you re-run `buildCmd` **and then a full
  `package-build.mjs`**. Symptom: the preview renders with correct structure and
  missing spacing/colour. This bit us once — always finish an authoring wave
  with buildCmd + full build before capturing.
- `.design-sync/ds-entry.css` `@source`s both `../src` and `./previews`, so
  preview-only classes are scanned. `ds-bundle/` and `.ds-sync/` are gitignored
  and therefore never auto-scanned.
- **`@layer base` fix in `src/styles/global.css`.** The element reset
  (`button`, `input`, `h1`…) used to sit unlayered. In Tailwind v4 **any
  unlayered rule outranks every `@layer`**, so the reset beat every component
  utility — buttons rendered flat and colourless in both the app and the design
  system. The reset is now wrapped in `@layer base`. This is a fix in the app's
  own source, deliberately, because the app had the same defect. Do not
  "simplify" it back out.

## Fonts

- The app pulls DM Sans / JetBrains Mono from Google Fonts via a `<link>` in
  `index.html`. A rendered design has no such link, and a remote `@import` in
  the CSS entry made every capture wait on `fonts.googleapis.com` (timeouts) and
  degraded to system fonts wherever the request is blocked.
- Fixed by `cfg.extraFonts: ['.design-sync/fonts/fonts.css']` — the Google
  stylesheet with its `.woff2` files downloaded next to it, 28 `@font-face`
  rules copied into `ds-bundle/fonts/`. **A rendered design now makes zero
  network requests for fonts.**
- To regenerate: fetch the Google CSS with a modern-browser UA (so you get
  woff2, not ttf), download every `src: url(...)`, rewrite the URLs to bare
  filenames, and drop the lot in `.design-sync/fonts/`.

## Syntax highlighting

- `@streamdown/code` pulls the full shiki registry (all languages, all themes) —
  megabytes, and it broke the bundle. Replaced by a **slim registry stub** under
  `.design-sync/stubs/`: **24 languages and 4 GitHub themes**
  (`github-light`, `github-dark`, and their default variants). Anything outside
  that list renders as plain text rather than failing.
- If a design needs a language we do not carry, extend the stub — do not swap
  back to the full registry.

## Toolchain quirks

- **`tsconfig.ds.json` must stay comment-free.** The converter parses it with
  `JSON.parse`, not JSON5 — a single `//` or `/* */` fails the run with an
  unhelpful message.
- `.design-sync/node_modules` is a **junction** into `.ds-sync/node_modules`
  (Windows). It is gitignored and must be recreated per clone:
  `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` (or
  `mklink /J`). Needed because the CSS build and stubs import bare package
  names.
- `preview-rebuild.mjs` costs roughly **16 s per component** and blows past a
  120 s foreground timeout on any multi-component batch. Run it backgrounded.
- Working directory persists between shell calls on this machine — prefix
  commands with the repo path or use absolute paths.

## Component gotchas

- **`Textarea` does not exist in this package.** It looks like it should (there
  is an `Input`), but the only matching names are `ContextMenu*`, `EditorArea`,
  `ScrollArea`, `TextShimmer`. A preview importing it fails the whole card.
- **Portal-based components need `cardMode: 'single'`.** In the default `grid`
  mode every export renders as a `.ds-cell` inside **one** document, and
  anything that portals to `document.body` (Dialog, Sheet, Popover, Select,
  DropdownMenu, ContextMenu, CommandDialog, Tooltip) escapes its cell and
  overlaps the others. `single` renders only `primaryStory` (or the first
  export) in the live product card. **Captures and grades are unaffected** —
  the harness drives `?story=<Export>` full-bleed per export regardless of
  `cardMode`, so every story is still captured and gradeable. 22 such overrides
  live in `cfg.overrides`.
- `cardMode: 'column'` is for wide stories (the Edit/Plan diff cards) — one cell
  per row instead of a grid.
- `Toast` is deliberately **not** previewed. Base UI's Toast requires a live
  toast manager (`Toast.Provider` + `useToastManager`); a standalone
  `<Toast.Root>` has no toast object to render and throws. It ships on the floor
  card, honestly.
- `ActivityBar` calls `useTranslation()` with no `I18nextProvider` in the
  preview harness. react-i18next warns on the console and `t()` echoes the key —
  harmless here, because the only strings are `title`/`aria-label`, never
  visible text.
- The `Resizer` is invisible at rest by design (a 4px transparent hit area whose
  2px accent bar paints only on hover/drag). Its third preview cell forces the
  painted state with an arbitrary-variant override and says so in the caption —
  otherwise the card looks broken.

## Known render warns

- `package-validate.mjs` exits clean with ~57 non-blocking warnings. They are
  the expected kind for an app-shaped DS: components whose props are wired to
  Electron IPC or zustand stores and therefore have no meaningful standalone
  `.d.ts` contract.
- The render check flags components showing the typographic **floor card**. That
  is not a failure — it is what an unauthored component correctly looks like.
  Judge a run by `blank || rootEmpty || thin`, not by the floor-card count.
  `.render-check.json` is an object keyed `"0","1",…` — use `Object.values()`,
  it has no `components` array.

## Scope of this import

- Everything is synced, **including app screens** (`editor/`, `terminal/`,
  `sidebar/`, `chat/`, `settings/`, `onboarding/`) even though they are wired to
  Electron IPC and zustand. They render as floor cards where they cannot stand
  alone; that was a deliberate call, not an oversight.
- **84 components carry authored previews**; the rest ship the floor card and are
  the standing offer for incremental authoring on any re-sync.

## Re-sync risks

- **`componentSrcMap` is a 180-entry enumeration inside `config.json`.** It goes
  stale the moment a component is added, renamed, or moved. Regenerate it and
  re-run `gen-entry.mjs` before trusting a re-sync's component count.
- **`.design-sync/fonts/` is a snapshot of a Google Fonts response.** If Google
  changes its unicode-range splits, the local copy silently diverges from what
  the app's `<link>` serves. Nothing will fail — the design system will just use
  slightly different font files than the app.
- **The shiki stub pins 24 languages / 4 themes.** A design that highlights an
  unlisted language degrades to plain text with no warning.
- **The `@layer base` fix lives in app source** (`src/styles/global.css`), not
  in a design-sync override. A refactor of the app's stylesheets can undo it and
  the only symptom will be flat-looking buttons in every design the agent
  builds.
- **Previews assume current prop shapes.** The tool-card previews in particular
  hand-build AI-SDK `part` objects (`{type, toolCallId, state, input, output}`)
  and `TimelineStep` literals. If `tool-adapters.ts` or `types/timeline.ts`
  changes shape, those previews compile fine and render wrong. Re-grade the
  `tools/*` cards after any change there.
- **`cssEntry` is a build artifact under `.cache/`**, which is gitignored. A
  fresh clone has no `tailwind.css` until `buildCmd` runs. The converter will
  not tell you it is missing in a useful way.
- Verification state is **not** in git — it comes from the uploaded project's
  `_ds_sync.json`. A re-sync against a different project re-verifies everything.
