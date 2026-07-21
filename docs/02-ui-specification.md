# UI / UX Specification (v1.0.0)

**Status:** Binding for structure, flow and behavior; **deliberately not pixel-level.** The exact
visual layout (grids, spacing, precise component placement, final visual design) is the design doc's
job (`04-design-proposal.md`). This document specifies the **story deck** — its slides, scenes, the
UX elements and their behavior, the reader-facing flow, and the mapping to state and data. It is
derived from `00-business-overview.md` (especially §1.1 and §4) and must stay consistent with
`01-technical-decisions.md`.

**Terminology.**
- **Deck** — the whole app: a linear sequence of six **slides** the reader advances through.
- **Slide** — one step of the narrative: a layout + authored copy + zero, one or two visualisations +
  the controls its scene exposes.
- **Scene** — a run of consecutive slides that share the *same on-screen visualisation instances*.
  Sibling slides in a scene keep charts mounted and only change their configuration (an in-place
  ECharts `setOption` animation); crossing a scene boundary mounts fresh visualisations.
- **Time horizon** — the projection selector (*today · +20 · +30 · +50 · +75 · +100 y*),
  server-side, refetches (business §2.4a). **Time range** — the client-only `dataZoom` view crop,
  no refetch. They are different controls.

There is **no** "official ↔ full" accounting axis — the app always shows "full" (stock + forgone
sink); the reveal is staged by the slide 2→3 animation (business §2.6).

---

## 1. Design principles

1. **A guided story, not a composer.** The app is a linear **deck of eight slides**, not an open
   dashboard the reader reconfigures. The reader advances (Next / Back, keyboard, scroll); each slide
   reveals one step. A few slides carry interactive controls scoped to their scene.
2. **Preserve chart identity within a scene.** Sibling slides that share a visualisation keep the
   **same chart instance** and only change its `setOption` — so the reveal (2→3) and the zoom (5→6)
   **animate** rather than reload. Crossing a scene boundary mounts a fresh chart. (§7.)
3. **Honest explorer.** Measured WB figures and our estimates are always visually distinct: **stock**
   solid (harder number), **forgone sink** dashed + uncertainty band (estimate). Beyond the last
   measured year, **projected** values are a lighter dashed continuation with a **join-year divider**
   (business §2.4a). Every estimate shows its assumptions (baseline, horizon) and its data year.
4. **Dark only (V1).** Dark surfaces, light text (PrimeVue Aura dark); **no light-mode toggle**
   (ADR-002); charts share the chrome's theme tokens.
5. **Localized copy, international numbers.** Every string (headings, body copy, labels, tooltips,
   units, caveats) is an i18n key; SK/EN; default = Slovak if the browser is Slovak else English
   (ADR-011). **Numbers are not locale-formatted** — one international **compact notation** (`3.2M`,
   `820k`, `×3.2`) via an injected `Formatter`, never inline (ADR-018, §11).
6. **Responsive.** Works from desktop down to a narrow viewport; charts autoresize and their options
   adapt by breakpoint; the slide layouts reflow.
7. **No component-local data.** Every value shown comes from Pinia (ADR-003); components are pure
   views + intent emitters.

---

## 2. The deck shell (layout regions)

The deck lives under a **single persistent page** (route `/story/:slug`, §4) that does **not** remount
as the reader moves between slides — only the slide's content changes reactively. Logical regions:

- **Header bar** (persistent) — app title ("Story of Deforestation" / "Príbeh deforestácie"), the
  **language switcher**, and a link to the "About / methodology" disclosure.
- **Slide stage** (dominant) — renders the current slide through one of three **layout presets** (§3.2):
  an optional **heading**, the **visualisation area** (0, 1 or 2 charts), and a **text block below**
  the visualisation(s). The `main` scene also shows the **multiplier ×N** alongside its chart (from
  slide 3, §6.6).
- **Scene controls** — the interactive controls the current scene exposes (§5), placed with the
  visualisation (design doc owns exact placement). Absent on text-only / control-less slides.
