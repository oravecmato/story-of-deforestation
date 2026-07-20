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
                 │  StoryPage (/story/:slug, persistent) → SlideFactory(SlideDef+sceneState+DTO)         │
                 │        │  → GenericSlide → SlideLayout (text | viz-text | duo-viz-text)               │
                 │  Vue 3 components (dumb)  ← props ─ Pinia getters ← Pinia state ← Pinia actions      │
                 │        │              typed props + useChartContext → BaseChartOption(metrics)           │
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
  props + the `useChartContext` bundle + the slide's **metric selection** (ADR-007/009/024).
- Services depend on the adapter *interface*, not a concrete adapter (ADR-008/009).
- The statistics module is pure and isomorphic; it runs on the server (single authoritative
  derivation path, ADR-005).
- **The story deck (slides/scenes) is a frontend-only presentation layer (ADR-021):** authored
  `SlideDef[]` config + a `SlideFactory` + generic slide components. It selects *which metrics* each
  visualisation shows (a client-side presentation transform over the fetched DTO) and never adds a
  server route, DTO or param. The server does not know slides exist. See §17.

---

## 1. Project structure

```
/
├─ nuxt.config.ts                 # modules, i18n, primevue, nuxt-echarts, nitro preset
├─ app.config.ts                  # theme tokens (shared with ECharts), runtime UI config
├─ app/
│  ├─ pages/
│  │  └─ story/[slug].vue          # the ONE persistent StoryPage route (does NOT remount; ADR-023)
│  ├─ story/                       # story deck config + factory (frontend-only, ADR-021)
│  │  ├─ slides.ts                 # authored SlideDef[] (8 slides, 5 scenes) — i18n keys, no copy
│  │  └─ SlideFactory.ts           # SlideDef + sceneState + DTO(s) → RenderableSlide
│  ├─ components/
│  │  ├─ deck/                     # AppHeader, DeckNav, ProgressIndicator, GenericSlide, SlideLayout,
│  │  │                            #   SlideHeading, SlideText, MultiplierBadge, MethodologyDisclosure
│  │  ├─ controls/                 # HorizonSelect, DomainSelect, BaselineControl, TimeRangeZoom
│  │  └─ charts/
│  │     ├─ BaseChart.vue          # tier 1: dumb <VChart> wrapper (autoresize, emits timeRange)
│  │     ├─ MainStackedChart.vue   # tier 2: per-chart components (Pinia-unaware, typed props+metrics)
│  │     ├─ GlobalStackedAreaChart.vue
│  │     ├─ CrossingChart.vue
│  │     ├─ FossilComparisonChart.vue   # one grid, two categories (ADR-024)
│  │     └─ FootprintDonut.vue
│  ├─ charts/                      # tier 3: chart-option classes (pure; take a metrics/presentation arg)
│  │  ├─ BaseChartOption.ts        # abstract base
│  │  ├─ MainStackedOption.ts
│  │  ├─ GlobalStackedAreaOption.ts
│  │  ├─ CrossingOption.ts
│  │  ├─ FootprintDonutOption.ts
│  │  └─ FossilComparisonOption.ts # one grid, two categories
│  ├─ composables/
│  │  ├─ useChartContext.ts        # Pinia-aware ChartContext bundle (i18n+theme+formatter+view)
│  │  └─ useDerived.ts             # isomorphic derive(DTO, baseline) → baseline-dependent series (§3.2a, ADR-026)
│  ├─ stores/                      # Pinia: single source of truth
│  │  ├─ useViewStore.ts           # per-scene control state: sceneState Map<sceneId,{params,baseline,timeRange}> (ADR-023/026)
│  │  ├─ useDataStore.ts           # fetched/derived DTOs + param-keyed dtoCache + in-flight map
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
│  │  ├─ reference.get.ts          # /api/reference
│  │  └─ equivalence.get.ts        # /api/equivalence
│  ├─ services/                    # EmissionsService, ForestAreaService, AggregationService, ...
│  ├─ adapters/                    # SourceAdapter, WdiAdapter
│  ├─ di/container.ts              # composition root (factory wiring)
│  └─ utils/
│     └─ coverage.ts               # CoverageGate (server-only, ADR-020)
├─ shared/                         # types + config + isomorphic stats importable by server and app
│  ├─ types/                       # DTOs, domain types
│  ├─ config/                      # domains.ts, indicators.ts, equivalences.ts, derivation.ts (BASELINE_FLOOR=1800)
│  ├─ utils/
│  │  └─ stats.ts                  # pure statistics module (isomorphic; imported by server services AND app/composables/useDerived, ADR-026)
│  └─ data/
│     └─ luh2/                     # OFFLINE-built static per-domain 1800–1990 area reconstruction JSON (ADR-026)
│        ├─ amazon.json            #   { year: areaKm2 } per domain; consumed by ForestAreaService, not runtime-fetched
│        ├─ seasia.json
│        ├─ congo.json
│        └─ other_tropical.json
├─ scripts/
│  └─ luh2/                        # ONE-TIME preprocessing pipeline (Python xarray/netCDF4; NOT on any request path)
│     ├─ extract.py                #   mask states.nc (primf+secdf)*carea by domain ISO/boundary → per-domain {year:area}
│     └─ README.md                 #   sources (Hurtt et al. 2020), how to re-run, licence (CC BY)
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

**Restaged on slide 6 (ADR-025).** This config is no longer dormant: slide 6's `EquivalenceStrip`
(§17.4) reuses `carAnnualTonsCO2` and the locale-driven reference-country resolution as the basis of
its **unit switcher** (`mtco2`/`car`/`country`, default `car`). The strip's four magnitudes are derived
**client-side** from the footprint scene's global DTO over the forward window
`[referenceYear, referenceYear + horizonYears(horizon)]` (`sceneWindow(referenceYear, horizon)`) — the
forgone-sink figure a TRUE finite integral `Σ` over that window (business §2.4 #2), consistent with
stock/fossil — so no `EquivalenceDTO` fetch is required for the strip itself.

### 2.4 Scope / Domain selector config (`scopeSelector.ts`)
The scope and domain axes stay two independent state variables (`DerivationParams.scope` +
`domainId`, §3.2). The time horizon (§2.3, §3.2) is the third derivation axis that replaced the old
official↔full accounting switch — **the data model otherwise unchanged.** In the story deck the app
is **global-first**: only the **main scene** surfaces a `DomainSelect` (the crossing/footprint scenes
are forced global, §17.1). This constant drives that select — its entries are the sole mapping from
the single control back onto the two variables (a `Global` entry = `scope:'global'`; a domain entry =
`scope:'local'` + `domainId`).
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
`DomainSelect` (the main scene's control, UI §5/§11) renders one item per entry, drawing a delimiter
before any entry with `divider:true`; the Global entry is the deck's default (global-first). Selecting
an entry copies **both** `scope` and `domainId` onto the **current scene's** params in `useViewStore`
(§10.1), the only place the two axes are held.

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
interface DerivationParams {           // the SERVER cache-key surface (ADR-005; baseline removed per ADR-026)
  scope: 'global' | 'local';
  domainId?: DomainConfig['id'];       // required if scope=local
  horizon: Horizon;                    // 'today' | '20y' | '30y' | '50y' | '75y' | '100y' (§2.3) — replaced accounting
  rScenario: 'conservative' | 'mid' | 'high';
}
// `baseline` is NOT part of the server cache key (ADR-026). It is a client-transform control held in
// view-state alongside `timeRange` (§10.1), synced to the URL for shareability (ADR-017 amendment), and
// drives client/SSR-side recomputation of the baseline-dependent series (§3.2a). Range 1800–present;
// default 1990 (the reconstructed↔measured boundary, business §7.2a).
```
**Projection metadata.** Every series that a chart may draw dashed carries, in addition to
`SeriesMeta.isEstimate`, a `projectedFrom: number | null` field — the **join year** where measured
data ends and the linear-trend projection begins (business §2.4a, §8). `null` = fully measured.
`today` produces `projectedFrom = null` on all series (no projection); any other horizon sets it to
the last measured year of the underlying cleared-area series. Charts split each metric into a
**measured** segment and a **projected** segment at this year (§11.2/§11.5), rendering the projected
one dashed-and-lighter; the join year also drives the divider `markLine`.
```ts
interface SeriesMeta {                 // (§3.1, extended) — projection + reconstruction honesty
  // ...existing fields (indicatorId, seriesType, unit, latestDataYear, gaps, isEstimate)...
  projectedFrom: number | null;        // join year where linear-trend projection starts; null = measured only
  reconstructedBefore: number | null;  // join year (1990) BELOW which the series is LUH2-reconstructed (dashed); null = no reconstruction (ADR-026)
}

// The server DTOs ship only baseline-INDEPENDENT data (ADR-026): the full-range `area` series
// (reconstructed 1800–1990 + measured 1990→latest + projected future) and `stock`. All
// baseline-DEPENDENT quantities are recomputed by the isomorphic derive layer (§3.2a) from `area`
// + per-domain `R` at the chosen `baseline`, in SSR and browser alike.
interface DomainResultDTO {            // GET /api/domain/{id}
  params: DerivationParams;
  referenceYear: number;               // min common data year for composite scalars (ADR-016)
  area: Series;                        // AG.LND.FRST.K2 (state); FULL range 1800→projected horizon, dashed pre-1990 (meta.reconstructedBefore) and projected post-latest (meta.projectedFrom)
  stock: Series;                       // WB .DF (flow, solid); measured then projected past latest year (projectedFrom)
}

interface GlobalResultDTO {            // GET /api/global
  params: DerivationParams;
  referenceYear: number;
  perDomainArea: Series[];             // FULL-range per-domain area (feeds per-domain forgone sink; R differs per domain)
  perDomainStock: Series[];            // stacked layers; measured then projected (per-domain projectedFrom)
  aggregateStock: Series;              // Σ perDomainStock (denominator for multiplier + fossil comparison)
}

// Client/SSR-derived from a *ResultDTO + baseline via the isomorphic core (stats.ts). Recomputed on every
// baseline-slider frame with NO refetch (ADR-026). Was previously carried on the DTO; now derived.
interface DomainDerived {              // derive(DomainResultDTO, baseline)
  cumulativeLoss: Series;              // cumulative area loss from baseline (state); projected past latest measured year
  forgoneSink: BandSeries;             // R * cumulativeLoss (estimate, dashed+band); same R band pre/post 1990 (central estimate, business §7.2a)
  fullEmissions: Series;               // stock + forgoneSink
  multiplier: number;                  // ΣfullEmissions ÷ ΣWB stock over [referenceYear, referenceYear+horizonYears(horizon)] (business §2.5/§4.2; horizon-reactive, today=single-year)
  crossingYear: number | null;         // annual stock impulse × cumulative forgone-sink crossing (may fall in projected range)
}
interface GlobalDerived {              // derive(GlobalResultDTO, baseline)
  perDomainForgoneSink: Series[];      // stacked layers
  aggregateForgoneSink: BandSeries;    // sum + single aggregate band; lower/upper deviations combined separately (asymmetric-safe, §5)
  aggregateFullEmissions: Series;
  multiplier: number;
  crossingYear: number | null;
}

interface ReferenceDTO {               // GET /api/reference (global fossil bar) — always fetched in global scope
  params: DerivationParams;
  referenceYear: number;
  fossilTotal: Series;                 // denominator = global fossil emissions (also the fossil bar in the side-by-side)
}                                      // BASELINE-INDEPENDENT (ADR-026): the donut slices (stock + forgone) and share % are CLIENT-DERIVED from the global DTO's derived tail at the live baseline — not shipped here.

interface EquivalenceDTO {             // GET /api/equivalence
  params: DerivationParams;
  referenceYear: number;
  referenceCountry: { iso3: string };  // locale-driven (SVK/UK)
  referenceCountryAnnualCO2: number;   // Mt CO2/yr at referenceYear — the country unit basis (baseline-independent)
}                                      // BASELINE-INDEPENDENT (ADR-026): the slide-6 strip client-derives its four magnitudes from the global DTO at the live baseline; this endpoint only supplies the country basis so the `country` unit can be computed client-side. The `car` basis comes from config.
```
**Note.** With the accounting switch removed there is a **single accounting ('full')**; the forgone
sink, `fullEmissions`, `multiplier` and `crossingYear` are **always derivable** — they are
CLIENT-DERIVED from the baseline-independent DTO at the live baseline (§3.2a, ADR-026), no longer
carried on the DTO. The `multiplier` (`Σ fullEmissions ÷ Σ WB stock` over the forward window
`[referenceYear, referenceYear + horizonYears(horizon)]`, business §2.5) is **horizon-reactive** —
`today` collapses the window to the single reference year (the measured-year ratio), a longer horizon
widens it over projected years; the deck **surfaces the badge from slide 3** with the forgone-sink
reveal (§11.2, UI §6.6). `ReferenceDTO` (the fossil denominator) is fetched in every global-scope view
(no fossil-reference toggle — business §4.1) and its `fossilTotal` is **projected to the horizon target
year** so it integrates over the same forward window as stock/forgone.

