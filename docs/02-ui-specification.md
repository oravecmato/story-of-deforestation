# UI / UX Specification (v1.0.0)

**Status:** Binding for structure, flow and behavior; **deliberately not pixel-level.** The exact
layout of UX elements per screen (grids, spacing, precise component placement, final visual design)
is a **separate later round.** This document specifies the screens, the UX elements and their
behavior, the application flow from the user's / frontend's perspective, and the mapping to state
and data. It is derived from `00-business-overview.md` (especially §4 and §4.5) and must stay
consistent with `01-technical-decisions.md`.

Terminology: **scope** = global aggregate / local domain; **accounting** = official / full; these
are the two independent axes (business §3).

---

## 1. Design principles

1. **Composer, not a static page.** A narrow control panel + a main canvas that recomposes with the
   configuration. The app opens on a working preset (a functional state), not an empty form; the
   user branches out from there.
2. **Honest explorer.** Measured WB figures and our estimates are always visually distinct: the
   **stock** layer is solid (harder number), the **forgone sink** is dashed + carries an
   uncertainty band (estimate). Every estimate shows its assumptions (R scenario, baseline,
   horizon) and its data year.
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
  **multiplier ×N** sits **top-right above it** (full mode only).
- **Magnitude panels row** (below/beside the canvas) — up to four panels (§5), shown per the mode
  matrix.
- **Equivalence panel** (quarter width) — the annual-rate / permanent-debt framing (§6).
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
| **Official ↔ Full** | SelectButton (binary, signature) | Official / Full | Reveals/hides the forgone-sink layer, multiplier, crossing, band | The signature interaction; binary; no separate layer checkboxes |
| **R scenario** | SelectButton (tri-state) | Conservative / Mid / High | Lower CI / central / upper CI of `R` | **Default = Mid**; applies to all domains in global |
| **Baseline year** | Select or year Slider | 1990 … latest | Start year of cumulative loss | **≥ 1990 only**; explicit label "forgone sink from loss after {X}"; default 1990 |
| **Time window** | ECharts `dataZoom` (slider under chart + inside drag/scroll) | any sub-range | **View state only — no refetch, no data crop** | Client-side; pure ECharts `dataZoom`, series data untouched; a **reset-to-full** affordance; the window **resets on scope change** (domains span different x-ranges) |
| **Language** | Select in header | SK / EN | Switches locale | Persisted via cookie |

There is **no fossil-reference control** (business §4.1). The share-of-footprint donut + share
number is always shown in global scope (§5, panel 1).

**Interaction rules.**
- In **official** accounting, the **multiplier badge is hidden** (1× is trivial), and the
  forgone-sink layer, band, crossing and (full-only) elements are hidden.
- Scope and domain are chosen from a **single** dropdown: the four local domains, a delimiter, then
  the default **Global** entry. Picking Global sets `scope='global'`, `domainId=null` (all domains
  summed, R scenario applies to every domain at once); picking a domain sets `scope='local'` and the
  matching `domainId`. The two-axis data model is unchanged — only the UI is merged (§3.1).
- The baseline change and the R/mode change are the only controls that refetch; the window
  (`dataZoom`) never refetches and never manipulates the series.
- Controls never produce contradictory states (the binary switch replaces stock/forgone-sink
  checkboxes by design).

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
("the real cost is N times higher than the official one"), recomputed on R-scenario and
accounting-mode change. The badge is a **single instance** (not duplicated in the header) and is
shown only in **full** mode (hidden in official).

### 4.1 Local domain
A stacked chart of a single domain:
- **Stock** — bottom layer, annual impulse, **solid** line/area (harder number).
- **Forgone sink** — growing cumulative deficit, **dashed** line + **uncertainty band** (estimate).
- In **official** mode only the stock layer is shown.
- (A "side by side" stock-vs-forgone variant is **deferred** from V1 — §13.)

### 4.2 Global aggregate
A **stacked area** where the layers are the four **domains** (each domain's contribution to the
world sum), with **one aggregate uncertainty band** around the upper edge (not per-domain bands —
business §3). In **official** mode the forgone-sink stacking and band are hidden.

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
  by the official↔full switch (and scope); a clickable legend would create a contradictory state
  (the same reason the binary switch replaces layer checkboxes, §3).
