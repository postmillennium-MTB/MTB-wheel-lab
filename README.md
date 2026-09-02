# Wheel Strength Lab — source

This is the buildable source behind `postmillennium-mtb/MTB-wheel-lab`'s
`index.html`. The deployed site is still a single self-contained HTML file —
that hasn't changed — but it's now *generated* from real, readable source
files instead of being the only copy of the app that exists anywhere.

## Why this exists

The original `index.html` was a 600KB single-line minified bundle with no
separate source, frozen dependency versions, and no error handling if a
calculation crashed. This directory fixes that:

- **`src/`** — readable, organized source (see below)
- **`build.js`** — rebuilds `dist/index.html` from `src/` using esbuild
- **`test/`** — automated regression tests (physics math + a full-app smoke test)
- **`.github/workflows/test.yml`** — runs the tests on every push

## Project layout

```
src/
  themes.js              four color themes + theme-cycling helper
  data.js                hub databases, rim sizes, ride/impact scenario data
  physics.js             the wheel-strength math (see note below)
  theme-state.js          shared "current theme" binding used by sibling components
  App.jsx                 main app: header, tabs, global controls
  index.jsx               entry point (mounts <ErrorBoundary><App/></ErrorBoundary>)
  components/
    WheelDiagram.jsx       MTB hub cross-section + rim-channel SVG diagram
    Section.jsx             collapsible panel
    ToggleGroup.jsx         segmented button control
    Slider.jsx               labeled range input
    MetricBar.jsx            paired 148/157 comparison bar
    RideTooltipContent.jsx  custom Recharts tooltip
    SymmetryTab.jsx          the SYMMETRY tab's interactive demo
    AnnotationOverlay.jsx    SYMMETRY tab's self-playing callout tour
    PixelFox.jsx             the easter-egg pixel-art fox
    ErrorBoundary.jsx        NEW — catches crashes, shows a recoverable fallback
```

## A note on code style in physics.js and App.jsx

`physics.js`'s wheel-strength calculation (`computeWheelStrength`, based on
Ford's Mode Matrix method) and the bulk of `App.jsx` are left in a dense,
short-variable-name style on purpose, rather than fully rewritten with
descriptive names throughout. Two reasons:

1. **Risk.** Hand-renaming variables inside a 20-term trigonometric
   expression is exactly the kind of edit that can silently introduce a
   sign error nobody catches in review. Every rename that *was* made
   (function names, module-level data references, component names) was
   verified mechanically — reversing the rename and diffing against the
   original bundle byte-for-byte — rather than trusted by eye.
2. **What actually helps.** The value of "readable source" here is mostly
   about being able to *find* things (a named `physics.js` instead of one
   line of 600KB) and understand what a function *does* (via the comment
   above it), not about every local loop variable having a long name.

If you want to make the internals more readable too, that's a reasonable
follow-up — just do it function-by-function with the same verify-by-diff
discipline, not as one big pass.

## Building

```
npm install
npm run build       # writes dist/index.html
npm test            # physics regression tests (fast, no build needed)
npm run test:smoke  # mounts the built app in a simulated browser, clicks every tab
npm run test:all    # build + both test suites
```

## Deploying

`dist/index.html` is the same kind of file as the original — copy/upload it
to the `MTB-wheel-lab` repo's `index.html` via GitHub's web UI, exactly like
before. GitHub Pages picks it up automatically.

## Updating dependencies

React, ReactDOM, and Recharts are now real npm dependencies pinned in
`package.json` (currently the latest patch releases on the same major
versions the site already used — React 18, Recharts 2 — deliberately *not*
jumped to React 19 / Recharts 3, since those are breaking major-version
changes that would need real browser testing to validate safely, not just
a rebuild). To update:

```
npm outdated          # see what's behind
npm update             # bump within the ranges in package.json
npm audit               # check for known vulnerabilities
npm run test:all       # rebuild and re-run everything before deploying
```

For a major-version jump (e.g. Recharts 2 → 3, which changed internal
APIs), budget time for actual visual testing in a browser — the automated
tests here catch crashes and math regressions, not "does this chart still
look right."
