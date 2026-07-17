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

### 1.1 Presentation format: a guided story, not a dashboard

**V1 presents the argument as a linear "story deck," not as a free-form composer dashboard.** The
product is titled **"Story of Deforestation" / "Príbeh deforestácie."** Earlier drafts (and the code
built so far) framed the UI as a *composer*: one page with a control bar, a main canvas and a grid of
magnitude panels the user reconfigures at will. That framing is **replaced** by a **sequential deck of
six slides** the reader advances through — each slide reveals one step of the argument, and a few
slides carry the same interactive controls as before (time horizon, domain, baseline, time-range
zoom), now scoped to the slide they belong to.

Why a deck. The audience is recruiters/engineers skimming a portfolio piece; a guided narrative lands
the *stock vs. forgone-sink* point far more reliably than an open dashboard that assumes the visitor
already understands the thesis. The deck keeps every scientific derivation from the earlier design
(the server contract is **unchanged**, §9); it only changes how the results are **staged and revealed**.
The deck's own choreography — advancing between slides, and the two in-place chart animations (§4.3,
§4.6) — is the new signature interaction, in place of the free-standing composer.

**Nothing in the scientific model changes.** The two components (§2), the counterfactual method
(§2.2), the projection (§2.4a), `R` (§6), the coverage rules (§7.1b) and every formula are exactly as
before. §4 (the screen structure) is the section this reframe rewrites; §2–3 and §5–8 stand.

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

The choice of time horizon is not a footnote — it is the **primary derivation control** of the deck's
`main` scene (§4.3), and it replaced the earlier "official ↔ full" accounting toggle, now removed (see
§2.6). (The deck's top-level interaction is advancing between slides, §1.1/§4; within the main scene
the horizon is the control that does the heavy lifting.) The reader sets **both edges of the time
window**: the lower edge (baseline, §7.2) and an **upper edge chosen from fixed horizon categories** — *today* · *+20 y* · *+30 y* · *+50 y* · *+75 y* · *+100 y*, counted
from the current calendar year. "Today" means no projection (the window ends at the last year of
measured data); every other category extends the window into the future by that many years.

**Why the app must project.** Measured series end ~2022 (§7.1). The crossing panel (§4.3, panel 3)
cannot show its point — the moment the accumulating forgone sink overtakes the one-off stock
release — inside such a short measured window; the multiplier is likewise more
telling over a longer horizon. So beyond the last measured year the app draws a **forward
projection** ("committed future"): visualisations need *some* future values to make the point, and
these are clearly-labelled, visually-distinct estimates, never presented as measured data.

**How the projection is built (method, binding).**
- **Per domain, not on the aggregate.** Each domain's cleared-area series is extrapolated on its
  own, because each domain has its own `R` (§6) and its own trajectory; the projected domains are
  then summed with the same aggregation as measured data (§3). A single trend fitted to the
  pre-aggregated series would freeze today's domain mix and is therefore wrong for the forgone sink.
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
(§7.1a). The horizon extends the *time-series* charts and the crossing point.

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
reveal it produced (the hidden forgone sink appearing) is now carried by the deck's **slide 2→3
in-place animation** (§4.3): slide 2 shows the reported stock alone, slide 3 animates the forgone sink
in on top. The WB "official" number does not disappear as a *quantity* — it remains the measured stock
layer and the denominator of the multiplier (§2.5) — only as a separate *mode*.

What the horizon changes and does not change:
- **Magnitude-based** things move strongly with the horizon: the crossing year and the shape of the
  projected series grow/shift as the window lengthens (as do the slide-6 equivalence-strip figures,
  §4.5a). The horizon lives in the `main` scene (§4.3) and its projection feeds the
  crossing scene (§4.4) — magnitude-based by design.
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
control. It changes magnitudes (crossing, multiplier, equivalence), never the identity of
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

## 4. The story deck (screen structure)

