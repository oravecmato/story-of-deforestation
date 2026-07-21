# Design Proposal (V1) — The Hidden Carbon Cost of Deforestation

**Status:** first proposal, to be iterated. Concrete values here are *provisional defaults* that make
the abstract `ThemeTokens` (tech spec §13) real; nothing here changes a locked decision — it dresses
them. Where this doc sets a number (hex, px, ms), read it as "starting point, revisable".

Scope: this is the **visual + layout** layer the UI spec (doc 02) deliberately left out (it is
behavior-level, not pixel-level). No component code yet.

---

## 1. Design intent

A serious, quiet, data-first portfolio piece — the *restraint* is the statement. The interface is a
**guided linear story** ("Story of Deforestation" / "Príbeh deforestácie", business §4), not a
composer dashboard: **one slide at a time**, a visualisation with a **text block below it**, advanced
by Next/Back. The interface should feel like an honest instrument narrating an argument, not a
dashboard shouting. The dramatic moments are the **two in-place animations** the deck stages — the
**forgone sink revealing itself** on top of the reported stock (slide 2→3), and **fossil dropping
away** from the footprint so only deforestation remains and the axis zooms in (slide 5→6). Everything
else stays calm so those moves land.

Three principles, inherited and made visual:
1. **Honesty is legible.** Measured vs. estimated is encoded in *line style* (solid vs. dashed), and
   non-measured time — the **projected future** *and* the **reconstructed past (pre-1990, ADR-026)** — in
   a further *lighter dashed* step — never buried in a caption.
2. **The story leads; controls are quiet.** No hero control bar — the reader advances slides; the few
   per-scene controls (horizon, domain, baseline, time-range) sit unobtrusively near the chart and
   never compete with the narration. The chart itself carries the drama via the two authored reveals.
3. **Dark, restrained, tabular.** Dark-only V1 (ADR-002); numbers are international compact
   (`3.2M`, `×3.2`, ADR-018) in tabular figures so columns align and magnitudes read at a glance.

---

## 2. Color tokens (dark, provisional)

Maps 1:1 onto `app.config.ts → ThemeTokens`; PrimeVue Aura dark and the ECharts `themeColors()` both
consume these (tech spec §13), so chrome and charts share one source.

### 2.1 Surfaces & text
| Token | Hex | Use |
|---|---|---|
| `bg.base` | `#0D1117` | app backdrop |
| `surface.1` | `#161B22` | panels, canvas card |
| `surface.2` | `#1C232D` | raised controls, tooltip, popovers |
| `border.hairline` | `rgba(255,255,255,0.08)` | panel borders, dividers |
| `border.strong` | `#2A313B` | control outlines, focus track |
| `text.hi` | `#E8ECF2` | headings, headline numbers |
| `text.mid` | `#A7B0BD` | body, axis labels |
| `text.low` | `#6E7681` | captions, data-year notes, disabled |
| `accent` | `#3FB6A8` | focus ring, active toggle, links, crossing marker |

### 2.2 Data-layer semantics — the crux
The whole thesis is a color+style grammar, consistent across **every** panel so a color learned in the
donut is the same series in the time chart:

| Series | Fill/line color | Line style | Meaning |
|---|---|---|---|
| **Stock** (WB `.DF`, measured) | forest green `#5FBE6E` | **solid** | the *reported* number |
| **Forgone sink** (derived `R × loss`) | amber `#E8A13A` | **dashed** + translucent band `alpha .18` | the *hidden* cost — estimate + CI |
| **Projected future** (either metric, past the join year) | same color, **opacity ×0.55** | **dashed, lighter** | extrapolated "dummy" data — not measured |
| **Reconstructed past** (either metric, before 1990) | same color, **opacity ×0.55** | **dashed, lighter** | LUH2 back-projection 1800–1990 (ADR-026) — not measured |
| **Fossil reference** (denominator) | muted slate `#5B6B7F` | solid, desaturated | context, deliberately not a hero |
| **Full emissions** | (stock green + forgone amber, stacked) | — | no new color; the amber layer *added on top* (always shown) |

