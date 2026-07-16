# Detailed Technical Specification (v1.0.0)

**Status:** Binding. A top-down description of every architectural article, from the runtime
topology down to individual classes, types and their contracts. It operationalizes
`01-technical-decisions.md`, serves the flows in `02-ui-specification.md`, and realizes the domain
in `00-business-overview.md`. **Consistency is a first-class requirement:** §16 explicitly checks
every new element against the earlier documents and resolves conflicts so the whole application is
logically consistent.

Type/interface sketches below are **specification contracts**, not implementation. No application
code is written this round.

---

## 0. Overview and layering

```
                 ┌──────────────────────────── Browser (SSR-hydrated SPA) ────────────────────────────┐
                 │  Vue 3 components (dumb)  ← props ─ Pinia getters ← Pinia state ← Pinia actions      │
                 │        │              typed props + useChartContext → BaseChartOption                    │
                 │        │ intents (actions)                 │            │ Option                       │
                 │        ▼                                   ▼            ▼                              │
                 │  client Axios instance ───────────────► BaseChart.vue (<VChart>, client-only)         │
                 └──────────────│──────────────────────────────────────────────────────────────────────┘
                                │ HTTP (BFF)
                 ┌──────────────▼──────────── Nitro server (Vercel functions) ─────────────────────────┐
                 │  server/api/*  (thin routes: parse params → cache → service → DTO)                    │
                 │        │ composition root (DI)                                                         │
                 │        ▼                                                                               │
                 │  Services (EmissionsService, ForestAreaService, AggregationService, EquivalenceSvc)   │
                 │        │ inject                     │ use                                              │
                 │        ▼                            ▼                                                  │
                 │  SourceAdapter (WdiAdapter) ── server Axios ──► World Bank WDI API                     │
                 │  statistics module (pure)   ◄─ config (domains, indicators, equivalences)              │
                 └────────────────────────────────────────────────────────────────────────────────────┘
```

**Layer boundaries (strict):**
- Components never fetch or hold data (ADR-003); they read Pinia and emit intents.
- The store never talks to World Bank; only to our BFF via client Axios (ADR-004/008).
- Chart-option classes are pure; data is injected via constructor from a chart component's typed
  props + the `useChartContext` bundle (ADR-007/009).
- Services depend on the adapter *interface*, not a concrete adapter (ADR-008/009).
- The statistics module is pure and isomorphic; it runs on the server (single authoritative
  derivation path, ADR-005).

---

## 1. Project structure

```
/
├─ nuxt.config.ts                 # modules, i18n, primevue, nuxt-echarts, nitro preset
├─ app.config.ts                  # theme tokens (shared with ECharts), runtime UI config
├─ app/
│  ├─ components/
│  │  ├─ shell/                    # AppHeader, ControlPanel, MainCanvas, MagnitudePanels, ...
│  │  ├─ controls/                 # ScopeDomainSelect, HorizonSelect, RScenarioToggle, ...
│  │  └─ charts/
│  │     ├─ BaseChart.vue          # tier 1: dumb <VChart> wrapper (autoresize, emits timeRange)
│  │     ├─ MainStackedChart.vue   # tier 2: per-chart components (Pinia-unaware, typed props)
│  │     ├─ GlobalStackedAreaChart.vue
│  │     ├─ CrossingChart.vue
│  │     ├─ RankingBumpChart.vue
│  │     ├─ FossilComparisonChart.vue
│  │     └─ FootprintDonut.vue
│  ├─ charts/                      # tier 3: chart-option classes (pure)
│  │  ├─ BaseChartOption.ts        # abstract base
│  │  ├─ MainStackedOption.ts
│  │  ├─ GlobalStackedAreaOption.ts
│  │  ├─ CrossingOption.ts
│  │  ├─ RankingBumpOption.ts
│  │  ├─ FootprintDonutOption.ts
│  │  └─ FossilComparisonOption.ts
│  ├─ composables/
│  │  └─ useChartContext.ts        # Pinia-aware ChartContext bundle (i18n+theme+formatter+view)
│  ├─ stores/                      # Pinia: single source of truth
│  │  ├─ useViewStore.ts           # control/view state (scope, horizon, R, baseline, timeRange)
│  │  ├─ useDataStore.ts           # fetched/derived DTOs + param-keyed cache + in-flight map
│  │  └─ useUiStore.ts             # locale, theme, loading/error UI state
│  ├─ services/
│  │  └─ apiClient.ts              # client Axios wrapper exposing typed BFF calls
│  └─ plugins/
│     ├─ axios.client.ts / axios.server-aware.ts  # client Axios instance (absolute URL for SSR)
│     └─ primevue, echarts config as needed
├─ server/
│  ├─ api/
│  │  ├─ domain/[id].get.ts        # /api/domain/{id}
│  │  ├─ global.get.ts             # /api/global
│  │  ├─ ranking.get.ts            # /api/ranking
│  │  ├─ reference.get.ts          # /api/reference
│  │  └─ equivalence.get.ts        # /api/equivalence
│  ├─ services/                    # EmissionsService, ForestAreaService, AggregationService, ...
│  ├─ adapters/                    # SourceAdapter, WdiAdapter
│  ├─ di/container.ts              # composition root (factory wiring)
│  └─ utils/
│     └─ stats.ts                  # pure statistics module (isomorphic)
├─ shared/                         # types + config importable by server and app
│  ├─ types/                       # DTOs, domain types
│  └─ config/                      # domains.ts, indicators.ts, equivalences.ts
├─ i18n/
│  └─ locales/{sk,en}.json         # all copy
└─ test/                           # Vitest unit + Vue Test Utils
```

---

## 2. Configuration (`shared/config/`)

Typed, versioned, importable everywhere. Single source for defensible numbers (ADR-012).

### 2.1 Domain config (`domains.ts`)
```ts
interface RRange { mid: number; low: number; high: number; }   // absolute endpoints, NOT mid±σ → asymmetry preserved
interface DomainConfig {
  id: 'amazon' | 'congo' | 'seasia' | 'other_tropical';
  labelKey: string;              // i18n key, never a literal label
  isoCodes: string[];            // ISO3 membership (verified in spike)
  rAboveground: RRange;          // published aboveground values (t CO2/ha/yr)
  allometricFactor: number;      // LOCKED = 1.24 (1 + IPCC root:shoot ~0.24; business §6)
  r: RRange;                     // = rAboveground * allometricFactor (total sink)
  robustness: 'high' | 'medium' | 'lower' | 'rough';
  caveatKeys: string[];          // i18n keys for domain-specific caveats
  sourceRefs: string[];          // literature citations
}
```
Four entries (business §3.1, §6). `r` is derived from `rAboveground × allometricFactor`;
`rAboveground` and the CI come from the literature table; `× 3.667` (t C→CO₂) is applied when
seeding `rAboveground` from the source t C values. `RRange` stores **absolute `{ low, high }`**
endpoints (not `mid ± σ`), so asymmetric bands survive both the `× 1.24` and any aggregation.

**Seeded `r` values (total, t CO₂/ha/yr; provisional, `revisable` — business §6):**

| id | mid | low | high | note |
|---|---|---|---|---|
| `congo` | 3.00 | 2.41 | 3.60 | symmetric (Hubau 2020) |
| `seasia` | 1.96 | 0.63 | 3.27 | symmetric (Qie 2017, Borneo proxy) |
| `amazon` | 1.36 | 0.00 | 2.23 | **asymmetric**, floor 0 (declining sink) |
| `other_tropical` | 2.27 | 0.63 | 3.60 | envelope CI (seasia-low → congo-high) |

### 2.2 Indicator registry (`indicators.ts`)
```ts
type SeriesType = 'state' | 'flow';   // state/cumulative vs flow/increment (business §2.7)
interface IndicatorConfig {
  id: string;                    // internal id, e.g. 'forestArea'
  code: string;                  // WDI code, e.g. 'AG.LND.FRST.K2'
  category: 'forestArea' | 'lulucf' | 'fossil';
  seriesType: SeriesType;
  unit: string;                  // km2, Mt CO2, ...
  canBeNegative: boolean;        // LULUCF net series can be negative
  source: 'FAOSTAT' | 'EDGAR' | 'LULUCF-bookkeeping';
  coverageFrom: number;          // first year with real (non-nowcast) data — live-verified
}

// Live-verified against the WDI API (probe, 2026): coverage, holes, sign all confirmed.
const INDICATORS: Record<string, IndicatorConfig> = {
  forestArea: {
    id: 'forestArea', code: 'AG.LND.FRST.K2', category: 'forestArea',
    seriesType: 'state', unit: 'km2', canBeNegative: false,
    source: 'FAOSTAT', coverageFrom: 1990,   // BRA/IDN 1990–2023, no holes, monotone-declining
  },
  deforestationStock: {
    id: 'deforestationStock', code: 'EN.GHG.CO2.LU.DF.MT.CE.AR5', category: 'lulucf',
    seriesType: 'flow', unit: 'Mt CO2', canBeNegative: false,
    source: 'EDGAR', coverageFrom: 2000,      // country-level starts 2000 (WLD carries 1990); positive
  },
  fossil: {
    id: 'fossil', code: 'EN.GHG.CO2.MT.CE.AR5', category: 'fossil',
    seriesType: 'flow', unit: 'Mt CO2', canBeNegative: false,
    source: 'EDGAR', coverageFrom: 1990,      // WLD 1990–2024, full, no holes — the fossil denominator
  },
};
```
`seriesType` powers the (dormant) correlation guard and the axis-type choice in option classes.
`coverageFrom` is not a display floor — it records the earliest real year so the composite floor and
per-series honesty notes (§3.2, §7.1) derive from data, not from a hardcoded assumption.