- **Animation.** The official↔full toggle uses a **short ECharts transition** that visibly slides the
  forgone-sink layer/band in and lets the magnitudes "jump" — dramatizing the signature move. Kept
  brief; refetch-driven updates reuse ECharts' setOption transition rather than remounting (§9).

---

## 5. Magnitude panels

Shown below/beside the canvas per the mode matrix (§8). Each reacts to the official↔full switch
with a **visible magnitude difference** (never a correlation — business §2.6, §4.3).

1. **Share of total footprint (composition donut)** — a donut of total emissions: in **full** mode
   **three slices** (fossil, one-off deforestation stock release, forgone sink); in **official**
   **two slices** (fossil, stock). A **share number** (deforestation as % of total) sits with it and
   jumps when the forgone sink enters. **Global scope, always shown** (both accounting modes; not
   behind a toggle), fossil = global fossil emissions.
2. **Domain ranking reshuffle** — because `R` is regional, the ranking really reshuffles on switch.
   Bump chart / ranked bars. **Global / cross-domain.**
3. **Stock × forgone-sink crossing** — the cumulative forgone sink grows faster and crosses the
   one-off stock in year N; official shows only the stock curve, full reveals the second. Line with
   a marked crossing point. **Both scopes; full only.**
4. **Deforestation vs. fossil (side by side, shared scale)** — two side-by-side charts: total
   deforestation emissions (official = stock; full = stock + forgone sink) vs. global fossil
   emissions, drawn on a **shared Y-axis** (identical max and tick size) so magnitudes compare
   directly. **Global scope only**; reacts to the official/full switch. (Shared scale is enforced by
   a helper, not ECharts auto-scale — §11, tech spec §11.2.)
5. **Equivalence panel** — §6.

Panels that do not apply to the current mode are hidden (not greyed) to keep the composer clean.

---

## 6. Equivalence panel (finalized behavior)

Quarter width. Framing = **annual rate / permanent debt**, never a one-off "total to infinity"
(business §2.4, §4.4).

- **Resting state:** a large number + the framing "per year" right beneath it (e.g.,
  "≈ 3.2 million cars per year — and every subsequent year again").
- **Presets row (self-describing, touch-friendly):** `annual` · `10 y` · `30 y` · `50 y`. Semantics
  = **forward committed** (business §4.4): `annual` = the annual rate at the reference year;
  `10/30/50 y` = `annualRate × horizon` (the debt already committed by loss so far, holding
  cumulative loss constant — never an infinite total). **Default preset = `30 y`** (climate
  asymmetry), with shorter horizons visually emphasized as decisive.
- **Equivalences shown:** (a) equivalent annual passenger-car emissions and (b) annual emissions of
  a reference country. Conversion factors + sources come from the equivalence config; the reference
  country and the car factor are open items (business §12) — the panel is parameterized so the
  final choices are config edits.
- No mode switch, no paragraph of explanatory text (preset labels are their own description).
- The value reacts to scope, accounting, R scenario and baseline (it is present in both accounting
  modes; the number changes).

---

## 7. Multiplier ×N

A large headline number: **fullEmissions / officialEmissions** at the reference year (§9a) for the
current scope/domain/baseline, at the current R scenario. Shown only in **full** mode; **hidden in
official** (1× is trivial). Recomputed on R-scenario and accounting-mode change. Sourced entirely
from Pinia (server-derived).

---

## 8. Mode matrix (authoritative visibility rules)

Two independent axes — scope (global/local) and accounting (official/full). This table is the
single source of truth for what renders where; it mirrors business §4.5 and the frontend must
implement exactly this.