- **Deck navigation** (persistent) — Next / Back affordances and a **progress indicator** (which of
  the eight slides, §4).
- **Footer / disclosure** — data sources, methodology caveats, data-year notes (localized).

Loading, empty and error states are first-class (§9). The About/methodology disclosure surfaces the
three `R` caveats, the two-methodologies note, and the "main tropical domains, not the whole world"
label (business §3, §6, §7).

---

## 3. Slides and scenes (authoritative)

### 3.1 The eight slides

| # | Slide (slug) | Scene | Layout | Visualisation(s) | Metrics shown | Controls |
|---|---|---|---|---|---|---|
| 1 | Intro (`intro`) | `intro` | `text` | — | — | — |
| 2 | Main — reported (`main`) | `main` | `viz-text` | main stacked chart | stock | horizon, domain, baseline |
| 3 | Main — hidden cost (`main-sink`) | `main` | `viz-text` | *same* main chart | stock + forgone sink | horizon, domain, baseline |
| 4 | Crossing (`crossing`) | `crossing` | `viz-text` | crossing chart | stock impulse + forgone level | time-range, baseline |
| 5 | Footprint (`footprint`) | `footprint` | `duo-viz-text` | donut + defo-vs-fossil bar | fossil + stock + forgone sink | baseline, horizon |
| 6 | Deforestation zoom (`deforestation-insight`) | `footprint` | `duo-viz-equiv` | *same* donut + bar **+ equivalence strip** | stock + forgone sink | baseline, horizon |
| 7 | Baseline lab (`baseline`) | `baseline` | `caption-viz` | main stacked chart (global) | stock + forgone sink | baseline **slider**, horizon |
| 8 | Baseline impact (`baseline-impact`) | `baseline` | `viz-equiv` | crossing chart **+ equivalence strip** | stock impulse + forgone level | baseline **slider**, horizon |

Slides 2→3, 5→6 and 7→8 are **in-scene** transitions (chart instances preserved, `setOption` animates,
§7). Slides 1→2, 3→4, 4→5, 6→7 cross a scene boundary (fresh visualisations). Slides 5 and 6 **share the
`baseline` + `horizon` controls** (footprint scene, reset policy A) — the reader's setting carries from
5 to 6 and drives both the visualisations and the slide-6 equivalence strip (§6.7, ADR-025). Slide 6
uses the **`duo-viz-equiv`** layout (§3.2): a thin caption line replaces the text block and a full-width
equivalence strip is added at the foot; the layout change **does not remount** the donut/bar (§7).
Slides 7 and 8 form the **`baseline` scene** (ADR-026): a full-range **baseline slider** (1800→present)
plus the live horizon picker drive the client-side back-projection in real time; slide 7 shows the main
stock+forgone chart, slide 8 the crossing chart above the equivalence strip — both fixed to the global
view and sharing the slider/horizon state across 7↔8.

### 3.2 Layout presets (closed set)

Six presets. The first three carry the **text block below** the visualisation(s) with an **optional
heading above the text**; the caption/equivalence-led presets (slides 6–8) drop the text block for a
thin caption on top and/or a full-width equivalence strip at the foot:

- **`text`** — heading + body copy only (slide 1).
- **`viz-text`** — one visualisation on top, full-width text block below (slides 2–4).
- **`duo-viz-text`** — two visualisations side by side on top, full-width text block below (slide 5).
- **`duo-viz-equiv`** — slide 6 only (ADR-025): top-to-bottom a **thin caption line** (one localized
  line, no heading) · the scene's **controls** row · the **two visualisations** side by side (the same
  donut + bar as slide 5) · a **full-width equivalence strip** (§6.7). **No text block.** On a
  height-constrained viewport the strip keeps its needed height and the **viz cards shrink** (they are
  primitive charts), never the strip.
- **`caption-viz`** — slide 7 only (ADR-026): a **thin caption line** on top · the **controls** row ·
  **one full-width visualisation**. **No text block, no equivalence strip.**
