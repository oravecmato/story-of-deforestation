# Design Proposal (V1) — The Hidden Carbon Cost of Deforestation

**Status:** first proposal, to be iterated. Concrete values here are *provisional defaults* that make
the abstract `ThemeTokens` (tech spec §13) real; nothing here changes a locked decision — it dresses
them. Where this doc sets a number (hex, px, ms), read it as "starting point, revisable".

Scope: this is the **visual + layout** layer the UI spec (doc 02) deliberately left out (it is
behavior-level, not pixel-level). No component code yet.

---

## 1. Design intent

A serious, quiet, data-first portfolio piece — the *restraint* is the statement. The interface should
feel like an honest instrument, not a dashboard shouting. The single dramatic moment is **pushing the
time horizon out** (`today → +100y`), where the projected future debt grows and the magnitudes climb;
everything else stays calm so that move lands.

Three principles, inherited and made visual:
1. **Honesty is legible.** Measured vs. estimated is encoded in *line style* (solid vs. dashed), and
   measured vs. **projected future** in a further *lighter dashed* step — never buried in a caption.
2. **One hero action.** The time-horizon selector is the most prominent control on the page.
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
| **Fossil reference** (denominator) | muted slate `#5B6B7F` | solid, desaturated | context, deliberately not a hero |
| **Full emissions** | (stock green + forgone amber, stacked) | — | no new color; the amber layer *added on top* (always shown) |

Rule, stated once and never broken: **solid = measured, dashed = estimate, lighter-dashed = projected
future; green = deforestation measured, amber = the derived hidden cost.** That single rule carries the
argument without a legend sentence. The **join year** (where measurement ends and projection begins)
is marked by a thin vertical divider (§7). Donut slices reuse the exact three: fossil slate / stock
green / forgone-sink amber (always 3 slices, measured data only).

