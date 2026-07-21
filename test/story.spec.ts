import { describe, it, expect } from 'vitest'
import type {
  ControlKey,
  DerivationParams,
  GridTemplateId,
  SceneId,
  VizKind,
  WidgetDef,
  WidgetType,
} from '../shared/types'
import {
  SLIDES,
  SLUGS,
  FIRST_SLUG,
  getSlide,
  slideIndex,
  nextSlug,
  prevSlug,
} from '../app/story/slides'
import { renderSlide, type RenderableWidget } from '../app/story/SlideFactory'

// --- fixtures --------------------------------------------------------------

const GRIDS: ReadonlySet<GridTemplateId> = new Set([
  'text',
  'viz-text',
  'text-viz',
  'duo-viz-text',
  'duo-viz-equiv',
  'lab',
])
const SCENES: ReadonlySet<SceneId> = new Set([
  'intro',
  'main',
  'crossing',
  'footprint',
  'baseline',
  'method',
  'amplified',
])
const WIDGET_TYPES: ReadonlySet<WidgetType> = new Set([
  'text',
  'controls',
  'viz',
  'multiplier',
  'equivalence',
])
const VIZ_KINDS: ReadonlySet<VizKind> = new Set([
  'mainStacked',
  'globalStackedArea',
  'crossing',
  'donut',
  'fossilComparison',
  'fluxBar',
])
const CONTROL_KEYS: ReadonlySet<ControlKey> = new Set([
  'horizon',
  'baseline',
  'baselineSlider',
  'rMultiplier',
])
const METRICS: ReadonlySet<string> = new Set(['stock', 'forgoneSink', 'fossil'])

const params: DerivationParams = { horizon: 'today', rScenario: 'mid' }

// --- widget helpers --------------------------------------------------------

const widgets = (slug: string): readonly WidgetDef[] => getSlide(slug)!.widgets
const widgetsOfType = <T extends WidgetType>(slug: string, type: T) =>
  widgets(slug).filter((w) => w.type === type)
const vizWidgets = (slug: string) =>
  widgets(slug).filter((w): w is Extract<WidgetDef, { type: 'viz' }> => w.type === 'viz')
const textWidgets = (slug: string) =>
  widgets(slug).filter((w): w is Extract<WidgetDef, { type: 'text' }> => w.type === 'text')
const controlsWidget = (slug: string) =>
  widgets(slug).find((w): w is Extract<WidgetDef, { type: 'controls' }> => w.type === 'controls')

const rendered = (slug: string, params: DerivationParams) => renderSlide(getSlide(slug)!, params)
const renderedViz = (slug: string, params: DerivationParams) =>
  rendered(slug, params).widgets.filter((w): w is Extract<RenderableWidget, { type: 'viz' }> => w.type === 'viz')

// --- slides.ts (authored config) -------------------------------------------