- **`viz-equiv`** — slide 8 only (ADR-026): the **controls** row · **one full-width visualisation** ·
  a **full-width equivalence strip** (§6.7). **No caption, no text block.**

A single generic `SlideLayout` component renders a preset from named slots (`caption`, `controls`,
`viz`, `viz2`, `equivalence`, `heading`, `text`). The preset list is **closed for V1** — new narrative
shapes extend it deliberately. **Binding (§7, ADR-025):** the `viz` slot outlet is rendered
**unconditionally** for every preset (only surrounding slots + CSS differ), so switching
`duo-viz-text`→`duo-viz-equiv` across the 5→6 boundary preserves the chart instances.

### 3.3 What is fixed vs. what the reader controls

- **Per-slide, authored (immutable at runtime):** the slide's layout preset, its heading + body copy,
  and **which metrics each visualisation shows** (slide 2 = stock only; slide 3 = stock + forgone
  sink; slide 5 = with fossil; slide 6 = fossil removed). The reader cannot change these — they are
  the narrative.
- **Per-scene, interactive (mutable):** the derivation controls the scene exposes (§5), shared by all
  slides in the scene and **persisted while the reader stays in it**.
- **Reset policy (A).** Returning to an **already-visited** scene restores its remembered control
  state (faithful Back/Forward, held in session + the URL query, §4); entering a scene for the
  **first time** initialises it from the authored global defaults, independent of tweaks made in
  another scene.

---

## 4. Navigation & routing

- **Advance model.** The reader moves with **Next / Back** buttons, **keyboard** (←/→, PgUp/PgDn),
  and **scroll/swipe**. A **progress indicator** shows position in the eight-slide sequence. Advancing
  is the deck's top-level interaction.
- **Single persistent route.** `/story/:slug` maps to one `StoryPage` component that does **not**
  remount between slides; a reactive `currentIndex`/`slug` drives which slide renders. Each slide
  advance is a `router.push` (so browser **Back/Forward** traverse slides). The six slugs are
  `intro · main · main-sink · crossing · footprint · deforestation-insight · baseline · baseline-impact` (§3.1).
- **Control state in the URL query.** A scene's control values live in the query
  (e.g. `/story/main?domain=amazon&baseline=2005`), defaulting when absent — so a configured slide is
  shareable/bookmarkable and SSR renders exactly the requested state (ADR-017). The **time range**
  (`dataZoom`) stays out of the URL (pure view state), like before.
- **Prefetch.** On idle, the deck prefetches the **next** slide's DTO(s) so forward navigation is
  instant; already-fetched DTOs are served from the store cache (ADR-005).

---

## 5. Controls (per scene)

Controls are attached to **scenes**, not to a global control bar. All write to Pinia; a control that
affects derivations triggers a (cached/deduped) fetch (ADR-005). A control that is a client-only view
(`dataZoom`) never refetches.

| Control | Component (PrimeVue) | Values | Scene(s) | Effect |
|---|---|---|---|---|
| **Time horizon** | SelectButton | today / +20 / +30 / +50 / +75 / +100 y | `main`, `footprint` | Sets the window's **upper edge**; *today* = last measured year, others extend a dashed forward projection (business §2.4a). Refetches (server projects). Default **today**. In the footprint scene it is the upper edge of the equivalence strip's window (§6.7). |
| **Domain** | Select | Global (default) · Amazon · Congo Basin · SE Asia · Other tropical | `main` | Narrows the global aggregate to one domain (or back to global). Refetches. |
| **Baseline year** | **year Slider** (real-time) | **1800 … latest** | `main`, `crossing`, `footprint` | Start year of cumulative loss (window **lower** edge). **1800–present**: 1990→latest is measured, **1800–1990 is the LUH2 reconstruction (drawn dashed)**; explicit label "forgone sink from loss after {X}", and a "reconstructed before 1990" note when dragged below 1990. Default **1990** (reconstructed↔measured boundary). **Client-transform — no refetch** (ADR-026): dragging recomputes the curves **in real time** via the isomorphic derive layer; synced to the URL for sharing. In the footprint scene it is the lower edge of the equivalence strip's window (§6.7). |
| **Time range (zoom)** | ECharts `dataZoom` (slider + inside) | any sub-range | `crossing` | **View state only — no refetch, no data crop** (`viewStore.timeRange`); a **reset-to-full** affordance. Helps frame the crossing. |
| **Unit** (equivalence) | SelectButton | Mt CO₂ / car / country | `footprint` (slide 6) | **View state only — no refetch** — which unit the equivalence strip renders all four values in (§6.7). Locale-driven country (SVK/UK). Default **car**. Not in the URL. |
| **Language** | Select in header | SK / EN | (deck-wide) | Switches locale; persisted via cookie. |