**Fossil denominator (business §7.1, per user B-2/B-3):** `EN.GHG.CO2.MT.CE.AR5` (**CO₂ excl-LULUCF, WLD**)
— chosen over `EN.GHG.ALL.*` (which folds in agriculture/waste and blurs the "fossil" framing) and
over the per-capita variant. Live-verified full 1990–2024 coverage, zero holes.

### 2.3 Equivalence config (`equivalences.ts`)
```ts
// The single time-horizon vocabulary, shared with DerivationParams (§3.2). 'today' = no projection
// (measured data only); the others project forward from the calendar anchor (business §2.4a).
type Horizon = 'today' | '20y' | '30y' | '50y' | '75y' | '100y';

// Calendar anchor for "now" (business §2.4a): the year the horizon is measured FROM.
const HORIZON_ANCHOR_YEAR = 2026;

// Horizon → absolute target year for the projected series' upper bound.
//   today → HORIZON_ANCHOR_YEAR (no projection past measured data) · 20y → 2046 · 30y → 2056
//   50y → 2076 · 75y → 2101 · 100y → 2126
function horizonTargetYear(h: Horizon): number;  // HORIZON_ANCHOR_YEAR + { today:0, 20y:20, ... }
function horizonYears(h: Horizon): number;        // 0 | 20 | 30 | 50 | 75 | 100 (for equivalence)

interface ReferenceCountry { iso3: string; labelKey: string; source: string }
interface EquivalenceConfig {
  carAnnualTonsCO2: number;      // 4.6 (EPA typical passenger vehicle; business §4.4)
  // Reference country is LOCALE-DRIVEN (business §4.4): resolved from the active i18n locale.
  referenceCountryByLocale: Record<string, ReferenceCountry>;   // e.g. { sk: SVK }
  defaultReferenceCountry: ReferenceCountry;                    // fallback for any other locale (GBR)
  sourceRefs: string[];
}
```
**Equivalence is driven by the global time horizon (business §4.4):** it has **no own preset row**.
The headline is always the annual rate at the reference year; when the horizon is pushed past
`today`, equivalence additionally shows the **committed total = annualRate × `horizonYears(h)`** (the
already-committed debt, holding cumulative loss constant — never an infinite total, business
§2.4/§4.4). **Reference country resolves from the store locale**
(`resolveReferenceCountry(cfg, locale)` → `referenceCountryByLocale[locale] ??
defaultReferenceCountry`): `sk` → Slovakia, else → UK. The equivalence UX element is reactive to the
current language (Pinia), re-resolving the country + `countryEquivalent.times` with no new fetch of
the deforestation series. Car factor + countries are `revisable` config edits (business §4.4/§12).

### 2.4 Scope / Domain selector config (`scopeSelector.ts`)
The scope and domain axes stay two independent state variables (`DerivationParams.scope` +
`domainId`, §3.2). The time horizon (§2.3, §3.2) is the third derivation axis that replaced the old
official↔full accounting switch — **the data model otherwise unchanged.** The merge is **purely a UI convenience**: one
dropdown (UI §3/§3.1) rendered from this constant, whose entries are the sole mapping from the
single control back onto the two variables.
```ts
interface ScopeSelectorOption {
  labelKey: string;                       // i18n key — never a literal label
  divider: boolean;                       // render a simple delimiter before this item
  scope: DerivationParams['scope'];       // 'global' | 'local'
  domainId: DomainConfig['id'] | null;    // local domain id; null for the global entry
}

// Display order; the dropdown is rendered from this array (no hardcoded strings).
const SCOPE_SELECTOR_OPTIONS: readonly ScopeSelectorOption[] = [
  { labelKey: 'scope.domain.amazon', divider: false, scope: 'local',  domainId: 'amazon' },
  { labelKey: 'scope.domain.congo',  divider: false, scope: 'local',  domainId: 'congo' },
  { labelKey: 'scope.domain.seasia', divider: false, scope: 'local',  domainId: 'seasia' },
  { labelKey: 'scope.domain.other',  divider: false, scope: 'local',  domainId: 'other_tropical' },
  { labelKey: 'scope.global',        divider: true,  scope: 'global', domainId: null },  // DEFAULT
];
```
`ScopeDomainSelect` (UI §11) renders one item per entry, drawing a delimiter before any entry with
`divider:true`; the last (Global) entry is the default selection. Selecting an entry copies **both**
`scope` and `domainId` onto `useViewStore`, which is the only place the two axes are held.

---

## 3. Canonical data model (`shared/types/`)

The **authoritative** shapes. Defined up front (ADR-003); everything flows through them.

### 3.1 Point and series
```ts
interface DataPoint { source: string; geo: string; year: number; value: number | null; }
interface SeriesMeta {
  indicatorId: string;
  seriesType: SeriesType;        // state | flow
  unit: string;
  latestDataYear: number | null; // for the "always show the year" rule
  gaps: Array<{ geo: string; reason: string }>;  // partial coverage / holes (honesty)
  isEstimate: boolean;           // measured (false) vs derived, e.g. forgone sink (true)
  projectedFrom: number | null;  // join year where linear-trend projection starts; null = measured only (§3.2, business §2.4a)
}
interface Series { id: string; points: DataPoint[]; meta: SeriesMeta; }
interface BandSeries extends Series { lower: DataPoint[]; upper: DataPoint[]; }  // uncertainty band
```

