# UI / UX Specification (v1.0.0)

**Status:** Binding for structure, flow and behavior; **deliberately not pixel-level.** The exact
layout of UX elements per screen (grids, spacing, precise component placement, final visual design)
is a **separate later round.** This document specifies the screens, the UX elements and their
behavior, the application flow from the user's / frontend's perspective, and the mapping to state
and data. It is derived from `00-business-overview.md` (especially §4 and §4.5) and must stay
consistent with `01-technical-decisions.md`.

Terminology: **scope** = global aggregate / local domain; **time horizon** = the upper edge of the
window (*today · +20 · +30 · +50 · +75 · +100 y*); these are the two independent axes (business §3,
§2.4a). There is **no** "official ↔ full" accounting axis — the app always shows "full" (stock +
forgone sink); the horizon selector is the signature interaction (business §2.6).

---

## 1. Design principles

1. **Composer, not a static page.** A narrow control panel + a main canvas that recomposes with the
   configuration. The app opens on a working preset (a functional state), not an empty form; the
   user branches out from there.
2. **Honest explorer.** Measured WB figures and our estimates are always visually distinct: the
   **stock** layer is solid (harder number), the **forgone sink** is dashed + carries an uncertainty
   band (estimate). Beyond the last measured year, **projected (future) values** are a lighter dashed
   continuation with a **join-year divider** marking where measurement ends (business §2.4a). Every
   estimate shows its assumptions (R scenario, baseline, horizon) and its data year.
3. **Dark only (V1).** Dark surfaces, light text (PrimeVue Aura dark). **No light-mode toggle** in
   V1 (ADR-002); charts share the same theme tokens as the chrome (business/tech consistency).
4. **Fully localized copy, international numbers.** Every string (labels, tooltips, units, copy,
   caveats, preset names) is an i18n key; SK/EN; default = Slovak if browser is Slovak else English
   (ADR-011). **Numbers are not locale-formatted** — they use one international **compact notation**
   (`3.2M`, `820k`, `1.1B`; multiplier `×3.2`) produced by an injected `Formatter` instance, never
   formatted inline (ADR-018, §11).
5. **Responsive.** Works from a large desktop dashboard down to a narrow viewport; charts autoresize
   and their options adapt (label rotation, legend placement, grid margins) by breakpoint.
6. **No component-local data.** Every value shown comes from Pinia (ADR-003); components are pure
   views + intent emitters.

---

## 2. Application shell / layout regions

A single-page composer with these logical regions (exact grid is the later round):

- **Header bar** — app title + one-sentence point (localized), the **language switcher**, and a
  link to the "About / methodology" disclosure. (The multiplier is **not** in the header — it lives
  top-right above the canvas, §4/§7, so there is a single instance.)
- **Control panel** (narrow, persistent) — all controls (§3). Collapsible on narrow viewports.
- **Main canvas** (dominant) — the primary chart for the current scope (§4); the live
  **multiplier ×N** sits **top-right above it** (always shown — there is no "official" mode).
- **Magnitude panels row** (below/beside the canvas) — up to four panels (§5), shown per the mode
  matrix.
- **Equivalence panel** (quarter width) — the annual-rate / permanent-debt framing (§6), driven by
  the global time horizon.
- **Footer / disclosure** — data sources, methodology caveats, data-year notes (localized).

Loading and empty states are first-class (§9). The About/methodology disclosure surfaces the three
`R` caveats, the two-methodologies note, and the "main tropical domains, not the whole world"
honesty label (business §3, §6, §7).

---

## 3. Controls (the control panel)

All controls write to Pinia; changing a control that affects derivations triggers a
(cached/deduped) fetch (ADR-005). Degrees of freedom follow business §4.1.