**Design note (consistency with business §2.5):** all headline quantities that feed magnitude
panels and equivalences are **annual flows** (Mt CO₂/yr); the forgone sink is the annual deficit
(a cumulative *level*), the stock is the annual flow — units consistent by construction.

**Composite floor = 2000 (per user, B).** The WB deforestation **stock** exists only from **2000** at
country level (`deforestationStock.coverageFrom`), while forest area — and therefore the forgone-sink
integral — now runs from the chosen `baseline` (as far back as **1800** via the LUH2 reconstruction,
business §7.2a). Rather than render an early sink-only composite, the full-emission composite is
**clamped to `COMPOSITE_STOCK_FLOOR = 2000`** so `stock` and `forgoneSink` are always present together.
The clamp is a display/derivation floor computed from `coverageFrom`, not a new user control.
`stock`/`forgoneSink`/`fullEmissions` therefore begin at `max(baseline, 2000)`; `area`/`cumulativeLoss`
begin at `baseline` (`BASELINE_FLOOR = 1800`, ADR-026). The cumulative-loss integration origin is the
`baseline` itself; the reconstructed `area` below 1990 makes an 1800-origin integral possible.

### 3.2a Isomorphic derive layer (client/SSR) — `baseline`-dependent quantities (ADR-026)
Because `stats.ts` is pure/isomorphic (§5), the baseline-dependent tail
(`cumulativeLoss → forgoneSink → fullEmissions → multiplier → crossingYear`) is computed **off the DTO on
the frontend** — during **SSR** (honouring the URL `baseline` on first paint) and on **every baseline-slider
frame** in the browser, with **no server round-trip**. A thin `derive(DTO, baseline, cfg)` composable wraps
the same `stats` functions the server used pre-ADR-026 (`stats.cumulativeLoss`, `stats.forgoneSink`,
`stats.fullEmissions`, `stats.aggregateForgoneSink`, `stats.multiplier`, `stats.crossingYear`), reading
per-domain `R` from `shared/config`. There is **no math drift** (single implementation, both tiers).
The `referenceYear` and the equivalence/forgone **annual rate** read at it stay measured quantities
(business §7.1a); the `multiplier`, donut and share are **horizon-reactive `Σ` over the forward window**
`[referenceYear, referenceYear + horizonYears(horizon)]` (§17.4), computed client-side. The global
aggregate band is recombined client-side via the isomorphic `aggregateForgoneSink` (asymmetric-safe
quadrature, §5).

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
trend differ per domain. The projected points carry
`meta.projectedFrom = <last measured year>`; composite scalars (`multiplier`, `referenceYear`, donut,
share, equivalence annual rate) are computed on **measured data only**, never on projected points
(business §7.1a). `horizon='today'` skips projection entirely (`projectedFrom = null`).

**These DTOs are the deck's whole server contract — unchanged by the story reframe (ADR-021).** The
story deck (§17) is a **frontend-only presentation layer**: `SlideDef[]`, scenes and slides live in
`app/story/` and are invisible to the server. Each visualisation names a **metric subset** of the DTO
it already receives (e.g. slide 2 draws `stock` only; slide 3 adds `forgoneSink`/`fullEmissions` from
the *same* `DomainResultDTO`; slide 6 pulls `forgoneSink` out of the deforestation bar). Metric
selection is a **client-side presentation transform** applied by the chart-option class (§11) over a
DTO the store already holds — it adds **no route, DTO field or `DerivationParams` key**, and never
triggers a refetch. The deck controls tagged *server-refetch* (`domain`, `horizon`) change
`DerivationParams` and thus the cache key; `timeRange` (ECharts `dataZoom`), **`baseline`** (ADR-026,
client-transform → isomorphic derive §3.2a) and metric selection are pure view state (§10.1, ADR-023).

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