### 3.2 Endpoint DTOs (BFF → store)
```ts
interface DerivationParams {           // the cache key surface (ADR-005)
  scope: 'global' | 'local';
  domainId?: DomainConfig['id'];       // required if scope=local
  horizon: Horizon;                    // 'today' | '20y' | '30y' | '50y' | '75y' | '100y' (§2.3) — replaced accounting
  rScenario: 'conservative' | 'mid' | 'high';
  baseline: number;                    // >= 1990
}
```
**Projection metadata.** Every series that a chart may draw dashed carries, in addition to
`SeriesMeta.isEstimate`, a `projectedFrom: number | null` field — the **join year** where measured
data ends and the linear-trend projection begins (business §2.4a, §8). `null` = fully measured.
`today` produces `projectedFrom = null` on all series (no projection); any other horizon sets it to
the last measured year of the underlying cleared-area series. Charts split each metric into a
**measured** segment and a **projected** segment at this year (§11.2/§11.5), rendering the projected
one dashed-and-lighter; the join year also drives the divider `markLine`.
```ts
interface SeriesMeta {                 // (§3.1, extended) — projection honesty
  // ...existing fields (indicatorId, seriesType, unit, latestDataYear, gaps, isEstimate)...
  projectedFrom: number | null;        // join year where linear-trend projection starts; null = measured only
}

interface DomainResultDTO {            // GET /api/domain/{id}
  params: DerivationParams;
  referenceYear: number;               // min common data year for composite scalars (ADR-016)
  area: Series;                        // AG.LND.FRST.K2 (state)
  cumulativeLoss: Series;              // cumulative area loss from baseline (state); projected past latest measured year
  stock: Series;                       // WB .DF (flow, solid); measured then projected past latest year (projectedFrom)
  forgoneSink: BandSeries;             // R * cumulativeLoss (estimate, dashed+band); extends into the projected range
  fullEmissions: Series;               // stock + forgoneSink
  multiplier: number;                  // fullEmissions ÷ WB stock at referenceYear (business §2.5/§4.2; measured data only)
  crossingYear: number | null;         // annual stock impulse × cumulative forgone-sink crossing (may fall in projected range)
}

interface GlobalResultDTO {            // GET /api/global
  params: DerivationParams;
  referenceYear: number;
  perDomainStock: Series[];            // stacked layers; measured then projected (per-domain projectedFrom)
  perDomainForgoneSink: Series[];      // stacked layers
  aggregateStock: Series;              // Σ perDomainStock (denominator for multiplier + fossil comparison)
  aggregateForgoneSink: BandSeries;    // sum + single aggregate band; lower/upper deviations combined separately (asymmetric-safe, §5)
  aggregateFullEmissions: Series;
  multiplier: number;
  crossingYear: number | null;
}

interface RankingDTO {                 // GET /api/ranking (global/cross-domain)
  params: DerivationParams;
  referenceYear: number;
  // Two-column bump chart (business §4.3): today = annual full emissions per domain on MEASURED data
  // at referenceYear; atHorizon = per-domain full emissions read at the chosen horizon's target year
  // (projected). The horizon reshuffles ranks because per-domain R + trend differ.
  today: Array<{ domainId: string; value: number; rank: number }>;
  atHorizon: Array<{ domainId: string; value: number; rank: number }>;   // reshuffled by horizon
}

interface ReferenceDTO {               // GET /api/reference (global fossil bar) — always fetched in global scope
  params: DerivationParams;
  referenceYear: number;
  fossilTotal: Series;                 // denominator = global fossil emissions (also the fossil bar in the side-by-side)
  sharePercent: number;                // share-of-footprint magnitude at referenceYear: defo / (fossil + defo)
  composition: {                       // donut slices at referenceYear (Mt CO2) — always 3 slices
    fossil: number;
    stock: number;
    forgoneSink: number;
  };
}

interface EquivalenceDTO {             // GET /api/equivalence
  params: DerivationParams;
  referenceYear: number;
  horizon: Horizon;                    // echoes params.horizon
  annualRateCO2: number;               // Mt CO2/yr at referenceYear (the always-shown headline)
  cumulativeCO2: number | null;        // committed total = annualRateCO2 × horizonYears(horizon); null when horizon='today'
  carEquivalent: number;               // cars (annual, or committed over horizon)
  countryEquivalent: { iso3: string; times: number };
}
```
**Note.** With the accounting switch removed there is a **single accounting ('full')**; the forgone
sink, `fullEmissions`, `multiplier` and `crossingYear` are **always present** (business §2.6). The
`multiplier` (`fullEmissions ÷ WB stock` at the reference year, business §2.5) is **always shown**
and is **not** horizon-reactive in V1 (computed on measured data — §12 open item). `ReferenceDTO`
(donut + share %) is fetched in every global-scope view (no fossil-reference toggle — business §4.1).

**Design note (consistency with business §2.5):** all headline quantities that feed magnitude
panels and equivalences are **annual flows** (Mt CO₂/yr); the forgone sink is the annual deficit
(a cumulative *level*), the stock is the annual flow — units consistent by construction.

**Composite floor = 2000 (per user, B).** The WB deforestation **stock** exists only from **2000** at
country level (`deforestationStock.coverageFrom`), while forest area — and therefore the forgone-sink
integral — runs from **1990**. Rather than render an early decade of sink-only composite, the
full-emission composite is **clamped to `COMPOSITE_STOCK_FLOOR = 2000`** so `stock` and `forgoneSink`
are always present together; **1990 remains the cumulative-loss integration origin** for the sink
(baseline stays ≥ 1990, business §7.2). The clamp is a display/derivation floor computed from
`coverageFrom`, not a new user control. `stock`/`forgoneSink`/`fullEmissions` in the DTO therefore
begin at `max(baseline, 2000)`; `area`/`cumulativeLoss` still begin at `baseline`.

**Provisional-tail trim (per user, B).** The AR5 emission series repeat their last real year as a
nowcast (probe: 2023 ≡ 2022 across every `EN.GHG.*` series). The adapter **drops the duplicated final
year uniformly** (§4) so charts end on genuinely distinct data; the trimmed end sets `latestDataYear`,
which in turn feeds the min-common `referenceYear` rule (ADR-016).

**Forward projection (business §2.4a, §8).** When `horizon !== 'today'`, `AggregationService`
extends each series past its last measured year up to `horizonTargetYear(horizon)` using a
**per-domain linear-trend extrapolation** of the cleared-area series (`stats.projectSeries`: recent
mean + fitted slope over the last ~9 measured years, clamped ≥ 0), then multiplies by `R_domain` and
aggregates through the existing `sumSeries`/`aggregateForgoneSink` path. Projection is applied **per
domain, before aggregation** (NOT a single fit on the pre-aggregated series) — because `R` and the
trend differ per domain, and this is exactly what reshuffles the ranking. The projected points carry
`meta.projectedFrom = <last measured year>`; composite scalars (`multiplier`, `referenceYear`, donut,
share, equivalence annual rate) are computed on **measured data only**, never on projected points
(business §7.1a). `horizon='today'` skips projection entirely (`projectedFrom = null`).

---

## 4. Adapter layer (`server/adapters/`)

The extension seam (ADR-008). One module per source; uniform output.

```ts
interface SourceAdapter {
  fetchIndicator(iso3: string, indicatorCode: string, opts?: FetchOpts): Promise<Series>;
  fetchIndicatorMulti(iso3List: string[], indicatorCode: string, opts?: FetchOpts): Promise<Series[]>;
}
interface FetchOpts { dateRange?: [number, number]; mostRecentNonEmpty?: boolean; perPage?: number; }
```

**`WdiAdapter implements SourceAdapter`.** Responsibilities and WDI quirks it hides (business §7.1):
- Uses the injected **server Axios** instance (`baseURL = https://api.worldbank.org/v2`,
  `format=json`, `per_page` raised from the default 50).
- **Timeout & retry (per user, B-4):** 8s per-request timeout; **2 retries** with exponential backoff
  (250 ms → 500 ms) on **network errors and 5xx only** — never on 4xx (a 4xx is a contract/geocode
  bug to surface, not to hammer). Retry lives in the Axios instance/interceptor, so every adapter
  inherits it uniformly.
- Data always in `response[1]` (index 0 is metadata).
- Aggregate filtering: request via `v2/country`; drop rows where `region.id === 'NA'`.
- `mrnev` support for series that end 1–2 years early; records `latestDataYear` in meta.
- **Nowcast-tail trim:** when the final point equals the previous year's value (WB provisional
  carry-forward, verified on the `EN.GHG.*` AR5 family), drop that duplicated last point and set
  `latestDataYear` to the last genuinely distinct year (feeds the min-common `referenceYear`, §3.2).
- Normalizes each WDI row → `DataPoint { source:'WDI', geo:countryiso3code, year:+date, value }`,
  preserving `null` values (holes) rather than dropping them.
- Populates `SeriesMeta` from the indicator registry (`seriesType`, `unit`, `canBeNegative`,
  `isEstimate:false`) and records `gaps` for missing countries.
- **Parallelism (ADR-010):** `fetchIndicatorMulti` fans out per-country requests with
  `Promise.allSettled`; a failed country becomes a recorded gap, not a thrown error.

**Future GFW adapter** = a new `GfwAdapter implements SourceAdapter` file + a service wiring line +
config; no route/contract/frontend change (business §12).

---

## 5. Statistics module (`server/utils/stats.ts`)

Pure, composable, isomorphic. `series in → series out`, uniform point shape (business §8).
Signatures (contracts):

```ts
movingAvg(s: Series, window = 9): Series;         // centered
detrend(s: Series, window = 9): Series;           // deviation from movingAvg
diff(s: Series): Series;                           // first differences (flow); meta.seriesType='flow'
cumulative(s: Series): Series;                     // cumulative sum (state); meta.seriesType='state'
pearson(xs: number[], ys: number[]): number;       // dormant (correlation view deferred)
lagCorrelation(xs: number[], ys: number[], maxLag: number): Array<{lag:number; r:number}>; // dormant

// domain derivations
areaLoss(area: Series): Series;                    // -diff(area), clipped to losses; flow
cumulativeLoss(area: Series, baseline: number): Series;  // cumulative(areaLoss) from baseline; state
forgoneSink(cumLoss: Series, r: RRange, scenario): BandSeries; // r * cumLoss + CI band (low/high from RRange endpoints, may be asymmetric); isEstimate=true
fullEmissions(stock: Series, forgone: Series): Series;         // pointwise sum
multiplier(stock: Series, full: Series, atYear: number): number;  // fullEmissions ÷ WB stock at referenceYear (measured data)
crossingYear(stock: Series, cumulativeForgone: Series): number | null;  // annual stock impulse × cumulative forgone level (semantics unchanged)
referenceYear(...series: Series[]): number;                    // min common latestDataYear (ADR-016)

// forward projection (business §2.4a/§8)
projectSeries(series: Series, targetYear: number, lookback = 9): Series;  // recent mean + fitted slope,
    // extrapolated to targetYear, clamped ≥ 0; appended points get meta.projectedFrom = last measured year.
    // targetYear ≤ last measured year → returns the series unchanged (projectedFrom = null).

// aggregation
sumSeries(series: Series[], id: string, geo?: string): Series;  // PURE pointwise sum over the union of years (nulls skipped);
                                                               // NO coverage/exclusion logic — country exclusion is the CoverageGate's job (§6, ADR-020)
aggregateForgoneSink(perDomain: BandSeries[]): BandSeries;      // sum mid; combine lower/upper deviations SEPARATELY (asymmetric-safe):
                                                               //   low = midΣ − √Σ(mid_i−low_i)² ; high = midΣ + √Σ(high_i−mid_i)²
sharePercent(numerator: number, denominator: number): number;
domainRanking(values: Array<{domainId:string; value:number}>): Array<{domainId:string; value:number; rank:number}>;
equivalence(annualRate: number, horizon: Horizon, cfg: EquivalenceConfig): EquivalenceDTO;  // committed: annualRate × horizonYears(h)
```