- **`R` scenario** is a valid derivation axis (conservative / mid / high, default mid) but is **not
  surfaced as a deck control in V1** — every slide uses `mid`. It stays in the params for a later
  slide (business §4.1/§4.6).
- **View:** the deck surfaces **only the global view** — the global aggregate with domains as stacked
  layers. There is no scope/domain selector and no per-domain view; domains are an internal server-side
  building block (business §4.6).

**Interaction rules.**
- The **footprint scene surfaces `baseline` + `horizon`** (slides 5 and 6, shared per-scene, reset
  policy A). `horizon` refetches; **`baseline` re-derives client-side in real time (no refetch, ADR-026)**;
  both set the equivalence strip's window (§6.7). The **unit** switcher (slide 6) is a client-only view
  toggle (no refetch, not in the URL).
- Every scene renders the **global aggregate** (domains as stacked layers); there is no per-domain view.
- The **time horizon** is the control that refetches (part of the derivation
  signature); the **baseline slider** (client-transform, real-time re-derive — ADR-026) and the
  **time-range zoom** never refetch and never manipulate the fetched series.
- Controls never produce contradictory states (no layer checkboxes — which metrics show is authored
  per slide, §3.3).
- Changing the **domain** resets the crossing scene's `timeRange` to full on entry (domains/global
  span different x-ranges); more precisely, entering a scene applies reset policy A (§3.3).

---

## 6. The visualisations (per scene)

### 6.1 Main scene (slides 2–3) — the reveal
A **stacked time-series chart**, shared across slides 2 and 3.
- **Slide 2:** **stock only** (WB `.DF`, solid) — the reported picture. Controls (horizon, domain,
  baseline) are live; the text block explains the measured series.
- **Slide 3 (same instance, animated):** the **forgone sink** layer (derived `R × cumulative loss`,
  dashed + uncertainty band) animates in **on top** of the stock, producing the full picture (total
  Y = stock + forgone sink). The text block updates to explain that the reported number was only the
  visible part.
- **Global stacked area.** The chart is a **stacked area** whose layers are the
  four domains plus the aggregate forgone sink and **one aggregate band** (not per-domain bands,
  business §3).
- **Projection.** A future horizon extends every layer past the last measured year as a lighter dashed
  projection with a join-year divider (§6.4). The forgone sink is always present once on slide 3 (no
  "official" mode strips it).

### 6.2 Crossing scene (slide 4)
A single **crossing chart** (fresh mount): the annual one-off **stock** release (impulse, ~flat) vs.
the **forgone sink** as a cumulative-driven level (`R × cumulative area loss`, rising); in year **N**
the forgone sink overtakes the stock. The crossing sits **beyond the measured window**, so the scene
exposes the **time-range** zoom (to frame it) and the **baseline** control; the data is **forced
global** (business §4.4). A marked crossing point + join-year divider. Text block below.