Rule, stated once and never broken: **solid = measured, dashed = estimate, lighter-dashed = projected
OR reconstructed (non-measured); green = deforestation measured, amber = the derived hidden cost.** That
single rule carries the argument without a legend sentence. The lighter-dashed style is symmetric in time:
the **projected future** (past the last measured year) and the **reconstructed past** (before 1990, ADR-026)
share it. Two **join-year dividers** mark the boundaries — the last measured year (projection start) and
**1990** (reconstruction start, only visible once the baseline slider is dragged below 1990) (§7). Donut
slices reuse the exact three: fossil slate / stock green / forgone-sink amber (always 3 slices, measured
data only).

### 2.3 State colors
Kept minimal (this isn't a status app). **Split from the data layer (iteration #2):** data amber
`#E8A13A` is a **data-layer color only — never a UI state**, so the forgone-sink layer can never read
as a warning. Caveats, data-year and methodology notes use `text.low`; genuine problems (fetch fail,
data gap) use error red `#E5534B`. No separate `warn` token and no `success` in V1.

### 2.3a Combined-total color (`data.total`, iteration 5 / ADR-025)
The slide-6 equivalence strip (§6) shows a fourth figure — the **combined total** (stock + forgone
sink over the window). It gets its own **data-layer** token `data.total`: a **red-adjacent** hue that is
deliberately **distinct from the error red** `#E5534B` (proposed `#CE5B4E`, a warm terracotta —
`revisable`), so "everything added up" reads as *weight/severity of the figure*, never as a fault
state. Like the amber rule, `data.total` is a **data color only, never a UI state**. It joins
`data.stock` (green) and `data.forgoneSink` (amber) in `ThemeTokens.data`.

---

## 3. Typography

- **UI & copy:** Inter (variable), system-ui fallback.
- **Numbers & headline stats:** Inter with `font-variant-numeric: tabular-nums`; the **multiplier
  badge** and big scalar readouts use **IBM Plex Mono** (or Inter tabular if we want one family) so
  `×3.2` reads as an instrument reading, not prose.
- Scale (px / line-height): display 40/48, h1 24/32, h2 18/26, body 14/22, caption 12/18, micro 11/16.
- Weights: 600 headings, 500 controls/numbers, 400 body. Letter-spacing −0.01em on display only.

---

## 4. Space, shape, elevation

- **Base unit 4px**, 8-grid for layout. Panel padding 20–24px, control gap 12px.
- **Radii:** panels 10px, controls 8px, the horizon selector is a **pill** segmented control (fully rounded).
- **Elevation** via surface step + hairline border, **not** heavy shadows (flat dark aesthetic). One
  soft shadow reserved for popovers/tooltip only.
- Max content width **1360px**, 12-col grid, 24px gutter, centered.

---

## 5. Layout

The deck is a **single persistent shell** (tech spec §17, ADR-023): a slim header, one **slide stage**
that swaps content as the reader advances, and deck navigation. There is **no** control bar / side rail
/ secondary grid — every visualisation lives inside a slide, and the copy sits **below** it. Slides use
one of **four closed layout presets** (tech spec §11/§17): `text`, `viz-text`, `duo-viz-text`,
`duo-viz-equiv` (slide 6, ADR-025).

### 5.1 Deck shell (desktop ≥1120px)
```
┌───────────────────────────────────────────────────────────────────────┐
│ HEADER  Story of Deforestation · slide 3 / 6            SK|EN · Method▸ │
├───────────────────────────────────────────────────────────────────────┤
│  SLIDE STAGE (centered, max 1360)                                       │
│                                                                         │
│   ┌── viz-text ──────────────┐   ┌── duo-viz-text ───────────────────┐  │
│   │  [ scene controls ]  ×3.2 │   │  ◐ donut        ▐ defo | fossil ▌  │  │
│   │  ┌──────────────────────┐ │   │  ┌──────────┐   ┌──────────────┐  │  │
│   │  │  main chart (viz.id) │ │   │  │  (viz.id)│   │   (viz.id)   │  │  │
│   │  └──────────────────────┘ │   │  └──────────┘   └──────────────┘  │  │
│   │  Heading                  │   │  Heading                          │  │
│   │  full-width text block …  │   │  full-width text block …          │  │
│   └───────────────────────────┘   └───────────────────────────────────┘  │
│                                                                         │
├───────────────────────────────────────────────────────────────────────┤
│  ◀ Back            ● ● ○ ○ ○ ○  (progress)                     Next ▶   │
└───────────────────────────────────────────────────────────────────────┘
```
- **Header** is slim: deck title, an unobtrusive `slide N / 6` progress read-out, `SK|EN` toggle, and
  the "Methodology ▸" disclosure. No control bar.
- **Slide stage** renders the active preset. `text` (slide 1) = heading + framing lines, no viz.
  `viz-text` (slides 2–4) = one chart above a full-width text block. `duo-viz-text` (slide 5) =
  donut (left) + deforestation-vs-fossil (right) above the text block. `duo-viz-equiv` (slide 6,
  ADR-025) = a thin caption line, the controls row, the same donut + bar (which may **shrink** to make
  room), and a **full-width equivalence strip** at the foot — **no** text block:
```
   ┌── duo-viz-equiv (slide 6) ───────────────────────┐
   │  "…deforestation stops looking so insignificant…"  │  ← caption (one line)
   │  [ baseline · horizon ]            [Mt CO₂|car|ctry]│  ← controls + unit switch (right)
   │  ┌── ◐ donut ──┐  ┌── ▐ defo bar ──┐               │  ← two vizzes (can shrink)
   │  └─────────────┘  └────────────────┘               │
   │  ┌──────────────── equivalence strip ────────────┐ │
   │  │ ▮stock/window  ▮sink/yr  ▮sink/window  ▮TOTAL │ │  ← 4 colour-coded figures
   │  └───────────────────────────────────────────────┘ │
   └────────────────────────────────────────────────────┘
```
  If vertical space is tight, height comes off the **viz cards** first (primitive charts), never the
  strip. The `viz` slot outlet is the *same* element as `duo-viz-text`, so the 5→6 charts are preserved
  and only animate (§7, tech spec §17.2).
- **Scene controls** sit as a quiet inline row **just above the chart** — only what the scene surfaces
  (main: horizon · baseline; crossing: time-range · baseline). Small, `text.mid`, never a
  hero bar. Every scene renders the global aggregate (domains as stacked layers).
- **Multiplier badge (`×N`)** appears **from slide 3** (when the forgone sink is revealed), top-right
  of the main chart — `Σfull ÷ Σstock` over the forward window `[referenceYear, referenceYear +
  horizonYears(horizon)]`, never a trivial "×1". Absent on slide 2 (stock only).
- **Deck nav:** Back / Next + a dot **progress indicator**; also keyboard (←/→) and scroll. The route
  is one persistent `/story/:slug`; the stage swaps, it does not reload (ADR-023).

### 5.2 Tablet (768–1119px)
Slide stage stays single-column and centered; `duo-viz-text`/`duo-viz-equiv` **stack** the two vizzes
(donut above the bar) then the text block or equivalence strip. On `duo-viz-equiv` the strip's four
cells wrap to a **2×2** grid. Scene controls wrap to a compact row above the chart; the six horizon
segments may condense to a `▾ horizon` select. Deck nav stays pinned at the bottom.

### 5.3 Mobile (<768px)
Single column, full-bleed charts to card edges. `duo-viz-text`/`duo-viz-equiv` are fully stacked; the
equivalence strip's cells stack **2×2** (or 1-up if very narrow), staying above the deck nav. Scene
controls become a compact row / disclosure above the chart. Deck nav is a bottom bar (Back · dots ·
Next); swipe gestures may advance slides. `dataZoom` slider retained (touch), inside-zoom enabled on
the crossing.

---

## 6. Component treatment

- **Header:** small — deck title `h1`, an unobtrusive `slide N / 6` read-out, right-aligned `SK|EN`
  segmented toggle and a "Methodology ▸" text link (opens the disclosure). No nav, no logo chrome.
- **Slide layout (`SlideLayout`):** the viz sits in a `surface.1` card (hairline border, radius 10);
  the **text block is full-width below it** with an optional `h2` heading above the copy. `duo-viz-text`
  places two cards side-by-side above the shared text block. Text is `text.mid` body, generous measure.
- **Deck nav (`DeckNav` + `ProgressIndicator`):** Back / Next as quiet text/icon buttons at the stage
  foot; a dot progress indicator (filled = visited, `accent` = current). Keyboard ←/→ mirror them.
- **Scene controls (inline, quiet):** a small `text.mid` row just above the chart, only what the scene
  surfaces:
  - **Horizon (`HorizonSelect`):** a compact segmented pill `today · 20y · 30y · 50y · 75y · 100y`,
    `today` default; active segment accent-tinted `surface.2` + `text.hi`; labels are i18n keys
    ("+20 rokov" / "+20 years"). Main scene only. On narrow widths condenses to a `▾ horizon` select.
  - **Baseline (`BaselineSlider`):** a real-time year slider, floor **1800** … latest, "from loss after
    **{year}**"; the track visually splits at **1990** (measured right / reconstructed left, a dashed/
    lighter track segment) so the reader feels when they cross into the LUH2 back-projection. Dragging
    re-derives the curves live with no refetch (client-transform, ADR-026).
  - **Time-range (`TimeRangeZoom`):** the crossing scene's `dataZoom` control (§7); pure view state.
  - **R scenario is NOT surfaced in the V1 deck** (tech spec §17.1) — it stays a param at its `mid`
    default. (When later surfaced it would be a muted 3-segment control, secondary to the others.)