**Guards (business §2.7, §8):** `pearson`/`lagCorrelation` are guarded to refuse a `state × state`
levels correlation (the r≈0.99 trap) using `meta.seriesType`; they remain dormant in V1 (no UI).
Robustness rule (|r|<~0.25 = noise at n~30–60) documented for the future view.

**Determinism:** the module is a pure function of its inputs → endpoints are deterministic in
`DerivationParams` → cacheable (ADR-005).

---

## 6. Services (`server/services/`)

OOP classes, constructor-injected dependencies (ADR-008/009). Each orchestrates adapters + config +
stats to produce DTOs.

- **`CoverageGate()`** (pure, stateless — `server/utils/coverage.ts`, ADR-020) — the **single source
  of truth for country exclusion**. `evaluate(contributions: { indicator: string; series: Series[] }[])`
  inspects the **per-country** series of **every** indicator a domain uses (stock **and** forest area)
  and returns `{ excluded: Set<iso>; gaps; windowEnd: Map<indicator, year|null> }`. **Union criterion:**
  a country is excluded if it is incomplete on **any** indicator — where "complete" = reaches that
  indicator's **modal** last-real year with a real value **and** has no internal hole between its first
  real value and that year (leading pre-data nulls never trigger). The **same** excluded set is applied
  to stock **and** area, so a domain's stock and forgone sink always describe the **identical country
  set**. There is **no** domain-level exclusion tier.