### 6.3 Footprint scene (slides 5–6) — the zoom
Two visualisations side by side, shared across slides 5 and 6. **Both slides surface `baseline` +
`horizon`** in the quiet controls row (shared per-scene; §5). Slide 5 uses `duo-viz-text`; slide 6 uses
`duo-viz-equiv` (§3.2) — a thin caption instead of the text block, plus the equivalence strip (§6.7).
- **Slide 5:** left = **composition donut** of the total carbon footprint with **three slices**
  (fossil, one-off deforestation stock, forgone sink); right = **deforestation-vs-fossil bar** — total
  deforestation emissions (stock + forgone sink) next to global fossil emissions. Both integrate over
  the forward window `[referenceYear, referenceYear + horizonYears(horizon)]` anchored at the
  reference year (§9a) — the single measured year at *today*, growing with the horizon.
- **Slide 6 (same instances, animated → `deforestation-insight`):** **fossil is removed from both**
  visualisations. The donut animates from three slices to **two** (stock + forgone sink); the bar
  drops fossil and the Y-axis rescales so the remaining deforestation composition "zooms in." A
  full-width **equivalence strip** appears at the foot (§6.7). The layout change from slide 5 does
  **not** remount the donut/bar (stable `viz` outlet, §7).
- **Bar restructure (binding).** The deforestation bar's slide-5 metric *includes* the forgone sink
  inside one "full emissions" total; for the 5→6 animation the forgone sink is pulled out and shown as
  its **own component** (a separate bar or a stack layer over the stock) in place of fossil — landing
  on the same green/amber grammar as the main chart. To make this a single smooth `setOption` (not a
  reload), the deforestation-vs-fossil chart is drawn as **one grid with two categories**
  (deforestation, fossil) sharing **one Y-axis**, not the two separate side-by-side grids of the old
  dashboard. The shared scale is enforced by a helper, not ECharts auto-scale (§11, tech spec §11.2).

### 6.4 Projection rendering (dashed future) — binding contract
Applies to the time-series charts (main, crossing). Beyond the last measured year each series
continues into the chosen horizon as a **dashed projection** (business §2.4a). ECharts cannot switch a
single line solid→dashed mid-series (no per-segment dash; `visualMap` only recolours), so the
projection is a **separate series per metric**:
- **Starts at the join year** (the last measured year, shared point) so measured and projected meet
  with no gap.
- **Same colour** and **same stack id/order** as its measured metric, so stacked layers keep their
  arrangement.
- **`estimateStyle` dashed**, rendered lighter (reduced opacity) than the measured forgone-sink dash,
  so "measured-but-estimated" (forgone) stays distinguishable from "projected" (future).
- **Excluded from the legend** via a `legend.data` allowlist (a continuation, not a new metric).
- A **join-year divider** (`markLine`) signals where measurement ends; absent at horizon *today*.

### 6.5 Chart interactions (tooltip, legend)
- **Tooltip.** A **shared-axis tooltip**: hovering a year shows every layer's value with its unit and
  estimate/measured marker, plus the "data as of {X}" note (§9a). Numbers via the injected `Formatter`.
- **Legend.** Display-only, **not clickable.** Which metrics render is authored per slide (§3.3), so a
  clickable legend would create a contradictory state. The legend lists only the real metrics — the
  invisible band-bound helper series and the dashed projection continuations are excluded via the
  `legend.data` allowlist.

### 6.6 Multiplier ×N
Shown in the `main` scene alongside the chart **from slide 3** (once the forgone sink is present):
**Σfull ÷ Σstock** over the forward window `[referenceYear, referenceYear + horizonYears(horizon)]`
(§9a) for the current domain/baseline — how many times the true cumulative impact exceeds the
officially reported number over that horizon. **Always shown while in the main scene** (there is no
"official" mode). **Horizon-reactive**: at *today* the window collapses to the reference year and ×N
reduces to the measured annual ratio (continuity); a longer horizon grows both edges of the ratio.
The badge caption reads "full vs reported at {year}" at *today* and "full vs reported, {from}–{to}"
over a window. Sourced from Pinia (server-derived). A single instance (not duplicated in the header).

### 6.7 Equivalence strip (slide 6 only)
A **full-width strip at the foot of slide 6** (the `duo-viz-equiv` preset's `equivalence` slot,
ADR-025). It is a redesign of the old equivalence panel (previously deferred, §8): instead of the
annual-rate/committed-total pair it presents **four colour-coded figures**, each derived reactively
from the footprint scene's Pinia state (its `horizon` window + the loaded global aggregate),
so it moves with the same control that drives the two charts above it. No refetch beyond those controls.

