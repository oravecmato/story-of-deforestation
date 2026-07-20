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
  'duo-viz-text',
  'duo-viz-equiv',
  'lab',
])
const SCENES: ReadonlySet<SceneId> = new Set(['intro', 'main', 'crossing', 'footprint', 'baseline'])
const WIDGET_TYPES: ReadonlySet<WidgetType> = new Set([
  'heading',
  'text',
  'caption',
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
])
const CONTROL_KEYS: ReadonlySet<ControlKey> = new Set([
  'horizon',
  'domain',
  'baseline',
  'baselineSlider',
])
const METRICS: ReadonlySet<string> = new Set(['stock', 'forgoneSink', 'fossil'])

const localParams: DerivationParams = {
  scope: 'local',
  domainId: 'amazon',
  horizon: 'today',
  rScenario: 'mid',
}
const globalParams: DerivationParams = { scope: 'global', horizon: 'today', rScenario: 'mid' }

// --- widget helpers --------------------------------------------------------

const widgets = (slug: string): readonly WidgetDef[] => getSlide(slug)!.widgets
const widgetsOfType = <T extends WidgetType>(slug: string, type: T) =>
  widgets(slug).filter((w) => w.type === type)
const vizWidgets = (slug: string) =>
  widgets(slug).filter((w): w is Extract<WidgetDef, { type: 'viz' }> => w.type === 'viz')
const controlsWidget = (slug: string) =>
  widgets(slug).find((w): w is Extract<WidgetDef, { type: 'controls' }> => w.type === 'controls')

const rendered = (slug: string, params: DerivationParams) => renderSlide(getSlide(slug)!, params)
const renderedViz = (slug: string, params: DerivationParams) =>
  rendered(slug, params).widgets.filter((w): w is Extract<RenderableWidget, { type: 'viz' }> => w.type === 'viz')

// --- slides.ts (authored config) -------------------------------------------

