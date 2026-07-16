# The Hidden Carbon Cost of Deforestation — Business Overview (v1.0.0)

**Status:** Source-of-truth business document. All other specification documents
(`01-technical-decisions.md`, `02-ui-specification.md`, `03-technical-specification.md`)
are derived from this one. It is a complete, self-contained restatement of the product
concept in English, translated and consolidated from the original concept handoff
(`handoff-v1.0.0.md`). Decided items are binding; open items are collected in §12.

---

## 1. Purpose and framing

A reference mini-project by a frontend engineer: an application that connects to public data
via an API and visualizes it with diagrams. **Audience:** IT recruiters and engineers at
companies the author is applying to. Demonstration value — data-model design, non-trivial
transformations, clean visualization, and defensibility of decisions — matters more than mass
comprehensibility of the topic.

**Core proposition.** The application answers one concrete question:

> The real climate cost of vanished rainforest is larger than the official numbers say.
> By how much?

There is a **visible part** (released stored carbon — present in official statistics) and a
**hidden part** (lost future sink — missing from official numbers). The application makes the
hidden part visible and puts it in proportion to known quantities.

**Stance: "honest explorer, not proof."** The app clearly separates *measured inventory
figures* from *its own estimates*, admits uncertainty, and exposes its assumptions (choice of
`R`, baseline, horizon) rather than hiding them. Crucially, our estimate of the forgone sink is
a **structurally conservative lower bound** (reasons in §5) — the app never claims "exactly this
much," always "at least this much."

---

## 2. Key concepts

### 2.1 Two components of the carbon impact of deforestation

1. **Stock emission (committed emission).** Carbon accumulated in biomass and soil, released
   when forest is cleared. A one-off "withdrawal from the account," tied to the year of clearing.
   Measured by the World Bank indicator `EN.GHG.CO2.LU.DF...` (by net convention).
2. **Forgone sink (lost sequestration).** How much CO₂ the forest would have absorbed every year
   into the future had it stood — and now will not. Not a one-off event but a **permanent flow
   that disappeared.** This is the main mechanism the app focuses on, and it is **systematically
   missing** from official LULUCF numbers: the net convention counts the difference of gross
   emissions and gross removals, and vanished forest is no longer on the list of areas that
   absorb anything, so the "lost sink" never appears as a positive line.

### 2.2 Estimating the forgone sink (counterfactual method)

```
annualForgoneSink[t] = R × (cumulative cleared area from baseline through year t)
```

`R` = net sequestration rate of undisturbed tropical rainforest (t CO₂ per ha per year,
regionally differentiated — see §6). Interpretation: how much the area lost so far would absorb
annually if it still stood. This is a **derived, estimated** metric — always clearly separated
in the UI from measured WB figures, with an uncertainty band.

### 2.3 Impulse vs. cumulative flow (fundamental to the data model)

- **Stock emission** is an *impulse* — proportional to the *change* in area in a given year
  (Δarea[t]). Natural visualization: bars.
- **Forgone sink** is *cumulative* — proportional to the *cumulative loss* of area
  (Σ Δarea through year t), because every cleared hectare is also missing in every subsequent
  year. Natural visualization: growing area/line.

Two mathematically distinct transformations of the same input series (`AG.LND.FRST.K2`).

### 2.4 Non-computability of a "total" forgone sink

Three quantities must be distinguished: the **annual rate** (finite), the **cumulative to today**
(finite integral), and the **cumulative into the infinite future** (diverges — no single "total"
number exists because the deficit lasts forever). The app therefore never displays a "total"
number to infinity; it works with the annual rate or the cumulative over a finite window. The
"forever" property is not a defect but the point: the stock is paid once, the forgone sink is a
subscription forever. Analogy: the choice of horizon in GWP-100 vs. GWP-20 is also a convention —
we expose it, we do not hide it.

**The time horizon is climatically asymmetric.** The climate crisis is acute now and its peak is
estimated within the coming decades; the value of the forgone sink in a 10–30 year window is
therefore disproportionately more important than the distant future. Consequence for the UI
(§4.4): shorter horizons are the relevant ones, and the argument "the sink will saturate around
2035 anyway" is weak if the critical window is precisely now.

### 2.4a The time horizon as the central control, and the forward projection

The choice of time horizon is not a footnote — in V1 it is **the** signature interaction of the app
(it replaces the earlier "official ↔ full" accounting toggle, now removed; see §2.6). The user sets
**both edges of the time window**: the lower edge (baseline, §7.2) and an **upper edge chosen from
fixed horizon categories** — *today* · *+20 y* · *+30 y* · *+50 y* · *+75 y* · *+100 y*, counted
from the current calendar year. "Today" means no projection (the window ends at the last year of
measured data); every other category extends the window into the future by that many years.

**Why the app must project.** Measured series end ~2022 (§7.1). The crossing panel (§4.3, panel 3)
cannot show its point — the moment the accumulating forgone sink overtakes the one-off stock
release — inside such a short measured window; the multiplier and the ranking are likewise more
telling over a longer horizon. So beyond the last measured year the app draws a **forward
projection** ("committed future"): visualisations need *some* future values to make the point, and
these are clearly-labelled, visually-distinct estimates, never presented as measured data.

**How the projection is built (method, binding).**
- **Per domain, not on the aggregate.** Each domain's cleared-area series is extrapolated on its
  own, because each domain has its own `R` (§6) and its own trajectory; the projected domains are
  then summed with the same aggregation as measured data (§3). A single trend fitted to the
  pre-aggregated series would freeze today's domain mix and is therefore wrong for the forgone sink
  (and it is exactly the per-domain divergence that makes the ranking reshuffle, §4.3, panel 2).