The app is a **linear deck of six slides** the reader advances through (Next / Back, keyboard, or
scroll). It is **not** a composer dashboard. The deck opens on the same functional preset as before —
**global scope, `R` = mid, baseline 1990, horizon = today** — but the reader meets the argument one
step at a time rather than reconfiguring an open canvas.

**Scenes.** The six slides are grouped into **four scenes**. A scene is a run of consecutive slides
that share the *same on-screen visualisation(s)*: sibling slides in a scene keep the chart mounted and
only change its configuration, so the transition between them is an **in-place ECharts animation**
(`setOption`), never a reload or re-layout. Crossing a scene boundary mounts fresh visualisations.

| Scene | Slides | Shared visualisation(s) |
|---|---|---|
| `intro` | 1 | — (text only) |
| `main` | 2, 3 | the main stacked time-series chart |
| `crossing` | 4 | the stock-vs-forgone crossing chart |
| `footprint` | 5, 6 | the composition donut + the deforestation-vs-fossil bar |

The two **in-place animations** — slide 2→3 (forgone sink appears on the main chart) and slide 5→6
(fossil drops out of the donut and the bar) — are the deck's signature moments, replacing the old
composer's free-standing horizon hero. Everything the earlier design computed is still computed; the
deck only stages it.

### 4.1 Slide vs. scene: what is fixed and what the reader controls

- **Per-slide, authored (immutable at runtime):** the slide's layout, its heading + body copy, and
  *which metrics each visualisation shows* (e.g. slide 2 shows stock only; slide 3 shows stock +
  forgone sink). The reader cannot change these — they are the narrative.