- **The four figures** (**symmetric window** = from the `baseline` year to the chosen `horizon`'s target
  year, the same window the donut and fossil bar sum over), colour-matched to the chart grammar so a
  glance ties each number to a layer above:
  1. **Stock over the window** — **green** (`data.stock`, the exact colour of the stock slice/bar).
  2. **Forgone sink, annual** at the last measured year — **amber** (`data.forgoneSink`).
  3. **Forgone sink over the window** (the TRUE finite integral `Σ` of the annual rate over the window,
     business §2.4 #2) — **amber** (`data.forgoneSink`).
  4. **Combined total** = stock + forgone sink over the window — a **red-adjacent** colour
     (`data.total`), deliberately distinct from the error red so it never reads as a fault (design §2.3).
- **Unit switcher.** A small segmented control toggles the unit for **all four** figures at once:
  **Mt CO₂ · one passenger car's annual emissions · one country's annual emissions** (locale-driven:
  Slovakia in SK, the UK in EN — as today). **Default: cars.** Pure view state (no refetch, not in the
  URL); the country re-resolves on language change with no data refetch.
- **Framing.** Numbers via the injected `Formatter`; units are localized labels. The strip surfaces the
  "data as of {referenceYear}" note for the annual figure (§9a). It is real DOM text (accessible),
  not only in-canvas.

---

## 7. In-place animation contract (chart identity)

The reveal (2→3) and the zoom (5→6) are the deck's signature moments and depend on **stable chart
identity**:
- Every visualisation in a slide carries a stable **`viz.id`** (e.g. `main`, `crossing`, `donut`,
  `fossil`). **Sibling slides in a scene reuse the same `viz.id`** for the same chart → the Vue/ECharts
  instance is **preserved** and only its `:option` changes → ECharts `setOption` **animates** the
  difference (a new series fading/growing in; a removed series shrinking out; axes rescaling).
- A **different `viz.id`** (or none) across a boundary → a **fresh mount** (no morph).
- **No shared-element morph across layout changes** in V1 (e.g. a chart does not fly from one preset
  slot to another) — animation is only the within-scene `setOption` diff.
- **Layout-preset change ≠ remount (ADR-025).** Slide 6 changes preset (`duo-viz-text`→`duo-viz-equiv`)
  *and* adds the equivalence strip, yet the donut/bar must still animate. This holds **because
  `SlideLayout` renders the `viz` slot outlet unconditionally** (same vnode position for every preset;
  only the surrounding `caption`/`text`/`equivalence` slots and CSS differ). The `viz.id`-keyed charts
  therefore keep their instances and only `setOption`-animate. A structural `v-if` fork or a separate
  slide-6 layout component would relocate the outlet and re-init ECharts (losing the zoom) — forbidden.
  Adding the strip in its own slot never touches chart identity.

This is a **binding contract** with the technical spec's story-orchestration layer (tech spec §17).

---

## 8. Slide / scene matrix (authoritative visibility rules)

This table is the single source of truth for what renders on each slide; the frontend must implement
exactly this. It replaces the old scope×accounting mode matrix.

| Element | 1 intro | 2 main | 3 main-sink | 4 crossing | 5 footprint | 6 defo-zoom |
|---|---|---|---|---|---|---|
| Heading + body text | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Caption line (top, no heading) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Global stacked chart | ✗ | ✓ (stock) | ✓ (stock + forgone) | ✗ | ✗ | ✗ |
| Crossing chart | ✗ | ✗ | ✗ | ✓ (global) | ✗ | ✗ |
| Composition donut | ✗ | ✗ | ✗ | ✗ | ✓ (3 slices) | ✓ (2 slices) |
| Defo-vs-fossil bar (one grid, two categories) | ✗ | ✗ | ✗ | ✗ | ✓ (with fossil) | ✓ (fossil removed) |
| Equivalence strip (4 values, unit switcher) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Multiplier ×N | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Horizon control | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ |
| Baseline control | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Time-range zoom | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Unit switcher (equivalence) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Forgone-sink layer + band | ✗ | ✗ | ✓ | ✓ | ✓ (as slice) | ✓ (as slice) |

The **equivalence panel** is restaged (redesigned) as the slide-6 equivalence strip (§6.7, ADR-025).

---

## 9. States: loading, empty, gaps, error

- **Loading.** Each data-driven visualisation has a skeleton/spinner bound to the store's per-request
  loading flag; charts show `BaseChart`'s `loading` state rather than remounting (preserves identity,
  §7). Prefetch (§4) makes most forward moves land warm.
