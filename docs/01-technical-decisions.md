# Technical Decisions (v1.0.0)

**Status:** Binding. This document records the *what* and the *why* of the main technical
decisions, in ADR (Architecture Decision Record) form. The *how* — the concrete shape of every
module — is in `03-technical-specification.md`. The business rationale lives in
`00-business-overview.md`. Where a decision resolves a tension in the concept handoff, the
resolution is stated explicitly.

Each record: **Context → Decision → Rationale → Consequences.** Alternatives considered are noted
where a real fork existed.

---

## ADR-001 — Framework: Nuxt 3, SSR universal, with Vite

**Context.** One engineer, one repository, a demo/portfolio piece that must also expose a
Backend-for-Frontend (BFF) to proxy, cache, normalize and compute over World Bank data. Apache
ECharts is a client-only renderer.

**Decision.** Nuxt 3 in **SSR universal** mode (`ssr: true`), build tooling Vite (Nuxt default),
Nitro server engine for the BFF. Charts render client-only (see ADR-006).

**Rationale.**
- One language (TypeScript), one repo, one deploy for both the SPA and the BFF.
- SSR gives a fast first paint and a rendered shell (the composer chrome, controls, copy) before
  the client-only charts hydrate.
- Demonstrates full-stack capability (the audience is engineers/recruiters).