### 2.3 State colors
Kept minimal (this isn't a status app). **Split from the data layer (iteration #2):** data amber
`#E8A13A` is a **data-layer color only — never a UI state**, so the forgone-sink layer can never read
as a warning. Caveats, data-year and methodology notes use `text.low`; genuine problems (fetch fail,
data gap) use error red `#E5534B`. No separate `warn` token and no `success` in V1.

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

### 5.1 Desktop (≥1120px)
```
┌───────────────────────────────────────────────────────────────────────┐
│ HEADER   Title · one-line thesis                       SK|EN · Method▸ │
├───────────────────────────────────────────────────────────────────────┤
│ CONTROL BAR (sticky)                                                    │
│  [ ScopeDomainSelect ▾ ]   « today·20·30·50·75·100y »   R:[c·m·h] ▸ baseline 1990 ⌄│
├──────────────────────────────────────────────┬────────────────────────┤
│  MAIN CANVAS (8 col)                 ×3.2 many│ SIDE RAIL (4 col)       │
│  stacked time series (│ = join year),         │  ◐ Composition donut     │
│  dataZoom below                              │    (always 3 slices)     │
│                                              │  Share: 4.1% ...         │
├──────────────────────────────────────────────┴────────────────────────┤
│  SECONDARY GRID                                                         │
│  [ Ranking today→horizon ] [ Deforestation vs fossil — global ] [ Equiv]│
└───────────────────────────────────────────────────────────────────────┘
```
- **Control bar is sticky** and the horizon selector sits **centered and largest** — the hero action.
  The scope dropdown anchors left; R scenario (segmented) and baseline (compact stepper/select) right.
- **Multiplier badge (`×N`)** = single instance, **top-right above the canvas**, **always shown**
  (single accounting; F8/A) — `fullEmissions ÷ WB stock` at the reference year, never a trivial "×1".
- **Panel 1 (composition donut) stays in the side rail** as the persistent context (placement A),
  always 3 slices, with the always-on share number beneath it.
- **Deforestation-vs-fossil** panel appears in the secondary grid **only in global scope**; its slot
  collapses (grid reflows) in local scope — no empty placeholder.
- **Ranking** is a **two-column bump** — `today` ranks on the left, the chosen-horizon ranks on the
  right; the crossing lines reshuffle as the horizon changes.

### 5.2 Tablet (768–1119px)
Side rail drops **below** the canvas (donut full-width). Secondary grid → 2-up then 1-up. Control bar
keeps the **scope select + horizon selector** on one row (selector stays centered, still hero) and
**collapses R-scenario + baseline behind a "▾ scenario & baseline" disclosure** (iteration #2) —
they're secondary, so the hero row stays uncluttered. On the narrower tablet width the six horizon
segments may wrap or condense to a compact `▾ horizon` select.

### 5.3 Mobile (<768px)
Single column, everything stacked. Control bar becomes: scope select (full width) → the horizon
selector (full-width pill / compact select, still visually dominant) → a collapsible "▾ scenario &
baseline" disclosure. Charts full-bleed to card edges; `dataZoom` slider retained (touch), inside-zoom
enabled.

---

## 6. Component treatment

- **Header:** small — title `h1`, one muted thesis line, right-aligned `SK|EN` segmented toggle and a
  "Methodology ▸" text link (opens the disclosure). No nav, no logo chrome.
- **ScopeDomainSelect:** PrimeVue Select; items rendered from `SCOPE_SELECTOR_OPTIONS`; a thin divider
  before the default **Global** entry (tech spec §2.4). Selected value shows the domain/global label.
- **Horizon selector (`HorizonSelect`):** a wide pill with six segments
  `today · 20y · 30y · 50y · 75y · 100y`, `today` preselected. Inactive segments `text.mid` on
  `surface.2`; the active segment fills with a subtle accent-tinted surface and `text.hi`. A labeled
  segmented control so the horizon is always visible; the segment labels are i18n keys
  ("+20 rokov" / "+20 years"). This is the hero control — largest, centered.
- **R scenario:** 3-segment control `conservative · mid · high`, `mid` preselected. Muted; secondary
  to the horizon selector by size and contrast.
- **Baseline:** compact select/stepper, floor 1990, label pattern "from loss after **{year}**".
- **Multiplier badge:** mono `×3.2`, `text.hi` on `surface.2`, accent hairline; a caption key beneath
  ("full vs official at {referenceYear}"). **Always shown**; the number itself is horizon-invariant in
  V1 (measured data), so it does not animate on horizon change (only on a scenario/scope change that
  re-derives it).
- **Panels:** `surface.1` card, hairline border, radius 10, a `h2` title + optional `text.low`
  data-year note ("data to 2023"). The reference-year note lives here (ADR-016).
- **Legend:** display-only, inline under the title, using the §2.2 swatches (solid green / dashed
  amber / slate). The **projected twin series carry no legend entry** — one entry per metric,
  regardless of horizon. Non-interactive by decision (UI §4.4/§4.5) — scope is the only layer control.

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
- **Join-year divider:** a thin `text.low` vertical `markLine` (dotted, no symbol) at the last
  measured year, with a small "projected →" caption in `text.low`; absent at `horizon='today'`.
- **Tooltip:** shared-axis (UI §4.4), `surface.2` card, hairline border, one soft shadow, mono numbers
  via the injected `Formatter`; rows ordered stock → forgone → total, with the `×N` echoed; projected
  years append a "(projected)" `text.low` tag.
- **Crossing marker:** thin accent vertical guide + a small accent dot where the annual stock impulse
  and the cumulative forgone-sink level cross; label in `text.mid`. The extended horizon is what gives
  the chart enough span to reach the crossing (which may sit in the projected tail).
- **Ranking bump:** two category columns (`today` → chosen horizon), one line per domain in its stock
  green tint, crossing lines where the horizon reshuffles the order; rank labels in `text.mid`.
- **dataZoom:** slider (bottom, minimal, accent handles) + inside; a "reset to full range" affordance;
  time range resets on scope change (F6). Pure client view, distinct from the horizon — no refetch (ADR-005).
- **Fossil-comparison panel:** two grids side-by-side sharing one computed `sharedYAxis()` max+interval
  (F7b) so the deforestation bar and the fossil bar are honestly comparable at a glance.

---

## 8. Motion

- **horizon change** (`today → +Ny`): single ECharts `setOption` transition ~**240ms** `cubic-out`
  (F5); the projected dashed tail extends, the axis rescales smoothly, the join divider slides to the
  new span. Because the data refetches, the transition runs on arrival of the (usually cached) DTO.
- Everything else near-instant (≤120ms hovers/focus). Respect `prefers-reduced-motion`: drop the
  transition and swap immediately.
- No decorative/ambient animation anywhere — motion only ever communicates a data change.

---

## 9. Design decisions & open questions

**Resolved (iteration 1):**
- **Amber/warn split (#2):** forgone-sink amber is a **data-only** color; UI states never use it (§2.3).
- **Composition panel (#3):** **donut confirmed**, now **always 3 slices** (single accounting).
- **Green (#4):** the warm "eco" green `#5FBE6E` is **kept** — deliberately approachable, not clinical.

**Resolved (iteration 2):**
- **Number typeface:** **IBM Plex Mono** for the `×N` badge + big scalar readouts; Inter tabular
  everywhere else inline.
- **Tablet control bar:** R-scenario + baseline **collapse behind a disclosure**; scope + horizon
  selector stay on the hero row (§5.2).

**Resolved (iteration 3 — official↔full → time horizon):**
- **Hero control:** the binary accounting switch is **removed**; the **time-horizon selector** (six
  segments, `today` default) is the new hero (§1/§5/§6).
- **Projected-future style:** measured-vs-projected is a **lighter dashed** step over the existing
  solid/dashed grammar (`opacity ×0.55`), with a **join-year divider** (§2.2/§7). Provisional — the
  lighter-dashed vs. estimate-dashed distinction is `revisable` (business §12).
- **Multiplier badge:** now **always shown**, horizon-invariant in V1 (measured data) — so it no
  longer count-up-animates on the hero action.
- **Ranking:** two-column bump (`today` → horizon), reshuffling with the horizon (§5/§7).

No open design questions remain for V1 (the flagged projection-styling nuance is a revisable default).
