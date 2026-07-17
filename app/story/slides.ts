import type { SlideDef } from '../../shared/types'

// The authored story deck (tech-spec §17.1, business §4.7). Six slides across four scenes. Copy is
// i18n keys only. Sibling slides in a scene share `viz.id`s so the reveal (2→3) and the zoom (5→6)
// animate in place. `params` seeds a scene's authored defaults on first entry; `forced` overrides are
// immutable (crossing/footprint are global-only). The equivalence data is restaged as the slide-6
// `EquivalenceStrip` (ADR-025).

export const SLIDES: readonly SlideDef[] = [
  // 1 — intro: pure text framing, no visualisation.
  {
    slug: 'intro',
    scene: 'intro',
    layout: 'text',
    headingKey: 'story.intro.heading',
    textKeys: ['story.intro.p1', 'story.intro.p2'],
    visualizations: [],
  },

  // 2 — main: the reported number. Stock only (WB .DF, solid). Controls live.
  {
    slug: 'main',
    scene: 'main',
    layout: 'viz-text',
    headingKey: 'story.main.heading',
    textKeys: ['story.main.p1'],
    visualizations: [{ id: 'main', kind: 'mainStacked', metrics: ['stock'] }],
    controls: ['horizon', 'domain', 'baseline'],
    params: { scope: 'global', domainId: 'amazon', horizon: 'today', rScenario: 'mid', baseline: 1990 },
  },

  // 3 — main-sink: the hidden cost. Same chart instance; forgone sink animates in on top.
  {
    slug: 'main-sink',
    scene: 'main',
    layout: 'viz-text',
    headingKey: 'story.mainSink.heading',
    textKeys: ['story.mainSink.p1'],
    visualizations: [{ id: 'main', kind: 'mainStacked', metrics: ['stock', 'forgoneSink'] }],
    controls: ['horizon', 'domain', 'baseline'],
  },

  // 4 — crossing: fresh mount. Annual stock impulse vs. rising cumulative forgone sink; forced global.
  // A future horizon is forced so the projection spans far enough for the two to cross on screen.
  {
    slug: 'crossing',
    scene: 'crossing',
    layout: 'viz-text',
    headingKey: 'story.crossing.heading',
    textKeys: ['story.crossing.p1'],
    visualizations: [{ id: 'crossing', kind: 'crossing', metrics: ['stock', 'forgoneSink'] }],
    controls: ['timeRange', 'baseline'],
    forced: { scope: 'global', horizon: '100y' },
    params: { baseline: 1990 },
  },

  // 5 — footprint: donut (3 slices) + deforestation-vs-fossil bar (both categories). Global scope.
  // baseline + horizon are live and carry over to slide 6 (footprint scene, ADR-025).
  {
    slug: 'footprint',
    scene: 'footprint',
    layout: 'duo-viz-text',
    headingKey: 'story.footprint.heading',
    textKeys: ['story.footprint.p1'],
    visualizations: [
      { id: 'donut', kind: 'donut', metrics: ['fossil', 'stock', 'forgoneSink'] },
      { id: 'fossil', kind: 'fossilComparison', metrics: ['fossil', 'stock', 'forgoneSink'] },
    ],
    controls: ['baseline', 'horizon'],
    forced: { scope: 'global' },
  },

  // 6 — deforestation-insight: same instances; fossil removed from both → the deforestation zoom.
  // `duo-viz-equiv` preset: a thin caption on top, the shared baseline/horizon controls, the two
  // (same) vizzes, and a full-width equivalence strip at the foot — no text block (ADR-025).
  {
    slug: 'deforestation-insight',
    scene: 'footprint',
    layout: 'duo-viz-equiv',
    captionKey: 'story.insight.caption',
    textKeys: [],
    visualizations: [
      { id: 'donut', kind: 'donut', metrics: ['stock', 'forgoneSink'] },
      { id: 'fossil', kind: 'fossilComparison', metrics: ['stock', 'forgoneSink'] },
    ],
    controls: ['baseline', 'horizon'],
    forced: { scope: 'global' },
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