**Consequences.**
- Pinia state must be SSR-safe (no shared singletons across requests; the store is created per
  request by Nuxt's Pinia module). The hydration payload transfers store state to the client.
- Axios calls made during SSR need an absolute base URL (resolved from the request origin in a
  Nuxt plugin — see ADR-004 and the technical spec).
- Charts must be guarded so they never run on the server (ADR-006).

**Alternatives.** SPA (`ssr:false`) — simpler for a Pinia-centric client store, but loses SSR
benefits and the full-stack showcase. Hybrid/prerender — a middle ground. SSR universal chosen
for the showcase value; the extra hydration care is contained and documented.

---

## ADR-002 — UI component library: PrimeVue v4 (Aura), dark by default

**Context.** The UI is a "composer": a narrow control panel (segmented toggles, a tri-state
scenario control, a domain selector, a baseline control, a timeline brush) + a main canvas. Design
is dark with light text by default.

**Decision.** **PrimeVue v4** with the **Aura** theme preset, dark mode as the default. Integrated
via the PrimeVue Nuxt module. Icons via PrimeIcons. **V1 ships dark-only** — there is **no
light-mode toggle**; the theme stays centrally switchable so a light mode is a later addition, not a
V1 control.

**Rationale.**
- Lighter and less style-opinionated than Material; pairs cleanly with an ECharts dashboard.
- Strong data/form components: `SelectButton` fits the signature **time-horizon** selector
  (`today`/`20y`/…/`100y`) and the tri-state `R` scenario; `Slider`, `Select`, `Panel`, `Card`
  cover the rest.
- Dark mode is a first-class theme concern (`.p-dark` class strategy), controllable centrally.

**Consequences.**
- The theme is configured once (Aura + dark) and consumed via design tokens; ECharts must share
  the same token values (see ADR-007) so charts match the app chrome.
- Component styling stays in the styled mode (Aura); we do not adopt the unstyled/Tailwind path
  for V1 to keep scope tight.

**Alternatives.** Vuetify 3 (Material) — heavier, more opinionated look, larger bundle. Rejected
for this dashboard aesthetic.

---

## ADR-003 — State: Pinia is the single source of truth

**Context.** The concept requires a data model that is clear from the start, centrally managed,
with **no data living at the component level.**

**Decision.** **Pinia** holds all application state and all fetched/derived data. Components are
pure: they read from Pinia (via getters/composables) and emit control intents (via actions).
Chart components receive already-shaped series through props; they fetch nothing and store nothing.

**Rationale.**
- A single, typed, inspectable data model (§ data model in the technical spec).
- Deterministic control flow: controls → store actions → BFF fetch → store state → getters →
  components.
- Testability: store logic is unit-testable without mounting components.

**Consequences.**
- The data model (DTOs and store shape) is defined up front (technical spec) and is authoritative.
- SSR: stores are per-request; state serializes into the hydration payload.
- Response caching by parameter signature lives in the store (ADR-005) to keep re-toggling instant.

---

## ADR-004 — HTTP client: Axios everywhere, injected instances

**Context.** The concept mandates Axios for API requests. There are two HTTP boundaries:
(1) client/store → BFF, and (2) BFF adapter → World Bank API.

**Decision.** Use **Axios** on both boundaries via explicitly created, injected instances:
- **Client instance:** created in a Nuxt plugin, `baseURL` = the app origin (absolute during SSR,
  relative on the client), provided to Pinia actions.
- **Server instance:** created inside the WDI adapter, `baseURL` = the World Bank API base, with
  timeout, retry-on-transient and `per_page` defaults.

**Rationale.**
- Honors the mandated stack while keeping a clean separation: the store never talks to World Bank
  directly, only to our BFF (adapter isolation, ADR-008).
- Interceptors give one place for base URL, timeouts, error normalization and (server side)
  retry/backoff.

**Consequences.**
- Nuxt's native `$fetch`/`useFetch` is deliberately not used for data fetching; `useAsyncData` may
  still wrap store actions for SSR-time hydration, but the actual request goes through Axios.
- Absolute-URL handling during SSR is centralized in the client-Axios plugin.

---

## ADR-005 — Derivations are server-authoritative; the store caches by parameter signature

**Context (resolves a handoff tension).** The handoff says the BFF computes the forgone sink and
full emissions on the server. The UX also wants the **time-horizon** selector and the `R` scenario
change to feel instant.

**Decision.** All `R`-scenario- and horizon-dependent derivations are computed
**server-side** (single source of truth). Changing the scenario or horizon **refetches** the
corresponding endpoint (the horizon drives per-domain forward projection — ADR-019). The endpoint is
cached on the BFF (`defineCachedFunction`) keyed by `(scope, domain, horizon, rScenario, baseline)`.
The **store additionally caches responses by the same parameter signature**, so re-selecting a
previously seen combination is served from memory with no network round-trip. The **time range**
(zoom) is a pure client-side ECharts `dataZoom` view state (`viewStore.timeRange`) — distinct from
the horizon; it never triggers a refetch and never manipulates the series data.

**Rationale.**
- One authoritative computation path (the server statistics module) — no risk of client/server
  math drift.
- The parameter space is small and finite (6 horizons × 3 scenarios × {global + 4 domains} × a few
  baselines), so both layers of cache make the practical experience feel instant after the first
  visit; the first visit warms the cache.

**Consequences.**
- The frontend does **not** re-implement the derivation math (nor the projection); the statistics
  module is used on the server only (though written as a pure, isomorphic module).
- The store keeps a keyed cache map and a small "in-flight request" map to dedupe concurrent
  identical fetches.
- Endpoints must accept `horizon`, `rScenario`, `baseline` as query params and be pure functions of
  them (deterministic → cacheable).

**Alternatives.** Client-side recompute via a shared isomorphic module (instant, but two math
paths / drift risk); precompute-all-scenarios server-side (larger payload). Server-authoritative
chosen for a single source of truth, with store caching to recover interactivity.

---

## ADR-006 — ECharts integration: the `nuxt-echarts` module

**Context.** Apache ECharts is mandated for visualization; a Vue wrapper exists. ECharts cannot
compute DOM dimensions during SSR.

**Decision.** Integrate via the official **`nuxt-echarts`** module (which wraps `vue-echarts`,
by ecomfe/Justineo). Use its `<VChart>` component. Register only the needed chart types
(`LineChart`, `BarChart`, `PieChart`, custom for bump) and components (grid, tooltip, legend,
dataZoom, markLine, visualMap, etc.) for tree-shaking. Charts are rendered client-only.

**Rationale.**
- Auto-import of `<VChart>`, built-in tree-shaking config, and SSR/client-only handling out of the
  box — less boilerplate than manually wrapping raw `vue-echarts` in `<ClientOnly>`.
- Smaller bundle via explicit component registration.

**Consequences.**
- The low-level `BaseChart.vue` wraps `<VChart>` and enables `autoresize` for responsiveness.
- Chart type/component registration is centralized in the module config (technical spec).

**Alternatives.** Raw `vue-echarts` + manual `<ClientOnly>` — more control, more boilerplate.
Rejected.

---

## ADR-007 — Chart architecture: a "chart option class" hierarchy over dumb view components

**Context.** The concept wants reusable components: charts at the lowest level as a component over
the ECharts wrapper, and a class system that produces a finished ECharts `Option` object passed
into the component. It asks whether per-chart classes should share an abstract base.

**Decision.** A three-tier design:
1. **`BaseChart.vue`** (lowest tier) — a thin, dumb wrapper over `<VChart>`. Props: `option`,
   `loading`, `theme`. Responsive (`autoresize`). Contains no domain logic.
2. **Per-chart Vue components** (e.g., `MainStackedChart.vue`, `CrossingChart.vue`,
   `RankingBumpChart.vue`, `FootprintDonut.vue`) — receive already-shaped series + view context
   via props, obtain a finished `Option` from a chart-option class, and pass it to `BaseChart`.
   They hold no business math.
3. **Chart-option classes** (`app/charts/*`) — an **abstract `BaseChartOption`** with concrete
   subclasses per chart. Their single responsibility: given normalized series + a rendering
   context (theme tokens, i18n translator, formatting, mode/scenario flags), **produce a complete,
   validated ECharts `Option` object.** They are pure (no fetching, no Vue reactivity, no side
   effects) and therefore directly unit-testable.

**Shared base — decision:** yes, an abstract `BaseChartOption` is worthwhile. Common
responsibilities it centralizes: base grid/axis/tooltip/legend scaffolding, theme-token → ECharts
color mapping, number/unit formatting, i18n label resolution, empty/loading state, and the
"state vs. flow" guard for axis types. Subclasses implement only `buildSeries()` and any
chart-specific overrides. This avoids duplicating dozens of lines of ECharts boilerplate per chart
and keeps a single place for theme/i18n wiring.

**Rationale.**
- Separation of concerns: math in the store/BFF, `Option` construction in pure classes, rendering
  in dumb components.
- Testability: `Option` builders are the trickiest part and are tested in isolation.
- Reuse: the abstract base and `BaseChart.vue` are shared by every chart.

**Consequences.**
- Chart-option classes receive their data via the constructor (ADR-009). They never read Pinia
  directly — a factory injects the data.
- Responsiveness is handled at two levels: `autoresize` in `BaseChart.vue`, and responsive
  `Option` tweaks (grid margins, label rotation, legend placement) driven by a breakpoint the
  option classes receive in their context.

---

## ADR-008 — Backend layering: Adapter → Service → BFF route, OOP with TS classes

**Context.** The concept mandates modern patterns and, on the backend, OOP with TS classes: the
API uses a service, the service uses an adapter that would allow extension to a different API
provider.

**Decision.** Three backend layers, all as TS classes:
1. **Adapter** (`server/adapters/`): `SourceAdapter` interface + `WdiAdapter` implementation.
   Sole job: talk to one external source (World Bank) via the server Axios instance and return the
   uniform normalized shape `{ source, geo, year, value, meta }`. Knows the WDI response quirks
   (`response[1]`, aggregates filter, `mrnev`, holes). Future sources (GFW) = one new adapter class.
2. **Service** (`server/services/`): domain services (`EmissionsService`, `ForestAreaService`,
   `AggregationService`) orchestrate one or more adapters, apply the domain config, and call the
   statistics module to produce derived series (forgone sink, full emissions, aggregates,
   magnitude-panel data, equivalences). Services depend on the *adapter interface*, not a concrete
   adapter (constructor injection, ADR-009).
3. **BFF routes** (`server/api/*`): thin Nitro handlers that parse/validate query params, invoke a
   service via the composition root, wrap with caching, and return DTOs.

**Rationale.**
- The adapter interface is the extension seam the concept explicitly asks for.
- Services concentrate domain logic and are independently testable with a stub adapter.
- Thin routes keep HTTP concerns (params, cache, status) separate from domain logic.

**Consequences.**
- Adding a source (GFW) touches only a new adapter + a service wiring line + config — no route or
  frontend changes to the contract.
- The statistics module is a dependency of services (injected or imported as pure functions).

---

## ADR-009 — Dependency injection: manual composition root / constructor injection

**Context.** The concept asks for a sensible way to inject dependencies into classes; if a class
has no injected deps, a layer should feed data from the component or Pinia into its constructor.

**Decision.** **Constructor injection** wired by **manual composition-root factory functions** —
no IoC container, no decorators, no `reflect-metadata`.
- **Server:** a per-request composition root (`server/di/container.ts` — a plain factory) wires
  `WdiAdapter → services → statistics`, returning ready service instances to route handlers.
  Cached singletons where safe (stateless adapters/services); per-request where request context
  matters.
- **Frontend:** chart-option classes have no service dependencies — they need *data*. The
  Pinia-aware **shell parents** read the required DTOs from the data store and pass them, together
  with the shared **`useChartContext`** bundle (i18n translator + theme tokens + formatter +
  breakpoint + horizon/R/timeRange), as **typed props** into the Pinia-unaware chart components. Each
  chart component `new`s its own option class from those props. No central factory; components never
  read Pinia or hand-assemble data.

**Rationale.**
- Idiomatic for Nitro/Nuxt; zero runtime reflection; smallest bundle and ceremony for this scope.
- Typed props + `useChartContext` are the explicit "layer that feeds data from Pinia/component into
  constructors" the concept describes, while keeping the chart components dumb and store-free.

**Consequences.**
- Dependencies are explicit and visible at the wiring site (the composition root / factory) —
  easy to follow and to stub in tests.

**Alternatives.** InversifyJS/tsyringe — rejected as over-engineering (decorators,
reflect-metadata, bundle/ceremony) for this size.

---

## ADR-010 — Parallelism: promise orchestration on both tiers

**Context.** The concept mandates parallelizing requests with advanced promise handling on both
backend and frontend where it makes sense.

**Decision.**
- **Server:** services fan out independent adapter calls with `Promise.all` (e.g., all member
  countries of a domain, or area + emissions + fossil reference in parallel), and use
  `Promise.allSettled` where partial failure must be tolerated (a missing country/indicator must
  not sink the whole domain — it degrades with a recorded gap in `meta`).
- **Client:** the store dispatches independent endpoint fetches concurrently (e.g., domain series +
  ranking + reference for the current view) via `Promise.all`, deduped through the in-flight map
  (ADR-005). No sequential waterfalls where calls are independent.

**Rationale.** Latency reduction; the World Bank API and the BFF endpoints are largely independent
per view. `allSettled` on the server matches the concept's "always show the year / admit holes"
honesty stance.

**Consequences.** Error/gap handling is per-request and recorded in `meta`; the UI surfaces gaps
rather than failing hard.

---

## ADR-011 — Internationalization: `@nuxtjs/i18n`, SK/EN, browser-detected default

**Context.** The app must be multilingual (Slovak + English), all texts localized from the start;
default = Slovak if the browser language is Slovak, otherwise English; `vue-i18n` is mandated.

**Decision.** **`@nuxtjs/i18n`** (built on `vue-i18n`), locales `sk` and `en`, strategy
`no_prefix` (no locale in the URL — single-page composer), browser language detection with
`redirectOn: 'root'` and a cookie to persist the choice, fallback `en`. All user-facing strings —
including chart titles, axis labels, tooltips, units, preset labels, caveats and copy — come from
message catalogs; no hardcoded display text anywhere.

**Rationale.** Native Nuxt integration, SSR-correct locale detection, one place for all copy;
chart-option classes receive the translator via their context (ADR-007/009) so charts localize too.

**Consequences.**
- Number/unit formatting is locale-aware (Intl) via i18n helpers, shared by the app and the chart
  classes.
- Config-derived strings (domain labels, caveats) are keyed, not literal, in the catalogs.

---

## ADR-012 — Configuration as versioned, typed config objects

**Context.** `R` rates, domain membership, indicator metadata and equivalence factors must be
auditable and defensible.

**Decision.** Three typed config modules (shared, importable by server and any consumer):
- **Domain config** — `domain → { id, isoCodes[], R: {mid, low, high}, allometricFactor, labelKey }`.
  The allometric factor is **locked = 1.24** (= 1 + IPCC root:shoot ≈ 0.24, cited; business §6).
- **Indicator registry** — `indicator → { id, code, category, seriesType: 'state'|'flow', unit }`.
- **Equivalence config** — conversion factors (car annual emissions, reference country), the shared
  `Horizon` vocabulary + calendar anchor (`HORIZON_ANCHOR_YEAR`, ADR-019), sources. Equivalence has
  **no own horizon control** — it is driven by the global time horizon; committed total =
  `annualRate × horizonYears(horizon)` (business §4.4).

**Rationale.** Single source for defensible numbers; the `seriesType` attribute powers both the
correlation guard (§2.7, dormant) and the axis-type choice in chart-option classes; versionable
for audit.

**Consequences.** Changing a value is a config edit, not a code change; every displayed number is
traceable to a config entry with a cited source.

---

## ADR-013 — Testing: Vitest unit + Vue Test Utils on critical components

**Context.** A demo needs credible, proportionate test coverage.

**Decision.** **Vitest** for unit tests of pure logic — the statistics module, the WDI adapter
(against recorded fixtures), the services (with a stub adapter), the chart-option classes (assert
the produced `Option`), and the config integrity. **Vue Test Utils** for a few critical components
and the store flow (horizon change, `R` scenario change → correct fetch/params → correct getters).
No end-to-end layer in V1.

**Rationale.** Best value-to-effort: the risky parts (math, normalization, `Option` construction,
store control flow) are covered; UI-layout churn (a later round) is not over-tested prematurely.

**Consequences.** The pure, DI-friendly design (ADR-007/008/009) makes these tests
mount-free and fast. Adapter tests rely on recorded WDI fixtures captured during the spike.

---

## ADR-014 — Deploy: Vercel, Nitro `vercel` preset

**Context.** Free tier, easy caching, good Nitro DX.

**Decision.** Deploy to **Vercel** with the Nitro `vercel` preset; BFF routes run as serverless
functions. **Caching is CDN-first:** Nitro `routeRules` set cache headers so the **Vercel CDN**
caches responses by URL (the full derivation-parameter signature is in the query string), with a
long `maxAge` and stale-while-revalidate. `defineCachedFunction` is kept as a **second, in-function
layer** for warm instances. This survives serverless cold starts and scaling (where a purely
in-memory cache would be lost), stays on the free tier, and needs no external service. A persistent
KV/blob storage driver remains an easy later upgrade. The Nitro preset is a single config value,
keeping the door open to Netlify/Cloudflare later.

**Rationale.** Best Nitro developer experience; CDN caching is the robust fit for ephemeral
serverless functions and low-traffic portfolio use; World Bank data changes ~yearly so long TTL +
SWR is safe.

**Consequences.** Every cacheable endpoint must be a deterministic function of its query params
(ADR-005) and set explicit cache headers via `routeRules`; the cache key is the URL + param
signature.

---

## ADR-015 — Tooling: pnpm, Node 20 LTS, strict TypeScript, ESLint + Prettier

**Context.** The stack left package manager, Node version, TS strictness and linting unspecified.

**Decision.** **pnpm** as the package manager; **Node 20 LTS** runtime (matches the Vercel target);
**TypeScript `strict: true`** (plus `noUncheckedIndexedAccess`) across app and server; **ESLint**
via the official `@nuxt/eslint` module + **Prettier** for formatting.

**Rationale.** pnpm's efficient, deterministic installs; Node 20 LTS is the supported Vercel/Nitro
baseline; strict TS catches contract errors early in a spec-driven codebase; Nuxt ESLint gives a
flat-config, Nuxt-aware setup with minimal wiring.

**Consequences.** CI runs `typecheck`, `lint`, `test`; the strict settings make the DTOs and config
contracts (technical spec) enforceable at compile time.

---

## ADR-016 — Composite scalars use a single reference year (min common data year)

**Context.** Source series end in different years (forest area ~2023, LULUCF emissions possibly
~2022). Composite scalars (full emissions, multiplier, share %, equivalence annual rate) must not
silently mix years.

**Decision.** All composite scalars are computed at a **reference year = the most recent year where
every required series has a value** (`min` of the per-series `latestDataYear`). The reference year
is returned in the DTO and **always surfaced in the UI** ("data as of {X}"). Time-series charts
still draw each series over its own full range; only the scalars use the common reference year.

**Rationale.** Prevents mixing different years inside one composite number; matches the
honest-explorer stance (business §7.1a).

**Consequences.** Services compute and expose `referenceYear` on every DTO that carries a composite
scalar; the UI binds a "data as of {X}" note to it.

---

## ADR-017 — Composer state is shareable via the URL query

**Context.** The app is a portfolio composer: a configured view (scope, domain, time horizon, R
scenario, baseline) is worth **sharing and bookmarking**, and SSR should render the requested state,
not only the opening preset.

**Decision.** The **`DerivationParams`** (`scope`, `domainId`, `horizon`, `rScenario`,
`baseline`) are **synced to the URL query string** — including the time `horizon`, since it is a
derivation param. On load the view store initializes **from the URL**, falling back to the opening
preset for any missing/invalid key (validation reuses the server param validation). Changing a
derivation control rewrites the query. Only the **client-only** time range (`dataZoom`) is **not**
in the URL — it is pure view state. This dovetails with ADR-014 (the param signature is already the
cache-key URL) and ADR-005.

**Rationale.** Shareable/bookmarkable views; SSR renders exactly the requested state; reuses the
existing parameter signature, so no new contract surface.

**Consequences.** A small router-sync layer maps `viewStore.derivationParams ↔ route.query`
(replace, not push, to avoid history spam); only `timeRange` deliberately stays out of the URL.

---

## ADR-018 — Number formatting via an injectable `Formatter` class hierarchy

**Context.** Numeric magnitudes (Mt CO₂/yr, the multiplier, equivalence values) are rendered across
many components. Formatting must be **one consistent, injectable rule**, extensible later, never
scattered inline.

**Decision.** An **abstract `Formatter`** base class with a **single V1 concrete
`CompactNumberFormatter`**: international **compact notation** (`3.2M`, `820k`, `1.1B`), and the
multiplier fixed to **1 decimal** (`×3.2`). **No locale-specific number formatting in V1**
(international notation only, even though copy is localized — ADR-011). Components **never format
numbers inline**; they receive a `Formatter` **instance** (composition root / `useFormatter()`
composable). A future variant (locale-aware, different precision) is a drop-in subclass — in
practice there is exactly one implementation for now, but rendering a number **requires** an
instance extending the base.

**Rationale.** Single source of formatting truth; matches the class-based, DI-first architecture
(ADR-007/009); keeps components dumb; the base class makes future formatters a pure extension.

**Consequences.** A `shared/format/Formatter.ts` hierarchy + a provider that binds the active
instance; the formatter is unit-tested directly (mount-free).

---

## ADR-019 — Time horizon as the signature axis; per-domain forward projection; dashed rendering

**Context (supersedes the earlier "official ↔ full" accounting switch).** The original design made
"official vs. full accounting" the signature control (a binary toggle between WB-reported stock and
stock + forgone sink). That switch is **removed** (business §2.6): the app now **always** shows full
accounting. In its place, the primary derivation control is a **time horizon** — the *upper* bound of
the time window — with categories `today` / `+20y` / `+30y` / `+50y` / `+75y` / `+100y` measured from a
fixed calendar anchor. (In the story deck, ADR-021, the horizon is the **`main` scene's** primary
control rather than a whole-page hero; the deck's top-level interaction is advancing between slides.) Because the WB stock series ends ~2022–2023, showing a meaningful future
horizon requires **projecting the data forward**; and the crossing chart (annual stock impulse vs.
cumulative forgone sink) only reaches its crossing point once the window extends far enough.

**Decision.**
- **Horizon is a `DerivationParams` axis** (`horizon: Horizon`, `HORIZON_ANCHOR_YEAR = 2026`,
  `horizonTargetYear`/`horizonYears` helpers in config). It refetches and is URL-synced (ADR-005/017).
  `today` = measured data only (no projection).
- **Per-domain linear-trend projection.** When `horizon !== 'today'`, each domain's cleared-area
  series is extrapolated to the horizon's target year (`stats.projectSeries`: recent mean + fitted
  slope over the last ~9 measured years, clamped ≥ 0), **then** multiplied by `R_domain` and
  aggregated. Projection is applied **per domain, before aggregation** — *not* as a single fit on the
  pre-aggregated series — because `R` and the trend differ per domain; this is exactly what drives
  the **ranking reshuffle** (`today` → `atHorizon`). Composite scalars (multiplier, share,
  equivalence rate, reference year) are computed on **measured data only**, never on projected points.
- **Dashed rendering via separate series (ECharts workaround).** ECharts cannot switch a single line
  from solid to dashed mid-series (no per-segment dash; `visualMap` only recolours). So each
  projected metric is emitted as a **separate series** starting at the join year (`meta.projectedFrom`),
  sharing the measured series' color and stack, styled dashed + lighter, and **excluded from the
  legend** (`legend.data` allowlist). A join-year divider `markLine` marks where measurement ends.
- **Crossing semantics unchanged.** The crossing chart keeps comparing the **annual stock impulse**
  against the **cumulative forgone-sink level**; the horizon only extends the x-span so the crossing
  becomes visible.

**Rationale.** The horizon reframes the whole story around "how large is the committed future debt,
and when does it overtake the reported impulse" — a more honest and vivid message than a binary
accounting toggle. Per-domain projection is the correct granularity (linear extrapolation is a linear
operator, so per-domain and aggregate coincide only under identical coverage, which the domains do
not share) and it powers the reshuffle. Separate dashed series is the only clean ECharts path.

**Consequences.**
- `SeriesMeta` gains `projectedFrom: number | null`; DTOs drop the `accounting` axis and make the
  forgone-sink family non-optional; `RankingDTO` becomes `today` + `atHorizon`; the multiplier is
  always shown (§3.2, §16.30–32 of the technical spec).
- The projection is a server-only derivation (single authoritative path, ADR-005).
- **Revisable V1 choices (business §12):** the multiplier is not horizon-reactive; the ranking uses a
  point-in-time value at the target year (not an integral); the CI band is not widened for
  projection uncertainty; join-divider styling is provisional.

**Alternatives.** Keep the official↔full toggle (rejected — the horizon subsumes and improves it);
project the pre-aggregated global series with one fit (rejected — loses the per-domain reshuffle and
mixes differing `R`); use `visualMap` for the dashed effect (rejected — recolours only, cannot dash).

---

## ADR-020 — Single-source-of-truth country coverage gate; no domain-level exclusion

**Context.** A domain aggregate (e.g. Amazon) is a **sum over its member countries** of two
indicators — deforestation **stock** (`EN.GHG.CO2.LU.DF…`, flaky, ends early / has holes for some
countries) and forest **area** (`AG.LND.FRST.K2`, robust) — where forest area drives the forgone
sink. To avoid a laggard country dragging the aggregate's window, an *incomplete-coverage* exclusion
was introduced inside `sumSeries`. But that exclusion was decided **per indicator, independently**:
a country could be dropped from **stock** (its stock series is incomplete) yet **kept** in **forgone
sink** (its forest area is fine), because the two sums each made their own decision. The result was a
domain whose stock and forgone described **different sets of countries** (e.g. SE Asia's forgone sink
included Malaysia + Brunei while its stock excluded them; "other tropical" included Senegal + Samoa in
forgone but not stock). The same `sumSeries` logic also ran a second time at the **domain → global**
level, which could in principle drop a whole domain from the aggregate stock — a path that **never
fires in practice** (all four domains reach the same modal window) yet added hidden behaviour.

**Decision.**
- **One coverage decision per domain, applied to every metric.** A dedicated pure, stateless
  **`CoverageGate`** (constructor-injected, ADR-008/009) is the **single source of truth** for which
  countries are excluded. It inspects the per-country series of **all** indicators a domain uses
  (stock **and** forest area) and returns one **excluded ISO set** + `incomplete-coverage` gaps +
  the per-indicator modal window. `AggregationService.buildDomain` applies that **same** excluded set
  when summing **both** stock and area, so a domain's stock and forgone sink always describe the
  **identical country set**.
- **Union criterion.** A country is retained only if it is **complete on every indicator**; it is
  excluded if it is incomplete on **stock OR forest area** (or has no data for either). "Complete" =
  reaches that indicator's modal last-real year with a real value **and** has no internal hole between
  its first real value and that year. Leading pre-data nulls never trigger exclusion.
- **`sumSeries` reverts to a pure sum.** It is once again a plain pointwise sum over the union of
  years (nulls skipped), with **no** coverage logic — matching its original technical-spec contract.
  The exclusion/window logic lives **only** in `CoverageGate`.
- **Domain-level exclusion is removed entirely.** The global aggregate stock is a plain sum of the
  four per-domain series (no modal-window exclusion at the domain tier), because in practice no whole
  domain is ever incomplete over the shared window.

**Rationale.** A single gate makes country membership **consistent across metrics** (the property the
data owner requires) and gives one obvious place to reason about coverage. The union criterion is the
most defensible reading of "a region we cannot fully represent should not appear at all," and it is
future-proof (a hole in forest area would now also exclude, not just a hole in stock). Removing the
never-firing domain tier deletes dead, surprising behaviour.

**Consequences.**
- New `server/utils/coverage.ts` (`CoverageGate`, pure). `ForestAreaService` / `EmissionsService`
  return **per-country** series (fan-out only); `AggregationService` gains a `CoverageGate` dependency
  and owns the gate → filter → `sumSeries` → clip-to-window composition. `container.ts` wires it.
- The aggregate **forgone sink / full emissions / multiplier change numerically** (countries now
  dropped from forgone too), which is the intended correction.
- `referenceYear` (ADR-016) is unaffected — it still reads the min-common `latestDataYear` of the
  (now consistently-built) domain series.

**Alternatives.** Gate on **stock only** (rejected — equivalent today because area is robust, but
misses a future area hole; the union is strictly safer). Keep exclusion inside `sumSeries` and pass a
shared excluded set into both service sums (rejected — the gate would need per-country data the
services had already summed away, forcing a double fetch or leaking country detail through the
service contract). Keep the domain-level tier "just in case" (rejected — dead behaviour, harder to
reason about).

---

## ADR-021 — Presentation is a linear story deck; story config is frontend-only; presentation transforms are client-side

**Context (supersedes the "composer dashboard" framing).** The original UI was a *composer*: one page
with a control bar + a main canvas + a grid of magnitude panels the visitor reconfigures freely. For
the target audience (recruiters/engineers skimming a portfolio) a **guided linear narrative** lands
the *stock vs. forgone-sink* thesis far more reliably (business §1.1). The reframe must **not** disturb
the server: every scientific derivation (R, projection, aggregation, forgone sink, CoverageGate) is
already correct and cache-keyed by `DerivationParams`.

**Decision.** The frontend presents the argument as a **deck of six slides across four scenes**
(business §4, UI §3). The deck is expressed as **authored, immutable frontend configuration** — a
`SlideDef[]` — that the **server never sees**:
```ts
type LayoutPreset = 'text' | 'viz-text' | 'duo-viz-text';
type VizKind = 'mainStacked' | 'globalStackedArea' | 'crossing' | 'donut' | 'fossilComparison';
interface VizConfig {
  id: string;                 // STABLE across sibling slides → in-place animation (ADR-022)
  kind: VizKind;
  metrics: string[];          // which metrics this viz shows on THIS slide (presentation, not data)
}
interface SlideDef {
  slug: string;               // URL slug (ADR-023)
  scene: string;              // scene id; sibling slides share viz identities
  layout: LayoutPreset;
  headingKey?: string;        // i18n
  textKeys?: string[];        // i18n body copy
  visualizations: VizConfig[];
  controls?: ControlKind[];   // which scene controls this slide exposes (horizon/domain/baseline/timeRange)
  params?: Partial<DerivationParams>;  // authored defaults for the scene
  forced?: (keyof DerivationParams)[]; // e.g. crossing/footprint force scope=global
}
```
A `SlideFactory` turns a `SlideDef` + the current scene state + the fetched DTO(s) into a
`RenderableSlide` that a **generic `GenericSlide`/`SlideLayout`** renders (ADR-024).

- **Presentation transforms are client-side.** Selecting *which metrics* a viz shows (stock only vs.
  stock + forgone sink; with/without fossil), and any cheap view reshaping (×constant, year filter,
  splitting a full-emissions total into stock + forgone components for slide 6), are **client-side
  transforms over the already-fetched DTO** — they never refetch. The **server keeps only
  authoritative scientific derivations**.
- **Controls carry an explicit derivation mode.** Each scene control is tagged **client-transform**
  (no refetch — e.g. `timeRange`) vs. **server-refetch** (cached — e.g. `horizon`, `domain`,
  `baseline`). This is cheap future-proofing: a future scene could make, say, a baseline-hindcast a
  client-side control without reworking the model.
- **Refetch analysis (V1).** Client-only (no refetch): `timeRange`. Server-refetch (cached DTO):
  `scope`/`domain`, `baseline`, `horizon` (and `rScenario` if ever surfaced). Mitigation: prefetch the
  next slide's DTO(s) on idle (ADR-023); server-refetch controls are fetch-then-animate.

**Rationale.** The narrative is a *view* concern; keeping it entirely on the frontend means the BFF
contract, cache keys and tests are untouched (the deck is additive). One authoritative derivation path
survives (ADR-005). Client-side metric selection is what makes the 2→3 and 5→6 animations possible
without server round-trips.

**Consequences.**
- New frontend layer: `shared`/`app` **story config** (`SlideDef[]`), a `SlideFactory`, and generic
  slide components (ADR-024). No new server route, DTO or param.
- The **ranking** and **equivalence** visualisations are **deferred from the deck** (built, on no
  slide — business §4.6); their endpoints/components remain for a later `SlideDef`.
- Chart-option classes gain a **presentation input** (which metrics to render) — see ADR-024.

**Alternatives.** Keep the composer (rejected — weaker for the audience). Encode slide config on the
server so routes return slide-shaped payloads (rejected — the DTO is already param-keyed and complete;
the server needs no slide knowledge, and coupling it would break the clean cache/contract).

---

## ADR-022 — Chart identity for in-place animation (stable `viz.id` → `setOption`)

**Context.** Two transitions are the deck's signature: slide 2→3 (forgone sink appears on the main
chart) and slide 5→6 (fossil drops out of the donut and bar). They must **animate in place**, not
reload — ECharts animates a diff only if it keeps the **same component instance** and receives a new
`setOption`.