| Control | Component (PrimeVue) | Values | Effect | Notes |
|---|---|---|---|---|
| **Scope / Domain** | Select (single dropdown) | Amazon, Congo Basin, SE Asia, Other tropical — *(delimiter)* — Global (default) | Sets **both** `scope` and `domainId` in one gesture; switches the main canvas variant and which panels apply | Rendered from the `SCOPE_SELECTOR_OPTIONS` constant (§3.1); the last (Global) item is delimiter-separated and default; drives the mode matrix (§8) |
| **Time horizon** | SelectButton (signature) | today / +20 y / +30 y / +50 y / +75 y / +100 y | Sets the window's **upper edge**; *today* = last measured year, the others extend a dashed forward projection (business §2.4a); also drives the equivalence panel (§6) | The signature interaction (replaces the old Official↔Full toggle); **default = today**; the shorter future categories are visually emphasized |
| **R scenario** | SelectButton (tri-state) | Conservative / Mid / High | Lower CI / central / upper CI of `R` | **Default = Mid**; applies to all domains in global |
| **Baseline year** | Select or year Slider | 1990 … latest | Start year of cumulative loss (window **lower** edge) | **≥ 1990 only**; explicit label "forgone sink from loss after {X}"; default 1990 |
| **Time range (zoom)** | ECharts `dataZoom` (slider under chart + inside drag/scroll) | any sub-range | **View state only — no refetch, no data crop** | Client-side (`viewStore.timeRange`); pure ECharts `dataZoom`, series data untouched; a **reset-to-full** affordance; the range **resets on scope change** (domains span different x-ranges). Distinct from the horizon selector, which *does* refetch |
| **Language** | Select in header | SK / EN | Switches locale | Persisted via cookie |

There is **no fossil-reference control** and **no "Official ↔ Full" control** (business §4.1, §2.6).
The share-of-footprint donut + share number is always shown in global scope (§5, panel 1); the
forgone sink is always part of the picture.

**Interaction rules.**
- The **multiplier badge is always shown** (`fullEmissions ÷ WB stock` at the reference year, §7);
  there is no "official" mode that hides it.
- Scope and domain are chosen from a **single** dropdown: the four local domains, a delimiter, then
  the default **Global** entry. Picking Global sets `scope='global'`, `domainId=null` (all domains
  summed, R scenario applies to every domain at once); picking a domain sets `scope='local'` and the
  matching `domainId`. The two-axis data model is unchanged — only the UI is merged (§3.1).
- The baseline, the R scenario and the **time horizon** are the controls that refetch (each is part
  of the derivation signature); the time-range zoom (`dataZoom`) never refetches and never manipulates
  the series.
- Controls never produce contradictory states (no layer checkboxes; the forgone sink is always on).

### 3.1 Scope / Domain selector constant
The single dropdown is **rendered from a constant array** (never hardcoded strings), one entry per
option, in display order. Each entry carries: an i18n **label key**, a **divider** flag (whether a
simple delimiter precedes it), the **scope** value, and a **nullable local-domain id**. This
constant is the sole mapping from the one UI control to the two underlying state variables
(`scope`, `domainId`); selecting an entry copies both onto the view store. Canonical shape and the
five entries live in `03-technical-specification.md` §2.4 (`SCOPE_SELECTOR_OPTIONS`): four local
domains (`divider:false`), then the Global entry (`divider:true`, `scope:'global'`,
`domainId:null`) as the default selection.

---

## 4. Main canvas (per scope)

The dominant chart. **Top-right above it** sits the **live multiplier ×N** with its one-line framing
("the real annual cost is N times the officially reported number"), recomputed on R-scenario change.
The badge is a **single instance** (not duplicated in the header) and is **always shown** (there is
no "official" mode to hide it).

### 4.1 Local domain
A stacked chart of a single domain:
- **Stock** — bottom layer, annual impulse, **solid** line/area (harder number).
- **Forgone sink** — growing cumulative deficit, **dashed** line + **uncertainty band** (estimate),
  stacked **on top** of the stock so the total Y = stock + forgone sink.
- When a future horizon is chosen, each layer continues past the last measured year as a **lighter
  dashed projection** with a join-year divider (§4.5). The forgone sink is always present (no
  "official" mode strips it).
- (A "side by side" stock-vs-forgone variant is **deferred** from V1 — §13.)

### 4.2 Global aggregate
A **stacked area** where the layers are the four **domains** (each domain's contribution to the
world sum) plus the aggregate **forgone sink** stacked on top, with **one aggregate uncertainty
band** around the upper edge (not per-domain bands — business §3). Past the last measured year each
layer continues as a projection (§4.5). The forgone-sink stacking and band are always shown.

### 4.3 Framing guard (copy rule)
The stock layer must always read as carrying the anti-deforestation argument even when a domain's
forgone sink is small (e.g., a saturated Amazon). The canvas and tooltips must never invite the
reading "small forgone sink = clearing is okay" (business §4.2). This is enforced through copy and
tooltip text (localized), not through data.

### 4.4 Chart interactions (tooltip, legend, animation)
- **Tooltip.** A **shared axis tooltip**: hovering a year shows every layer's value at that year,
  each with its unit and estimate/measured marker, plus the "data as of {X}" note (§9a). Numbers use
  the injected `Formatter` (§11, ADR-018).