- **Data gaps (honesty).** Emission series often end 1–2 years before the present; some member
  countries/indicators may be missing. Gaps are surfaced: the UI shows the **year of the value**, and
  a small note marks partial coverage (from `meta`). A domain with a missing member degrades
  gracefully (recorded gap), it does not fail.
- **Empty.** If a combination genuinely has no data, a localized empty state explains why (e.g.
  baseline beyond available data).
- **Error.** A failed fetch shows a localized, retryable error for that visualisation only; the rest
  of the slide stays usable (per-region isolation, ADR-010).

### 9a. Reference year (composite scalars)
Composite figures (multiplier, donut composition, share %, fossil bar, equivalence totals) are
**anchored** at a single **reference year** = the most recent year where all required series have a
value (business §7.1a). The UI always surfaces it ("data as of {X}"). They integrate over the forward
window `[referenceYear, referenceYear + horizonYears(horizon)]` — collapsing to the reference year at
*today* and growing with the horizon — while pointwise figures (full-emissions level, equivalence
annual rate) stay at the measured reference year. Time-series charts still render each series over its
full range.

---

## 10. Deck flow (reader perspective)

1. **First load.** The app detects locale (SK/EN), applies dark theme, resolves the slide from the
   `/story/:slug` route (default `intro`), and reads any scene control state from the URL query
   (ADR-017), else the authored defaults (**global · mid · baseline 1990 · horizon today**). SSR
   renders the slide; charts hydrate client-only. The next slide's data prefetches on idle.
2. **Slide 1 — Intro.** A short heading + framing copy: the visible stock vs. the hidden forgone sink.
   The reader advances.
3. **Slide 2 — the reported picture.** The main chart shows **stock only**. The reader can already
   explore with horizon / domain / baseline. Advancing to slide 3 keeps the chart and these controls.
4. **Slide 3 — the hidden cost.** The **same chart animates** the forgone sink in on top; the `×N`
   multiplier appears. The text explains the reveal. Controls hold their state from slide 2.
5. **Slide 4 — the crossing.** A fresh crossing chart, **global**. The reader uses the time-range zoom
   (and baseline) to frame where the rising forgone sink overtakes the flat stock impulse.
6. **Slide 5 — the footprint.** Donut (3 slices) + the defo-vs-fossil bar, showing deforestation
   against fossil over the forward window anchored at the reference year (§9a).
7. **Slide 6 — the zoom.** The **same** donut + bar animate: **fossil is removed**, the axis rescales,
   and the deforestation composition (stock + forgone sink) fills the view. A thin caption sits on top;
   `baseline` + `horizon` carry over from slide 5; a full-width **equivalence strip** (§6.7) at the foot
   restates the footprint as four colour-coded figures with a unit switcher (Mt CO₂ / cars / country) —
   the closing insight.
8. **Read methodology / switch language, anytime.** The disclosure explains estimate vs. measured, the
   lower-bound stance, the three `R` caveats and the two-methodology note; language switches all copy,
   labels, chart text, units and formats and persists.

Back/Forward (browser or Back button) return to a visited slide with its remembered scene state
(reset policy A, §3.3).

---

## 11. Component inventory (frontend, for the technical spec)