**Decision.** Every visualisation carries a **stable `viz.id`**. **Sibling slides in a scene reuse the
same `viz.id`** for the same chart → Vue keys the chart component by `viz.id`, so the instance is
**preserved** across the slide change and only its `:option` prop changes → ECharts `setOption`
animates (a series fading/growing in, a removed series shrinking out, axes rescaling). A **different
`viz.id`** (or crossing a scene boundary) → a **fresh mount** (no morph). **No shared-element morph
across layout changes** in V1 (a chart never flies between layout slots) — animation is only the
within-scene `setOption` diff.

**Rationale.** Keying by `viz.id` is the idiomatic Vue/ECharts way to get `setOption` animation for
free while still remounting cleanly at scene boundaries. It keeps the chart components dumb (they just
receive a new option) and the animation is ECharts' own.

**Consequences.**
- The slide renderer keys each chart slot by `viz.id`; the `SlideFactory` guarantees `viz.id` stability
  within a scene and uniqueness across scenes.
- The **fossil-comparison** chart must be **one grid with two categories** (not two grids) so slide
  5→6 is a single `setOption` diff (ADR-024, business §4.5).

---

## ADR-023 — Single persistent story route; scene-keyed two-layer store; reset policy A

**Context.** The deck must support browser Back/Forward across slides, restore a visited scene's
control state faithfully, share/bookmark a configured slide, and never remount the page (which would
kill chart identity, ADR-022).