- **Legend.** The legend is **display-only, not clickable.** Series visibility is driven **solely**
  by the scope (and always includes the forgone sink); a clickable legend would create a
  contradictory state (the same reason there are no layer checkboxes, §3). The legend lists only the
  real metrics — the invisible band-bound helper series **and the dashed projection continuations**
  are **excluded** via a `legend.data` allowlist (they are not separate metrics, §4.5).
- **Animation.** Changing the **time horizon** uses a **short ECharts `setOption` transition** that
  visibly extends the dashed projection and lets the magnitudes (crossing, ranking, equivalence)
  "shift" — dramatizing the signature move. Kept brief; refetch-driven updates reuse the transition
  rather than remounting (§9).

### 4.5 Projection rendering (dashed future) — binding contract
Beyond the last measured year, each series continues into the chosen horizon as a **dashed
projection** (business §2.4a). ECharts cannot switch a single line from solid to dashed mid-series
(no per-segment dash; `visualMap` only recolours), so the projection is drawn as a **separate
series per metric**, following these rules so a stacked chart reads as "the solid line simply became
dashed":
- **Starts at the join year** (the last measured year, shared point) so measured and projected parts
  meet with no gap.
- **Same colour** as its measured metric and the **same stacking order / stack id**, so stacked
  layers keep their vertical arrangement.
- **`estimateStyle` dashed**, rendered lighter (reduced opacity) than the measured forgone-sink dash
  so "measured-but-estimated" (forgone) stays distinguishable from "projected" (future).
- **Excluded from the legend** via the `legend.data` allowlist (it is a continuation, not a new
  metric).
- A **join-year divider** (a subtle `markLine` at the join year) signals where measurement ends.

---

## 5. Magnitude panels

Shown below/beside the canvas per the mode matrix (§8). Each is **magnitude-based** (proportions,
orderings, temporal crossings), never a correlation (business §2.6, §4.3); the **time horizon** is
what moves them, most visibly the ranking (panel 2) and the crossing (panel 3).

1. **Share of total footprint (composition donut)** — a donut of total emissions with **three
   slices** (fossil, one-off deforestation stock release, forgone sink). A **share number**
   (deforestation = stock + forgone sink, as % of the total footprint) sits with it. **Global scope,
   always shown**, fossil = global fossil emissions. Evaluated at the reference year on measured
   data, so it does not move with the horizon in V1.
2. **Domain ranking reshuffle (today → horizon bump)** — a **two-column bump chart**: the domain
   ranking **today** (left) vs. **at the chosen horizon** (right), with connectors. Reshuffles
   because each domain has its own `R` and projected trajectory (business §2.4a). Driven by the
   horizon selector, not any accounting switch. **Global / cross-domain.**
3. **Stock × forgone-sink crossing** — the annual one-off stock release (impulse, ~flat) vs. the
   forgone sink as a cumulative-driven level (`R × cumulative area loss`, rising); in year N the
   forgone sink overtakes the stock. The point sits **beyond the measured window**, so it becomes
   visible only once the horizon is pushed into the projection (business §4.3). Line with a marked
   crossing point + join-year divider. **Both scopes.**
4. **Deforestation vs. fossil (side by side, shared scale)** — two side-by-side charts: total
   deforestation emissions (stock + forgone sink) vs. global fossil emissions, drawn on a **shared
   Y-axis** (identical max and tick size) so magnitudes compare directly. **Global scope only**;
   evaluated at the reference year. (Shared scale is enforced by a helper, not ECharts auto-scale —
   §11, tech spec §11.2.)
5. **Equivalence panel** — §6.

Panels that do not apply to the current mode are hidden (not greyed) to keep the composer clean.

---

## 6. Equivalence panel (finalized behavior)

Quarter width. Framing = **annual rate / permanent debt**, never a one-off "total to infinity"
(business §2.4, §4.4).

- **Resting state:** a large number + the framing "per year" right beneath it (e.g.,
  "≈ 3.2 million cars per year — and every subsequent year again").
- **Driven by the global time horizon (no own preset row).** The headline is always the **annual
  rate** at the reference year; when the horizon is a future category (+20 … +100 y) the panel adds
  the **committed total over that window** = `annualRate × horizonYears` (the debt already committed
  by loss so far, holding cumulative loss constant — never an infinite total; business §4.4). At
  horizon *today* only the annual headline shows. The panel reads the same horizon control as the
  rest of the app (§3), which replaces the old `annual/10/30/50` presets.
- **Equivalences shown:** (a) equivalent annual passenger-car emissions and (b) annual emissions of
  a reference country. Conversion factors + sources come from the equivalence config (car factor
  4.6 t CO₂/yr; reference country locale-driven, business §4.4).
