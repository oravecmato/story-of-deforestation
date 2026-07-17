import type {
  ControlKey,
  DerivationMode,
  DerivationParams,
  LayoutPreset,
  SceneId,
  SlideDef,
  VizKind,
  VizPresentation,
} from '../../shared/types'

// The pure slide factory (tech-spec §17.2, ADR-021). It resolves an authored `SlideDef` against the
// current scene's `DerivationParams` into a render-ready `RenderableSlide`: effective params (scene
// params + immutable `forced` overrides), controls tagged server-refetch vs client-only, and each
// visualisation's concrete tier-2 component + presentation transform. This layer is Vue/Pinia-free
// and Vue-unaware: `GenericSlide` (Pinia-aware) maps `component` → the actual chart component and
// binds the `dto`/`ctx` props at render time (§11). Keeping the factory pure makes it unit-testable.

/** A deck control, tagged with whether flipping it refetches (mutates `DerivationParams`) or is pure
 *  view state (`timeRange`). Only `timeRange` is client-only (ADR-021). */
export interface RenderableControl {
  key: ControlKey
  mode: DerivationMode
}

/** A resolved visualisation: stable identity + the concrete tier-2 component name (`mainStacked`
 *  resolves to global vs. single-domain per scope, business §6.1) + its metric presentation. */
export interface RenderableViz {
  id: string
  kind: VizKind
  component: ChartComponentName
  presentation: VizPresentation
}

/** A slide resolved for rendering (tech-spec §17.2). `params` is the effective derivation signature
 *  (scene params with `forced` applied); `dto`/`ctx` are bound later by `GenericSlide`. */
export interface RenderableSlide {
  slug: string
  scene: SceneId
  layout: LayoutPreset
  headingKey?: string
  captionKey?: string
  textKeys: string[]
  params: DerivationParams
  controls: RenderableControl[]
  visuals: RenderableViz[]
  showMultiplier: boolean
}

/** The tier-2 chart component names `GenericSlide` maps to actual components (§11, §17.2). */
export type ChartComponentName =
  | 'MainStackedChart'
  | 'GlobalStackedAreaChart'
  | 'CrossingChart'
  | 'FootprintDonut'
  | 'FossilComparisonChart'

/** Controls that refetch when changed; `timeRange` is the sole client-only control (ADR-021). */
const CLIENT_ONLY_CONTROLS: ReadonlySet<ControlKey> = new Set<ControlKey>(['timeRange'])

const controlMode = (key: ControlKey): DerivationMode =>
  CLIENT_ONLY_CONTROLS.has(key) ? 'client-only' : 'server-refetch'

/** Resolve a viz `kind` to its concrete component. `mainStacked` picks the global stacked-area or the
 *  single-domain stack from the effective scope (business §6.1); the rest are fixed. */
const resolveComponent = (kind: VizKind, params: DerivationParams): ChartComponentName => {
  switch (kind) {
    case 'mainStacked':
      return params.scope === 'global' ? 'GlobalStackedAreaChart' : 'MainStackedChart'
    case 'globalStackedArea':
      return 'GlobalStackedAreaChart'
    case 'crossing':
      return 'CrossingChart'
    case 'donut':
      return 'FootprintDonut'
    case 'fossilComparison':
      return 'FossilComparisonChart'
  }
}

/**
 * Resolve an authored slide against the current scene's params into a render-ready unit (§17.2).
 * `params` is the scene's live `DerivationParams` (§10.1); the slide's immutable `forced` overrides
 * are applied on top so scope/horizon locks (crossing/footprint → global) always win.
 */
export const renderSlide = (def: SlideDef, params: DerivationParams): RenderableSlide => {
  const effective: DerivationParams = { ...params, ...def.forced }

  const controls: RenderableControl[] = (def.controls ?? []).map((key) => ({
    key,
    mode: controlMode(key),
  }))

  const visuals: RenderableViz[] = def.visualizations.map((viz) => ({
    id: viz.id,
    kind: viz.kind,
    component: resolveComponent(viz.kind, effective),
    presentation: { metrics: viz.metrics },
  }))

  // The multiplier ×N is shown only in the `main` scene, once the forgone sink is revealed — i.e.
  // slide 3 (`main-sink`), never slide 2 (UI §6.6, matrix row).
  const showMultiplier =
    def.scene === 'main' && visuals.some((v) => v.presentation.metrics.includes('forgoneSink'))

  return {
    slug: def.slug,
    scene: def.scene,
    layout: def.layout,
    headingKey: def.headingKey,
    captionKey: def.captionKey,
    textKeys: def.textKeys,
    params: effective,
    controls,
    visuals,
    showMultiplier,
  }
}