**Decision.**
- **One persistent route `/story/:slug` → one `StoryPage`** that does **not** remount between slides;
  a reactive `currentIndex`/`slug` selects the slide. Each advance is a `router.push` (browser
  Back/Forward traverse slides). Slugs: `intro · main · main-sink · crossing · footprint ·
  deforestation-insight`.
- **Two-layer store.**
  - `dtoCache: Map<paramKey, DTO>` — the existing shared, deduped DTO cache (ADR-005), unchanged.
  - `sceneState: Map<sceneId, { params: DerivationParams; timeRange: [number,number] | null }>` —
    lightweight **per-scene control state**.
- **Reset policy A.** Returning to an **already-visited** scene restores its `sceneState` (faithful
  Back/Forward, persisted in session + the URL query); entering a scene for the **first time**
  initialises `sceneState` from the slide's authored defaults, **independent** of tweaks made in
  another scene.
- **Control state in the URL query** (extends ADR-017): a scene's control values live in the query
  (e.g. `/story/main?domain=amazon&baseline=2005`), defaulting when absent; `timeRange` stays out of
  the URL (pure view state). SSR renders exactly the requested slide + state.
- **Prefetch** the next slide's DTO(s) on idle so forward navigation lands warm.

**Rationale.** A single non-remounting route is the only way to keep chart instances alive across
slides (ADR-022). Splitting DTO cache (shared, param-keyed) from scene control state (per-scene) keeps
the existing cache intact while giving each scene independent, restorable controls. Reset policy A is
the intuitive "each scene remembers itself" behaviour the user chose.