| Element | Global | Local | Full only | Also official |
|---|---|---|---|---|
| Main chart (stock + forgone sink) | ✓ (forgone sink as domain stack) | ✓ (one domain, 2 series) | — | ✓ (official = stock only) |
| Official ↔ full switch | ✓ | ✓ | (axis) | (axis) |
| Forgone-sink layer/band | ✓ | ✓ | ✓ | ✗ hidden |
| Multiplier ×N | ✓ | ✓ | ✓ | ✗ (badge hidden; =1×) |
| Stock × forgone-sink crossing | ✓ | ✓ | ✓ | ✗ |
| Equivalence panel | ✓ | ✓ | ✓ | ✓ (value reacts) |
| Share of footprint (composition donut + %, fossil incl.) | ✓ (always on) | ✗ | ✓ (3 slices) | ✓ (2 slices, % jumps) |
| Deforestation vs. fossil (side by side, shared Y-scale) | ✓ (global only) | ✗ | ✓ (incl. forgone sink) | ✓ (stock only) |
| Domain ranking reshuffle | ✓ | ✗ | ✓ | ✓ |
| Scope / Domain dropdown (single, merged) | ✓ (Global entry selected) | ✓ (a local-domain entry selected) | independent | independent |
| R scenario control | ✓ (all domains) | ✓ (one domain) | independent | independent |
| Baseline, time window | ✓ | ✓ | independent | independent |

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
   otherwise opens on the preset **global scope · accounting = official · R = mid · baseline = 1990**,
   window 1990–today. The store fetches that state's data; the shell renders immediately (SSR),
   charts hydrate client-only. When it opens in *official*, the multiplier badge and forgone-sink
   layer are not yet shown — a one-sentence point invites the first toggle. Changing any derivation
   control rewrites the URL query; the window and equivalence horizon stay out of the URL.
2. **Toggle official ↔ full.** The signature move (and the intended first interaction). The
   forgone-sink layer/band, the multiplier badge, the crossing and the full-only panels appear;
   magnitudes visibly jump. Refetch is cached/deduped, so after the first time it is instant.
3. **Change R scenario.** conservative/mid/high re-scale the forgone sink and the multiplier;
   the ranking may reshuffle; the equivalence number changes. Refetch (cached).
4. **Choose scope / domain.** A single dropdown lists the four local domains, then a delimiter, then
   the default **Global** entry. Picking any entry sets both `scope` and `domainId` at once and
   recomposes the canvas and the applicable panels per the mode matrix (Global = aggregate view; a
   domain = single-domain view); the time window resets to full (§3).
5. **Move baseline.** Re-labels ("from loss after {X}") and refetches (cumulative changes).
6. **Zoom the window.** Instant client-side ECharts `dataZoom`; no refetch, no data manipulation.
7. **Explore equivalence presets.** annual/10/30/50 y switch the framing; default 30 y.
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
  `scope` and `domainId`), `AccountingToggle`, `RScenarioToggle`, `BaselineControl`, `WindowZoom`
  (ECharts `dataZoom`). (No fossil-reference control — §3.)
- **Charts (tier 2, per-chart components over `BaseChart.vue`):** `MainStackedChart` (local),
  `GlobalStackedAreaChart` (global), `CrossingChart`, `RankingBumpChart`, `FootprintDonut`
  (3-slice full / 2-slice official), `FossilComparisonChart` (global-only, deforestation vs. fossil
  on a shared Y-scale).
- **Chart base (tier 1):** `BaseChart.vue` wrapping `<VChart>` (autoresize, loading, theme).
- **State/feedback:** `LoadingSkeleton`, `DataGapNote`, `EmptyState`, `ErrorRetry`.
- **Formatting:** an injected `Formatter` instance — abstract base + V1 `CompactNumberFormatter`
  (`3.2M`, `×3.2`); every rendered number passes through it, never formatted inline (ADR-018). Bound
  via a `useFormatter()` composable / composition root.

All display values arrive via props from Pinia getters; chart-option construction is delegated to
chart-option classes via the `ChartOptionFactory` (ADR-007/009). No component fetches or stores
data locally. All numeric output is rendered through the injected `Formatter` (ADR-018).

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
  the bump chart (panel 2), the crossing rendering (panel 3).
- The concrete reference country and car conversion factor for equivalences (config-driven).
- Whether/how to preview the (dormant) correlation view in a future version.
- The local **"side by side" stock-vs-forgone variant** of the domain chart (deferred from V1; the
  local canvas ships stacked-only).