- No mode switch, no paragraph of explanatory text.
- The value reacts to scope, the time horizon, R scenario and baseline.

---

## 7. Multiplier ×N

A large headline number: **fullEmissions ÷ WB reported stock** at the reference year (§9a) for the
current scope/domain/baseline, at the current R scenario — how many times the true annual impact
exceeds the officially reported number. **Always shown** (there is no "official" mode). It is a
scalar on measured data at the reference year, so in V1 it does not itself move with the horizon
(a horizon-reactive multiplier is revisable — business §12). Recomputed on R-scenario change.
Sourced entirely from Pinia (server-derived).

---

## 8. Mode matrix (authoritative visibility rules)

Two axes — scope (global/local) and the **time horizon** (upper edge). There is **no accounting
axis** — the app always shows "full". This table is the single source of truth for what renders
where; it mirrors business §4.5 and the frontend must implement exactly this.

| Element | Global | Local | Notes |
|---|---|---|---|
| Main chart (stock + forgone sink) | ✓ (forgone sink as domain stack) | ✓ (one domain, 2 series) | forgone always shown; projection dashed past the last measured year (§4.5) |
| Time-horizon selector | ✓ | ✓ | signature control; sets the window's upper edge / projection |
| Forgone-sink layer + band | ✓ | ✓ | always on |
| Multiplier ×N | ✓ | ✓ | always on; `fullEmissions ÷ WB stock` at the reference year |
| Stock × forgone-sink crossing | ✓ | ✓ | crossing point appears once the horizon is pushed into the projection |
| Equivalence panel | ✓ | ✓ | reads the global horizon; headline = annual rate, +N y = committed total |
| Share of footprint (3-slice donut + %) | ✓ (always on) | ✗ | fossil + stock + forgone sink; at the reference year |
| Deforestation vs. fossil (side by side, shared Y-scale) | ✓ (global only) | ✗ | stock + forgone sink vs. fossil; at the reference year |
| Domain ranking reshuffle (today → horizon bump) | ✓ | ✗ | reshuffles with the horizon |
| Scope / Domain dropdown (single, merged) | ✓ (Global entry selected) | ✓ (a local-domain entry selected) | one control → both `scope` + `domainId` |
| R scenario control | ✓ (all domains) | ✓ (one domain) | conservative / mid / high |
| Baseline (lower edge), time-range zoom | ✓ | ✓ | baseline server-side; zoom client-only |

---

## 9. States: loading, empty, gaps, error

- **Loading.** Each data-driven region has a skeleton/spinner (PrimeVue) bound to the store's
  per-request loading flag. Charts show `BaseChart`'s `loading` state rather than remounting.
- **Data gaps (honesty).** Emission series often end 1–2 years before the present, and some
  member countries/indicators may be missing. Gaps are surfaced, not hidden: the UI always shows
  the **year of the value**, and a small note/tooltip marks partial coverage (from the `meta` in
  the DTO). A domain with a missing member degrades gracefully (recorded gap), it does not fail.
- **Empty.** If a combination genuinely has no data, a localized empty state explains why (e.g.,
  baseline beyond available data).
- **Error.** A failed fetch shows a localized, retryable error for that region only; the rest of
  the composer stays usable (per-region isolation, ADR-010).

### 9a. Reference year (composite scalars)
Composite scalars (multiplier, share %, equivalence annual rate) are computed at a single
**reference year** = the most recent year where all required series have a value (business §7.1a).
The UI always surfaces it ("data as of {X}"). Time-series charts still render each series over its
own full range; only the scalars use the common reference year.

---

## 10. Application flow (user perspective)

1. **First load.** The app detects locale (SK/EN), applies the dark theme, and reads the
   `DerivationParams` **from the URL query** if present (shareable/bookmarked view, ADR-017),
   otherwise opens on the preset **global scope · R = mid · baseline = 1990 · horizon = today**,
   window 1990 – last measured year. The store fetches that state's data; the shell renders
   immediately (SSR), charts hydrate client-only. The forgone-sink layer and the multiplier badge
   are shown from the start; a one-sentence point invites the user to push the horizon out. Changing
   any derivation control (incl. the horizon) rewrites the URL query; the time-range zoom stays out of
   the URL.
2. **Push the time horizon out (+20 … +100 y).** The signature move (and the intended first
   interaction). A dashed forward projection extends every series past the last measured year, the
   crossing point becomes visible, the ranking reshuffles (today → horizon bump), and the equivalence
   committed total grows. Refetch is cached/deduped, so after the first time it is instant.