**Consequences.**
- `useViewStore` gains `sceneState` keyed by scene id (the old single `derivationParams` becomes
  the *current scene's* params getter); `useDataStore.dtoCache` is unchanged.
- A router-sync layer maps the current scene's controls ↔ `route.query` (replace within a slide, push
  on slide change).

**Alternatives.** A route per slide with real page components (rejected — remounts kill chart
identity). One global control state shared by all scenes (rejected — breaks reset policy A / faithful
Back).

---

## ADR-024 — Generic slide layout (closed preset set); presentation-configurable option classes; one-grid fossil bar

**Context.** Slides differ only in a small number of shapes; chart-option classes must render
different metric subsets on different slides; the fossil bar must animate 5→6.

**Decision.**
- **Three layout presets, closed for V1** (later extended to a fourth, `duo-viz-equiv`, by ADR-025)**:**
  `text`, `viz-text`, `duo-viz-text` — all with the **text
  block below** the visualisation(s) and an **optional heading above the text** (business §4, UI §3.2).
  A single generic **`SlideLayout`** component renders a preset from named slots (`heading`, `viz`,
  `viz2`, `text`). New shapes extend the closed set deliberately.
- **Presentation-configurable chart-option classes.** Each option class gains a **presentation /
  metric-selection input** (the slide's `VizConfig.metrics`) so the same class renders stock-only vs.
  stock + forgone sink (main), or with/without fossil (donut, bar). Metric selection is a **client-side
  presentation transform** over the DTO (ADR-021), not a refetch.
- **Fossil-comparison = one grid, two categories.** `FossilComparisonOption` is restructured from two
  separate grids (old dashboard) to **one grid with two categories** (deforestation, fossil) sharing a
  single Y-axis (still via the `sharedYAxis()` helper) — which both simplifies the chart and makes the
  slide 5→6 fossil-removal a single smooth `setOption` diff (ADR-022, business §4.5).

**Rationale.** One generic layout + a closed preset set keeps the deck's surface tiny and consistent.
Passing metric selection into option classes reuses the pure, tested chart classes across slides with
no duplication. The one-grid bar is a prerequisite for the closing animation.

**Consequences.**
- `SlideLayout` + `GenericSlide` components (ADR-021); option-class constructors take a
  `presentation`/metrics argument; `FossilComparisonOption` loses its two-grid branch in favour of one
  two-category grid.
- Chart-option unit tests gain metric-selection cases (which series are emitted per slide).

---

## ADR-025 — Slide-6 "insight" layout preset (`duo-viz-equiv`); restaged 4-value equivalence strip; layout change preserves chart identity

**Context.** Slide 6 (`deforestation-insight`) must simultaneously (a) share the footprint scene's
`baseline` + `horizon` controls with slide 5, (b) reuse **and animate** slide 5's donut + fossil-bar
instances (the 5→6 zoom, ADR-022), and (c) additionally stage a **full-width equivalence strip** at
the foot. That fits none of the three ADR-024 presets, and the bottom text block must be dropped (screen
budget) in favour of a single **caption line on top**. A new preset is required — but a naive new layout
branch would relocate the `#viz` slot outlet and **remount** the charts, destroying the 5→6 animation.

**Decision.**
- **Add a fourth closed preset `duo-viz-equiv`** (slide 6 only): top-to-bottom a thin **caption** line
  (one localized line, no heading) · the scene's **controls** row · the **two vizzes** (donut + fossil
  bar, the *same instances* as slide 5) · a **full-width equivalence strip**. **No bottom text block.**
  On a height-constrained viewport the strip keeps its needed height and the **viz cards shrink** (they
  are primitive charts), never the strip.