## 5. Statistics module (`shared/utils/stats.ts`)

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
sumWindow(series: Series, from: number, to: number): number;   // Σ non-null values over inclusive [from,to] (shared by multiplier + scene diagrams)
multiplier(stock: Series, full: Series, from: number, to: number): number;  // Σfull ÷ Σstock over [from,to]; today→single year; NaN if Σstock=0
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
- **`ForestAreaService(adapter, domainConfig, reconstruction)`** — fetches `AG.LND.FRST.K2` for a
  domain's ISO3 set (parallel) and returns the **per-country** area series (`domainAreaByCountry`,
  fan-out only — the summing + coverage gating is the `AggregationService`'s job). It also injects the
  **LUH2 reconstruction loader** (`reconstruction`, ADR-026): a static per-domain 1800–1990 area asset
  (`shared/data/luh2/<domain>.json`, produced offline §1). The reconstruction is **anchored** to the
  domain's measured `AG.LND.FRST.K2` at 1990 (additive/multiplicative offset) and **spliced** ahead of
  the measured series, tagging `meta.reconstructedBefore = 1990` on the pre-1990 points. Because the
  reconstruction is a domain-level total (already masked offline), it is spliced onto the **aggregated
  domain area**, not per country.
- **`EmissionsService(adapter, indicatorRegistry)`** — fetches LULUCF `.DF` stock as **per-country**
  series (`domainStockByCountry`, fan-out only) plus the fossil totals (`globalFossil`,
  `countryFossil`); handles negative net values and the two-methodology note in meta.
- **`AggregationService(forestAreaService, emissionsService, domainConfigs, coverageGate, stats)`** —
  the core orchestrator. `buildDomain` fetches the per-country area + stock, runs the **`CoverageGate`
  once** to get the shared excluded set + per-indicator window, then for each metric **filters
  survivors → `stats.sumSeries` → clips to that indicator's window** (single consistent country set).
  It then produces `DomainResultDTO`/`GlobalResultDTO` carrying only the **baseline-independent** series —
  the full-range **`area`** (reconstruction spliced 1800–1990 + measured + projection) and **`stock`**
  (ADR-026). It **no longer** computes `cumulativeLoss`/`forgoneSink`/`fullEmissions`/`multiplier`/
  `crossingYear` on the DTO — those move to the isomorphic client/SSR derive layer (§3.2a), since they
  depend on the client-transform `baseline`. It still **applies the `horizon` param by extending each
  domain's area series via `stats.projectSeries(…, horizonTargetYear(horizon))`** (per-domain,
  pre-aggregation — §3.2), so the shipped `area` already includes the projected tail; `× R_domain`,
  cumulative loss and the aggregate band now happen client-side. The global aggregate stock is a **plain
  `sumSeries` of the four per-domain series** — no domain-tier exclusion.
- **`ReferenceService(emissionsService)`** — ships only the **baseline-independent** global fossil
  denominator series (`fossilTotal`) + `referenceYear` (ADR-026). `fossilTotal` is **projected to
  `horizonTargetYear(horizon)`** (`stats.projectSeries`, identity for `today`) so the scene's forward
  window sums fossil over the same range as stock/forgone (§17.4); the endpoint cache key includes
  `horizon`, so a horizon change refetches the correctly-projected series. The donut slices (stock +
  forgone) and share % are CLIENT-DERIVED from the global DTO's derived tail at the live baseline —
  not here.
- **`EquivalenceService(aggregationService, equivalenceConfig)`** — ships only the **locale-driven
  country unit basis** (`referenceCountry.iso3` + `referenceCountryAnnualCO2` at `referenceYear`,
  baseline-independent, ADR-026). The slide-6 strip's four magnitudes and car/country equivalents are
  client-derived from the global DTO at the live baseline.

**Parallelism (ADR-010):** services issue independent adapter calls via `Promise.all`
(e.g., area + stock in parallel; all domains of a global request in parallel) and tolerate partial
failure with `allSettled` where a gap must not sink the response.

**Horizon/scenario handling:** services are pure functions of `DerivationParams`. There is a
**single accounting** — the forgone-sink family (`forgoneSink`/`fullEmissions`/`crossingYear`/
`multiplier`) is **always derivable**, now CLIENT-DERIVED from the baseline-independent DTO at the
live baseline (§3.2a, ADR-026). The `horizon` param changes how far each series is projected
(via `stats.projectSeries`, per-domain, pre-aggregation) **and** the width of the forward window the
`multiplier` / donut / fossil bar / equivalence strip integrate over (`[referenceYear, referenceYear +
horizonYears(horizon)]`, §17.4); the `referenceYear` anchor and the annual rate read at it stay
horizon-invariant. This is the single authoritative
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

| Route | DTO | Applies to (scene) |
|---|---|---|
| `GET /api/domain/[id]` | `DomainResultDTO` | main scene, local domain (main chart, multiplier) |
| `GET /api/global` | `GlobalResultDTO` | main scene (global) + crossing scene, multiplier |
| `GET /api/reference` | `ReferenceDTO` | footprint scene: donut + fossil bar + share-of-footprint |
| `GET /api/equivalence` | `EquivalenceDTO` | equivalence — **not fetched for the slide-6 strip** (its 4 magnitudes are client-derived from the global DTO, §17.4); reused only for the locale-driven reference-country scalar behind the `country` unit |

**Param validation:** `baseline` is **not an endpoint param** (ADR-026 — it is client-transform; the
server ships the full-range `area` regardless of baseline). The endpoints validate only `scope`/
`domainId` (require `domainId` when `scope=local`), `horizon` (`today`/`20y`/`30y`/`50y`/`75y`/`100y`)
and `rScenario`. The **client** clamps `baseline` to `[BASELINE_FLOOR=1800, latestMeasuredYear]`.
Invalid → 400 with a localized-key error code.

**Caching (ADR-005/014) — CDN-first:** `routeRules` set cache headers so the **Vercel CDN** caches
each response by URL (the full `DerivationParams` signature is in the query string), with high
`maxAge` (hours–day) + stale-while-revalidate, because WB data changes ~yearly. `defineCachedFunction`
is a **second, in-function layer** for warm instances. This survives serverless cold starts/scaling
(a purely in-memory cache would not); upgradeable to a KV/blob storage driver without contract
change. Every endpoint must therefore be a deterministic function of its query params.

**Parallelism / errors (ADR-010):** handlers may resolve several service calls with `Promise.all`;
partial gaps travel in `meta.gaps`, not as failures. A genuine upstream failure → 502 with a
retryable localized error; per-endpoint isolation keeps the rest of the deck alive.

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

Three stores; all displayed data lives here; no component-local data. Because the deck is a single
persistent route (§17, ADR-023), control/view state is **keyed per scene**, not held as one flat
current-view — revisiting a scene restores its state (reset policy A), first entry uses the slide's
authored defaults.

**Authored scene defaults (business §4.1):** the *main* scene opens at `scope='global'`,
`horizon='today'`, `domainId='amazon'` (surfaced control), `rScenario='mid'`, `baseline=1990` (now a
client-transform default, not part of `params` — ADR-026), `timeRange=null`; the *crossing* and
*footprint* scenes are `forced` to `scope='global'`. Opening at
`horizon='today'` (measured data only, no projection) and pushing the horizon out is the signature
interaction that reveals the forward debt.

### 10.1 `useViewStore` — per-scene control/view state
```ts
type EndpointKey = 'domain' | 'global' | 'reference' | 'equivalence';
type SceneId = 'intro' | 'main' | 'crossing' | 'footprint';

interface SceneState {
  params: DerivationParams;            // scope/domainId/horizon/rScenario for THIS scene (server cache key; NO baseline — ADR-026)
  baseline: number;                    // client-transform control (ADR-026): drives isomorphic derive §3.2a, never refetch; 1800–present
  timeRange: [number, number] | null;  // ECharts dataZoom view-state ONLY — no refetch, no data crop (ADR-005)
}
state: {
  currentScene: SceneId;
  sceneState: Map<SceneId, SceneState>;   // seeded from authored SlideDef.params/forced on first entry
}
getters: {
  derivationParams: () => DerivationParams;   // = sceneState.get(currentScene).params — the SERVER cache key (baseline-free)
  baseline:         () => number;             // the current scene's client-transform baseline
  timeRange:        () => [number, number] | null;
}
actions: {
  enterScene(id);                       // set currentScene; seed sceneState from SlideDef if absent (policy A)
  setControl(key, value);               // mutate current scene's params; server-refetch controls only
  setBaseline(year);                    // mutate current scene's baseline — client-transform, re-derives §3.2a, never refetch
  setTimeRange(range);                  // mutate current scene's timeRange — pure view state, never refetch
}
```
Controls are tagged by **derivation mode** (ADR-021): `domain`, `horizon` are *server-refetch* (they
change `derivationParams` → the data store fetches); **`baseline`** (ADR-026) and `timeRange` are
*client-transform / client-only* (pure view state — `baseline` re-runs the isomorphic derive §3.2a, no
fetch). There is no `fossilReference`/`equivalenceHorizon` field — the donut
is always shown in global scope and slide 6's equivalence strip (§17.4) reads `baseline` + `horizon`
directly (its forward window is `[referenceYear, referenceYear + horizonYears(horizon)]`, `sceneWindow`;
`baseline` shapes the forgone depth, `horizon` the window width); its
**unit** choice is a separate client-only
view field (`mtco2`/`car`/`country`, default `car`), not a `DerivationParam`. Metric selection
(stock-only vs +forgone) is **not** stored here: it is authored per-slide in the `VizConfig` (§17)
and applied as a presentation transform in the option class (§11). Slides 2→3 and 5→6 therefore
**stay in the same scene with the same `params`** — only the visualisation's metric set changes, so
the chart animates in place (ADR-022) with no refetch.