- **Multiplier badge:** mono `×3.2`, `text.hi` on `surface.2`, accent hairline; a caption key beneath
  — `multiplier.caption` "full vs reported at {year}" at *today*, `multiplier.captionWindow` "full vs
  reported, {from}–{to}" over a window. **Appears from slide 3** with the forgone-sink reveal;
  **horizon-reactive** (window ratio), so it counts up as the horizon lengthens.
- **Panels:** `surface.1` card, hairline border, radius 10, a `h2` title + optional `text.low`
  data-year note ("data to 2023"). The reference-year note lives here (ADR-016).
- **Equivalence strip (`EquivalenceStrip`, slide 6 — §6.7 UI):** a full-width `surface.1` bar at the
  slide foot, hairline top border, holding **four stat cells** in a row. Each cell = a big **mono**
  number (IBM Plex Mono / tabular) over a small `text.mid` caption; a **left colour rule / dot** ties
  the cell to its layer — `data.stock` green (stock/window), `data.forgoneSink` amber (sink/yr and
  sink/window), `data.total` terracotta (combined total, the visually heaviest cell). Numbers via the
  injected `Formatter`; units are localized labels appended by the caller. A small `text.low`
  "data as of {referenceYear}" note sits under the annual cell. On narrow widths the four cells wrap to
  a **2×2** grid (§5.2/§5.3).
