import type { SlideDef } from '../../shared/types'

// The authored story deck (tech-spec §17.1, business §4.7, ADR-027). Seven slides across five scenes.
// A slide is a grid template + the widgets placed on it (copy is i18n keys only). Sibling slides in a
// scene share widget `id`s so the reveal (2→3) and the fossil-removal (5→6) animate in place. `params`
// seeds a scene's authored defaults on first entry; `forced` overrides are immutable (crossing/
// footprint/baseline are global-only). Widget `area` names come from the slide's `GridTemplate`.

export const SLIDES: readonly SlideDef[] = [
  // 1 — intro: pure text framing, no visualisation.
  {
    slug: 'intro',
    scene: 'intro',
    grid: 'text',
    widgets: [
      { id: 'heading', type: 'heading', area: 'heading', headingKey: 'story.intro.heading' },
      { id: 'text', type: 'text', area: 'text', textKeys: ['story.intro.p1', 'story.intro.p2'] },
    ],
  },

  // 2 — main: the reported number. Stock only (WB .DF, solid). Controls live.
  {
    slug: 'main',
    scene: 'main',
    grid: 'viz-text',
    widgets: [
      { id: 'controls', type: 'controls', area: 'controls', keys: ['horizon', 'domain', 'baseline'] },
      { id: 'main', type: 'viz', area: 'viz-a', kind: 'mainStacked', metrics: ['stock'] },
      { id: 'heading', type: 'heading', area: 'heading', headingKey: 'story.main.heading' },
      { id: 'text', type: 'text', area: 'text', textKeys: ['story.main.p1'] },
    ],
    params: { scope: 'global', domainId: 'amazon', horizon: 'today', rScenario: 'mid' },
    baseline: 1990,
  },

  // 3 — main-sink: the hidden cost. Same `main` viz instance; forgone sink animates in on top. The ×N
  // multiplier badge appears (authored only here — the main scene, forgone revealed).
  {
    slug: 'main-sink',
    scene: 'main',
    grid: 'viz-text',
    widgets: [
      { id: 'controls', type: 'controls', area: 'controls', keys: ['horizon', 'domain', 'baseline'] },
      { id: 'multiplier', type: 'multiplier', area: 'badge' },
      { id: 'main', type: 'viz', area: 'viz-a', kind: 'mainStacked', metrics: ['stock', 'forgoneSink'] },
      { id: 'heading', type: 'heading', area: 'heading', headingKey: 'story.mainSink.heading' },
      { id: 'text', type: 'text', area: 'text', textKeys: ['story.mainSink.p1'] },
    ],
  },

  // 4 — crossing: fresh mount. Annual stock impulse vs. rising cumulative forgone sink; forced global.
  // A future horizon is forced so the projection spans far enough for the two to cross on screen.
  {
    slug: 'crossing',
    scene: 'crossing',
    grid: 'viz-text',
    widgets: [
      { id: 'controls', type: 'controls', area: 'controls', keys: ['baseline'] },
      { id: 'crossing', type: 'viz', area: 'viz-a', kind: 'crossing', metrics: ['stock', 'forgoneSink'] },
      { id: 'heading', type: 'heading', area: 'heading', headingKey: 'story.crossing.heading' },
      { id: 'text', type: 'text', area: 'text', textKeys: ['story.crossing.p1'] },
    ],
    forced: { scope: 'global', horizon: '100y' },
    baseline: 1990,
  },

  // 5 — footprint: donut (3 slices) + deforestation-vs-fossil bar (both categories). Global scope.
  // baseline + horizon are live and carry over to slide 6 (footprint scene, ADR-025).
  {
    slug: 'footprint',
    scene: 'footprint',
    grid: 'duo-viz-text',
    widgets: [
      { id: 'controls', type: 'controls', area: 'controls', keys: ['baseline', 'horizon'] },
      { id: 'donut', type: 'viz', area: 'viz-a', kind: 'donut', metrics: ['fossil', 'stock', 'forgoneSink'] },
      { id: 'fossil', type: 'viz', area: 'viz-b', kind: 'fossilComparison', metrics: ['fossil', 'stock', 'forgoneSink'] },
      { id: 'heading', type: 'heading', area: 'heading', headingKey: 'story.footprint.heading' },
      { id: 'text', type: 'text', area: 'text', textKeys: ['story.footprint.p1'] },
    ],
    forced: { scope: 'global' },
  },

  // 6 — deforestation-insight: same donut/fossil instances; fossil removed from both → the deforestation
  // zoom. Caption on top, the shared baseline/horizon controls, the two (same) vizzes, and a full-width
  // equivalence strip at the foot — no text block (ADR-025).
  {
    slug: 'deforestation-insight',
    scene: 'footprint',
    grid: 'duo-viz-equiv',
    widgets: [
      { id: 'caption', type: 'caption', area: 'caption', captionKey: 'story.insight.caption' },
      { id: 'controls', type: 'controls', area: 'controls', keys: ['baseline', 'horizon'] },
      { id: 'donut', type: 'viz', area: 'viz-a', kind: 'donut', metrics: ['stock', 'forgoneSink'] },
      { id: 'fossil', type: 'viz', area: 'viz-b', kind: 'fossilComparison', metrics: ['stock', 'forgoneSink'] },
      { id: 'equivalence', type: 'equivalence', area: 'equiv', orientation: 'horizontal' },
    ],
    forced: { scope: 'global' },
  },

  // 7 — baseline lab: the interactive back-projection (ADR-026). Caption on top, the baseline SLIDER
  // (1800→present) + the live horizon picker, then TWO charts stacked in the main column (the main
  // stock+forgone chart above the crossing chart), and a full-height equivalence strip aside (vertical,
  // quarter-width). Fixed global. Moving the slider re-derives the forgone sink, both charts and the
  // strip client-side in real time (no refetch). Horizon is seeded to a future value so the projection
  // and the crossing are meaningful on first entry.
  {
    slug: 'baseline',
    scene: 'baseline',
    grid: 'lab',
    widgets: [
      { id: 'caption', type: 'caption', area: 'caption', captionKey: 'story.baselineLab.caption' },
      { id: 'controls', type: 'controls', area: 'controls', keys: ['baselineSlider', 'horizon'] },
      { id: 'baseline-main', type: 'viz', area: 'viz-a', kind: 'mainStacked', metrics: ['stock', 'forgoneSink'] },
      { id: 'baseline-crossing', type: 'viz', area: 'viz-b', kind: 'crossing', metrics: ['stock', 'forgoneSink'] },
      { id: 'equivalence', type: 'equivalence', area: 'equiv', orientation: 'vertical' },
    ],
    forced: { scope: 'global' },
    params: { horizon: '100y' },
    baseline: 1990,
  },
]

/** Ordered slugs (deck navigation order). */
export const SLUGS: readonly string[] = SLIDES.map((s) => s.slug)

/** The deck's entry slug. */
export const FIRST_SLUG = SLUGS[0] as string

/** Look up a slide by slug (undefined for an unknown slug). */
export const getSlide = (slug: string): SlideDef | undefined => SLIDES.find((s) => s.slug === slug)

/** Zero-based position of a slug in the deck (−1 if unknown). */
export const slideIndex = (slug: string): number => SLUGS.indexOf(slug)

/** The slug that follows / precedes a given one, or null at the deck ends. */
export const nextSlug = (slug: string): string | null => {
  const i = slideIndex(slug)
  return i >= 0 && i < SLUGS.length - 1 ? (SLUGS[i + 1] as string) : null
}
export const prevSlug = (slug: string): string | null => {
  const i = slideIndex(slug)
  return i > 0 ? (SLUGS[i - 1] as string) : null
}