**URL sync (ADR-017/023).** A router-sync layer maps the **current scene's** `derivationParams ↔
route.query` (replace, not push) plus the active slug: on load the store initializes the scene from
the query, falling back to authored defaults for any missing/invalid key (validation reuses the
server param validation, §8); each server-refetch control change rewrites the query. `horizon` **is**
in the URL (part of `DerivationParams`); **`baseline` is also in the URL** for shareability (ADR-017
amendment / ADR-026) but is client-transform — a `baseline` change rewrites the query **without** a
refetch (it re-runs the isomorphic derive §3.2a); `timeRange` stays out (pure view state). Entering a
scene whose `params` differ **resets that scene's `timeRange` to `null`** (scenes span different
x-ranges).

### 10.2 `useDataStore` — fetched/derived DTOs + caching
```ts
state: {
  dtoCache: Map<string, DomainResultDTO | GlobalResultDTO | ReferenceDTO | EquivalenceDTO>;
  inFlight: Map<string, Promise<unknown>>;   // dedupe concurrent identical fetches
  loading: Record<EndpointKey, boolean>;
  errors:  Record<EndpointKey, StoreError | null>;
}
actions: {
  loadForScene(params);   // fetches the endpoints a scene needs IN PARALLEL (Promise.all), deduped.
  prefetch(params);       // idle-time warm of the next slide's scene params (ADR-023)
}
getters: {
  currentMainResult;      // domain or global DTO for current scene's params (baseline-independent, ADR-026)
  currentDerived;         // = derive(currentMainResult, viewStore.baseline, cfg) — isomorphic §3.2a; recomputed on baseline change, NO fetch
  currentReference; currentEquivalence;   // equivalence restaged on slide 6 (strip §17.4, mostly client-derived from the global DTO)
  multiplier;             // from currentDerived (baseline-dependent, ADR-026)
}
```
**Caching key** = `endpoint + JSON(derivationParams)` — **baseline-free** (ADR-026), so moving the
baseline slider **never** changes the key and **never** refetches. On a scene entry or a server-refetch
control change (`domain`/`horizon`) the action computes the key; a cache hit returns instantly
(server-authoritative first fetch warms `dtoCache` → instant re-select of an already-visited
horizon/scene, ADR-005). `inFlight` dedupes simultaneous identical requests, and `prefetch` warms the
next slide's params on idle so forward navigation is instant. The **baseline slider** and the
**time-range zoom** only update the current scene's `baseline`/`timeRange`; `baseline` re-runs the
isomorphic `derive` (§3.2a) over the cached DTO, `timeRange` binds to ECharts `dataZoom` — neither
refetches.

### 10.3 `useUiStore` — locale, theme, presentation
Locale (SK/EN, synced with `@nuxtjs/i18n`), active theme tokens (**fixed dark in V1** — no
light-mode toggle, ADR-002), the injected `Formatter` (§11.5), global loading/error surfaces.

**SSR (ADR-001):** stores are per-request; `loadForScene` may run inside `useAsyncData` during SSR so
the first slide's scene data is in the hydration payload; the client rehydrates without a duplicate
fetch.

---

## 11. Chart-option class system (ADR-007/024)

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
// A slide's authored VizConfig (§17) → the presentation transform each option class applies.
// `metrics` names the DTO-metric subset this visualisation renders; the same DTO drives slide 2
// (['stock']) and slide 3 (['stock','forgoneSink']) → the option class emits fewer/more series and
// ECharts animates in place (ADR-022/024). Empty/omitted = the option's default full metric set.
interface VizPresentation {
  metrics: string[];                      // e.g. ['stock'] | ['stock','forgoneSink'] | ['deforestation','fossil']
}
abstract class BaseChartOption<TData> {
  constructor(protected data: TData, protected ctx: ChartContext,
              protected presentation: VizPresentation) {}
  protected has(metric: string): boolean; // presentation.metrics gate (empty = show all)
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
The `presentation` (metric selection) is a **client-side transform** authored per slide (§17) — it
carries no data and never triggers a refetch; the DTO is unchanged (§3.2). Keeping the *same*
DTO/`ctx` and varying only `presentation.metrics` is exactly what lets slides 2→3 and 5→6 update via
`setOption` on a preserved chart instance (ADR-022) instead of remounting.
Centralizes ECharts boilerplate, theme→color mapping, i18n labels, number/unit formatting, the
measured-vs-estimate visual distinction (solid stock vs dashed forgone sink + band), the
**measured-vs-projected split** (a metric is emitted as two series at `meta.projectedFrom` — same
color/stack order, the projected one dashed-and-lighter, excluded from the legend via the
`legend.data` allowlist, with a join-year divider `markLine`, business §2.4a / UI §4.5), empty/loading
handling, and the `state/flow` → axis-type mapping. Subclasses implement only `buildSeries()` plus
chart-specific overrides.

**Why the split (ECharts limitation).** ECharts cannot switch a single line solid→dashed mid-series
(no per-segment dash; `visualMap` only recolours). So each metric is split into **separate series** at
its join years: a **dashed reconstructed** segment BELOW `meta.reconstructedBefore` (1990, ADR-026), the
solid **measured** segment, and a dashed **projected** segment ABOVE `meta.projectedFrom` — all sharing
the metric's colour and stack, the dashed twins using `estimateStyle()` (dashed + reduced opacity). Only
the measured series appear in `legend.data` (the dashed reconstructed/projected twins are name-suffixed
and omitted) so the legend stays clean. Divider `markLine`s mark **1990** (reconstruction join) and the
projection join year. This is a **binding contract** with UI §4.5 / design proposal.

### 11.2 Concrete subclasses (one responsibility: data + presentation → complete `Option`)
Each takes the `presentation.metrics` set (§11.1) so the deck can reveal metrics in place:
- **`MainStackedOption`** (main scene): stock (solid) always; forgone-sink (dashed + band) and the
  `fullEmissions` framing appear **only when `metrics` includes `forgoneSink`** — this is the whole
  slide-2→slide-3 reveal (business §4.3, UI §6.1). Each series is split into a **dashed reconstructed
  (pre-1990)** + solid measured + **dashed projected** segment at `reconstructedBefore`/`projectedFrom`
  (ADR-026). When the reader drags the baseline back, the forgone-sink curve re-derives client-side
  (§3.2a) and the pre-1990 dashed segment lengthens in place. Same DTO/`ctx` on both slides → the added
  series animate in (ADR-022), no remount.
- **`GlobalStackedAreaOption`**: per-domain stacked area + one aggregate band; each layer split
  measured/projected at its own join year, with a single join-year divider.
- **`CrossingOption`** (crossing scene, global): **annual stock impulse** vs **cumulative
  forgone-sink level** + marked crossing point (semantics unchanged — business §4.4). The extended
  horizon window is what finally gives it enough span to reach the crossing; the projected tail is
  dashed-lighter.
- **`FootprintDonutOption`** (footprint scene): composition donut. Slide 5 shows **3 slices**
  (fossil, stock, forgone sink); slide 6 drops `fossil` from `metrics` → the donut animates to the
  **2 deforestation slices** (stock + forgone sink) and rescales. Reads `ReferenceDTO.composition`.
- **`FossilComparisonOption`** (footprint scene, **global only**): **one grid, two categories**
  (`deforestation`, `fossil`) sharing a **single Y-axis** (ADR-024) — restructured from the old
  two-grid design specifically so slide 6 can animate. Slide 5 draws both category bars (deforestation
  = stock + forgone sink; fossil at the reference year). Slide 6 drops `fossil` from `metrics` → the
  fossil bar leaves and the deforestation bar splits its `forgoneSink` out as its own stacked layer
  (or sibling bar) over `stock`, the shared axis rescaling to the deforestation-only range ("zoom
  in", UI §6.3). Consumes `currentReference` (fossil) + `currentMainResult` (aggregate deforestation).

**Single-axis rescale.** `FossilComparisonOption` uses one `yAxis` whose `max`/`interval` are derived
from the **visible** categories via `sharedYAxis()`, so removing `fossil` recomputes the axis to the
deforestation range (the animated rescale). A protected
`sharedYAxis(...seriesGroups): { max: number; interval: number }` computes the "nice" maximum + tick
interval across the supplied (visible) series.

All are **pure** (no fetch, no Vue reactivity, no side effects) → directly unit-testable by asserting
the produced `Option` for a given `(data, ctx, presentation)` triple, including the metric-reveal and
metric-drop transforms (ADR-013).

### 11.3 `useChartContext` (the shared injection bundle, ADR-009)
```ts
function useChartContext(): ComputedRef<ChartContext> {
  const view = useViewStore(); const ui = useUiStore();
  const { t } = useI18n();
  return computed(() => ({ t, theme: ui.theme, formatter: useFormatter(),
                           breakpoint: ui.breakpoint, horizon: view.derivationParams.horizon,
                           rScenario: view.derivationParams.rScenario }));
}
```
This composable is **Pinia-aware** and lives in the parent (deck) components. It bundles the
cross-cutting context (i18n, theme, formatter, breakpoint, horizon, R) that every option class needs
— all read from the **current scene's** params (§10.1). It carries neither the metric selection (that
is the slide's authored `VizPresentation`, §11.1/§17) nor `timeRange` (bound directly to `dataZoom`,
§11.4). The chart components themselves are **Pinia-unaware**: `GenericSlide` reads the DTOs from the
data store and passes them, together with `ctx` and the slide's `presentation`, as **typed props**.

### 11.4 Rendering tiers
- **`BaseChart.vue`** (tier 1): props `{ option, loading, theme }`; wraps `<VChart :option
  :autoresize />` inside the module's client-only rendering; no domain logic; responsive. The
  zoomable charts bind ECharts `dataZoom` and emit a `timeRange` event upward (never touch Pinia).
- **Per-chart components** (tier 2, Pinia-unaware): take typed props `{ <dto>, ctx: ChartContext,
  presentation: VizPresentation, loading? }`, build their option class in a local `computed`, and
  pass `:option`/`:loading` to `BaseChart`. They hold no math and read no store. The main/global/
  crossing charts also re-emit `timeRange`.
- **`GenericSlide`** (the deck's Pinia-aware chart owner, §17): from a `RenderableSlide` it reads the
  DTOs + `useChartContext()` from the stores, and for each `VizConfig` renders the matching tier-2
  component **keyed by `viz.id`** with its `presentation` (metrics). It persists the charts'
  `timeRange` emits back to `viewStore.setTimeRange`.

**Chart identity (ADR-022).** The tier-2 chart is `:key`ed on `viz.id`, a stable id **shared across
the slides of one scene**. Within a scene (slides 2→3, 5→6) the id is unchanged, so Vue preserves the
`<VChart>` instance and only the recomputed `:option` flows through → ECharts `setOption` animates
(series added/removed, axis rescaled) with no canvas reload. Crossing a **scene boundary** uses a
different `viz.id` → a fresh mount. This keying is a binding contract with UI §7 and §17.

**Reactivity:** each chart wraps its option in a `computed` over its props (`dto`, `ctx`,
`presentation`); `GenericSlide`'s DTO getters and `ctx` are themselves `computed` over Pinia state.
When state (data, scene params, baseline, or authored metrics) changes, the props update → the `Option`
recomputes → `<VChart>` updates. A **horizon/domain** change flows: control → viewStore (scene params) →
data fetch/cache → `GenericSlide` getters → props → chart `computed` → new `Option`. A **baseline** change
(ADR-026) flows **without a fetch**: slider → `viewStore.setBaseline` → `currentDerived` getter re-runs the
isomorphic `derive` (§3.2a) over the cached DTO → props → chart `computed` → new `Option` → `setOption`
animates the shifted curve in place (real-time). A metric reveal (2→3, 5→6) flows purely: next slide's
`presentation` → same-keyed chart → new `Option` → in-place animation, no fetch.

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
| `stats.ts` | Vitest | movingAvg/detrend/diff/cumulative, forgoneSink+band (asymmetric CI), fullEmissions, `sumWindow` (inclusive Σ), `multiplier` (Σfull/Σstock over window; single-year today; NaN on Σstock=0), aggregate band with two-sided deviation combine (asymmetric-safe), crossingYear, equivalence; `projectSeries` (slope+clamp≥0, `projectedFrom` set, `today`/target≤last → unchanged), `sumSeries`; correlation guards reject state×state levels; determinism |
| `WdiAdapter` | Vitest + fixtures | `response[1]` parsing, aggregate filtering, `mrnev`/holes (null preserved), gap recording, normalization to `DataPoint`/meta (incl. `projectedFrom: null`) |
| Services | Vitest + stub adapter | DTO shape, `referenceYear` = min common data year, forgone-sink family always present, `referenceYear` anchor + annual rate horizon-invariant, `ReferenceService` projects `fossilTotal` to `horizonTargetYear` (identity for `today`), per-domain projection before aggregation, committed equivalence (annualRate × horizonYears), parallel fan-out, partial-failure tolerance |
| Chart-option classes | Vitest | produced `Option` for a `(data, ctx, presentation)` triple: series count under a metric set, metric-reveal (stock→stock+forgone) and metric-drop (donut/bar lose fossil, axis rescale), estimate styling (dashed+band), measured/projected split at `projectedFrom` (twin series, projected omitted from `legend.data`, divider markLine), fossil-comparison one-grid two-category shared axis, axis types from seriesType, i18n/format usage |
| Config integrity | Vitest | domain `r = rAboveground × allometricFactor` (factor = 1.24), CI ordering low≤mid≤high, indicator seriesType coverage, `horizonTargetYear`/`horizonYears` mapping |
| Story config + factory | Vitest | `slides.ts` well-formed (8 slides / 5 scenes, valid layout preset + VizKind + metrics per VizConfig, forced-global on crossing/footprint/baseline); `SlideFactory` → `RenderableSlide` (resolves scene params, layout, viz list); `viz.id` stable within a scene, distinct across scenes; server-refetch vs client-only control tagging (incl. `baselineSlider`) |
| Store flow | Vue Test Utils | per-scene `sceneState`: entering a scene seeds authored defaults / restores prior state (policy A); server-refetch control → correct `derivationParams` → apiClient call → `dtoCache`; `timeRange` (`dataZoom`), `baseline` (client-transform, ADR-026) and metric selection do NOT refetch; horizon/domain DO (then cache hit/dedupe); URL query sync of current scene's params |
| Deck components | Vue Test Utils | `GenericSlide` renders the layout preset + controls a scene surfaces; charts keyed by `viz.id` (same key 2→3 & 5→6, new key across scene boundary); the 5→6 `duo-viz-text`→`duo-viz-equiv` preset change does **not** remount the `viz.id`-keyed charts (stable `#viz` outlet, ADR-025); horizon='today' hides projection + divider; multiplier appears from slide 3; `EquivalenceStrip` renders on slide 6 only (4 colour-coded values, unit switcher converts all four, default `car`) |