- **Linear trend from the recent past.** The projection is a linear extrapolation of the last
  ~10 measured years (recent mean + fitted slope), clamped to non-negative area loss. It carries
  forward the current pace *and* its direction (accelerating or declining deforestation). From the
  projected cleared area follow the projected stock and the projected forgone sink by the same
  formulas as for measured years (§2.2, §2.5).
- **Visually distinct.** Projected values render as a **dashed** continuation of each series in the
  same colour and the same stacking order as its measured part, so a stacked chart reads as "the
  solid line simply became dashed," with a **join-year divider** marking where measurement ends and
  projection begins (the technical rendering contract is in the UI/technical specs).

The projection does not change any *scalar* computed on measured data: the multiplier, the
equivalence base and the footprint donut are still evaluated at the measured **reference year**
(§7.1a). The horizon extends the *time-series* charts, the crossing point, and the ranking's
"at-horizon" column.

### 2.5 Composite quantity "full emissions"

```
fullEmissions[t] = WB_emissions[t] + forgoneSink[t]
```

Both terms are **the annual flow of year t** (Mt CO₂/yr): the WB emission is an annual flow, the
forgone sink is the annual deficit valid in year t due to loss so far (a cumulative *level*, not
its increment). Units are consistent. This number feeds the magnitude panels and the equivalence
panel (§4).

The **multiplier ×N** shown above the main chart is `fullEmissions ÷ WB_emissions` at the reference
year (§7.1a) — how many times the true annual impact exceeds the officially reported number. The WB
reported stock survives as this denominator even though the app no longer has a separate "official"
display mode (§2.6).

### 2.6 One accounting ("full"), and what the horizon changes

**V1 shows one accounting: "full" (stock + forgone sink).** Earlier drafts carried an
"official ↔ full" toggle; it is **removed** — from the UI and from every architecture layer. The
reveal it produced (the hidden forgone sink appearing) is now carried by the app's default state
(the forgone sink is always shown) and, above all, by the **time-horizon** control (§2.4a), the new
signature interaction. The WB "official" number does not disappear as a *quantity* — it remains the
measured stock layer and the denominator of the multiplier (§2.5) — only as a separate *mode*.

What the horizon changes and does not change:
- **Magnitude-based** things move strongly with the horizon: the crossing year, the multiplier
  ceiling, the domain ranking, the equivalence value all grow/shift as the window lengthens. These
  are the panels under the main chart (§4.3) — magnitude-based by design.