- **The layout switch must NOT remount the charts (binding).** `SlideLayout` renders **one
  unconditional stage** — `<div class="slide__stage"><slot name="viz"/></div>` — for **every** preset;
  presets differ only by **CSS** (grid template / sizing) and by **which surrounding slots**
  (`caption`, `text`, `equivalence`) render. Because the `#viz` outlet keeps the **same vnode position**
  across `duo-viz-text` (slide 5) → `duo-viz-equiv` (slide 6), the `viz.id`-keyed `<VChart>` instances
  are preserved and the 5→6 `setOption` animation is retained (ADR-022/023). A structural `v-if` fork,
  a second layout component, or any change that relocates the viz outlet is **rejected** (it re-inits
  ECharts). Adding a sibling widget (the strip) in its own slot does **not** touch chart identity.
- **Footprint scene surfaces `baseline` + `horizon`, shared across slides 5–6.** Per-scene state
  (ADR-023) already shares control state between sibling slides in a scene; the old
  `forced { horizon:'today' }` is dropped (only `scope:'global'` stays forced). Both are server-refetch
  controls (ADR-021); changing them re-derives the donut/bar and the strip alike.
- **Restaged, redesigned equivalence strip (slide 6).** The equivalence panel is **no longer deferred**
  (business §4.6 / UI §8 updated). A redesigned `EquivalenceStrip` shows **four** magnitudes derived
  from the footprint scene's Pinia state, colour-coded to the chart grammar:
  1. **stock over the window** (`data.stock` green);
  2. **forgone sink, annual** at the last measured year (`data.forgoneSink` amber);
  3. **forgone sink over the window / to horizon** (`data.forgoneSink` amber);
  4. **combined total** = stock + forgone sink over the window (`data.total` — a **new** red-adjacent
     token, deliberately **distinct from the error red** `#E5534B` so it never reads as a fault).
  A **unit switcher** (Mt CO₂ · passenger-car annual · reference-country annual, locale-driven SVK/UK,
  **default cars**) converts all four values at once. The magnitudes are **client-side reductions** over
  the already-fetched global DTO series (**symmetric window** = `[baseline, horizonTargetYear(horizon)]`,
  i.e. it **opens at the `baseline` year and closes at the chosen horizon**; keyed by `DerivationParams`
  — no new endpoint, no refetch beyond the existing controls). The car factor comes from
  `equivalences.ts`; the reference-country annual scalar reuses the existing locale-driven equivalence
  resolution (re-resolved on locale change with no deforestation refetch).

  The **donut and fossil-comparison bar on slides 5/6 read the same window basis**: every slice / bar is
  the **TRUE finite integral** — stock, fossil AND the forgone sink each summed (`Σ`) over
  `[baseline, horizonTargetYear(horizon)]` (business §2.4 quantity #2), so all three magnitudes are the
  same kind of quantity. `sceneWindow(baseline, horizon)` in `derivation.ts` is the single source of
  truth for the window edges. The **`baseline` control both shapes the server-side forgone-sink rate**
  (cumulative-loss integration) **and defines the lower edge of the magnitude window**. Consequence: at
  horizon **today** the window is `[baseline, anchor]` and every scene magnitude reads its
  **cumulative-to-today** value (never 0) — the scene reads meaningfully at every horizon.

**Rationale.** One unconditional viz outlet is the minimal, robust way to add a structurally different
slide without losing the signature animation. Client-side magnitude reduction reuses data the scene
already holds and keeps the server contract unchanged (ADR-021).

**Consequences.**
- `LayoutPreset` gains `duo-viz-equiv`; `SlideLayout` gains `#caption` + `#equivalence` slots and
  per-preset CSS while the stage/viz outlet stays unconditional.
- New `EquivalenceStrip` + `UnitToggle` components; `theme.data.total` token added (shared theme type +
  `app.config.ts`).
- Footprint `SlideDef`s (slides 5,6) gain `controls:['baseline','horizon']`; slide 6 uses
  `duo-viz-equiv` with a `captionKey` and no text-block `textKeys`.
- Tests: 5→6 does not remount the `viz.id`-keyed charts across the preset change; strip renders 4 values
  with the correct colour tokens; the unit switch converts all four; window reduction spans the symmetric
  window `[baseline, horizonTargetYear(horizon)]` as a true `Σ` for all three metrics (donut + fossil bar
  read the same window totals).

**Alternatives.** A dedicated slide-6 layout component or a `v-if` structural fork (rejected — relocates
the viz outlet, remounts ECharts, kills the zoom). A new `/api/equivalence`-shaped endpoint for the four
magnitudes (rejected — they are pure reductions over data the scene already holds; ADR-021).

---

## Decision summary table

| # | Area | Decision |
|---|---|---|
| 001 | Framework | Nuxt 3, SSR universal, Vite, Nitro BFF |
| 002 | UI library | PrimeVue v4 (Aura), dark default |
| 003 | State | Pinia single source of truth; dumb components |
| 004 | HTTP | Axios both tiers, injected instances |
| 005 | Derivations | Server-authoritative + store cache by param signature; `timeRange` is client-only ECharts `dataZoom` |
| 006 | Charts lib | `nuxt-echarts` module (`<VChart>`), client-only, tree-shaken |
| 007 | Chart arch | `BaseChart.vue` → per-chart components → abstract `BaseChartOption` classes |
| 008 | Backend | Adapter → Service → thin BFF route, OOP TS classes |
| 009 | DI | Manual composition root, constructor injection; typed props + `useChartContext` on FE |
| 010 | Parallelism | `Promise.all`/`allSettled` on server; concurrent deduped fetch on client |
| 011 | i18n | `@nuxtjs/i18n` (vue-i18n), SK/EN, browser-detected default, all copy localized |
| 012 | Config | Typed versioned config: domains, indicators, equivalences |
| 013 | Testing | Vitest unit + Vue Test Utils on critical components |
| 014 | Deploy | Vercel, Nitro `vercel` preset; CDN `routeRules` cache (SWR) + `defineCachedFunction` |
| 015 | Tooling | pnpm, Node 20 LTS, strict TS, `@nuxt/eslint` + Prettier |
| 016 | Reference year | Composite scalars at min common data year; surfaced in UI |
| 017 | Shareable state | `DerivationParams` (incl. `horizon`) synced to URL query (only `timeRange` excluded); SSR reads it |
| 018 | Number formatting | Injectable `Formatter` hierarchy; V1 `CompactNumberFormatter` (`3.2M`, `×3.2`) |
| 019 | Time horizon + projection | Horizon is the signature axis (replaces official↔full); per-domain linear projection; dashed separate series (ECharts workaround) |
| 020 | Country coverage gate | Single `CoverageGate` decides excluded countries (union: incomplete on stock OR area) and applies to both stock & forgone; `sumSeries` is a pure sum; no domain-level exclusion |
| 021 | Story deck | Presentation = linear six-slide deck (`SlideDef[]`, frontend-only); presentation transforms client-side; server contract unchanged; controls tagged client-transform vs. server-refetch |
| 022 | Chart identity | Stable `viz.id` across sibling slides → preserved instance → `setOption` animation; different id / scene boundary → fresh mount; no shared-element morph in V1 |
| 023 | Route & store | Single persistent `/story/:slug` route (no remount); two-layer store (`dtoCache` + per-scene `sceneState`); reset policy A; control state in URL query; prefetch next slide |
| 024 | Slide layout & options | Closed layout presets (`text`/`viz-text`/`duo-viz-text`) via generic `SlideLayout`; presentation-configurable option classes (metric selection); fossil bar = one grid, two categories |
| 025 | Slide-6 insight | 4th preset `duo-viz-equiv` (caption · duo-viz · equivalence strip, no text); the layout change keeps the `#viz` outlet unconditional → charts preserved 5→6 (ADR-022); footprint shares `baseline`+`horizon`; restaged 4-value equivalence strip (client-derived, unit switcher, new `data.total` token) |
