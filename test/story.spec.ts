import { describe, it, expect } from 'vitest'
import type {
  ControlKey,
  DerivationParams,
  LayoutPreset,
  SceneId,
  VizKind,
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
import { renderSlide } from '../app/story/SlideFactory'

// --- fixtures --------------------------------------------------------------

const LAYOUTS: ReadonlySet<LayoutPreset> = new Set([
  'text',
  'viz-text',
  'duo-viz-text',
  'duo-viz-equiv',
  'lab',
])
const SCENES: ReadonlySet<SceneId> = new Set(['intro', 'main', 'crossing', 'footprint', 'baseline'])
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

  it('uses only valid layout presets, scenes, viz kinds, controls and metrics', () => {
    for (const s of SLIDES) {
      expect(LAYOUTS.has(s.layout)).toBe(true)
      expect(SCENES.has(s.scene)).toBe(true)
      for (const key of s.controls ?? []) expect(CONTROL_KEYS.has(key)).toBe(true)
      for (const v of s.visualizations) {
        expect(VIZ_KINDS.has(v.kind)).toBe(true)
        expect(v.metrics.length).toBeGreaterThan(0)
        for (const m of v.metrics) expect(METRICS.has(m)).toBe(true)
      }
    }
  })

  it('has 0 (intro) / 1 (main, crossing) / 2 (footprint, baseline lab) visualisations per slide', () => {
    const count = (slug: string) => getSlide(slug)!.visualizations.length
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
    expect(lab.layout).toBe('lab')
    expect(lab.captionKey).toBe('story.baselineLab.caption')
    expect(lab.controls).toEqual(['baselineSlider', 'horizon'])
    expect(lab.params?.horizon).toBe('100y')
    expect(lab.baseline).toBe(1990)
    // two vizzes stacked in the main column: the main stock+forgone chart above the crossing chart
    expect(lab.visualizations.map((v) => v.id)).toEqual(['baseline-main', 'baseline-crossing'])
    expect(lab.visualizations.map((v) => v.kind)).toEqual(['mainStacked', 'crossing'])
  })

  it('surfaces the shared baseline+horizon controls on the footprint scene (ADR-025)', () => {
    for (const slug of ['footprint', 'deforestation-insight']) {
      expect(getSlide(slug)!.controls).toEqual(['baseline', 'horizon'])
      // horizon is no longer forced — only scope stays global (shared, live across 5→6).
      expect(getSlide(slug)!.forced).toEqual({ scope: 'global' })
    }
  })

  it('slide 6 uses duo-viz-equiv with a caption and no text block (ADR-025)', () => {
    const s = getSlide('deforestation-insight')!
    expect(s.layout).toBe('duo-viz-equiv')
    expect(s.captionKey).toBe('story.insight.caption')
    expect(s.headingKey).toBeUndefined()
    expect(s.textKeys).toEqual([])
    // slide 5 keeps the classic duo-viz-text with a text block
    expect(getSlide('footprint')!.layout).toBe('duo-viz-text')
  })

  it('shares viz.id within a scene and keeps ids distinct across scenes', () => {
    // main scene: same 'main' instance across slides 2→3 (in-place reveal)
    expect(getSlide('main')!.visualizations[0]!.id).toBe('main')
    expect(getSlide('main-sink')!.visualizations[0]!.id).toBe('main')
    // footprint scene: same 'donut'/'fossil' instances across slides 5→6 (fossil-removal)
    expect(getSlide('footprint')!.visualizations.map((v) => v.id)).toEqual(['donut', 'fossil'])
    expect(getSlide('deforestation-insight')!.visualizations.map((v) => v.id)).toEqual([
      'donut',
      'fossil',
    ])
    // crossing's id is distinct from the main-scene id (fresh mount across the boundary)
    expect(getSlide('crossing')!.visualizations[0]!.id).toBe('crossing')
    expect(getSlide('crossing')!.visualizations[0]!.id).not.toBe('main')
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
  it('passes layout / heading / text through unchanged', () => {
    const r = renderSlide(getSlide('main')!, localParams)
    expect(r.layout).toBe('viz-text')
    expect(r.headingKey).toBe('story.main.heading')
    expect(r.textKeys).toEqual(['story.main.p1'])
  })

  it('passes the slide-6 captionKey through (ADR-025)', () => {
    const insight = renderSlide(getSlide('deforestation-insight')!, globalParams)
    expect(insight.layout).toBe('duo-viz-equiv')
    expect(insight.captionKey).toBe('story.insight.caption')
    expect(insight.textKeys).toEqual([])
    // other slides carry no caption
    expect(renderSlide(getSlide('main')!, localParams).captionKey).toBeUndefined()
  })

  it('tags controls server-refetch vs client-only', () => {
    const main = renderSlide(getSlide('main')!, localParams)
    expect(main.controls).toEqual([
      { key: 'horizon', mode: 'server-refetch' },
      { key: 'domain', mode: 'server-refetch' },
      { key: 'baseline', mode: 'client-only' }, // ADR-026: baseline no longer refetches
    ])
    const crossing = renderSlide(getSlide('crossing')!, globalParams)
    expect(crossing.controls).toEqual([{ key: 'baseline', mode: 'client-only' }])
  })

  it('applies forced overrides on top of the scene params', () => {
    // crossing forces global + 100y even if the scene arrives local/today
    const r = renderSlide(getSlide('crossing')!, localParams)
    expect(r.params.scope).toBe('global')
    expect(r.params.horizon).toBe('100y')
    // untouched keys survive
    expect(r.params.rScenario).toBe('mid')
  })

  it('resolves mainStacked to global vs single-domain by scope', () => {
    const asGlobal = renderSlide(getSlide('main')!, globalParams)
    expect(asGlobal.visuals[0]!.component).toBe('GlobalStackedAreaChart')
    const asLocal = renderSlide(getSlide('main')!, localParams)
    expect(asLocal.visuals[0]!.component).toBe('MainStackedChart')
  })

  it('resolves the fixed viz kinds to their components', () => {
    expect(renderSlide(getSlide('crossing')!, globalParams).visuals[0]!.component).toBe('CrossingChart')
    const footprint = renderSlide(getSlide('footprint')!, globalParams)
    expect(footprint.visuals.map((v) => v.component)).toEqual([
      'FootprintDonut',
      'FossilComparisonChart',
    ])
  })

  it('carries the metric presentation transform per viz', () => {
    expect(renderSlide(getSlide('main')!, localParams).visuals[0]!.presentation).toEqual({
      metrics: ['stock'],
    })
    expect(renderSlide(getSlide('main-sink')!, localParams).visuals[0]!.presentation).toEqual({
      metrics: ['stock', 'forgoneSink'],
    })
    const insight = renderSlide(getSlide('deforestation-insight')!, globalParams)
    expect(insight.visuals.map((v) => v.presentation.metrics)).toEqual([
      ['stock', 'forgoneSink'],
      ['stock', 'forgoneSink'],
    ])
  })

  it('shows the multiplier only on slide 3 (main scene, forgone revealed)', () => {
    expect(renderSlide(getSlide('main')!, localParams).showMultiplier).toBe(false)
    expect(renderSlide(getSlide('main-sink')!, localParams).showMultiplier).toBe(true)
    // never outside the main scene, even when forgoneSink is present
    expect(renderSlide(getSlide('crossing')!, globalParams).showMultiplier).toBe(false)
    expect(renderSlide(getSlide('footprint')!, globalParams).showMultiplier).toBe(false)
  })

  it('renders the intro slide with no visuals or controls', () => {
    const r = renderSlide(getSlide('intro')!, globalParams)
    expect(r.visuals).toEqual([])
    expect(r.controls).toEqual([])
    expect(r.showMultiplier).toBe(false)
  })
})