Fixtures for the adapter are captured during the live spike (business §10).

---

## 16. Consistency audit & conflict resolution (mandatory)

Every new element checked against the earlier documents; conflicts resolved for global consistency.

1. **"Server computes derivations" (handoff §9) vs. "instant R/mode toggle" (UX).**
   *Resolution (ADR-005):* server-authoritative single path; refetch on R/mode change; BFF cache
   keyed by `DerivationParams` + a store cache by the same signature + in-flight dedupe → instant
   after warm-up. No client re-implementation of the math → no drift. **Consistent.**
   *Amended (ADR-026, see #37):* the **`baseline`** dimension alone moves to a client/SSR isomorphic
   recompute (real-time slider); still no drift because the *same* `stats` module runs both tiers.

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
    *Resolution (§7.2a, ADR-026, UI §3):* baseline is a **client-transform** control over the range
    `[1800, latestMeasuredYear]` (reconstructed pre-1990 via LUH2), explicit label "from loss after
    {X}", **not** part of `DerivationParams`. It re-derives baseline-dependent quantities via the
    isomorphic `stats` core (§3.2a) in SSR + browser without a refetch, and is carried in the URL for
    shareability. **Consistent.**

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
    equivalence); the UI surfaces it. The forgone/equivalence **annual rate** is read at that year; the
    multiplier / donut / fossil / equivalence-window figures use it as the **lower edge of the forward
    window** they Σ over (ADR-019/025, §17.4). **Consistent** — no silent mixing of different end-years.