describe('slides.ts — authored deck config', () => {
  it('is a seven-slide deck across the five scenes', () => {
    expect(SLIDES).toHaveLength(7)
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

  it('has 0 (intro) / 1 (main, crossing) / 2 (footprint, baseline lab) vizzes per slide', () => {
    const count = (slug: string) => vizWidgets(slug).length
    expect(count('intro')).toBe(0)
    expect(count('main')).toBe(1)
    expect(count('main-sink')).toBe(1)
    expect(count('crossing')).toBe(1)
    expect(count('footprint')).toBe(2)
    expect(count('deforestation-insight')).toBe(2)
    expect(count('baseline')).toBe(2)
  })

  it('forces global scope on the crossing, footprint and baseline scenes', () => {
    for (const slug of ['crossing', 'footprint', 'deforestation-insight', 'baseline']) {
      expect(getSlide(slug)!.forced?.scope).toBe('global')
    }
    // the main scene does NOT force scope (domain is a live control there)
    expect(getSlide('main')!.forced?.scope).toBeUndefined()
  })

  it('merges the baseline lab into one `lab` slide: stacked main+crossing + equivalence (ADR-026)', () => {
    const lab = getSlide('baseline')!
    expect(lab.scene).toBe('baseline')
    expect(lab.grid).toBe('lab')
    expect(widgetsOfType('baseline', 'caption')[0]).toMatchObject({
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
      // horizon is no longer forced — only scope stays global (shared, live across 5→6).
      expect(getSlide(slug)!.forced).toEqual({ scope: 'global' })
    }
  })

  it('slide 6 uses duo-viz-equiv with a caption, a horizontal equivalence strip and no text', () => {
    const s = getSlide('deforestation-insight')!
    expect(s.grid).toBe('duo-viz-equiv')
    expect(widgetsOfType('deforestation-insight', 'caption')[0]).toMatchObject({
      captionKey: 'story.insight.caption',
    })
    expect(widgetsOfType('deforestation-insight', 'text')).toHaveLength(0)
    expect(widgetsOfType('deforestation-insight', 'heading')).toHaveLength(0)
    expect(widgetsOfType('deforestation-insight', 'equivalence')[0]).toMatchObject({
      orientation: 'horizontal',
    })
    // slide 5 keeps the classic duo-viz-text with a text block and no equivalence
    expect(getSlide('footprint')!.grid).toBe('duo-viz-text')
    expect(widgetsOfType('footprint', 'text')).toHaveLength(1)
    expect(widgetsOfType('footprint', 'equivalence')).toHaveLength(0)
  })

  it('shows the multiplier widget only on slide 3 (main scene, forgone revealed)', () => {
    expect(widgetsOfType('main', 'multiplier')).toHaveLength(0)
    expect(widgetsOfType('main-sink', 'multiplier')).toHaveLength(1)
    for (const slug of ['crossing', 'footprint', 'deforestation-insight', 'baseline']) {
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
    expect(slideIndex('nope')).toBe(-1)
    expect(nextSlug('intro')).toBe('main')
    expect(nextSlug('deforestation-insight')).toBe('baseline')
    expect(nextSlug('baseline')).toBeNull()
    expect(prevSlug('intro')).toBeNull()
    expect(prevSlug('main')).toBe('intro')
    expect(prevSlug('baseline')).toBe('deforestation-insight')
    expect(nextSlug('nope')).toBeNull()
    expect(prevSlug('nope')).toBeNull()
  })
})

// --- SlideFactory (pure resolution) ----------------------------------------

describe('SlideFactory.renderSlide', () => {
  it('passes the grid, scene and slug through unchanged', () => {
    const r = rendered('main', localParams)
    expect(r.grid).toBe('viz-text')
    expect(r.scene).toBe('main')
    expect(r.slug).toBe('main')
  })

  it('resolves heading / text / caption widgets by passing their keys through', () => {
    const main = rendered('main', localParams).widgets
    expect(main.find((w) => w.type === 'heading')).toMatchObject({ headingKey: 'story.main.heading' })
    expect(main.find((w) => w.type === 'text')).toMatchObject({ textKeys: ['story.main.p1'] })
    const insight = rendered('deforestation-insight', globalParams).widgets
    expect(insight.find((w) => w.type === 'caption')).toMatchObject({
      captionKey: 'story.insight.caption',
    })
  })

  it('carries the grid area on every resolved widget', () => {
    for (const w of rendered('baseline', globalParams).widgets) {
      expect(w.area.length).toBeGreaterThan(0)
    }
    expect(renderedViz('baseline', globalParams).map((v) => v.area)).toEqual(['viz-a', 'viz-b'])
  })

  it('tags a controls widget server-refetch vs client-only', () => {
    const main = rendered('main', localParams).widgets.find((w) => w.type === 'controls')!
    expect(main).toMatchObject({
      type: 'controls',
      controls: [
        { key: 'horizon', mode: 'server-refetch' },
        { key: 'domain', mode: 'server-refetch' },
        { key: 'baseline', mode: 'client-only' }, // ADR-026: baseline no longer refetches
      ],
    })
    const crossing = rendered('crossing', globalParams).widgets.find((w) => w.type === 'controls')!
    expect(crossing).toMatchObject({ controls: [{ key: 'baseline', mode: 'client-only' }] })
  })

  it('applies forced overrides on top of the scene params', () => {
    // crossing forces global + 100y even if the scene arrives local/today
    const r = rendered('crossing', localParams)
    expect(r.params.scope).toBe('global')
    expect(r.params.horizon).toBe('100y')
    // untouched keys survive
    expect(r.params.rScenario).toBe('mid')
  })

  it('resolves mainStacked to global vs single-domain by scope', () => {
    expect(renderedViz('main', globalParams)[0]!.component).toBe('GlobalStackedAreaChart')
    expect(renderedViz('main', localParams)[0]!.component).toBe('MainStackedChart')
  })

  it('resolves the fixed viz kinds to their components', () => {
    expect(renderedViz('crossing', globalParams)[0]!.component).toBe('CrossingChart')
    expect(renderedViz('footprint', globalParams).map((v) => v.component)).toEqual([
      'FootprintDonut',
      'FossilComparisonChart',
    ])
  })

  it('carries the metric presentation transform per viz', () => {
    expect(renderedViz('main', localParams)[0]!.presentation).toEqual({ metrics: ['stock'] })
    expect(renderedViz('main-sink', localParams)[0]!.presentation).toEqual({
      metrics: ['stock', 'forgoneSink'],
    })
    expect(renderedViz('deforestation-insight', globalParams).map((v) => v.presentation.metrics)).toEqual([
      ['stock', 'forgoneSink'],
      ['stock', 'forgoneSink'],
    ])
  })

  it('resolves the multiplier widget only where authored (slide 3)', () => {
    expect(rendered('main', localParams).widgets.some((w) => w.type === 'multiplier')).toBe(false)
    expect(rendered('main-sink', localParams).widgets.some((w) => w.type === 'multiplier')).toBe(true)
    expect(rendered('footprint', globalParams).widgets.some((w) => w.type === 'multiplier')).toBe(false)
  })

  it('resolves the equivalence widget orientation (horizontal slide 6, vertical lab)', () => {
    expect(rendered('deforestation-insight', globalParams).widgets.find((w) => w.type === 'equivalence')).toMatchObject({
      orientation: 'horizontal',
    })
    expect(rendered('baseline', globalParams).widgets.find((w) => w.type === 'equivalence')).toMatchObject({
      orientation: 'vertical',
    })
  })

  it('renders the intro slide with only heading + text widgets (no viz, controls or multiplier)', () => {
    const kinds = rendered('intro', globalParams).widgets.map((w) => w.type)
    expect(kinds).toEqual(['heading', 'text'])
  })
})