- **Unit toggle (`UnitToggle`):** a compact segmented pill at the strip's top-right (mirrors
  `HorizonSelect`'s treatment) — `Mt CO₂ · car · country`, active segment accent-tinted `surface.2` +
  `text.hi`, **default car**. Switching it retints/relabels **all four** cells at once (pure view
  state; the country segment's label follows the locale — Slovakia / UK).
- **Legend:** display-only, inline under the title, using the §2.2 swatches (solid green / dashed
  amber / slate). The **projected twin series carry no legend entry** — one entry per metric,
  regardless of horizon. Non-interactive by decision — the deck's slide reveal is what changes which
  layers show, not a legend toggle.

---

## 7. Chart styling (ECharts conventions)

- Background transparent (inherits the panel `surface.1`); no chart-level border.
- **Gridlines:** horizontal only, `rgba(255,255,255,0.05)`; no vertical grid; axis line hidden, ticks
  hidden, axis labels `text.mid` 12px tabular.
- **Series:** stock = solid green area (stacked base); forgone sink = dashed amber line with a
  `alpha .18` amber confidence band (asymmetric-aware, tech spec §5); fossil = solid slate.
- **Projected tail:** past the join year each metric continues as a **separate series** of the same
  color at **opacity ×0.55**, dashed (ECharts cannot dash mid-line — tech spec §11.1/ADR-019). The
  band, if drawn into the projected range, drops to a fainter fill.
- **Reconstructed head (pre-1990):** symmetrically, below 1990 each metric is a **separate series** at
  **opacity ×0.55**, dashed (LUH2 back-projection — tech spec §11.1/ADR-026), only present when the
  baseline slider sits below 1990; the band drops to the same fainter fill.
- **Join-year dividers:** thin `text.low` vertical `markLine`s (dotted, no symbol) — one at the last
  measured year with a "projected →" caption (absent at `horizon='today'`), and one at **1990** with a
  "← reconstructed" caption (absent when the baseline sits at/above 1990).
- **Tooltip:** shared-axis (UI §4.4), `surface.2` card, hairline border, one soft shadow, mono numbers
  via the injected `Formatter`; rows ordered stock → forgone → total, with the `×N` echoed; projected
  years append a "(projected)" `text.low` tag.
- **Crossing marker:** thin accent vertical guide + a small accent dot where the annual stock impulse
  and the cumulative forgone-sink level cross; label in `text.mid`. The extended horizon is what gives
  the chart enough span to reach the crossing (which may sit in the projected tail).
- **dataZoom:** slider (bottom, minimal, accent handles) + inside; a "reset to full range" affordance;
  time range is **per-scene** and resets on scene entry. Pure client view, distinct from the horizon —
  no refetch (ADR-005/023).
- **Footprint donut (slide 5→6):** 3 slices (fossil slate / stock green / forgone amber) on slide 5;
  on slide 6 the **fossil slice leaves** and the remaining two (stock + forgone) grow to fill the ring
  — the donut re-sweeps in place (same `viz.id`, `setOption`).
- **Fossil-comparison bar — one grid, two categories (tech spec §11.2/§16.36):** a single grid with
  two category columns, `deforestation` and `fossil`, on **one shared Y-axis** (via `sharedYAxis()`)
  so they are honestly comparable. On **slide 6** the `fossil` column leaves, the `deforestation`
  column splits its **forgone-sink amber** out as its own stacked layer over the green stock, and the
  single axis **rescales to the deforestation range** — the "zoom in" that makes the hidden cost fill
  the frame. Restructured from the old two-grid design specifically to enable this in-place animation.

---

## 8. Motion

Motion is the deck's argument, so the **two authored in-place animations** are the only expressive
moments; each is a single ECharts `setOption` on a **preserved chart instance** (same `viz.id`, no
remount — tech spec §11.4/§17.3, ADR-022):

- **Reveal the forgone sink** (slide 2→3): the amber dashed forgone-sink line + `alpha .18` band
  **draw on** over the reported green stock; the axis grows to the full-emissions total and the `×N`
  badge fades in. ~**320ms** `cubic-out`. Same DTO/params — no refetch.
- **Remove fossil / zoom in** (slide 5→6): the fossil slate **leaves** both the donut slice and the
  bar's fossil column; the deforestation bar's amber forgone-sink layer separates over green stock and
  the single Y-axis **rescales to the deforestation range**. ~**320ms** `cubic-out`. Same DTO/params.
- **Slide transitions** (Next/Back across scenes): a quiet ~**200ms** cross-fade/slide of the stage
  content; crossing a scene boundary mounts a fresh chart (new `viz.id`).
- **Baseline drag** (real-time slider, ADR-026): the curves re-derive **client-side per frame** (no
  fetch); the pre-1990 dashed segment and the 1990 divider grow/shrink live as the reader drags — a fast,
  low-latency `setOption` (short/no animation so it tracks the pointer), unlike the fetch-then-animate
  horizon/domain change below.
- **Horizon / domain change** (in-scene controls): single `setOption` ~**240ms** `cubic-out`
  on arrival of the (usually cached) DTO — the projected dashed tail extends, the axis rescales, the
  join divider slides.
- Everything else near-instant (≤120ms hovers/focus). **Respect `prefers-reduced-motion`:** drop all
  transitions (including the two authored reveals) and swap state immediately.
- No decorative/ambient animation anywhere — motion only ever communicates a data or reveal change.

---

## 9. Design decisions & open questions

**Resolved (iteration 1):**
- **Amber/warn split (#2):** forgone-sink amber is a **data-only** color; UI states never use it (§2.3).
- **Composition panel (#3):** **donut confirmed**, now **always 3 slices** (single accounting).
- **Green (#4):** the warm "eco" green `#5FBE6E` is **kept** — deliberately approachable, not clinical.

**Resolved (iteration 2):**
- **Number typeface:** **IBM Plex Mono** for the `×N` badge + big scalar readouts; Inter tabular
  everywhere else inline.
- **Tablet control bar:** R-scenario + baseline **collapse behind a disclosure**; the horizon
  selector stays on the hero row (§5.2).

**Resolved (iteration 3 — official↔full → time horizon):**
- **Projected-future style:** measured-vs-projected is a **lighter dashed** step over the existing
  solid/dashed grammar (`opacity ×0.55`), with a **join-year divider** (§2.2/§7). Provisional — the
  lighter-dashed vs. estimate-dashed distinction is `revisable` (business §12).
- **Multiplier badge:** horizon-reactive window ratio — it counts up as the horizon lengthens,
  collapsing to the reference-year scalar at *today*.
- **Time horizon** is retained as an in-scene control of the main scene (not a page hero).

**Resolved (iteration 4 — composer → guided story deck, ADR-021..024):**
- **Layout model:** the sticky control bar + side rail + secondary grid are **removed**; the app is a
  single-route **deck shell** — header · slide stage · deck nav — rendering one of three closed layout
  presets (`text`, `viz-text`, `duo-viz-text`) with the **text block below the viz** (§5/§6).
- **Controls demoted:** no hero control bar; the few per-scene controls sit as a quiet inline row above
  the chart. The app surfaces **only the global view** (no scope/domain selector); R is
  **not surfaced** in V1 (§6).
- **Drama = two authored in-place animations** (same `viz.id`, `setOption`): forgone-sink reveal
  (2→3) and fossil-removal/zoom-in (5→6) — §7/§8. The fossil-comparison bar is restructured to **one
  grid, two categories** to enable the 5→6 animation (§7).
- **Multiplier badge** now **appears from slide 3** (the reveal), not always-on (§5/§6).

**Resolved (iteration 5 — slide-6 insight restage, ADR-025):**
- **Fourth layout preset `duo-viz-equiv`** for slide 6 (§5.1): caption · controls · duo-viz · full-width
  equivalence strip, no text block. The `viz` slot outlet stays the same element as `duo-viz-text`, so
  the 5→6 charts are preserved and only animate (§7).
- **Footprint scene surfaces `baseline` + `horizon`,** shared across slides 5–6 (quiet inline row).
- **Equivalence panel is restaged, not deferred:** a redesigned `EquivalenceStrip` (§6) — four
  colour-coded figures (stock/window green, sink/yr + sink/window amber, combined total terracotta) with
  a `Mt CO₂ · car · country` unit switcher (default car). New data token `data.total` (§2.3a).

No open design questions remain for V1 (the projection-styling nuance and the exact `data.total` hex are
revisable defaults).