describe('slides.ts — authored deck config', () => {
  it('is a ten-slide deck across the seven scenes', () => {
    expect(SLIDES).toHaveLength(10)
    expect(new Set(SLIDES.map((s) => s.scene))).toEqual(SCENES)
  })

  it('has unique slugs in deck order', () => {
    expect(SLUGS).toEqual([
      'intro',
      'main',
      'main-sink',
      'crossing',
      'footprint',
      'deforestation-insight',
      'baseline',
      'method',
      'method-more',
      'amplified',
    ])
    expect(new Set(SLUGS).size).toBe(SLUGS.length)
    expect(FIRST_SLUG).toBe('intro')
  })

  it('uses only valid grids, scenes, widget types, viz kinds, controls and metrics', () => {
    for (const s of SLIDES) {
      expect(GRIDS.has(s.grid)).toBe(true)
      expect(SCENES.has(s.scene)).toBe(true)
      for (const w of s.widgets) {
        expect(WIDGET_TYPES.has(w.type)).toBe(true)
        if (w.type === 'controls') for (const k of w.keys) expect(CONTROL_KEYS.has(k)).toBe(true)
        if (w.type === 'viz') {
          expect(VIZ_KINDS.has(w.kind)).toBe(true)
          expect(w.metrics.length).toBeGreaterThan(0)
          for (const m of w.metrics) expect(METRICS.has(m)).toBe(true)
        }
      }
    }
  })

  it('gives every widget a unique id and a non-empty grid area within its slide', () => {
    for (const s of SLIDES) {
      const ids = s.widgets.map((w) => w.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const w of s.widgets) expect(w.area.length).toBeGreaterThan(0)
    }
  })

  it('has 0 / 1 (main, crossing, method flux) / 2 (footprint, baseline lab, amplified) vizzes per slide', () => {
    const count = (slug: string) => vizWidgets(slug).length
    expect(count('intro')).toBe(0)
    expect(count('main')).toBe(1)
    expect(count('main-sink')).toBe(1)
    expect(count('crossing')).toBe(1)
    expect(count('footprint')).toBe(2)
    expect(count('deforestation-insight')).toBe(2)
    expect(count('baseline')).toBe(2)
    expect(count('method')).toBe(1)
    expect(count('method-more')).toBe(0)
    expect(count('amplified')).toBe(2)
  })

  it('forces a future horizon on the crossing scene so the two series cross on screen', () => {
    expect(getSlide('crossing')!.forced?.horizon).toBe('100y')
    // the footprint scenes carry no forced overrides (baseline + horizon are live, shared 5→6)
    for (const slug of ['footprint', 'deforestation-insight']) {
      expect(getSlide(slug)!.forced).toBeUndefined()
    }
  })

  it('mirrors the baseline lab as `amplified` with an added rMultiplier control (slide 10)', () => {
    const amp = getSlide('amplified')!
    expect(amp.scene).toBe('amplified')
    expect(amp.grid).toBe('lab')
    expect(widgetsOfType('amplified', 'text')[0]).toMatchObject({
      captionKey: 'story.amplified.caption',
    })
    expect(controlsWidget('amplified')!.keys).toEqual(['baselineSlider', 'rMultiplier', 'horizon'])
    expect(amp.params?.horizon).toBe('100y')
    expect(amp.baseline).toBe(1990)
    expect(vizWidgets('amplified').map((v) => v.id)).toEqual(['amplified-main', 'amplified-crossing'])
    expect(vizWidgets('amplified').map((v) => v.kind)).toEqual(['mainStacked', 'crossing'])
    expect(widgetsOfType('amplified', 'equivalence')[0]).toMatchObject({
      orientation: 'vertical',
      area: 'equiv',
    })
  })

  it('is the illustrative flux bar on the method scene (slide 8), a text-only follow-up (slide 9)', () => {
    const method = getSlide('method')!
    expect(method.grid).toBe('text-viz')
    expect(vizWidgets('method')[0]).toMatchObject({ kind: 'fluxBar', area: 'viz-a' })
    expect(textWidgets('method')[0]).toMatchObject({ headingKey: 'story.method.heading' })
    const more = getSlide('method-more')!
    expect(more.grid).toBe('text')
    expect(textWidgets('method-more')[0]).toMatchObject({ headingKey: 'story.methodMore.heading' })
  })

  it('merges the baseline lab into one `lab` slide: stacked main+crossing + equivalence (ADR-026)', () => {
    const lab = getSlide('baseline')!
    expect(lab.scene).toBe('baseline')
    expect(lab.grid).toBe('lab')
    expect(widgetsOfType('baseline', 'text')[0]).toMatchObject({
      captionKey: 'story.baselineLab.caption',
    })
    expect(controlsWidget('baseline')!.keys).toEqual(['baselineSlider', 'horizon'])
    expect(lab.params?.horizon).toBe('100y')
    expect(lab.baseline).toBe(1990)
    // two vizzes STACKED in the main column: the main stock+forgone chart (viz-a) above the crossing (viz-b)
    expect(vizWidgets('baseline').map((v) => v.id)).toEqual(['baseline-main', 'baseline-crossing'])
    expect(vizWidgets('baseline').map((v) => v.kind)).toEqual(['mainStacked', 'crossing'])
    expect(vizWidgets('baseline').map((v) => v.area)).toEqual(['viz-a', 'viz-b'])
    // the equivalence strip is authored vertical (the quarter-width aside)
    expect(widgetsOfType('baseline', 'equivalence')[0]).toMatchObject({
      orientation: 'vertical',
      area: 'equiv',
    })
  })

  it('surfaces the shared baseline+horizon controls on the footprint scene (ADR-025)', () => {
    for (const slug of ['footprint', 'deforestation-insight']) {
      expect(controlsWidget(slug)!.keys).toEqual(['baseline', 'horizon'])
      // baseline + horizon are live and shared across 5→6 — no forced overrides.
      expect(getSlide(slug)!.forced).toBeUndefined()
    }
  })

  it('slide 6 uses duo-viz-equiv with a caption-only text widget, a horizontal equivalence strip', () => {
    const s = getSlide('deforestation-insight')!
    expect(s.grid).toBe('duo-viz-equiv')
    // the only text widget is caption-only (no heading, no body copy block) in the `caption` area
    const texts = textWidgets('deforestation-insight')
    expect(texts).toHaveLength(1)
    expect(texts[0]).toMatchObject({ area: 'caption', captionKey: 'story.insight.caption' })
    expect(texts[0]!.headingKey).toBeUndefined()
    expect(texts[0]!.textKeys).toBeUndefined()
    expect(widgetsOfType('deforestation-insight', 'equivalence')[0]).toMatchObject({
      orientation: 'horizontal',
    })
    // slide 5 keeps the classic duo-viz-text with a heading+body text block and no equivalence
    expect(getSlide('footprint')!.grid).toBe('duo-viz-text')
    const footprintText = textWidgets('footprint')
    expect(footprintText).toHaveLength(1)
    expect(footprintText[0]).toMatchObject({ headingKey: 'story.footprint.heading' })
    expect(footprintText[0]!.textKeys).toEqual(['story.footprint.p1'])
    expect(widgetsOfType('footprint', 'equivalence')).toHaveLength(0)
  })

  it('shows the multiplier widget only on slide 3 (main scene, forgone revealed)', () => {
    expect(widgetsOfType('main', 'multiplier')).toHaveLength(0)
    expect(widgetsOfType('main-sink', 'multiplier')).toHaveLength(1)
    for (const slug of [
      'crossing',
      'footprint',
      'deforestation-insight',
      'baseline',
      'method',
      'method-more',
      'amplified',
    ]) {
      expect(widgetsOfType(slug, 'multiplier')).toHaveLength(0)
    }
  })

  it('shares viz.id within a scene and keeps ids distinct across scenes', () => {
    // main scene: same 'main' instance across slides 2→3 (in-place reveal)
    expect(vizWidgets('main')[0]!.id).toBe('main')
    expect(vizWidgets('main-sink')[0]!.id).toBe('main')
    // footprint scene: same 'donut'/'fossil' instances across slides 5→6 (fossil-removal)
    expect(vizWidgets('footprint').map((v) => v.id)).toEqual(['donut', 'fossil'])
    expect(vizWidgets('deforestation-insight').map((v) => v.id)).toEqual(['donut', 'fossil'])
    // crossing's id is distinct from the main-scene id (fresh mount across the boundary)
    expect(vizWidgets('crossing')[0]!.id).toBe('crossing')
    expect(vizWidgets('crossing')[0]!.id).not.toBe('main')
  })
})