- **`ForestAreaService(adapter, domainConfig)`** — fetches `AG.LND.FRST.K2` for a domain's ISO3 set
  (parallel) and returns the **per-country** area series (`domainAreaByCountry`, fan-out only — the
  summing + coverage gating is now the `AggregationService`'s job).
- **`EmissionsService(adapter, indicatorRegistry)`** — fetches LULUCF `.DF` stock as **per-country**
  series (`domainStockByCountry`, fan-out only) plus the fossil totals (`globalFossil`,
  `countryFossil`); handles negative net values and the two-methodology note in meta.
- **`AggregationService(forestAreaService, emissionsService, domainConfigs, coverageGate, stats)`** —
  the core orchestrator. `buildDomain` fetches the per-country area + stock, runs the **`CoverageGate`
  once** to get the shared excluded set + per-indicator window, then for each metric **filters
  survivors → `stats.sumSeries` → clips to that indicator's window** (single consistent country set).
  It then produces `DomainResultDTO`, `GlobalResultDTO`, `RankingDTO` by combining domain area + stock
  with `stats.forgoneSink/fullEmissions/aggregateForgoneSink/domainRanking`. Applies the `rScenario`
  param; **applies the `horizon` param by extending each domain's cleared-area series via
  `stats.projectSeries(…, horizonTargetYear(horizon))` before `× R_domain` and aggregation**
  (per-domain, pre-aggregation — §3.2); always computes `multiplier`, `crossingYear`, and the
  forgone-sink family (single accounting, no official/full branch). The global aggregate stock is a
  **plain `sumSeries` of the four per-domain series** — no domain-tier exclusion. Ranking returns
  `today` (measured, referenceYear) + `atHorizon` (projected, target year) columns.
- **`ReferenceService(emissionsService, stats)`** — global fossil bar + `sharePercent` + 3-slice
  `composition` (fossil, stock, forgone sink), all at the reference year (measured data).
- **`EquivalenceService(aggregationService, equivalenceConfig, stats)`** — annual rate (always) +
  committed cumulative over the global `horizon` + car/country equivalents.

**Parallelism (ADR-010):** services issue independent adapter calls via `Promise.all`
(e.g., area + stock in parallel; all domains of a global request in parallel) and tolerate partial
failure with `allSettled` where a gap must not sink the response.

**Horizon/scenario handling:** services are pure functions of `DerivationParams`. There is a
**single accounting** — the forgone-sink family (`forgoneSink`/`fullEmissions`/`crossingYear`/
`multiplier`) is **always** produced. The `horizon` param only changes how far each series is
projected (via `stats.projectSeries`, per-domain, pre-aggregation); all composite scalars are read on
**measured data** at `referenceYear`, independent of `horizon`. This is the single authoritative
derivation path (ADR-005).

---

## 7. Composition root / DI (`server/di/container.ts`)

Manual factory wiring (ADR-009), no IoC container:
```ts
function createContainer(event?: H3Event) {
  const httpClient = createServerAxios();                 // injected instance
  const wdi: SourceAdapter = new WdiAdapter(httpClient);  // interface-typed
  const forestArea = new ForestAreaService(wdi, domainConfigs);
  const emissions  = new EmissionsService(wdi, indicatorRegistry);
  const coverage    = new CoverageGate();                 // pure, stateless (ADR-020)
  const aggregation = new AggregationService(forestArea, emissions, domainConfigs, coverage, stats);
  const reference   = new ReferenceService(emissions, stats);
  const equivalence = new EquivalenceService(aggregation, equivalenceConfig, stats);
  return { aggregation, reference, equivalence };
}
```
Stateless adapters/services may be cached as singletons; anything needing request context is
created per request. Routes obtain services only through this factory — dependencies are explicit
and stubable in tests.

---

## 8. BFF endpoints (`server/api/*`)

Thin Nitro handlers: **parse/validate params → cache wrapper → service call → DTO**. All accept
`DerivationParams` as query params; all are deterministic and cacheable.

| Route | DTO | Applies to (mode matrix) |
|---|---|---|
| `GET /api/domain/[id]` | `DomainResultDTO` | local scope main chart, crossing, multiplier |
| `GET /api/global` | `GlobalResultDTO` | global scope main chart, crossing, multiplier |
| `GET /api/ranking` | `RankingDTO` | global ranking reshuffle (today → chosen horizon) |
| `GET /api/reference` | `ReferenceDTO` | global fossil reference + share-of-footprint |
| `GET /api/equivalence` | `EquivalenceDTO` | equivalence panel (driven by the global horizon) |

**Param validation:** reject `baseline < 1990`; require `domainId` when `scope=local`; enumerate
`horizon` (`today`/`20y`/`30y`/`50y`/`75y`/`100y`) and `rScenario`. Invalid → 400 with a
localized-key error code.

**Caching (ADR-005/014) — CDN-first:** `routeRules` set cache headers so the **Vercel CDN** caches
each response by URL (the full `DerivationParams` signature is in the query string), with high
`maxAge` (hours–day) + stale-while-revalidate, because WB data changes ~yearly. `defineCachedFunction`
is a **second, in-function layer** for warm instances. This survives serverless cold starts/scaling
(a purely in-memory cache would not); upgradeable to a KV/blob storage driver without contract
change. Every endpoint must therefore be a deterministic function of its query params.

**Parallelism / errors (ADR-010):** handlers may resolve several service calls with `Promise.all`;
partial gaps travel in `meta.gaps`, not as failures. A genuine upstream failure → 502 with a
retryable localized error; per-endpoint isolation keeps the rest of the composer alive.

---

## 9. Frontend HTTP layer

- **`plugins/axios`** — creates the client Axios instance. `baseURL` resolves to an absolute origin
  during SSR (from the incoming request) and a relative path on the client (ADR-004). Interceptors:
  base URL, timeout, and response-error normalization into a typed store error.
- **`services/apiClient.ts`** — a thin typed wrapper exposing one method per endpoint returning the
  corresponding DTO. This is the only place the store touches the network; it never calls World
  Bank directly.

---

## 10. Pinia stores (single source of truth, ADR-003)

Three stores; all displayed data lives here; no component-local data.

**Preset (opening state, business §4):** `scope='global'`, `horizon='today'`, `rScenario='mid'`,
`baseline=1990`, `timeRange=null` (full range). Opens at `horizon='today'` (measured data only, no
projection); pushing the horizon out is the signature interaction that reveals the forward debt.

### 10.1 `useViewStore` — control/view state
```ts
type EndpointKey = 'domain' | 'global' | 'ranking' | 'reference' | 'equivalence';
state: {
  scope: 'global' | 'local';           // preset 'global'
  domainId: DomainConfig['id'];        // meaningful only in local
  horizon: Horizon;                    // preset 'today' — the signature control (replaced accounting)
  rScenario: 'conservative' | 'mid' | 'high';   // default 'mid'
  baseline: number;                    // default 1990
  timeRange: [number, number] | null;  // ECharts dataZoom view-state ONLY — no refetch, no data crop (ADR-005)
}
getters: { derivationParams: () => DerivationParams }   // the cache key
```
No `fossilReference` field — the share-of-footprint donut is always shown in global scope (business
§4.1). No separate `equivalenceHorizon` — the equivalence panel is driven by the same `horizon`
(business §4.4). Changing any field except `timeRange` produces a new `derivationParams` → the data
store fetches. `horizon` **is** a refetch trigger (server projects the series): unlike the old
official↔full toggle (instant client re-layer), pushing the horizon out fetches the projected DTOs
(then cached — instant on re-select).

**URL sync (ADR-017).** A router-sync layer maps `derivationParams ↔ route.query` (replace, not
push): on load the store initializes from the query, falling back to the preset for any
missing/invalid key (validation reuses the server param validation, §8); each derivation change
rewrites the query. `horizon` **is** in the URL (it is part of `DerivationParams`); only `timeRange`
stays out (pure view state). Selecting a new scope/domain **resets `timeRange` to `null`** (domains span
different x-ranges).

### 10.2 `useDataStore` — fetched/derived DTOs + caching
```ts
state: {
  cache: Map<string, DomainResultDTO | GlobalResultDTO | RankingDTO | ReferenceDTO | EquivalenceDTO>;
  inFlight: Map<string, Promise<unknown>>;   // dedupe concurrent identical fetches
  loading: Record<EndpointKey, boolean>;
  errors:  Record<EndpointKey, StoreError | null>;
}
actions: {
  loadForCurrentView();   // reads viewStore.derivationParams, fetches the needed endpoints
                          // for the current mode matrix IN PARALLEL (Promise.all), deduped.
}
getters: {
  currentMainResult;      // domain or global DTO for current params
  currentRanking; currentReference; currentEquivalence;
  multiplier;             // from the DTO
}
```
**Caching key** = `endpoint + JSON(derivationParams)`. On a control change the action computes the
key; a cache hit returns instantly (server-authoritative first fetch warmed both caches → instant
re-select of an already-visited horizon/scope, ADR-005). `inFlight` dedupes simultaneous identical
requests. The **time-range zoom** only updates
`viewStore.timeRange`, which is bound to the chart's ECharts `dataZoom`; the series data is untouched
and nothing refetches.

### 10.3 `useUiStore` — locale, theme, presentation
Locale (SK/EN, synced with `@nuxtjs/i18n`), active theme tokens (**fixed dark in V1** — no
light-mode toggle, ADR-002), the injected `Formatter` (§11.5), global loading/error surfaces.

**SSR (ADR-001):** stores are per-request; `loadForCurrentView` may run inside `useAsyncData` during
SSR so the preset data is in the hydration payload; the client rehydrates without a duplicate fetch.

---

## 11. Chart-option class system (ADR-007)

### 11.1 Abstract base (`app/charts/BaseChartOption.ts`)
```ts
interface ChartContext {
  t: (key: string, params?) => string;   // i18n translator
  theme: ThemeTokens;                     // shared with app chrome (§13)
  formatter: Formatter;                   // injected number formatting (§11.5, ADR-018)
  breakpoint: 'sm' | 'md' | 'lg';         // responsive option tweaks
  horizon: Horizon;                       // drives projection extent + which years are dashed
  rScenario: 'conservative' | 'mid' | 'high';
}
abstract class BaseChartOption<TData> {
  constructor(protected data: TData, protected ctx: ChartContext) {}
  protected baseGrid(): object;           // shared grid/axis/tooltip/legend scaffolding
  protected themeColors(): string[];      // theme tokens → ECharts palette
  protected axisTypeFor(seriesType: SeriesType): 'value' | 'log' | 'time';
  protected estimateStyle(): object;      // dashed line + band styling (estimate vs measured)
  protected splitAtProjection(s: Series): { measured: Series; projected: Series | null };
                                          // splits a metric at meta.projectedFrom into a solid
                                          // measured segment + a dashed-lighter projected segment
                                          // (overlapping the join point so the line is continuous)
  protected projectionDivider(joinYear: number): object;  // vertical markLine at the join year
  abstract buildSeries(): object[];       // the only required per-chart method
  build(): EChartsOption;                 // assembles baseGrid + buildSeries into a full Option
}
```
Centralizes ECharts boilerplate, theme→color mapping, i18n labels, number/unit formatting, the
measured-vs-estimate visual distinction (solid stock vs dashed forgone sink + band), the
**measured-vs-projected split** (a metric is emitted as two series at `meta.projectedFrom` — same
color/stack order, the projected one dashed-and-lighter, excluded from the legend via the
`legend.data` allowlist, with a join-year divider `markLine`, business §2.4a / UI §4.5), empty/loading
handling, and the `state/flow` → axis-type mapping. Subclasses implement only `buildSeries()` plus
chart-specific overrides.

**Why the split (ECharts limitation).** ECharts cannot switch a single line solid→dashed mid-series
(no per-segment dash; `visualMap` only recolours). So each projected metric becomes a **separate
series** starting at the join year with the same color and stack, `estimateStyle()` dashed + reduced
opacity. Only the measured series appear in `legend.data` (the projected twins are name-suffixed and
omitted) so the legend stays clean. This is a **binding contract** with UI §4.5.

### 11.2 Concrete subclasses (one responsibility: data → complete `Option`)
- **`MainStackedOption`** (local): stock (solid) + forgone-sink (dashed + band), each split into a
  measured + dashed-lighter projected segment at `projectedFrom` when `horizon !== 'today'`. (The
  "side by side" stock-vs-forgone variant is **deferred** from V1 — §16, business §12.)
- **`GlobalStackedAreaOption`**: per-domain stacked area + one aggregate band; each layer split
  measured/projected at its own join year, with a single join-year divider.
- **`CrossingOption`**: **annual stock impulse** vs **cumulative forgone-sink level** + marked
  crossing point (semantics unchanged — business §4.3). The extended horizon window is what finally
  gives it enough span to reach the crossing; the projected tail is dashed-lighter.
- **`RankingBumpOption`**: **two-column bump chart** — `RankingDTO.today` → `RankingDTO.atHorizon`
  ranks; the reshuffle is driven by the chosen horizon (business §4.3).
- **`FootprintDonutOption`**: composition donut of total emissions — **always 3 slices** (fossil,
  stock, forgone sink); reads `ReferenceDTO.composition`.
- **`FossilComparisonOption`** (**global only**): two side-by-side bars/columns — total deforestation
  emissions (stock + forgone sink) vs. global fossil emissions, at the reference year — on a
  **shared Y-axis** (identical `max` + tick interval). It builds one `Option` with two grids and
  applies `sharedYAxis()` (below) to both `yAxis`, **overriding** ECharts' per-axis auto-scale so the
  two panels are visually comparable. Consumes `currentReference` (fossil) + `currentMainResult`
  (aggregate deforestation).

**Shared-scale helper.** A protected `sharedYAxis(...seriesGroups): { max: number; interval: number }`
computes a single "nice" maximum and tick interval across all supplied series and is written into
every `yAxis` of the paired grids (also reusable as a standalone util for any future paired chart).

All are **pure** (no fetch, no Vue reactivity, no side effects) → directly unit-testable by
asserting the produced `Option` (ADR-013).

### 11.3 `useChartContext` (the shared injection bundle, ADR-009)
```ts
function useChartContext(): ComputedRef<ChartContext> {
  const view = useViewStore(); const ui = useUiStore();
  const { t } = useI18n();
  return computed(() => ({ t, theme: ui.theme, formatter: useFormatter(),
                           breakpoint: ui.breakpoint, horizon: view.horizon,
                           rScenario: view.rScenario, timeRange: view.timeRange }));
}
```
This composable is **Pinia-aware** and lives in the parent (shell) components. It bundles the
cross-cutting context (i18n, theme, formatter, breakpoint, horizon, R, timeRange) that every option
class needs. The chart components themselves are **Pinia-unaware**: a parent reads the DTOs from the
data store and passes them, together with `ctx`, as **typed props**. There is no central factory —
each chart component instantiates its own option class from its props (§11.4).

### 11.4 Rendering tiers
- **`BaseChart.vue`** (tier 1): props `{ option, loading, theme }`; wraps `<VChart :option
  :autoresize />` inside the module's client-only rendering; no domain logic; responsive. The two
  zoomable charts bind ECharts `dataZoom` and emit a `timeRange` event upward (never touch Pinia).
- **Per-chart components** (tier 2, Pinia-unaware): take typed props `{ <dto>, ctx: ChartContext,
  loading? }`, build their option class in a local `computed`, and pass `:option`/`:loading` to
  `BaseChart`. They hold no math and read no store. The main/global charts also re-emit `timeRange`.
- **Shell parents** (Pinia-aware owners: `MainCanvas`, `MagnitudePanels`): read the DTOs +
  `useChartContext()` from the stores, pass them down as props, and persist the charts' `timeRange`
  emits back to `viewStore.setTimeRange`.

**Reactivity:** each chart wraps its option in a `computed` over its props; the parent's DTO getters
and `ctx` are themselves `computed` over Pinia state. When state (data or view) changes, the props
update → the `Option` recomputes → `<VChart>` updates. R/horizon changes flow: control → viewStore →
data fetch/cache → parent getters → props → chart `computed` → new `Option` → chart update.

### 11.5 Number formatting (`app/format/`, ADR-018)
A small class hierarchy is the **single** path for turning a number into display text; components
and chart-option classes never format inline.
```ts
interface FormatOptions { unitKey?: string; fractionDigits?: number; }
abstract class Formatter {
  abstract format(value: number | null, opts?: FormatOptions): string;   // null → localized "n/a"
  multiplier(value: number): string;   // convenience: "×" + 1-decimal, e.g. "×3.2"
}

// The ONLY concrete implementation in V1: international compact notation, not locale-formatted.
class CompactNumberFormatter extends Formatter {
  // 3_200_000 → "3.2M"; 820_000 → "820k"; 1_100_000_000 → "1.1B"; multiplier fixed to 1 decimal.
  format(value, opts) { /* Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }) + unit */ }
}
```
`useFormatter()` returns the active instance (bound in `useUiStore` / composition root). Rendering a
number **requires** a `Formatter` instance — even though there is exactly one subclass today, a
future variant (locale-aware, higher precision) is a drop-in subclass with no call-site changes.
Unit labels are still i18n keys (ADR-011); only the **numeric** part is international, not localized.
The class is unit-tested directly (mount-free, ADR-013).

---

## 12. Internationalization (ADR-011)

- `@nuxtjs/i18n` with `sk`/`en`, `strategy:'no_prefix'`, browser detection (`detectBrowserLanguage`
  with a persistence cookie), fallback `en`.
- **All** display strings are keys: chrome copy, control labels, chart titles/axes/tooltips/units,
  preset labels, the multiplier framing, caveats, data-gap and error messages, domain labels
  (`labelKey`), methodology disclosure.
- Chart-option classes receive `t` and the injected `Formatter` via `ChartContext`: **labels/units
  localize** (i18n keys), while the **numeric part uses international compact notation** (not
  locale-formatted, ADR-018).

---

## 13. Theme tokens shared with ECharts (consistency)

`app.config.ts` defines `ThemeTokens` (dark surfaces, text, accent, stock color, estimate color,
band opacity, grid/line colors). PrimeVue Aura dark consumes them for the chrome; the chart-option
base maps the **same** tokens to the ECharts palette (`themeColors()`), so charts and app chrome are
visually consistent and dark-mode-correct from one source.

---

## 14. Build, runtime, deploy

- **Tooling (ADR-015):** pnpm; Node 20 LTS; TypeScript `strict` (+ `noUncheckedIndexedAccess`);
  `@nuxt/eslint` + Prettier; CI runs `typecheck` + `lint` + `test`.
- `nuxt.config.ts`: `ssr: true`; modules `@pinia/nuxt`, `@nuxtjs/i18n`, PrimeVue Nuxt module,
  `nuxt-echarts` (with explicit chart/component registration for tree-shaking — Line, Bar, Pie,
  Custom + Grid, Tooltip, Legend, DataZoom, MarkLine, MarkPoint, VisualMap); `nitro.preset =
  'vercel'`.
- ECharts component/type registration is centralized in the module config (ADR-006).
- Deploy Vercel; BFF as serverless functions. **Caching = CDN-first (ADR-014):** `routeRules` set
  cache headers (high `maxAge` + SWR) so the Vercel CDN caches by URL/param-signature;
  `defineCachedFunction` is a second in-function layer. Preset is a single config value → portable
  to Netlify/Cloudflare later.

---

## 15. Testing (ADR-013)

| Target | Tool | What is asserted |
|---|---|---|
| `stats.ts` | Vitest | movingAvg/detrend/diff/cumulative, forgoneSink+band (asymmetric CI), fullEmissions, aggregate band with two-sided deviation combine (asymmetric-safe), crossingYear, ranking, equivalence; `projectSeries` (slope+clamp≥0, `projectedFrom` set, `today`/target≤last → unchanged), `sumSeries`; correlation guards reject state×state levels; determinism |
| `WdiAdapter` | Vitest + fixtures | `response[1]` parsing, aggregate filtering, `mrnev`/holes (null preserved), gap recording, normalization to `DataPoint`/meta (incl. `projectedFrom: null`) |
| Services | Vitest + stub adapter | DTO shape, `referenceYear` = min common data year, forgone-sink family always present, composite scalars on measured data only (horizon-invariant), per-domain projection before aggregation, ranking `today`→`atHorizon` reshuffle, committed equivalence (annualRate × horizonYears), parallel fan-out, partial-failure tolerance |
| Chart-option classes | Vitest | produced `Option`: series count, estimate styling (dashed+band), measured/projected split at `projectedFrom` (twin series, projected omitted from `legend.data`, divider markLine), axis types from seriesType, i18n/format usage |
| Config integrity | Vitest | domain `r = rAboveground × allometricFactor` (factor = 1.24), CI ordering low≤mid≤high, indicator seriesType coverage, `horizonTargetYear`/`horizonYears` mapping |
| Store flow | Vue Test Utils | control change → correct `derivationParams` (incl. `horizon`) → correct apiClient call/params → getters; `timeRange` (`dataZoom`) does NOT refetch; horizon DOES refetch (then cache hit/dedupe) |
| Critical components | Vue Test Utils | mode-matrix visibility (scope × horizon), horizon='today' hides projection + divider, multiplier always shown |

Fixtures for the adapter are captured during the live spike (business §10).

---

## 16. Consistency audit & conflict resolution (mandatory)

Every new element checked against the earlier documents; conflicts resolved for global consistency.

1. **"Server computes derivations" (handoff §9) vs. "instant R/mode toggle" (UX).**
   *Resolution (ADR-005):* server-authoritative single path; refetch on R/mode change; BFF cache
   keyed by `DerivationParams` + a store cache by the same signature + in-flight dedupe → instant
   after warm-up. No client re-implementation of the math → no drift. **Consistent.**

2. **Axios mandated vs. Nuxt's native `$fetch`/`useFetch` convention.**
   *Resolution (ADR-004):* Axios on both HTTP boundaries via injected instances; `useAsyncData` may
   wrap a store action for SSR hydration, but the request itself is Axios. **Consistent** with the
   mandate; SSR handled via absolute base URL.

3. **"All data in Pinia, none in components" vs. chart classes needing data.**
   *Resolution (ADR-007/009):* chart-option classes are pure and receive data as **typed props**
   from Pinia-unaware chart components; the Pinia-aware shell parents read the store and supply those
   props plus the `useChartContext` bundle. The chart components hold nothing. **Consistent.**

4. **Single accounting ('full') vs. belowground biomass / soil.**
   *Resolution (business §2.6/§6):* the official↔full switch is **removed** — the app always shows
   full accounting (stock + forgone sink). Belowground biomass is folded into `R` (allometric
   factor), soil omitted; the config models this via `rAboveground × allometricFactor = r`. The time
   **horizon** (§2.3/§3.2) is now the signature derivation axis in its place. **Consistent** — no
   accounting state anywhere in params, DTOs or UI; a single always-full presentation.

5. **"Total forgone sink is non-computable" (§2.4) vs. equivalence panel showing numbers.**
   *Resolution:* the panel always shows the **annual rate**, and when the global horizon is pushed
   past `today` it adds a **finite committed total** = `annualRate × horizonYears(horizon)`, never an
   infinite total; `EquivalenceDTO.cumulativeCO2` is `null` when `horizon='today'`. The equivalence
   panel has **no own horizon control** — it is driven by the global time horizon (business §4.4).
   **Consistent** with the "permanent debt, not a total" framing.

6. **Stock (impulse/flow) + forgone sink (cumulative level) summed into full emissions.**
   *Resolution (§2.5):* both expressed as the **annual flow of year t** (Mt CO₂/yr) before summing;
   `stats.fullEmissions` sums like units; DTO units annotated. **Consistent** — no unit mixing.

7. **Correlation view deferred vs. spike having correlation code.**
   *Resolution (§2.7):* `pearson`/`lagCorrelation` remain in `stats.ts` (dormant), guarded by
   `seriesType` against the levels trap; no endpoint or UI panel in V1; the `seriesType` attribute
   is present from the start so the view can be enabled later. **Consistent** — dormant, not deleted.

8. **Global uncertainty aggregation vs. per-domain bands.**
   *Resolution (§3, §5):* the global chart draws exactly one **aggregate** band, never per-domain
   bands; `GlobalResultDTO.aggregateForgoneSink` is a single `BandSeries`. Deviations are combined
   in quadrature **per side** (lower and upper separately, point 26), so an asymmetric domain band
   (Amazon) is not symmetrized. **Consistent.**

9. **Data holes / data year honesty vs. clean visuals.**
   *Resolution (§7.1, UI §9):* `null` values preserved through the pipeline; `SeriesMeta.gaps` +
   `latestDataYear` surfaced as notes; partial failure degrades gracefully (`allSettled`).
   **Consistent** with the honest-explorer stance.

10. **"Main tropical domains, not the whole world" vs. a "global" label.**
    *Resolution (§3):* global mode is labeled "main tropical rainforest domains"; the four-domain
    set is the definition of "global" here; copy is localized keys. **Consistent.**

11. **`.DF` possibly already including belowground/soil vs. applying the allometric factor.**
    *Resolution (§7.3, spike task):* the allometric factor is applied **only to the forgone sink**
    (`R`), never to the WB stock series. To be confirmed in the spike; the config/services already
    keep the factor solely on the `R` path, so no change is needed if confirmed. **Consistent by
    construction.**

12. **Baseline movable but interpretation-laden.**
    *Resolution (§7.2, UI §3):* baseline ≥ 1990, explicit label "from loss after {X}", part of
    `DerivationParams` (so it correctly re-derives and re-caches). **Consistent.**

13. **Time-range zoom vs. time-horizon (projection upper bound) — two distinct controls.**
    *Resolution (ADR-005, §10.1, UI §3/§11):* the **time range** (`viewStore.timeRange`) is a pure
    client-side **ECharts `dataZoom`** over data already in the store — *not* part of
    `DerivationParams`, triggers **no** refetch. The time **horizon** (`today`/`20y`/…/`100y`) *is*
    part of `DerivationParams` and *does* refetch (the server projects each series to
    `horizonTargetYear`). Only `scope / domainId / horizon / rScenario / baseline` re-derive on the
    server; `timeRange` never does. **Consistent** — instant range-zoom over a server-projected series.

14. **Reference year for composite scalars vs. uneven series end-years.**
    *Resolution (ADR-016, §2.1/§3.2/§5, UI §9a):* every DTO carries a `referenceYear` = the **minimum
    common `latestDataYear`** across the series feeding a composite scalar (multiplier, share,
    equivalence); scalars are read at that year and the UI surfaces it. **Consistent** — no silent
    mixing of different end-years.

15. **Fossil-reference share as a toggle vs. always-visible context.**
    *Resolution (business §4.1, UI §3/§7, per user B6):* there is **no** fossil-reference toggle
    anywhere; in global scope the share-of-footprint **donut and the share number are always shown**.
    No `fossilReference` field exists in state, DTOs or params. **Consistent** — a single always-on
    presentation, no hidden mode.

16. **Multiplier badge — always shown (single accounting).**
    *Resolution (§3.2, UI §3/§7, business §2.5/§4.2):* with the official↔full switch removed,
    `multiplier` is **non-optional on the DTOs and always shown** — `fullEmissions ÷ WB stock` at the
    reference year (how many times official numbers understate the impact). It is computed on
    **measured data** and is **not** horizon-reactive in V1 (a flagged, revisable §12 open item).
    **Consistent** — one always-visible headline multiplier, never a trivial 1×.

17. **Allometric factor as a free parameter vs. a locked constant.**
    *Resolution (business §6, §2.1, ADR-012):* `allometricFactor` is **locked = 1.24**
    (= 1 + IPCC default root:shoot ≈ 0.24), applied solely on the `R` path; it is a config constant,
    not user-tunable state. **Consistent** — no UI control, no param.

18. **Equivalence panel numbers vs. "no total" — semantics.**
    *Resolution (§2.3/§5, business §4.4, UI §6):* equivalence is **forward-committed**
    (`annualRate × horizonYears(horizon)`), representing committed annual debt over a finite horizon —
    never the non-computable infinite total. It is **driven by the global time horizon** (no own
    control); at `horizon='today'` only the annual rate shows (`cumulativeCO2 = null`). **Consistent**
    with point 5 and the "permanent debt" framing.

19. **Single Scope/Domain dropdown vs. two-axis data model.**
    *Resolution (§2.4, UI §3/§3.1):* scope and domain remain **two independent state variables**
    (`DerivationParams.scope` + `domainId`); the merge is **UI-only**. One `ScopeDomainSelect`
    renders `SCOPE_SELECTOR_OPTIONS` (four local domains, delimiter, default Global) and each entry
    maps back onto both variables. No change to DTOs, params, endpoints or the cache key.
    **Consistent** — the mode matrix and server contract are untouched.

20. **URL-synced composer state vs. cache key and view-only time range.**
    *Resolution (ADR-017, §10.1, UI §10):* only `DerivationParams` is synced to `route.query`
    (replace) — and `horizon` **is** in `DerivationParams`, so it is shareable in the URL. Only
    `timeRange` stays out (pure view state). The query signature is exactly the cache key (ADR-014), so
    sharing a URL warms the same cache. **Consistent** — no new contract, `timeRange` stays client-only
    (point 13).

21. **"Fully localized" vs. international (non-localized) numbers.**
    *Resolution (ADR-018, §11.5, UI §1/§4.4):* **copy, labels and units localize** (i18n keys);
    the **numeric part is international compact notation** (`3.2M`, `×3.2`) via the injected
    `Formatter`. This is a deliberate scoping of localization, not a contradiction. **Consistent.**

22. **Non-interactive legend vs. layer visibility + projected twin series.**
    *Resolution (UI §4.4/§4.5, §3, §11.1):* the legend is **display-only**; layer visibility is
    driven solely by scope (single accounting — no per-layer toggle). The dashed **projected** twin of
    each metric is **excluded from `legend.data`** so the legend shows one entry per metric regardless
    of horizon. A clickable legend would reintroduce contradictory per-layer state. **Consistent.**

23. **Multiplier in header vs. above canvas.**
    *Resolution (UI §2/§4/§7, per user F8):* a **single** `MultiplierBadge` instance lives
    **top-right above the canvas**, **always shown** (single accounting); it is **not** duplicated in
    the header. **Consistent** — one source of truth for the headline number.

24. **Local "side by side" variant referenced but deferred.**
    *Resolution (per user F7a; business §4.2/§12, UI §4.1/§13, §11.2):* the local stock-vs-forgone
    side-by-side variant is **deferred** from V1; the local canvas ships **stacked-only**. All four
    documents mark it deferred and `MainStackedOption` carries no side-by-side branch.
    **Consistent** — no dangling control or option path.

25. **New global "deforestation vs. fossil" side-by-side with a shared Y-scale.**
    *Resolution (per user F7b; business §4.3/§4.5, UI §5/§8, §11.2/§11.3, §3.2):* a **global-only**
    `FossilComparisonOption` draws two grids sharing a computed `sharedYAxis()` max+interval
    (overriding ECharts auto-scale); it reuses the already-fetched `ReferenceDTO` (fossil, plus the
    3-slice `composition` powering the donut) and `currentMainResult` (aggregate deforestation =
    stock + forgone sink at the reference year). Global-only, matching the "local fossil comparison
    is weak" rule (§4.5). No new endpoint or param. **Consistent** — hidden in local scope.

26. **Asymmetric `R` CI bands vs. symmetric `mid ± σ` assumptions.**
    *Resolution (business §6, §2.1/§5):* `RRange` stores **absolute `{ low, high }`** endpoints, not
    `mid ± σ`. The Amazon (floor 0, declining sink) and "other tropical" (envelope CI) are
    **asymmetric**; Congo/SE Asia are symmetric. `× 1.24` scales each endpoint (a zero endpoint stays
    zero). `aggregateForgoneSink` therefore combines **lower and upper deviations separately** in
    quadrature, never collapsing to one σ. All four `R` values are **provisionally locked**
    (`revisable`). **Consistent** — asymmetry is preserved end-to-end (config → band → aggregate).

27. **1990 baseline vs. 2000 stock-data floor.**
    *Resolution (§2.2/§3.2, per user B):* forest area and the forgone-sink integral run from **1990**;
    the WB deforestation **stock** only exists from **2000** at country level. The full-emission
    composite is **clamped to `COMPOSITE_STOCK_FLOOR = 2000`** (both bands always present together),
    while **1990 stays the cumulative-loss integration origin** and the min legal baseline.
    `coverageFrom` in the indicator registry is live-verified, so the floor is data-derived, not
    assumed. **Consistent** — no sink-only early decade, baseline semantics intact.

28. **Provisional nowcast-tail duplication vs. honest end-year.**
    *Resolution (§3.2/§4, per user B):* the AR5 series repeat the last real year as a nowcast
    (2023 ≡ 2022, probe-verified). The adapter **trims the duplicated final point uniformly** and sets
    `latestDataYear` to the last distinct year, which feeds the min-common `referenceYear` (ADR-016).
    **Consistent** — charts and composite scalars end on genuine data.

29. **Fossil denominator choice & adapter resilience.**
    *Resolution (§2.2/§4, per user B-2/B-3/B-4):* the fossil denominator is **`EN.GHG.CO2.MT.CE.AR5`
    (CO₂ excl-LULUCF, WLD)** — live-verified full 1990–2024, preferred over all-GHG/per-capita
    variants. The `WdiAdapter` applies an 8s timeout and 2 exponential-backoff retries on
    network/5xx only (never 4xx), inherited via the shared Axios instance. **Consistent** — one
    verified denominator, uniform transient-failure policy.

30. **Time horizon as a derivation axis vs. per-domain projection granularity.**
    *Resolution (business §2.4a/§8, §2.3/§3.2/§5/§6, per user):* `horizon` (`today`/`20y`/…/`100y`,
    anchored at calendar `HORIZON_ANCHOR_YEAR = 2026`) is part of `DerivationParams` and refetches.
    Projection is a **per-domain linear-trend extrapolation** of each cleared-area series
    (`stats.projectSeries`, slope over ~9 measured years, clamp ≥ 0) applied **before** `× R_domain`
    and aggregation — *not* one fit on the pre-aggregated series — because `R` and the trend differ
    per domain, which is exactly what reshuffles the ranking (`today` → `atHorizon`). All composite
    scalars (`multiplier`, `referenceYear`, donut, share, equivalence rate) use **measured data
    only**. **Consistent** — one horizon axis, honest scalars, ranking reshuffle preserved.

31. **Dashed "projected future" rendering vs. ECharts single-line dash limitation.**
    *Resolution (§3.2/§11.1/§11.2, UI §4.5, business §2.4a):* ECharts cannot switch one line
    solid→dashed mid-series, so every projected metric is emitted as a **separate series** starting at
    `meta.projectedFrom` (same color + stack, `estimateStyle()` dashed + reduced opacity), the
    projected twins are **excluded from `legend.data`**, and a **join-year divider `markLine`** marks
    where measurement ends. `horizon='today'` sets `projectedFrom = null` → no twin, no divider.
    **Consistent** — a single binding rendering contract across all stacked/line charts.

32. **Crossing chart semantics unchanged by the horizon extension.**
    *Resolution (business §4.3, §11.2, per user):* `CrossingOption` keeps the existing semantics —
    the **annual stock impulse** (roughly flat) against the **cumulative forgone-sink level** (rising)
    — and `stats.crossingYear` is unchanged. The horizon only **extends the x-span** far enough for
    the two to actually cross on screen (the projected tail is dashed-lighter; the crossing may fall
    in the projected range). **Consistent** — no semantic change, only more span.

33. **Country coverage consistency across metrics vs. per-indicator exclusion.**
    *Resolution (ADR-020, §5/§6):* a domain's **stock** and **forgone sink** must describe the
    **same set of countries**. A single **`CoverageGate`** (pure) is the sole authority: it evaluates
    the per-country series of **all** of a domain's indicators (stock + forest area) and yields one
    **excluded ISO set** (union criterion — incomplete on **stock OR area** ⇒ out of **both**), which
    `AggregationService.buildDomain` applies uniformly when summing each metric. `sumSeries` is a
    **pure** sum with no coverage logic, and there is **no** domain-level exclusion tier (a whole
    domain is never dropped from the global aggregate — a path that never fired in practice).
    **Consistent** — one country set per domain, one place that decides it.

No unresolved contradiction remains. Any future element must be checked against this section and
the earlier documents before adoption.

---

## 17. Traceability (element → decision → business source)

| Element | Decision | Business source |
|---|---|---|
| Nitro BFF, adapter→service→route | ADR-001/008 | §9 |
| Server-authoritative derivations + cache | ADR-005 | §9, §2.6 |
| `stats.ts` pure module | ADR-005/008 | §8 |
| Domain unit + config | ADR-012 | §3, §3.1, §6 |
| Merged Scope/Domain dropdown (UI-only, `SCOPE_SELECTOR_OPTIONS`) | §2.4, UI §3.1 | §3 (two axes) |
| Time horizon (signature derivation axis, `today`/20y/…/100y), R scenario tri-state | §2.3/§3.2, §16.30 | §2.4a, §4.1, §5, §6 |
| Per-domain forward projection (`projectSeries`, before ×R + aggregation) | §3.2/§5/§6, §16.30 | §2.4a, §8 |
| Dashed projected series (twin series, legend allowlist, join divider) | §11.1/§11.2, §16.31 | §2.4a |
| Forgone sink band + σ_total | stats/DTO | §2.2, §3 |
| Multiplier (always shown, `fullEmissions ÷ WB stock`, measured data) | DTO/charts, §16.16 | §2.5, §4.2 |
| Crossing (annual impulse × cumulative level, semantics unchanged) | DTO/charts, §16.32 | §4.3 |
| Ranking two-column bump (today → chosen horizon) | `RankingDTO`, §11.2 | §4.3 |
| Fossil share donut + number always-on (no toggle) | UI §3/§7 | §4.1 |
| Equivalence driven by global horizon (committed = rate × horizonYears) | §2.3/§5, UI §6 | §4.4, §2.4 |
| Reference year = min common data year | ADR-016 | §7.1a |
| Single country coverage gate (union; stock & forgone share one country set; no domain exclusion) | ADR-020, §16.33 | §7.1 |
| Time range = client-side ECharts dataZoom (slider+inside, reset on scope) | ADR-005, UI §11 | §9 |
| Shareable state via URL query (horizon included, timeRange excluded) | ADR-017 | §9 (portfolio) |
| Injectable `Formatter` hierarchy; international compact numbers | ADR-018 | (app requirement) |
| Dark-only V1 (no light toggle) | ADR-002 | UI §1 |
| Shared tooltip, non-interactive legend, toggle animation | UI §4.4 | §4.1–4.3 |
| Single multiplier badge, top-right above canvas | UI §2/§4/§7 | §4.2 |
| Composition donut (always 3 slices), `ReferenceDTO.composition` | §3.2, §11.2, UI §5 | §4.3 |
| Global-only deforestation-vs-fossil, shared Y-scale (`sharedYAxis`) | §11.2/§11.3, UI §5/§8 | §4.3/§4.5 |
| Local side-by-side variant deferred | §11.2, UI §13 | §12 |
| `R` values provisionally locked (4 domains); asymmetric CI, two-sided aggregation | §2.1, §5 | §6 |
| Seeded indicator registry (live-verified codes + coverageFrom) | §2.2 | §7.1 |
| Fossil denominator = `EN.GHG.CO2.MT.CE.AR5` (CO₂ excl-LULUCF, WLD) | §2.2, §16.29 | §7.1 |
| Composite floor clamped to 2000; 1990 = sink integration origin | §3.2, §16.27 | §7.2 |
| Nowcast-tail trim → honest `latestDataYear` | §3.2/§4, §16.28 | §7.1 |
| `WdiAdapter` 8s timeout, 2 retries (network/5xx only) | §4, §16.29 | §7.1 |
| Allometric factor locked = 1.24 | ADR-012 | §6 |
| Chart class hierarchy + factory | ADR-007/009 | §9 (reusable components) |
| i18n SK/EN | ADR-011 | (app requirement) |
| Correlation dormant | stats guards | §2.7 |
| Tooling (pnpm, Node 20, strict TS, ESLint/Prettier) | ADR-015 | (app requirement) |
| Deploy Vercel + CDN routeRules SWR | ADR-014 | §9 |