Reusable, series-agnostic where possible; charts follow ADR-007. Exact composition/props are
finalized in `03-technical-specification.md`.

- **Deck shell:** `StoryPage` (single persistent route target), `SlideLayout` (renders one of the four
  layout presets from slots — `text`/`viz-text`/`duo-viz-text`/`duo-viz-equiv`, with the `viz` outlet
  rendered unconditionally, §3.2/§7), `DeckNav` (Next/Back), `ProgressIndicator`, `SlideHeading`,
  `SlideText`, `SlideCaption` (slide-6 top line), `AppHeader`, `LanguageSwitcher`,
  `MethodologyDisclosure`, `MultiplierBadge` (main scene), `EquivalenceStrip` (slide 6, §6.7).
- **Controls:** `HorizonSelect` (SelectButton: today/+20/…/+100 y),
  `BaselineSlider` (real-time 1800–latest, dashed pre-1990, client-transform — ADR-026),
  `TimeRangeZoom` (ECharts `dataZoom`), `UnitToggle` (equivalence strip:
  Mt CO₂ / car / country, slide 6). Placed by the scene, not a global bar. (No fossil-reference, no
  accounting, no scope/domain selector — §5.)
- **Charts (tier 2, per-chart components over `BaseChart.vue`, Pinia-unaware):**
  `GlobalStackedAreaChart` (global aggregate, domains as stacked layers), `CrossingChart`,
  `FootprintDonut` (3-slice → 2-slice), `FossilComparisonChart` (**one grid, two categories**, shared
  Y-scale). Time-series charts render measured solid + a dashed **projection continuation** series per
  metric, excluded from the legend (§6.4). The equivalence data is presented by the slide-6
  `EquivalenceStrip` (§6.7); the old `EquivalencePanel` component has been removed (ADR-025).
- **Chart base (tier 1):** `BaseChart.vue` wrapping `<VChart>` (autoresize, loading, theme).
- **State/feedback:** `LoadingSkeleton`, `DataGapNote`, `EmptyState`, `ErrorRetry`.
- **Formatting:** an injected `Formatter` (abstract base + V1 `CompactNumberFormatter`: `3.2M`,
  `×3.2`); every rendered number passes through it, never inline (ADR-018); bound via `useFormatter()`.

All display values arrive via props from Pinia getters; chart-option construction happens inside each
Pinia-unaware chart component from its typed props + the `useChartContext` bundle supplied by the
scene/shell parents (ADR-007/009). No component fetches or stores data locally.

---

## 12. Responsiveness & accessibility (V1 baseline)

- **Breakpoints** drive: layout-preset reflow (side-by-side → stacked for `duo-viz-text` on narrow
  viewports), and responsive chart-option tweaks (label rotation, legend position, grid margins)
  passed into option classes via context.
- **Charts** use `autoresize`; containers are fluid; identity is preserved across resizes (§7).
- **Accessibility baseline:** keyboard-operable deck navigation (←/→, PgUp/PgDn) and controls
  (PrimeVue defaults), sufficient dark-theme contrast, ARIA labels on the signature controls and the
  Next/Back affordances, and text alternatives / accessible summaries for key chart numbers (the
  multiplier is real DOM text, not only in-canvas). Respect `prefers-reduced-motion` (drop the
  in-place transitions, swap immediately). Full a11y depth is a later-round concern.

---

## 13. Open UI items (defer to the dedicated design round)

- Exact grid/layout, spacing, transition choreography, and final visual design of each slide and the
  deck shell (the design doc, 04, owns tokens/motion).
- Exact chart forms: the stacked area + aggregate band (global), the domain stacked chart, the
  crossing rendering, the donut (3→2 slice) and the one-grid-two-category defo-vs-fossil bar, and the
  exact styling of the dashed projection + join-year divider (§6.4).
- The progress indicator's exact form and the scroll-vs-buttons emphasis.
- Whether/when to add a deck slide for the dormant correlation view.
- The local **"side by side" stock-vs-forgone variant** of the domain chart (deferred from V1; the
  main chart ships stacked-only).