- **Per-scene, interactive (mutable by the reader):** the derivation controls a scene exposes. These
  are shared by all slides in the scene and **persist while the reader moves within it** (and, per the
  reset policy below, are restored when they return to it):
  - **Time horizon** — *today · +20 · +30 · +50 · +75 · +100 y* (§2.4a). Exposed by the **main**
    scene. Pushing it out extends the dashed forward projection.
  - **Domain** — one of the ~4 rainforest domains. Exposed by the **main** scene; it switches the main
    chart from the global aggregate to a single domain. (In the deck, the global aggregate is the
    default the reader can *narrow*; see §4.6 on scope.)
  - **Baseline** — reference year, ≥ 1990 (§7.2); label always explicit ("forgone sink computed from
    forest loss after {X}"). Exposed by the **main** and **crossing** scenes.
  - **Time-range zoom** — a client-side brush on the timeline (ECharts `dataZoom`, no recompute).
    Exposed by the **crossing** scene, where narrowing/widening the visible span helps the reader see
    the crossing.
  - **`R` scenario** (conservative / mid / high, default mid, §6) remains a valid derivation axis but
    is **not surfaced as a deck control in V1** — every slide uses `mid`. It stays in the params so a
    later slide could expose it.
- **Reset policy (A).** Returning to a scene already visited **restores its remembered control state**
  (faithful Back/Forward, held in session + the URL query); entering a scene for the **first time**
  initialises it from the authored (global) defaults, independent of tweaks made in another scene.

Terminology: **"time horizon"** = the projection selector (server-side, refetches); **"time range"** =
the client-only zoom (`dataZoom`, no refetch). They are different controls.

### 4.2 Slide 1 — Intro (scene `intro`)

A pure **text** slide: a short heading + a few lines framing what the piece is about (the visible
stock vs. the hidden forgone sink, the "at least this much" stance). No visualisation, no controls.

### 4.3 Slides 2–3 — The main chart (scene `main`)

The core of the argument, delivered as a **reveal** across two sibling slides that share one chart.

- **Slide 2 — the reported picture.** The main stacked time-series chart showing **stock only** (WB
  `.DF`, the officially reported number, solid). Below the chart, full-width, one text block explains
  what the chart is: measured deforestation emissions over time. The scene's controls are present —
  **horizon, domain, baseline** — so the reader can already explore the reported series.
- **Slide 3 — the hidden cost.** The **same chart, not remounted** — only its configuration updates:
  the **forgone sink** layer (derived `R × cumulative loss`, dashed + uncertainty band) animates in on
  top of the stock, producing today's full picture (stock + forgone sink). The controls are unchanged
  and hold their state across the 2→3 transition. The text block below updates to describe what just
  happened — that the reported number was only the visible part.

If the horizon is pushed past *today*, both slides extend the series with the dashed forward
projection (§2.4a); the domain control narrows the aggregate to one domain; the baseline moves the
integration origin. The `×N` **multiplier** (`fullEmissions ÷ WB stock` at the reference year, §2.5)
is shown alongside the main chart from slide 3 on (once the forgone sink is present).

**Framing note (important for copy):** the stock layer carries the anti-deforestation argument even
when a domain's forgone sink is small (e.g. a saturated Amazon). Even if the net sink were near zero,
clearing dumps an enormous stored reserve. The chart must never invite "small forgone sink = clearing
is okay."

### 4.4 Slide 4 — The crossing (scene `crossing`)

A single **crossing chart** (its own scene, mounted fresh): the annual one-off **stock** release
(impulse, ~flat) vs. the **forgone sink** as a cumulative-driven level (`R × cumulative area loss`,
rising, §2.3); in year **N** the rising forgone sink overtakes the stock. That point sits *beyond* the
measured window, so it is only visible once the series runs far enough into the projection — hence the
scene exposes the **time-range** zoom (to frame the crossing) and the **baseline** control. The
**domain control disappears and the data is forced to the global aggregate** — a single crossing for
the whole tropical belt is the honest, legible framing (a per-domain crossing race is out of scope for
V1). Below the chart, one full-width text block describes what the crossing means.

### 4.5 Slides 5–6 — The footprint (scene `footprint`)

Two sibling slides sharing **two** visualisations, side by side. Both slides expose the **`baseline` +
`horizon`** controls (shared per-scene — the reader's setting carries from slide 5 to slide 6 and drives
both charts and slide 6's equivalence strip). Slide 5 keeps the full-width text block below; slide 6
replaces it with a thin caption on top and adds a full-width equivalence strip at the foot (§4.5a).

- **Slide 5 — deforestation in context.** Left: the **composition donut** of the total carbon
  footprint with **three slices** — fossil, the one-off deforestation stock, and the forgone sink.
  Right: the **deforestation-vs-fossil bar** — total deforestation emissions (stock + forgone sink)
  next to global fossil emissions, so the reader sees how the (still smaller) deforestation total sits
  against fossil. Both evaluated at the reference year on measured data (§7.1a). Global scope.
- **Slide 6 — zoom into deforestation (`deforestation-insight`).** The **same** two visualisations,
  **not remounted** — only animated: **fossil is removed from both** the donut and the bar. With the
  fossil slice/bar gone, the axis rescales and the remaining deforestation composition "zooms in": the
  donut becomes stock vs. forgone sink (two slices); the bar drops fossil and now shows deforestation
  broken into its parts. **Bar restructure (binding for the deck):** the deforestation bar's metric
  currently *includes* the forgone sink inside one "full emissions" total; for the 5→6 animation the
  forgone sink is pulled out and shown as its **own component** (a separate bar or a stack layer over
  the stock) in place of fossil — so the reader ends on the same green/amber grammar as the main chart.
  To make this a single smooth `setOption` (not a reload), the deforestation-vs-fossil chart is drawn
  as **one grid with two categories** (deforestation, fossil) sharing one Y-axis, rather than the two
  separate side-by-side grids of the old dashboard.

### 4.5a Slide 6 — caption + equivalence strip (the closing insight)

Slide 6 uses a distinct layout (`duo-viz-equiv`): instead of a body-text block it opens with a single
**caption line** and closes with a full-width **equivalence strip**.

- **Caption (authored copy).** One line, no heading:
  - SK: *"Pri pohľade na absolútne čísla a po odmyslení fosílnych emisií sa deforestácia prestáva javiť
    tak bezvýznamnou…"*
  - EN: *"Looking at the absolute numbers, and with fossil emissions set aside, deforestation stops
    looking so insignificant…"*
  (Final strings live as i18n keys; this records the intent + both locales.)
- **Equivalence strip — four figures.** A redesign of the old equivalence panel (previously deferred,
  §4.6), now the emotional payload of the closing slide. It restates the deforestation footprint over
  the reader's chosen window (`baseline` → `horizon`) as **four colour-coded numbers**,
  matched to the chart grammar above:
  1. **Stock over the window** — green (stock colour);
  2. **Forgone sink, per year** at the last measured year — amber (forgone-sink colour);
  3. **Forgone sink over the window** (the true finite integral `Σ` of the annual rate over the window,
     §2.4 quantity #2) — amber;
  4. **Combined total** = stock + forgone sink over the window — a red-adjacent colour (severity of the
     whole figure; not a fault state).
- **Unit switcher.** All four numbers can be read in one of three units: **Mt CO₂**, **one passenger
  car's annual emissions**, or **one country's annual emissions** (Slovakia in SK, the UK in EN — as the
  dormant panel already resolved, §4.4). **Default: cars** — the most tangible framing. Purely a view
  toggle; changing it (or the language) never refetches the deforestation data.

The strip's numbers are derived from data the slide already holds (the global aggregate over the
window) plus the car/country factors — no new server call beyond the two controls (technical spec §17.4).

### 4.6 What the V1 deck does not stage (and scope)

- **The equivalence panel is no longer deferred** — it is **restaged and redesigned as the slide-6
  equivalence strip** (§4.5a). Its resolved config carries over unchanged: car factor
  `carAnnualTonsCO2 = 4.6` t CO₂/yr (US EPA "typical passenger vehicle," EPA-420-F-18-008); reference
  country **locale-driven** (`sk` → Slovakia `SVK`, else → United Kingdom `GBR`), both from
  `EN.GHG.CO2.MT.CE.AR5`. The old single headline (annual rate; future horizon adding
  `annualRate × horizonYears`) is superseded by the strip's **four figures + unit switcher** (§4.5a);
  the "never an infinite total" rule (§2.4) still holds — every figure is bounded by the chosen window.
- **Scope.** The deck is **global-first.** Local single-domain viewing survives only as the **domain
  control inside the main scene** (§4.1) — the reader narrows the global aggregate to one domain there.
  The crossing and footprint scenes are global-only (a single-domain crossing/footprint is weak, as
  the old fossil-comparison rule already noted). There is no standalone global/local scope toggle.
- **`R` scenario** is likewise present in the model but not surfaced as a deck control in V1 (§4.1).

### 4.7 Slide / scene matrix

| # | Slide | Scene | Visualisation(s) | Metrics shown | Controls | Transition in |
|---|---|---|---|---|---|---|
| 1 | Intro | `intro` | — | — | — | (entry) |
| 2 | Main — reported | `main` | main stacked chart | stock | horizon, domain, baseline | scene mount |
| 3 | Main — hidden cost | `main` | *same* main chart | stock + forgone sink | horizon, domain, baseline | in-place animation |
| 4 | Crossing | `crossing` | crossing chart | stock impulse + forgone level | time-range, baseline (global forced) | scene mount |
| 5 | Footprint | `footprint` | donut + defo-vs-fossil bar | fossil + stock + forgone sink | baseline, horizon | scene mount |
| 6 | Deforestation zoom | `footprint` | *same* donut + bar **+ equivalence strip** | stock + forgone sink (fossil removed) | baseline, horizon, unit | in-place animation |

"In-place animation" = the visualisation instance is preserved and only its `setOption` changes
(slides 2→3 and 5→6). "Scene mount" = fresh visualisation(s) for a new scene.

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
- Magnitude computations for the panels: share of footprint, the year of the
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
  `/api/reference` (global fossil bar). Each takes the `R` scenario and the horizon as parameters.
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
- **Presentation = a linear six-slide story deck** ("Story of Deforestation"), not a composer
  dashboard (§1.1, §4). Six slides across four scenes (`intro` · `main` · `crossing` · `footprint`);
  sibling slides in a scene animate the shared chart in place (2→3 forgone sink appears, 5→6 fossil
  drops out). The scientific model and server contract are unchanged.
- Unit = domain (a set of ISO3), not country; the deck is **global-first**, with a domain control
  inside the main scene to narrow the aggregate (no standalone scope toggle, §4.6).
- **No "official ↔ full" switch** — the app always shows "full" (stock + forgone sink). The
  **time-horizon selector** (§2.4a: *today/+20/+30/+50/+75/+100 y*, per-domain dashed forward
  projection) is now a **scene control** (in the `main` scene), not the whole-page hero.
- `R` hardcoded from literature (§6), band = published CI; belowground biomass folded into `R`
  (allometric factor **1.24**, locked), not a third mode; soil flux omitted.
- **Default `R` = mid value** (not conservative), because the model structurally underestimates
  (§5).
- Baseline 1990+ (FAOSTAT floor), explicit label.
- The deck stages three visual scenes: **main** (stock → stock + forgone sink, §4.3), **crossing**
  (stock impulse vs. forgone level, forced global, §4.4), and **footprint** (3-slice donut + defo-vs-
  fossil bar → fossil removed, §4.5). The share-of-footprint donut has **3 slices** (fossil + stock +
  forgone sink); the defo-vs-fossil chart is **one grid, two categories** (for the 5→6 animation).
  **Footprint slides 5–6 share `baseline` + `horizon`; slide 6 adds a caption + a redesigned
  equivalence strip** (four colour-coded figures + unit switcher, §4.5a).
- **The equivalence panel is no longer deferred** — restaged as the slide-6 strip (§4.5a), reusing its
  resolved config (car factor 4.6, locale-driven reference country).
- Composite scalars use a single **reference year** = min common `latestDataYear`, on measured data
  only, always shown (§7.1a). The projection (§2.4a) extends only the time-series/crossing charts.
- Opening preset = **global · mid · 1990 · horizon today**; the deck opens on slide 1 (intro).
- The slide/scene matrix (§4.7) determines what each slide shows and controls.
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
- **Concrete equivalences:** **RESOLVED (V1, `revisable`, §4.5a).** Car factor = 4.6 t CO₂/yr (EPA);
  reference country is **locale-driven** (`sk` → Slovakia, else → UK). The equivalence panel is **now
  staged on slide 6** as a redesigned strip: **four** window-bounded figures (stock/window,
  sink/yr, sink/window, combined total) with a **Mt CO₂ · car · country** unit switcher (default car),
  superseding the old single annual-rate headline (§4.5a).
- **Time horizon + forward projection (§2.4a) — RESOLVED (V1, `revisable`).** Replaces the removed
  "official ↔ full" accounting axis. Upper-edge categories *today/+20/+30/+50/+75/+100 y* from the
  calendar year; per-domain linear-trend projection (last ~9–10 measured years, clamped ≥ 0);
  projected data rendered dashed with a join-year divider. Documented **defaults, flagged
  revisable:** (a) the multiplier stays a scalar at the reference year — not horizon-reactive in V1;
  (b) the uncertainty band is carried
  forward by the same `R` interval, **not** additionally widened with projection distance; (c) the
  visual separation of "measured-but-estimated" (forgone, already dashed) from "projected" data is a
  join-year divider + a lighter dashed projection — exact styling lives in the design doc.
- **Exact shape** of the stacked area and aggregate band (global), the domain stacked chart, the
  crossing chart, and the donut + defo-vs-fossil bar — the visual/layout detail lives in the UI and
  design docs (02, 04).
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