15. **Fossil-reference share as a toggle vs. always-visible context.**
    *Resolution (business §4.1, UI §3/§7, per user B6):* there is **no** fossil-reference toggle
    anywhere; in global scope the share-of-footprint **donut and the share number are always shown**.
    No `fossilReference` field exists in state, DTOs or params. **Consistent** — a single always-on
    presentation, no hidden mode.

16. **Multiplier — client-derived, horizon-reactive; badge surfaced from slide 3.**
    *Resolution (§3.2a/§17.4, UI §6.6, business §2.5/§4.2, ADR-019/025):* with the official↔full switch
    removed, `multiplier` is **always derivable** — `Σ fullEmissions ÷ Σ WB stock` over the forward
    window `[referenceYear, referenceYear + horizonYears(horizon)]` (how many times official numbers
    understate the impact), CLIENT-DERIVED from the baseline-independent DTO at the live baseline
    (ADR-026), not carried on the DTO. It is now **horizon-reactive**: `today` collapses the window to
    the single reference year (the measured-year ratio, preserving prior behaviour) and a longer horizon
    widens it over projected years. The deck **shows the badge from slide 3** (the forgone-sink reveal),
    not on the stock-only slide 2 (§23). **Consistent** — one headline multiplier, never a trivial 1×.

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

19. **Single Domain control vs. two-axis data model (global-first deck).**
    *Resolution (§2.4/§17.1, UI §5):* scope and domain remain **two independent state variables**
    (`DerivationParams.scope` + `domainId`). The deck is **global-first**: only the **main scene**
    surfaces a `DomainSelect` (rendered from `SCOPE_SELECTOR_OPTIONS` — four local domains, delimiter,
    default Global), each entry mapping back onto both variables; the crossing/footprint scenes
    **force `scope:'global'`**. No change to DTOs, params, endpoints or the cache key. **Consistent** —
    server contract untouched; there is no standalone scope toggle.