- **Shape/correlational** things are blind to it: Pearson `r` is invariant to the horizon just as it
  was invariant to the old switch (the forgone-sink increment is nearly collinear with the stock —
  both track that year's area loss). The optional correlation view (§2.7) therefore stays out of the
  main story.

### 2.7 Correlation — only one optional view

Correlation of indicators is not the main function. One legitimate optional correlational view
remains: forest-area loss vs. deforestation emissions *within a domain* ("carbon intensity of the
lost hectare"). It is not a tautology, because area and LULUCF emissions are independent
measurements (§7.3). For this view:
- **Unit consistency:** both sides of the same kind — level against level, or increment against
  increment. Never mix (the common-trend trap).
- **No correlating cumulatives at levels:** two monotonically rising series give r ≈ 0.99 for
  nothing. Therefore each series carries an attribute "state/cumulative vs. flow/increment" and
  the correlation layer rejects/warns on such a combination.

**V1 decision:** this view is **deferred** from V1. The correlation functions remain implemented
and tested in the statistics core but dormant (no UI panel). The series type attribute
(state vs. flow) is nonetheless present from the start so the view can be switched on later.

---

## 3. Two operating modes and the "domain" unit

The application operates at two scales on the **scope** axis:

- **Global aggregate** — sum of the forgone sink across the main rainforest domains.
- **Local domain** — one selected rainforest domain.

**The unit is the "domain," not the country.** In local mode the user selects from a small set of
predefined domains, not from a list of countries. A domain = a set of ISO3 codes in config (e.g.,
Amazon = Brazil + Peru + Colombia + …). This resolves the fact that biogeographic rainforests
cross country borders; countries are an internal aggregation detail, invisible in the UI.

A second, independent axis is the **time horizon** (§2.4a): the upper edge of the window — *today*
or a projected *+20 / +30 / +50 / +75 / +100 y* — set by the horizon selector, the app's signature
control. It changes magnitudes (crossing, multiplier, ranking, equivalence), never the identity of
a domain.

### Global sum and uncertainty aggregation

```
globalForgoneSink[t] = Σ_domain ( R_domain × cumulativeLoss_domain[t] )
```

Each domain has its own `R` and its own band. Uncertainties combine as independent estimates:
`σ_total = √Σ σ_domain²` (not a naive sum) — the global estimate is thereby *relatively* more
certain than any single domain (errors partly cancel). The global chart does not draw a band for
each domain separately (chaos), but one aggregate band around the upper edge of the sum.

Honesty: the global sum covers the *main tropical rainforest domains*, not literally every forest
on the planet (temperate/boreal forests have a different balance). The label must read
"main tropical rainforest domains," not "the whole world."

### 3.1 Locked domain set (V1)

Four domains are locked for V1 (ISO3 membership and `R` config finalized in the technical spec;
values flagged as revisable):

| Domain | Representative composition (ISO3, indicative) | Robustness of `R` |
|---|---|---|
| Amazon | BRA, PER, COL, VEN, ECU, BOL, GUY, SUR, GUF* | lower (declining trend → widest band) |
| Congo Basin | COD, COG, GAB, CMR, CAF, GNQ | high (Hubau 2020, stable) |
| SE Asia | IDN, MYS, PNG, MMR, KHM, LAO, THA, VNM, PHL, BRN | medium (Qie 2017 proxy) |
| Other tropical | remaining tropical-forest ISO3 not in the above | rough (pan-tropical average) |

*GUF (French Guiana) is a territory; its ISO3/World-Bank coverage is verified in the spike before
inclusion. The exact membership per domain is defined in the domain config and is revisable.

---

## 4. UX and screen structure

The UI is a **composer**: a narrow control panel + a main canvas that changes according to
configuration (not a static page). It opens on a ready preset — **global scope, `R` = mid, baseline
1990, horizon = today (window 1990 – last measured year)** — a functional state from which the user
branches out. The forgone sink and the ×N multiplier are shown from the start (there is no
"official" mode to reveal them from). The signature interaction is instead the **time-horizon
selector**: pushing the horizon out (+20 … +100 y) makes the forward projection appear and drives
the crossing point, the growing multiplier ceiling and the reshuffling ranking live. A one-sentence
point primes the user to push the horizon out.

### 4.1 Controls (degrees of freedom; limits follow from the nature of the data)

- **Scope** — switch global aggregate / local domain.
- **Domain selection** — from the ~4 rainforest domains (local mode only).
- **Time-horizon selector** — the signature interaction; sets the **upper edge** of the window as
  one of *today · +20 y · +30 y · +50 y · +75 y · +100 y* (from the current calendar year). *Today*
  ends at the last measured year; the others extend a dashed forward projection (§2.4a). This single
  control also drives the equivalence panel (§4.4). There is **no** "official ↔ full" toggle and no
  stock/forgone-sink checkboxes — the forgone sink is always part of the picture (belowground
  biomass is folded into `R`, §5, not a separate control).
- **`R` scenario** — three values conservative / mid / high = lower CI bound / central value /
  upper CI bound (§6). Not a free continuous slider — `R` is anchored in the literature.
  **Default = mid value** (not conservative — reason in §5). In global mode the scenario applies
  to all domains at once.
- **Reference year (baseline)** — optional, but only from 1990 upward (§7.2 — the data floor).
  Label always explicit: "forgone sink computed from forest loss after year {X}."
- **Time range (lower edge / zoom)** — a brush on the timeline (a client-side view crop, not a
  recomputation). The range's **upper edge** is the horizon selector above — that one *does* change
  the computed projection, so it is server-side, unlike the client-only zoom.

There is **no fossil-reference toggle.** The fossil comparison is not gated behind a control: in
global scope the share-of-footprint donut + share number (with global fossil emissions as the
denominator) is **always shown** (§4.3, panel 1). This removes a redundant control and a
redundant matrix row.

### 4.2 Main canvas (the core)

- **Local domain:** a stacked chart of a single domain — stock (bottom layer, annual impulse,
  solid line = harder number) + forgone sink (growing cumulative deficit, dashed line +
  uncertainty band = estimate). (A "side by side" stock-vs-forgone variant is **deferred** from V1 —
  §12.)
- **Global aggregate:** a stacked area where the layers are domains (each domain's contribution to
  the world sum), with one aggregate uncertainty band around the upper edge.
- Above the canvas, a large live **multiplier** ("×N: the real annual cost is N times the officially
  reported number") = `fullEmissions ÷ WB_emissions` at the reference year (§2.5), recomputed on
  change of `R` scenario. It is a scalar on measured data, so in V1 it does not itself move with the
  horizon; a horizon-reactive multiplier is a candidate (§12).

**Framing note (important for UI copy):** the stock layer carries the anti-deforestation argument
even when a domain's forgone sink is small (e.g., a saturated Amazon). Even if the net sink were
near zero, clearing dumps an enormous stored reserve. The chart must therefore never invite the
reading "small forgone sink = clearing is okay."

### 4.3 Magnitude panels under the main chart

Each is magnitude-based (proportions, orderings, temporal crossings), not correlational; the horizon
control (§2.4a) is what moves them, most visibly the ranking (panel 2) and the crossing (panel 3):

1. **Share of the total carbon footprint** — a **composition donut** of total emissions with
   **three slices**: fossil, the one-off deforestation stock release, and the forgone sink. The
   accompanying **share number** is deforestation (stock + forgone sink) as % of the total footprint.
   (Global mode — fossil is global fossil emissions.) **Always shown in global scope.** Evaluated at
   the reference year on measured data (§7.1a), so it does not move with the horizon in V1.
2. **Reshuffling of the domain ranking with the horizon** — a **two-column bump chart**: the domain
   ranking **today** (left) vs. the ranking **at the chosen horizon** (right), with connectors. The
   order reshuffles because each domain has its own `R` and its own projected trajectory (§2.4a), so
   their forgone-sink burdens grow at different rates; a domain modest today can climb by +100 y.
   Driven by the horizon selector, not by any accounting switch. (Global / cross-domain view.) *The
   per-domain value ranked is the domain's full impact accumulated over the window up to the column's
   year; the exact integral is flagged revisable (§12).*
3. **Stock vs. forgone-sink crossing over time** — the annual one-off stock release (impulse, ~flat)
   vs. the forgone sink as a cumulative-driven level (`R × cumulative area loss`, rising, §2.3); in
   year **N** the rising forgone sink overtakes the stock. That point sits *beyond* the measured
   window, so it becomes visible only once the horizon is pushed out into the projection (§2.4a) —
   the horizon is what finally lets this panel deliver its message. (Both scope modes.)
4. **Deforestation vs. fossil emissions (side by side, shared scale)** — two side-by-side charts of
   total deforestation emissions (stock + forgone sink) vs. global fossil emissions, drawn on a
   **shared Y-axis** (identical maximum and tick size) so the magnitudes are directly comparable.
   **Global scope only** (local fossil comparison is weak, §4.5). Evaluated at the reference year on
   measured data.
5. **Equivalence panel** — see §4.4.

### 4.4 Equivalence panel (finalized — driven by the global horizon)

Quarter width. **Resting state:** a large number + the framing "per year" right below it (e.g.,
"≈ 3.2 million cars per year — and every subsequent year again"). Framing as an **annual rate /
permanent debt**, not a one-off "total". No mode switch and **no separate preset row** any more —
the panel reads the **global time-horizon selector** (§2.4a, §4.1), which replaces its old
`annual/10/30/50` presets.

**Semantics — forward committed (decided).** The headline is always the **annual rate** at the
reference year (§7.1a). When the horizon is a future category (+20 … +100 y) the panel additionally
shows the **committed total over that window** = `annualRate × horizonYears` — the already-incurred
cumulative area loss keeps failing to absorb its annual amount every future year (holding the
current loss constant, i.e., no *further* loss). This matches the "permanent debt — and every
subsequent year again" framing and the climatic asymmetry (§2.4). At horizon *today* only the annual
headline shows. It is always a finite window, never an infinite total (§2.4).

**V1 emphasis (climate asymmetry, §2.4):** the horizon selector visually emphasises the shorter
future categories (**+20 / +30 y**) as the decisive ones. Equivalences shown =
(a) equivalent annual emissions of passenger cars and (b) annual emissions of a reference country.
Conversion factors and their sources live in config.

**Resolved config values (V1, `revisable`):**

- **Car factor `carAnnualTonsCO2 = 4.6` t CO₂/yr.** *Reasoning:* the US EPA "typical passenger
  vehicle" figure — a car driving ≈ 11,500 mi/yr at ≈ 22 mpg burns ≈ 489 gal, and gasoline emits
  8,887 g CO₂/gal → ≈ 4.6 metric t CO₂/yr (EPA, *Greenhouse Gas Emissions from a Typical Passenger
  Vehicle*, EPA-420-F-18-008). Chosen as the single most widely-cited, internationally recognizable
  anchor; the EU-fleet figure is lower but less universally known. A single scalar keeps the "≈ N
  million cars/yr" framing legible.
- **Reference country — locale-driven.** The comparison country is **resolved from the active UI
  language** (i18n locale in the store): **Slovak (`sk`) → Slovakia (`SVK`)** (relatable to the
  primary audience, ~30 Mt CO₂/yr → punchy multipliers); **all other locales (default `en`) →
  United Kingdom (`GBR`)** (recognizable mid-size emitter). Both countries' annual fossil emissions
  come from the same fossil indicator (`EN.GHG.CO2.MT.CE.AR5`). The equivalence UX element is
  **reactive to the current locale** — changing the language re-resolves the reference country (and
  its `countryEquivalent.times`) without a new data fetch of the deforestation series.

### 4.5 Mode matrix (what is shown where)

Two axes remain: **scope** (global / local) and the **time horizon** (§2.4a). There is no accounting
axis — the app always shows "full".

| Element | Global | Local domain | Notes |
|---|---|---|---|
| Main chart: stock + forgone sink over time | ✓ (forgone sink as domain stack) | ✓ (one domain, 2 series) | forgone always shown; projection dashed past the last measured year |
| Time-horizon selector | ✓ | ✓ | the signature control; sets the window's upper edge / projection |
| Forgone-sink layer + uncertainty band | ✓ | ✓ | always on |
| Multiplier ×N | ✓ | ✓ | `fullEmissions ÷ WB stock` at the reference year |
| Stock × forgone-sink crossing | ✓ | ✓ | crossing point appears only once the horizon is pushed into the projection |
| Equivalence panel | ✓ | ✓ | reads the global horizon; headline = annual rate, +N y = committed total |
| Share of total footprint (3-slice donut + %) | ✓ (always on) | ✗ (local fossil compare weak) | fossil + stock + forgone sink; at the reference year |
| Deforestation vs. fossil (side by side, shared Y) | ✓ (global only) | ✗ (local fossil compare weak) | stock + forgone sink vs. fossil; at the reference year |
| Domain ranking reshuffle (today → horizon bump) | ✓ | ✗ (single item) | reshuffles with the horizon, not an accounting switch |
| Domain selection | ✗ (all summed) | ✓ (from ~4 domains) | local only |
| `R` scenario | ✓ (all domains) | ✓ (given domain) | conservative / mid / high |
| Baseline (lower edge), time-range zoom | ✓ | ✓ | baseline is server-side; zoom is client-only |

Logic: fossil comparison, share of footprint and the domain ranking are global (local fossil
comparison is weakly informative; a ranking of one domain makes no sense). The forgone sink, the
multiplier, the crossing and the uncertainty band are always present (no "official" mode hides
them). Domain selection is the only element exclusive to local mode.

---

## 5. Why our estimate is a lower bound and why the default is not conservative

The `R × area` model **structurally underestimates** the true loss, for several independent
reasons at once. This matters for framing and for the choice of default.

**Reasons for underestimation:**
1. **Decay tail.** At the moment of clearing, absorption vanishes abruptly, but the compensation
   (that no future dead wood will form and decay) manifests only gradually. A transient, slowly
   weakening positive term of the forgone sink arises, which our constant `R` does not model.
2. **Regeneration and stock maintenance.** A standing forest dynamically renews and *holds* an
   enormous stock indefinitely; deforestation switches off this guarding/regeneration mechanism.
   `R × area` does not capture this.
3. **Positive flow from what replaces the forest.** Cleared land does not become a carbon-neutral
   void, but pasture/soy/palm — typically a net source (methane from cattle, N₂O from fertilizers,
   peat oxidation on drainage). Our model has no such term.
4. **Net instead of separated X.** WB `.DF` is a net number where the loss of absorption (X) and
   the decay flow (Y) are already merged; we do not have them separately (see §5.1).

**Consequence for the default:** when the model underestimates from so many sides, choosing the
lower bound of the `R` interval as well would be a double conservatism with an unrealistically low
result. Therefore **default = mid `R`**; the conservative/high scenarios are sensitivity bounds,
not the starting point. The mid value is a more realistic estimate for a structurally
underestimating model, and the app can always add "and even this is more of a lower bound."

### 5.1 The X/Y model and what "a sink declining to zero" means

Net forest sink = gross absorption by living trees (X) minus release by decay of dead matter (Y).
Deforestation directly reduces X. A "saturated forest" with net sink ≈ 0 **does not mean** the
trees have lost the ability to absorb (X = 0), but that X ≈ Y (growth balanced by mortality and
decay, the stock no longer grows). `R` in our metric = net sink, so for a saturated forest the
forgone sink comes out small — but that is not "the forest is insignificant," it is "its *net
future increment* was small, while its *stock* (which clearing dumps) is enormous." A zero lower
bound of the interval (e.g., Amazon) is a **measurement uncertainty, not a physical scenario** —
a further reason not to take the lower bound as default.

The ideal chart would track the fate of X and Y separately — but **that cannot be assembled from
World Bank data** (WB gives net). Separation of gross flows (gross removals ≈ X, gross emissions
≈ Y) is available only from GFW — and is the strongest substantive reason for GFW as an extension
(§12).

---

## 6. Sequestration rates `R` (hardcoded config, backed by literature)

`R` and its band are **not up to the user** — they are published values from the largest
rainforest measurement networks, hardcoded in config. The band = the published 95% confidence
interval, not an arbitrary number.

**Sources:** Hubau et al. 2020, Nature (net sink of aboveground living biomass of intact African
rainforests 0.66 t C/ha/yr, 95% CI 0.53–0.79, stable three decades to 2015; Amazon in long-term
decline, window 2010–2015 ≈ 0.25–0.33 t C/ha/yr, CI ~0.00–0.49). Qie et al. 2017, Nature
Communications (Borneo 0.43 t C/ha/yr, 95% CI 0.14–0.72). Pan-tropical average ≈ 0.5 t C/ha/yr
(plot-network data, 1990–2007).

**Conversion to CO₂: × 3.667** (t C → t CO₂), because the emission indicators are in CO₂.

**Belowground biomass is folded directly into `R`, not a third mode.** `R` = **total** ecosystem
sink = aboveground value × an allometric factor for roots/lianas/understory. **Factor locked =
1.24** (= 1 + IPCC default root:shoot ratio ≈ 0.24 for tropical rainforest; within the ~1.2–1.3
range), cited in the domain config; revisable. Why not a separate control: the belowground part via
a constant reveals no new *qualitative* mechanism (unlike the forgone sink, which is missing from
official numbers by principle) — it is "the same, larger." A separate control would only add a
degree of freedom for one constant with no qualitative payoff. **Soil carbon flux is deliberately
omitted** (its measurement is very uncertain everywhere).

Values (aboveground from literature; in config convert to CO₂ and multiply by the allometric
factor for the total sink):

| Domain | R aboveground (t C/ha/yr) | R aboveground (t CO₂/ha/yr) | 95% CI (CO₂, aboveground) | Robustness |
|---|---|---|---|---|
| Congo Basin | 0.66 | ≈ 2.42 | 1.94–2.90 | high (Hubau 2020, 244 plots, stable) |
| SE Asia | 0.43 | ≈ 1.58 | 0.51–2.64 | medium (Qie 2017, Borneo as proxy) |
| Amazon | ~0.30 (declining) | ≈ 1.10 | 0.00–1.80 | lower (declining trend → widest band) |
| Other tropical | ~0.50 | ≈ 1.83 | 0.51–2.90 | rough (pan-tropical mean; envelope CI) |

Note: the table above is **aboveground** (already in t CO₂, i.e. source t C × 3.667). The **total
`R` seeded into config = aboveground × 1.24** (the locked allometric factor). **CI is stored as
absolute `{ low, high }` endpoints, not `mid ± σ`,** so asymmetric bands are preserved.

**Config-ready total `R` (aboveground × 1.24, t CO₂/ha/yr) — provisional, `revisable`:**

| Domain | R mid | R low | R high | CI shape |
|---|---|---|---|---|
| Congo Basin | **3.00** | 2.41 | 3.60 | symmetric (±0.60) |
| SE Asia | **1.96** | 0.63 | 3.27 | symmetric (±1.32) |
| Amazon | **1.36** | 0.00 | 2.23 | **asymmetric** (−1.36 / +0.87), floor at 0 (declining sink) |
| Other tropical | **2.27** | 0.63 | 3.60 | mildly asymmetric (−1.64 / +1.33), SE-Asia-low → Congo-high envelope |

The multiplication by 1.24 scales both CI endpoints; a zero endpoint stays zero (Amazon low = 0).
The **Amazon** central estimate does not sit at the midpoint of its published CI (declining,
non-stationary sink), hence its asymmetry; **Congo/SE Asia** are symmetric because their central `R`
is the published mean of a symmetric 95% CI. All four are **locked provisionally and flagged
`revisable`** (§12).

**Three caveats (in config and in the UI):**
1. **Source of values = intact forest** — applies best to loss of primary forest; degraded/edge
   forest has a lower, sometimes negative sink.
2. **The sink is not constant over time** — the Amazon declines toward zero ~2035, the African
   sink is projected to shrink ~14% by 2030. A constant `R` is a defensible V1 simplification,
   but must be admitted (and is why the Amazon has the widest band). A time-varying `R` is a
   candidate beyond V1.
3. **"Saturated forest" = balance of flows, not loss of absorption capacity** (§5.1); a zero
   lower bound is measurement uncertainty.

`R` scenario in the UI: conservative/mid/high = lower CI bound / central value / upper CI bound.
Default = mid.

---

## 7. Data sources

For V1, **World Bank is the only API source.** Plus the hardcoded `R` (§6).

### 7.1 WDI Indicators API (World Bank)
- Base: `https://api.worldbank.org/v2/country/{GEO}/indicator/{IND}?format=json` — no key,
  CORS enabled.
- Response: an array `[metadata, rows]` — data always in `response[1]`. Record:
  `indicator{id,value}`, `country{id,value}`, `countryiso3code`, `date`, `value`, `unit`,
  `obs_status`, `decimal`.
- Parameters: `date=FROM:TO`, `mrv`/`mrnev` (most recent / most recent non-empty), `per_page`
  (default 50 — raise it), a semicolon = AND for both countries and indicators (max 60; with
  multiple indicators at once `source=2` is mandatory), `country/all` (contains aggregates —
  filter via `v2/country`, aggregates have `region.id === "NA"`), `WLD` = world.
- Data holes: emission series often end 1–2 years before the present; always show the year of the
  value in the UI. `mrnev` helps.

### 7.1a Reference year and data alignment (decided)
Series end in different years (forest area ~2023, LULUCF emissions possibly ~2022). Every composite
figure (full emissions, the multiplier, the magnitude panels, the equivalence annual rate) is
computed at a single **reference year = the most recent year where *all* required series have a
value** (i.e., `min` of the per-series `latestDataYear`). This avoids mixing different years inside
one composite number. The reference year is **always surfaced in the UI** ("data as of {X}"),
consistent with the honest-explorer stance. (Time-series charts still draw each series over its own
full range — and, when a future horizon is chosen, on into the dashed projection, §2.4a; only the
composite scalars use the common reference year, and they are computed on **measured data only**,
never on the projection.)

### 7.1b Country coverage consistency (decided)
A region (Amazon, Congo, SE Asia, "other tropical") is a **sum over its member countries** of two
indicators: the deforestation **stock** (`EN.GHG.CO2.LU.DF…`, which is patchy — some countries end
early or have holes) and forest **area** (`AG.LND.FRST.K2`, robust), where area drives the forgone
sink. To keep the story honest, a domain's **stock and forgone sink must cover the same countries**:
a country we cannot fully represent should not appear in *one* metric but not the other. So a single
**coverage decision** is made per domain and applied to **both** metrics — a country is **excluded
entirely** (from stock *and* forgone) if it has incomplete coverage on **either** indicator
(doesn't reach the shared last-real year with a value, or has an internal hole). Only leading
pre-data years are tolerated. Whole regions are **never** dropped from the global total (in practice
they all reach the same window); the exclusion operates only at the country level. Excluded countries
are recorded as coverage gaps the UI can surface.

### 7.2 Key indicators
- **Forest area (input for both forgone sink and stock):** `AG.LND.FRST.K2` (km²),
  `AG.LND.FRST.ZS` (% of land). **Coverage 1990–2023, annual, source FAOSTAT.** The
  year-over-year decrease of `AG.LND.FRST.K2` is the basis of both derived flows.
- **Deforestation/LULUCF emissions (stock):** `EN.GHG.CO2.LU.DF.MT.CE.AR5` (Deforestation),
  `EN.GHG.CO2.LU.MT.CE.AR5` (total LULUCF CO₂), `EN.GHG.CO2.LU.FL.MT.CE.AR5` (Forest Land).
  LULUCF series are net and can be **negative** (forest as a net sink). A divergent scale around
  zero is appropriate.
- **Fossil emissions (reference bar):** `EN.GHG.CO2.PC.CE.AR5` (CO₂/capita), `EN.GHG.ALL.MT.CE.AR5`
  (total GHG Mt), possibly `EN.GHG.CO2...` excluding LULUCF. The main emission series are
  "excluding LULUCF" — deforestation is deliberately not in them, which is why a separate LULUCF
  block exists.

**Data floor = 1990.** The forgone sink is computed from cumulative area loss; loss can only be
computed where we have area year by year, so we cannot start before 1990 (FAOSTAT has no
consistent annual series before 1990). The baseline is configurable only from 1990 upward.
Moving it up is a modeling decision with interpretive weight (with a 2010 baseline the 1990–2010
loss is not counted) — it must be explicitly labeled in the UI. Default 1990.

**Two methodologies under one brand.** The fossil `EN.GHG.*` emissions draw on EDGAR (JRC), which
does not cover LULUCF. The LULUCF series `EN.GHG.CO2.LU.*` have a different origin
(LULUCF-specific bookkeeping models). Admit in the UI as two emission blocks with two
methodologies and different uncertainty. The old `EN.ATM.CO2E.*` codes are frozen — use the new
`EN.GHG.*`.

### 7.3 How LULUCF emissions are computed (methodological note)
It is not a conversion from forest area. Bookkeeping models combine the area of change with the
carbon densities of vegetation/soil and with growth and decay curves (including the decay tail of
wood products — so the release of dead biomass is already accounted for here). Consequences:
(a) the same area loss gives different emissions depending on the ecosystem's carbon density —
emissions cannot be derived from area; (b) the models distinguish components by *process*
(Deforestation vs. Forest Land), not by territory; (c) the estimates have no independent benchmark
→ wider uncertainty intervals than fossil emissions. Practical consequence: area and LULUCF
emissions are independent measurements, so the optional correlation view (§2.7) is not a tautology.
**To verify in the spike:** whether `.DF` already includes belowground and soil stocks upon
release (probably yes) — if so, the stock layer need not be scaled by the allometric factor, which
belongs only to the forgone sink.

---

## 8. Statistical core (conceptual)

Pure, composable functions (series in → series out), a uniform point shape
`{ source, geo, year, value }`:
- `movingAvg(series, window=9)` — centered moving average.
- `detrend(series, window=9)` — deviation from the moving average.
- `diff(series)` — first differences (cross-check of detrend).
- `cumulative(series)` — cumulative sum (for the forgone sink over area losses). Conceptual
  inverse of `diff`.
- `projectSeries(series, horizonYear, lookback=9)` — **per-domain** linear extrapolation (recent
  mean + fitted slope, clamped ≥ 0) of the cleared-area series from the last measured year to the
  horizon (§2.4a). Feeds the projected stock and forgone sink by the same formulas as measured
  years; the derived future points carry a `projected` flag so the UI can render them dashed and
  exclude them from any scalar computed at the reference year.
- `pearson(xs, ys)`, `lagCorrelation(...)` — for the optional correlation view (§2.7); otherwise
  dormant.
- Derived series: `forgoneSink_domain = R_domain × cumulative(area losses of domain)`,
  `globalForgoneSink = Σ domains`, `fullEmissions = WB_emissions + forgoneSink`.
- Uncertainty aggregation: `σ_total = √Σ σ_domain²`.
- Magnitude computations for the panels: share of footprint, domain ranking, the year of the
  stock × forgone-sink crossing, equivalence conversions (annual rate + cumulative over a window).

Robustness (for the optional correlation view): take a signal seriously only if it survives both
`detrend` and `diff`. At n ~ 30–60, treat |r| < ~0.25 as noise; exploration, not proof.

---

## 9. Architecture summary (see the technical documents for detail)

- **Frontend:** Vue 3 on **Nuxt 3** (SSR universal) with Vite — one repository/language/deploy,
  Nitro server routes as a BFF.
- **BFF (Nitro `server/api/*`):** proxy + cache + normalization + computations.
  - Normalization: the flat WDI array → the uniform shape `{ source, geo, year, value, meta }`.
  - Cache: `cachedEventHandler`/`defineCachedFunction`; `country/all` responses are large, data
    changes ~yearly — maxAge hours to a day.
  - Server-side computations: domain aggregation, cumulative, forgone sink, full emissions,
    magnitude panels, equivalences, the forward projection. Derivations are **server-authoritative**
    (see the technical decisions document): changing the `R` scenario or the **time horizon**
    refetches the corresponding (cached) endpoint.
- **Adapter pattern** (`server/adapters/`): each source a separate module with a uniform output.
  Currently only WDI; possible extensions (§12) are one new file, key/token in the BFF.
- **Domain config:** mapping domain → { ISO3 codes, `R` mid, `R` CI (low/high), allometric factor,
  label }. Auditable, versionable.
- **Indicator registry** as a config object with the attributes `category` and
  "state/cumulative vs. flow/increment."
- **Series-agnostic chart components** (`components/charts/`): take normalized series via props,
  fetch nothing.
- **Indicative endpoints:** `/api/domain/{id}` (area, stock, forgone sink, full emissions, incl. the
  projection to the requested horizon), `/api/global` (sum across domains + aggregate band),
  `/api/ranking` (domain ranking today and at the chosen horizon), `/api/reference` (global fossil
  bar). Each takes the `R` scenario and the horizon as parameters.
- **Deploy:** Vercel (Nitro `vercel` preset).

---

## 10. Spike status (from the concept phase)

A file `spike.mjs` (Node ≥ 18, no dependencies):
- Adapter `fetchWDI(iso3, indicator)` → the uniform shape `{ source, geo, year, value }`.
- Statistical core (`movingAvg`, `detrend`, `diff`, `pearson`, `lagCorrelation`) + a deterministic
  self-test (mulberry32, seed 42).
- Self-test validated on synthetic data with a built-in signal: at levels r = +0.756 (common-trend
  trap, opposite sign to the true relationship); after detrend, method A (moving average) lag0
  r = −0.885, method B (differences) lag0 r = −0.890; differences knocked down the moving-average
  artifacts at lags 3–4.
- The sandbox has no network access to `api.worldbank.org`; the real run belongs in
  the implementation phase.

**Next step before building:** finish the spike live — verify the WDI response shape for
`AG.LND.FRST.K2` and `EN.GHG.CO2.LU.DF...` on member countries (Brazil/Indonesia); verify LULUCF
coverage/holes; verify which LULUCF component (`.DF` vs `.FL` vs `.LU`) corresponds to the "stock
emission from clearing," how the sign behaves, and whether `.DF` already includes belowground/soil
stocks (§7.3); prototype-compute `forgoneSink` and `fullEmissions` for one domain and a global sum
across 2–3 domains including the aggregate band.

---

## 11. Index of decided things

- Narrowed topic: the hidden carbon cost of deforestation; terminal metric = CO₂.
- Two components: stock (WB `.DF`) + forgone sink (derived `R × cumulative area loss`).
- Two modes: global aggregate / local domain; unit = domain (a set of ISO3), not country.
- **No "official ↔ full" switch** — the app always shows "full" (stock + forgone sink). The
  signature interaction is the **time-horizon selector** (§2.4a): upper-edge categories
  *today/+20/+30/+50/+75/+100 y*, driving a per-domain dashed forward projection.
- `R` hardcoded from literature (§6), band = published CI; belowground biomass folded into `R`
  (allometric factor **1.24**, locked), not a third mode; soil flux omitted.
- **Default `R` = mid value** (not conservative), because the model structurally underestimates
  (§5).
- Baseline 1990+ (FAOSTAT floor), explicit label.
- 4 magnitude panels; equivalence = annual rate, driven by the **global horizon** (headline = annual
  rate, future categories add `annualRate × horizonYears` committed); equivalences = cars + reference
  country. Share-of-footprint donut is **always on** (3 slices) in global scope (no fossil toggle).
  The ranking (panel 2) is a **today → horizon bump**; the crossing (panel 3) shows its point once
  the horizon is pushed into the projection.
- Composite scalars use a single **reference year** = min common `latestDataYear`, on measured data
  only, always shown (§7.1a). The projection (§2.4a) extends only the time-series charts, the
  crossing, and the ranking's at-horizon column.
- Opening preset = **global · mid · 1990 · horizon today** (forgone sink + multiplier shown from the
  start; pushing the horizon out reveals the projection and the crossing).
- The mode matrix (§4.5) determines what is shown where.
- Nuxt (SSR universal) + Nitro BFF; World Bank the only source; adapter pattern for future sources.
- Domain set locked to 4 (§3.1); correlation view deferred from V1.
- Full stack decided: Vite, Pinia, Axios, ECharts via `nuxt-echarts`, PrimeVue (dark), i18n
  SK/EN via `@nuxtjs/i18n`, deploy Vercel, testing Vitest + Vue Test Utils. Details in
  `01-technical-decisions.md`.

---

## 12. Open / undecided (do not extrapolate without agreement)

- **Exact ISO3 membership** per domain (§3.1) — **RESOLVED (V1, `revisable`).** Named domains
  (Amazon/Congo/SE Asia) taken from §3.1; "other tropical" derived from WB forest-area data
  (`AG.LND.FRST.K2`, 2023): tropical belt ∩ not-in-named-domains ∩ forest cover ≥ 5% (drops arid
  Sahel scrub NER/MRT/TCD) → 52 ISO codes. Membership lives in the domain config.
- **`R` config values:** **provisionally locked** for all four domains (§6 total-R table, flagged
  `revisable`), including the Amazon (asymmetric, floor at 0) and "other tropical" (envelope CI).
  These stay open only in the sense that better literature can revise them; they are not blockers.
- **Concrete equivalences:** **RESOLVED (V1, `revisable`, §4.4).** Car factor = 4.6 t CO₂/yr (EPA);
  reference country is **locale-driven** (`sk` → Slovakia, else → UK). Form decided; the panel is now
  driven by the global time horizon (§4.4) rather than its own preset row.
- **Time horizon + forward projection (§2.4a) — RESOLVED (V1, `revisable`).** Replaces the removed
  "official ↔ full" accounting axis. Upper-edge categories *today/+20/+30/+50/+75/+100 y* from the
  calendar year; per-domain linear-trend projection (last ~9–10 measured years, clamped ≥ 0);
  projected data rendered dashed with a join-year divider. Documented **defaults, flagged
  revisable:** (a) the multiplier stays a scalar at the reference year — not horizon-reactive in V1;
  (b) the ranking bump ranks each domain's full impact **accumulated over the window to each
  column's year** (annual-at-horizon is the alternative); (c) the uncertainty band is carried
  forward by the same `R` interval, **not** additionally widened with projection distance; (d) the
  visual separation of "measured-but-estimated" (forgone, already dashed) from "projected" data is a
  join-year divider + a lighter dashed projection — exact styling lives in the design doc.
- **Exact shape** of the stacked area and aggregate band (global), the domain stacked chart
  (local), the bump chart (panel 2), the crossing (panel 3) — to be detailed in the dedicated UI
  round.
- **Whether to include the optional correlation view** at all before a future version (deferred
  from V1, kept dormant).
- **Local "side by side" stock-vs-forgone variant** of the domain chart — **deferred** from V1
  (the local canvas ships stacked-only); may return in a later version.

### Extensions beyond V1 (noted, not approved)

- **Global Forest Watch / WRI Data API — the main reason is substantive, not cosmetic:** as the
  only source it separates gross emissions from gross removals (gross removals ≈ X = absorption,
  gross emissions ≈ Y = decay), i.e., breaks the net `.DF` into the components World Bank does not
  provide. This would enable a chart that tracks the fate of X and Y separately — conceptually the
  most accurate version of the app. Further value: 30 m pixel granularity + subnational units
  (GADM ADM1/ADM2) → true domain boundaries instead of a sum of whole countries; drivers of loss →
  a causes layer; near-real-time alerts (GLAD, RADD). Time coverage 2001–2025 (Hansen from 2001) —
  newer than WB (1990), not older. Cost: account + API key/token (in the BFF), SQL queries +
  GeoJSON geometries, the API is beta. Fits the adapter pattern.
- **Positive flow after forest conversion** (methane from cattle `EN.GHG.CH4...`, N₂O from
  fertilizers, peat oxidation) — a third impact component that V1 lacks; a further reason why our
  estimate is a lower bound.
- **Time-varying `R`** (instead of a constant) — accounting for the declining sink (Amazon toward
  zero ~2035).