describe('slides.ts — navigation helpers', () => {
  it('resolves index / next / prev within the deck', () => {
    expect(slideIndex('intro')).toBe(0)
    expect(slideIndex('deforestation-insight')).toBe(5)
    expect(slideIndex('baseline')).toBe(6)
    expect(slideIndex('amplified')).toBe(9)
    expect(slideIndex('nope')).toBe(-1)
    expect(nextSlug('intro')).toBe('main')
    expect(nextSlug('deforestation-insight')).toBe('baseline')
    expect(nextSlug('baseline')).toBe('method')
    expect(nextSlug('method-more')).toBe('amplified')
    expect(nextSlug('amplified')).toBeNull()
    expect(prevSlug('intro')).toBeNull()
    expect(prevSlug('main')).toBe('intro')
    expect(prevSlug('baseline')).toBe('deforestation-insight')
    expect(prevSlug('amplified')).toBe('method-more')
    expect(nextSlug('nope')).toBeNull()
    expect(prevSlug('nope')).toBeNull()
  })
})

// --- SlideFactory (pure resolution) ----------------------------------------

describe('SlideFactory.renderSlide', () => {
  it('passes the grid, scene and slug through unchanged', () => {
    const r = rendered('main', params)
    expect(r.grid).toBe('viz-text')
    expect(r.scene).toBe('main')
    expect(r.slug).toBe('main')
  })

  it('resolves the generic text widget by passing its heading/caption/body keys through', () => {
    const main = rendered('main', params).widgets
    expect(main.find((w) => w.type === 'text')).toMatchObject({
      headingKey: 'story.main.heading',
      textKeys: ['story.main.p1'],
    })
    const insight = rendered('deforestation-insight', params).widgets
    expect(insight.find((w) => w.type === 'text')).toMatchObject({
      captionKey: 'story.insight.caption',
    })
  })

  it('carries the grid area on every resolved widget', () => {
    for (const w of rendered('baseline', params).widgets) {
      expect(w.area.length).toBeGreaterThan(0)
    }
    expect(renderedViz('baseline', params).map((v) => v.area)).toEqual(['viz-a', 'viz-b'])
  })

  it('tags a controls widget server-refetch vs client-only', () => {
    const main = rendered('main', params).widgets.find((w) => w.type === 'controls')!
    expect(main).toMatchObject({
      type: 'controls',
      controls: [
        { key: 'horizon', mode: 'server-refetch' },
        { key: 'baseline', mode: 'client-only' }, // ADR-026: baseline no longer refetches
      ],
    })
    const crossing = rendered('crossing', params).widgets.find((w) => w.type === 'controls')!
    expect(crossing).toMatchObject({ controls: [{ key: 'baseline', mode: 'client-only' }] })
  })

  it('applies forced overrides on top of the scene params', () => {
    // crossing forces 100y even if the scene arrives at today
    const r = rendered('crossing', params)
    expect(r.params.horizon).toBe('100y')
    // untouched keys survive
    expect(r.params.rScenario).toBe('mid')
  })

  it('resolves mainStacked to the global stacked-area chart', () => {
    expect(renderedViz('main', params)[0]!.component).toBe('GlobalStackedAreaChart')
  })

  it('resolves the fixed viz kinds to their components', () => {
    expect(renderedViz('crossing', params)[0]!.component).toBe('CrossingChart')
    expect(renderedViz('footprint', params).map((v) => v.component)).toEqual([
      'FootprintDonut',
      'FossilComparisonChart',
    ])
  })

  it('carries the metric presentation transform per viz', () => {
    expect(renderedViz('main', params)[0]!.presentation).toEqual({ metrics: ['stock'] })
    expect(renderedViz('main-sink', params)[0]!.presentation).toEqual({
      metrics: ['stock', 'forgoneSink'],
    })
    expect(renderedViz('deforestation-insight', params).map((v) => v.presentation.metrics)).toEqual([
      ['stock', 'forgoneSink'],
      ['stock', 'forgoneSink'],
    ])
  })

  it('resolves the multiplier widget only where authored (slide 3)', () => {
    expect(rendered('main', params).widgets.some((w) => w.type === 'multiplier')).toBe(false)
    expect(rendered('main-sink', params).widgets.some((w) => w.type === 'multiplier')).toBe(true)
    expect(rendered('footprint', params).widgets.some((w) => w.type === 'multiplier')).toBe(false)
  })

  it('resolves the equivalence widget orientation (horizontal slide 6, vertical lab)', () => {
    expect(rendered('deforestation-insight', params).widgets.find((w) => w.type === 'equivalence')).toMatchObject({
      orientation: 'horizontal',
    })
    expect(rendered('baseline', params).widgets.find((w) => w.type === 'equivalence')).toMatchObject({
      orientation: 'vertical',
    })
  })

  it('renders the intro slide with one text widget (heading + body, no viz/controls/multiplier)', () => {
    const widgets = rendered('intro', params).widgets
    expect(widgets.map((w) => w.type)).toEqual(['text'])
    expect(widgets[0]).toMatchObject({
      type: 'text',
      headingKey: 'story.intro.heading',
      textKeys: ['story.intro.p1', 'story.intro.p2'],
    })
  })
})