20. **URL-synced deck state vs. cache key and view-only time range.**
    *Resolution (ADR-017/023, §10.1, UI §4):* the active slug + the **current scene's**
    `DerivationParams` are synced to `route.query` (replace) — and `horizon` **is** in
    `DerivationParams`, so it is shareable. `timeRange` and metric selection stay out (pure view
    state). The query signature is exactly the cache key (ADR-014), so sharing a URL warms the same
    cache. **Consistent** — no new contract, `timeRange`/metrics stay client-only (point 13/#34).

21. **"Fully localized" vs. international (non-localized) numbers.**
    *Resolution (ADR-018, §11.5, UI §1/§4.4):* **copy, labels and units localize** (i18n keys);
    the **numeric part is international compact notation** (`3.2M`, `×3.2`) via the injected
    `Formatter`. This is a deliberate scoping of localization, not a contradiction. **Consistent.**

22. **Non-interactive legend vs. layer visibility + projected twin series.**
    *Resolution (UI §6.5/§7, §3, §11.1):* the legend is **display-only**; which layers show is driven
    by the **slide's authored metric selection** (the 2→3 reveal, the 5→6 fossil-removal — §11.2), not
    a per-layer toggle. The dashed **projected** twin of each metric is **excluded from `legend.data`**
    so the legend shows one entry per metric regardless of horizon. A clickable legend would
    reintroduce contradictory per-layer state. **Consistent.**

23. **Multiplier badge placement + when it appears.**
    *Resolution (UI §6.6, §11.2):* a **single** `MultiplierBadge` instance lives **top-right of the
    main chart**; it **appears from slide 3** (with the forgone-sink reveal — it is meaningless on the
    stock-only slide 2) and is not duplicated in the header. **Consistent** — one source of truth for
    the headline number, surfaced when the full accounting is on screen.

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
    per domain. Composite figures are **anchored** at `referenceYear`: pointwise ones
    (`referenceYear`, equivalence rate, full-emissions level) stay at the measured year, while
    window figures (`multiplier`, donut, share, fossil bar, equivalence totals) integrate over the
    forward window `[referenceYear, referenceYear + horizonYears(horizon)]` (§17.4) — collapsing to
    the reference year at `today`. **Consistent** — one horizon axis, honest anchor.

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

34. **Story-deck presentation vs. the unchanged server contract.**
    *Resolution (ADR-021, §0/§3.2/§17, business §4, UI §3):* the guided six-slide deck is a
    **frontend-only** presentation layer — `SlideDef[]` config, `SlideFactory`, `GenericSlide`,
    `SlideLayout` — living in `app/story/` + `components/deck/`. It adds **no** route, DTO field or
    `DerivationParams` key; the server does not know slides exist. "Which metrics a slide shows"
    (stock-only vs +forgone; donut/bar with-or-without fossil) is a **client-side presentation
    transform** authored as `VizConfig.metrics` and applied by the option class over a DTO the store
    already holds — never a refetch. Only `domain`/`horizon` (server-refetch controls) change
    `DerivationParams`; `timeRange`, `baseline` (client-transform, ADR-026) and metric selection are
    pure view state.
    **Consistent** — story architecture is additive on the frontend, server contract intact.

35. **In-place chart animation vs. route/component remounting.**
    *Resolution (ADR-022/023, §10.1/§11.4/§17, UI §7):* the deck is **one persistent `/story/:slug`
    route** that does not remount, and each visualisation carries a stable **`viz.id` shared across
    the slides of one scene**. Slides 2→3 and 5→6 stay in the same scene with the same `params` and
    the same `viz.id`, so Vue preserves the `<VChart>` instance and only the recomputed `:option`
    flows through → ECharts `setOption` **animates** (series added/removed, axis rescaled) with no
    canvas reload; crossing a **scene boundary** uses a new `viz.id` → a fresh mount. No shared-element
    morph in V1 (`prefers-reduced-motion` drops the transition). **Consistent** — chart identity is
    the single mechanism for the two authored animations.

36. **Fossil-comparison restructured to one grid, two categories.**
    *Resolution (ADR-024, §11.2, UI §6.3):* the deforestation-vs-fossil chart is rebuilt from the old
    two-grid/shared-axis design into **one grid with two categories** (`deforestation`, `fossil`) on a
    **single Y-axis** — specifically so slide 6 can animate: dropping `fossil` from the visible metric
    set removes the fossil bar, splits the deforestation bar's `forgoneSink` into its own stacked
    layer over `stock`, and rescales the one axis to the deforestation range ("zoom in"). This
    supersedes audit #25's two-grid `sharedYAxis` wording for the deck; `sharedYAxis()` is retained as
    the axis-nicing helper across the visible categories. **Consistent** — restructure serves the
    5→6 in-place animation, same data, no new endpoint.

37. **Real-time baseline slider (back to 1800) vs. "server computes all derivations, no client math" (#1/ADR-005).**
    *Resolution (ADR-026, §3.2/§3.2a/§10):* `baseline` is **re-tagged from server-refetch to
    client-transform**. The BFF ships the **baseline-independent** full-range `area` series (LUH2
    reconstruction 1800–1990 anchored to WB 1990 + measured + projection) and `stock`; the
    baseline-dependent tail (`cumulativeLoss`/`forgoneSink`/`fullEmissions`/`multiplier`/`crossingYear`)
    is recomputed by the **isomorphic** `stats` core (§5) in a client/SSR derive layer (§3.2a) on every
    slider frame with **no refetch**. This narrowly amends #1's "no client re-implementation" **for the
    `baseline` dimension only** — there is **no math drift** because the *same* module runs both tiers
    (exactly the mitigation #1 relied on). `scope`/`domain`/`horizon`/`rScenario` stay server-refetch.
    `baseline` leaves `DerivationParams`/the cache key but stays in the URL (client-transform, ADR-017
    amendment). **Consistent.**

38. **Reconstructed pre-1990 area vs. FAO/WB measured floor (business §7.2) and the "no series before 1990".**
    *Resolution (ADR-026, business §7.2a):* the pre-1990 gap is filled by an **offline** LUH2
    reconstruction (per-domain `(primf+secdf)×carea`), **anchored** to the measured `AG.LND.FRST.K2` at
    1990 (OWID's sanctioned bridge — never a blind splice) and rendered **dashed** below `1990`
    (`meta.reconstructedBefore`, mirroring the dashed projected future). Carbon stays `R × cumulativeLoss`
    with the **same `R` band** pre/post 1990, treated as a **central** (not upper-bound) estimate — a
    conscious editorial call justified by the literature under-estimating `R` (business §6/§7.2a). A single
    reconstruction curve (no cross-dataset envelope) in V1. **Consistent** — one continuous, honestly
    labelled methodology; the reconstruction is a static build asset, not a runtime source.

No unresolved contradiction remains. Any future element must be checked against this section and
the earlier documents before adoption.

---

## 17. Story deck orchestration layer (frontend, ADR-021/022/023/024)

The presentation is a **linear eight-slide deck** ("Story of Deforestation" / "Príbeh deforestácie",
business §4). This layer is **entirely on the frontend** and additive over §§10–11: it authors the
slides, resolves them into renderable units, drives one persistent route, and keys charts for
in-place animation. It touches **no** server code, DTO or param (§16.34).

### 17.1 Authored config (`app/story/slides.ts`)
```ts
type SceneId   = 'intro' | 'main' | 'crossing' | 'footprint' | 'baseline';  // + ADR-026 baseline scene
type LayoutPreset =
  | 'text' | 'viz-text' | 'duo-viz-text' | 'duo-viz-equiv'  // closed set (ADR-024/025)
  | 'caption-viz' | 'viz-equiv';                             // + ADR-026 baseline scene
type VizKind   = 'mainStacked' | 'globalStackedArea' | 'crossing' | 'donut' | 'fossilComparison';
type ControlKey = 'horizon' | 'domain' | 'baseline' | 'baselineSlider' | 'timeRange';  // deck-surfaced controls only

interface VizConfig {
  id: string;                 // STABLE chart identity; SHARED across a scene's slides (ADR-022)
  kind: VizKind;              // which tier-2 chart component + option class
  metrics: string[];          // presentation transform (§11.1): e.g. ['stock'] → ['stock','forgoneSink']
}
interface SlideDef {
  slug: string;               // URL slug (/story/:slug)
  scene: SceneId;             // slides in the same scene share params + chart instances
  layout: LayoutPreset;
  headingKey?: string;        // optional heading above the text block
  textKeys: string[];         // i18n keys for the text block BELOW the viz
  visualizations: VizConfig[];// 0 (intro) | 1 (main/crossing/baseline) | 2 (footprint)
  controls?: ControlKey[];    // controls this slide surfaces (subset of its scene's controls)
  params?: Partial<DerivationParams>;  // authored defaults seeded on first scene entry (policy A)
  forced?: Partial<DerivationParams>;  // immutable overrides (e.g. crossing/footprint/baseline → scope:'global')
  baseline?: number;          // authored client-transform baseline seed (ADR-026, not a DerivationParam)
}
```
The eight slides map to five scenes: `intro`(text) · `main`(2 slides: reveal) · `crossing` ·
`footprint`(2 slides: fossil-removal) · `baseline`(2 slides: slider + crossing/equivalence, ADR-026).
Copy is **only** i18n keys (ADR-011); `slides.ts` holds no prose. The **equivalence panel is restaged
on slide 6** as a redesigned `EquivalenceStrip` (ADR-025, §17.4) and **reused on slide 8** (the
`viz-equiv` preset, ADR-026) — it is a **scene widget**, not a `VizConfig` chart, so it lives outside
the `visualizations[]` list.

**Baseline scene controls (ADR-026).** Slides 7–8 both carry `controls: ['baselineSlider','horizon']`
and share per-scene state (ADR-023). `scope:'global'` is `forced`; slide 7 seeds `horizon:'100y'` so the
projection (and the slide-8 crossing) is meaningful on first entry. Slide 7 uses `layout:'caption-viz'`
with a `captionKey` (`story.baselineLab.caption`); slide 8 uses `layout:'viz-equiv'` (crossing viz +
equivalence strip). Both baseline controls (`baseline` select + `baselineSlider`) are `client-only`.

**Footprint scene controls (ADR-025).** Slides 5–6 both carry `controls: ['baseline','horizon']`; the
per-scene state (ADR-023) shares those values across the two slides. Only `scope:'global'` stays
`forced` (the old `forced.horizon:'today'` is dropped so the horizon is reader-driven and feeds the
strip's window). Slide 6's `SlideDef` uses `layout:'duo-viz-equiv'` with a `captionKey` and **no**
text-block `textKeys`.

### 17.2 Factory & rendering (`app/story/SlideFactory.ts`, `components/deck/`)
`SlideFactory(slideDef, sceneState, dtoStore) → RenderableSlide` resolves the authored slide against
the current scene's params (§10.1) and the fetched DTOs (§10.2) into a render-ready unit:
```ts
interface RenderableSlide {
  layout: LayoutPreset;
  headingKey?: string; textKeys: string[];
  controls: ControlKey[];              // filtered by scene + tagged server-refetch/client-only (ADR-021)
  visuals: Array<{ id: string; component: Component; props: { dto; ctx; presentation } }>;
}
```
- **`StoryPage`** (`pages/story/[slug].vue`): the ONE persistent route; on slug change it swaps the
  active `SlideDef` and `viewStore.enterScene(scene)` **without** remounting the page (ADR-023).
- **`GenericSlide`**: renders `SlideLayout[preset]` with `SlideHeading`/`SlideText` (text below) and
  the scene's controls; mounts each `visuals[]` tier-2 chart **keyed by `viz.id`** with its
  `presentation` (§11.4) — the source of the 2→3 / 5→6 in-place animation.
- **`SlideLayout`**: the closed presets — `text` (text only), `viz-text` (one viz above a
  full-width text block), `duo-viz-text` (two vizzes side-by-side above the text block),
  `duo-viz-equiv` (slide 6: a thin `#caption` line + controls + two vizzes + a full-width
  `#equivalence` strip, **no** text block), plus the ADR-026 baseline-scene pair `caption-viz` (slide 7:
  `#caption` + controls + one full-width viz, no copy) and `viz-equiv` (slide 8: controls + one
  full-width viz + a full-width `#equivalence` strip, no caption/copy). **Binding re-render contract (ADR-025):** `SlideLayout`
  renders **one unconditional stage** `<div class="slide__stage"><slot name="viz"/></div>` for every
  preset; presets differ only by CSS (grid template / sizing) and by which *surrounding* slots
  (`caption`/`text`/`equivalence`) render. This keeps the `#viz` outlet at the same vnode position
  across `duo-viz-text`→`duo-viz-equiv`, so the `viz.id`-keyed `<VChart>` instances are **not**
  remounted and the 5→6 `setOption` animation survives the layout change. A structural `v-if` fork that
  moved the outlet is forbidden (it re-inits ECharts).
- **`DeckNav`/`ProgressIndicator`**: Next/Back + keyboard/scroll navigation over the slide order,
  updating the slug (§4). Forward navigation triggers `dtoStore.prefetch(nextParams)` on idle.

### 17.3 State, animation & routing (bindings)
- **Per-scene state (§10.1, ADR-023):** `viewStore.sceneState: Map<SceneId,{params,timeRange}>`;
  entering a scene seeds authored `params`/`forced` on first visit and **restores** them on return
  (reset policy A). Server-refetch controls mutate the scene's `params` → `dtoStore.loadForScene`;
  `timeRange` and metric selection stay pure view state.
- **Chart identity (§11.4, ADR-022):** same `viz.id` within a scene → preserved `<VChart>` →
  `setOption` animation; new `viz.id` across a scene boundary → fresh mount. No shared-element morph
  in V1; `prefers-reduced-motion` drops transitions (UI §12). **The 5→6 layout-preset change
  (`duo-viz-text`→`duo-viz-equiv`) does not affect identity** because the `#viz` outlet is unconditional
  (ADR-025, §17.2): the donut/fossil instances persist and only animate.
- **URL (§10.1, ADR-017/023):** the slug + the current scene's `DerivationParams` live in the route
  (replace, not push); `timeRange` and metric selection stay out.
- **Presentation transform (§3.2/§11.1, ADR-021):** `VizConfig.metrics` → `VizPresentation` → option
  class emits the chosen metric subset; no refetch, DTO unchanged.

### 17.4 Slide-6 equivalence strip (`EquivalenceStrip`, ADR-025)
A **scene widget** (not a chart / `VizConfig`), mounted only on slide 6 via the `duo-viz-equiv`
preset's `#equivalence` slot. Pinia-driven and reactive to the footprint scene's `horizon` (§10.1),
the loaded global DTO (§10.2) and the UI locale — no new endpoint, no refetch beyond the existing
controls (ADR-025). Its magnitude **window is a forward window** `[referenceYear, referenceYear +
horizonYears(horizon)]` — it **opens at the last measured year (`referenceYear`)** and spans the chosen
horizon's forward reach (`sceneWindow(referenceYear, horizon)` in `derivation.ts` is the single source
of truth, shared with the ×N multiplier). **`horizon` and `baseline` are orthogonal:** the horizon sets
the **width** of this window; the `baseline` sets the **depth** of the forgone sink (server-side
cumulative-loss integration, ADR-026) already baked into the series being summed. At horizon `today`
the window collapses to `[referenceYear, referenceYear]` → a single-year snapshot (continuity with the
measured ratio); a longer horizon widens it and every magnitude grows.

- **Four magnitudes** (all Mt CO₂ before unit conversion), each a **client-side reduction** over the
  already-fetched **global** DTO series, colour-coded to the chart grammar:
  | # | Value | Derivation (forward window `[referenceYear, referenceYear + horizonYears(horizon)]`) | Colour token |
  |---|---|---|---|
  | 1 | Stock over the window | Σ `aggregateStock` across the window | `data.stock` (green) |
  | 2 | Forgone sink, annual | `aggregateForgoneSink` annual rate at the **last measured year** (`referenceYear`) | `data.forgoneSink` (amber) |
  | 3 | Forgone sink over the window | the TRUE finite integral Σ `aggregateForgoneSink` across the window (business §2.4 #2), consistent with stock/fossil | `data.forgoneSink` (amber) |
  | 4 | Combined total | value 1 + value 3 (stock + forgone over the window) | `data.total` (new red-adjacent) |
  Values 1, 3, 4 are horizon-reactive over the window (and baseline-reactive through the forgone-sink
  depth); value 2 is a measured-year scalar. The window Σ uses the shared `stats.sumWindow`; the
  measured-year level uses `equivalenceStrip.ts`'s `levelAt`. The donut / fossil-bar window totals read
  the SAME window as true Σ integrals (fossil projected server-side to match); the option layer's DOM
  widget is untouched.
- **Unit switcher (`UnitToggle`, client-only view state).** Three units — `mtco2` · `car` · `country`
  — converting **all four** values at once; **default `car`**. `car` divides by
  `equivalenceConfig.carAnnualTonsCO2` (4.6 t → convert Mt↔t); `country` divides by the **reference
  country's annual CO₂** (locale-driven SVK/UK via `resolveReferenceCountry`, §2.3), reusing the
  existing equivalence resolution — re-resolved on locale change with **no** deforestation refetch. The
  chosen unit is not a `DerivationParam` and stays out of the URL (like `timeRange`, ADR-017).
- **`data.total` token (new).** Added to `ThemeTokens.data` (shared theme type + `app.config.ts`): a
  red-adjacent hue **distinct from the error red** `negative` `#E5534B`, so the "everything combined"
  figure never reads as a fault state (design §2.3).

---

## 18. Traceability (element → decision → business source)

| Element | Decision | Business source |
|---|---|---|
| Nitro BFF, adapter→service→route | ADR-001/008 | §9 |
| Server-authoritative derivations + cache | ADR-005 | §9, §2.6 |
| `stats.ts` pure module | ADR-005/008 | §8 |
| Domain unit + config | ADR-012 | §3, §3.1, §6 |
| Domain as a main-scene control (global-first deck; no standalone scope toggle) | §17.1, UI §5 | §3, §4.1 |
| Time horizon (signature derivation axis, `today`/20y/…/100y), R scenario tri-state | §2.3/§3.2, §16.30 | §2.4a, §4.1, §5, §6 |
| Per-domain forward projection (`projectSeries`, before ×R + aggregation) | §3.2/§5/§6, §16.30 | §2.4a, §8 |
| Dashed projected series (twin series, legend allowlist, join divider) | §11.1/§11.2, §16.31 | §2.4a |
| Forgone sink band + σ_total | stats/DTO | §2.2, §3 |
| Multiplier (always on DTO, badge from slide 3, `Σfull ÷ Σstock` over forward window, horizon-reactive) | DTO/charts, §16.16 | §2.5, §4.2 |
| Crossing (annual impulse × cumulative level, semantics unchanged) | DTO/charts, §16.32 | §4.3 |
| Fossil share donut + number always-on (no toggle) | UI §6.3 | §4.1 |
| Equivalence driven by global horizon (committed = rate × horizonYears) | §2.3/§5, UI §6 | §4.4, §2.4 |
| Slide-6 `EquivalenceStrip` (4 client-derived values, colour-coded; unit switcher car-default; forward window `[referenceYear, referenceYear + horizonYears(horizon)]` with forgone as a true Σ integral, donut + fossil bar share the same window totals, fossil projected server-side) | ADR-025, §17.4, UI §6.7 | §4.5 |
| 4th layout preset `duo-viz-equiv`; layout change keeps `#viz` outlet stable → charts preserved 5→6 | ADR-025, §17.2/§17.3 | §4.5 |
| Footprint scene shares `baseline`+`horizon` across slides 5–6; only `scope:'global'` forced | ADR-025, §17.1 | §4.5 |
| `data.total` theme token (red-adjacent, distinct from error red) for the combined figure | ADR-025, §17.4, design §2.3 | §4.5 |
| Reference year = min common data year | ADR-016 | §7.1a |
| Single country coverage gate (union; stock & forgone share one country set; no domain exclusion) | ADR-020, §16.33 | §7.1 |
| Time range = client-side ECharts dataZoom (per-scene, reset on scene entry) | ADR-005/023, §10.1 | §9 |
| Baseline back-projection to 1800 via real-time slider; `baseline` re-tagged client-transform (isomorphic derive, no refetch) | ADR-026, §3.2/§3.2a/§10, §16.37 | §7.2a |
| LUH2 pre-1990 area reconstruction (offline static asset), anchored to WB 1990, dashed pre-1990; `R×cumulativeLoss` central estimate, R band identical pre/post 1990 | ADR-026, §1/§6/§11.2, §16.38 | §7.2a, §6 |
| Shareable state via URL query (slug + scene params; horizon **and baseline** in, timeRange/metrics out) | ADR-017/023/026, §10.1 | §9 (portfolio) |
| Injectable `Formatter` hierarchy; international compact numbers | ADR-018 | (app requirement) |
| Dark-only V1 (no light toggle) | ADR-002 | UI §1 |
| Shared tooltip, non-interactive legend, in-place reveal animation | UI §6.5/§7 | §4.3–4.5 |
| Multiplier badge appears from slide 3 (reveal) | §11.2, UI §6.6 | §4.2/§4.3 |
| Composition donut (3 slices → 2 on slide 6), `ReferenceDTO.composition` | §3.2, §11.2, UI §6.3 | §4.5 |
| Global-only deforestation-vs-fossil, **one grid two categories**, single Y-axis rescale | §11.2, §16.36, UI §6.3 | §4.5 |
| Linear six-slide story deck (frontend-only presentation) | ADR-021, §17, §16.34 | §4 |
| Frontend-only `SlideDef[]`/`SlideFactory`/`GenericSlide`/`SlideLayout` (3 layout presets) | ADR-021/024, §17.1/§17.2 | §4 |
| Metric selection = client presentation transform (`VizConfig.metrics`, no refetch) | ADR-021, §3.2/§11.1, §16.34 | §4.3/§4.5 |
| In-place `setOption` animation via stable `viz.id` (slides 2→3, 5→6) | ADR-022, §11.4/§17.3, §16.35 | §4.3/§4.5 |
| Single persistent `/story/:slug` route (no remount) | ADR-023, §10.1/§17.2 | §4 |
| Per-scene `sceneState` + reset policy A; controls tagged server-refetch/client-only; prefetch | ADR-021/023, §10.1/§10.2/§17.3 | §4.1 |
| Global-first deck; domain a control in the main scene; crossing/footprint forced-global | §17.1, UI §5 | §4.1/§4.4/§4.5 |
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