3. **Change R scenario.** conservative/mid/high re-scale the forgone sink and the multiplier;
   the ranking may reshuffle; the equivalence number changes. Refetch (cached).
4. **Choose scope / domain.** A single dropdown lists the four local domains, then a delimiter, then
   the default **Global** entry. Picking any entry sets both `scope` and `domainId` at once and
   recomposes the canvas and the applicable panels per the mode matrix (Global = aggregate view; a
   domain = single-domain view); the time range resets to full (§3).
5. **Move baseline.** Re-labels ("from loss after {X}") and refetches (cumulative changes).
6. **Zoom the time range.** Instant client-side ECharts `dataZoom`; no refetch, no data manipulation.
   (Distinct from the horizon selector, which recomputes the projection and refetches.)
7. **Read the equivalence.** It follows the global horizon: at *today* the annual headline; at a
   future horizon it adds the committed total (`annualRate × horizonYears`).
8. **Read methodology.** The disclosure explains estimate vs. measured, the lower-bound stance, the
   three `R` caveats and the two-methodology note.
9. **Switch language.** All copy, labels, chart text, units and formats switch and persist.

---

## 11. Component inventory (frontend, for the technical spec)

Reusable, series-agnostic where possible; charts follow ADR-007. Exact composition/props are
finalized in `03-technical-specification.md`.

- **Shell:** `AppHeader`, `ControlPanel`, `MainCanvas`, `MagnitudePanels`, `EquivalencePanel`,
  `MethodologyDisclosure`, `LanguageSwitcher`, `MultiplierBadge`.
- **Controls:** `ScopeDomainSelect` (single dropdown, renders `SCOPE_SELECTOR_OPTIONS`, sets both
  `scope` and `domainId`), `HorizonSelect` (signature SelectButton: today/+20/+30/+50/+75/+100 y),
  `RScenarioToggle`, `BaselineControl`, `TimeRangeZoom` (ECharts `dataZoom`). (No fossil-reference and
  no accounting control — §3.)
- **Charts (tier 2, per-chart components over `BaseChart.vue`):** `MainStackedChart` (local),
  `GlobalStackedAreaChart` (global), `CrossingChart`, `RankingBumpChart` (today → horizon bump),
  `FootprintDonut` (always 3-slice), `FossilComparisonChart` (global-only, deforestation vs. fossil
  on a shared Y-scale). Time-series charts render the measured part solid + a dashed **projection
  continuation** series per metric, excluded from the legend (§4.5).
- **Chart base (tier 1):** `BaseChart.vue` wrapping `<VChart>` (autoresize, loading, theme).
- **State/feedback:** `LoadingSkeleton`, `DataGapNote`, `EmptyState`, `ErrorRetry`.
- **Formatting:** an injected `Formatter` instance — abstract base + V1 `CompactNumberFormatter`
  (`3.2M`, `×3.2`); every rendered number passes through it, never formatted inline (ADR-018). Bound
  via a `useFormatter()` composable / composition root.

All display values arrive via props from Pinia getters; chart-option construction happens inside each
Pinia-unaware chart component from its typed props + the `useChartContext` bundle supplied by the
shell parents (ADR-007/009). No component fetches or stores data locally. All numeric output is
rendered through the injected `Formatter` (ADR-018).

---

## 12. Responsiveness & accessibility (V1 baseline)

- **Breakpoints** drive: control-panel collapse, panel row wrapping, and responsive chart-option
  tweaks (label rotation, legend position, grid margins) passed into option classes via context.
- **Charts** use `autoresize`; containers are fluid.
- **Accessibility baseline:** keyboard-operable controls (PrimeVue defaults), sufficient dark-theme
  contrast, ARIA labels on the signature toggles, and text alternatives / accessible summaries for
  key chart numbers (the multiplier and equivalence values are real DOM text, not only in-canvas).
  Full a11y depth is a later-round concern; this is the V1 baseline.

---

## 13. Open UI items (defer to the dedicated UI round)

- Exact grid/layout, spacing, and final visual design of every region.
- Exact chart forms: the stacked area + aggregate band (global), the domain stacked chart (local),
  the today → horizon bump (panel 2), the crossing rendering (panel 3), and the exact styling of the
  dashed projection + join-year divider (§4.5; the design doc owns the tokens).
- The concrete reference country and car conversion factor for equivalences (config-driven).
- Whether/how to preview the (dormant) correlation view in a future version.
- The local **"side by side" stock-vs-forgone variant** of the domain chart (deferred from V1; the
  local canvas ships stacked-only).
