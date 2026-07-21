import type {
  ControlKey,
  DerivationMode,
  DerivationParams,
  GridTemplateId,
  SceneId,
  SlideDef,
  VizKind,
  VizPresentation,
  WidgetDef,
} from '../../shared/types'

// The pure slide factory (tech-spec §17.2, ADR-021/027). It resolves an authored `SlideDef` against the
// current scene's `DerivationParams` into a render-ready `RenderableSlide`: effective params (scene
// params + immutable `forced` overrides) and each WIDGET resolved to its render-ready form — a viz's
// concrete component + presentation, a controls widget's controls tagged server-refetch vs client-only.
// This layer is Vue/Pinia-free: the `Widget` renderer (Pinia-aware) maps a resolved widget to the actual
// component and binds live props (§11). Keeping the factory pure makes it unit-testable.

/** A deck control, tagged with whether flipping it refetches (mutates `DerivationParams`) or is pure
 *  view state. The baseline controls are client-only (ADR-021/026). */
export interface RenderableControl {
  key: ControlKey
  mode: DerivationMode
}

/** The tier-2 chart component names the `Widget` renderer maps to actual components (§11, §17.2). */
export type ChartComponentName =
  | 'GlobalStackedAreaChart'
  | 'CrossingChart'
  | 'FootprintDonut'
  | 'FossilComparisonChart'
  | 'FluxBarChart'

/** Fields every resolved widget carries: its authored identity and the grid area it occupies. */
interface RenderableWidgetBase {
  id: string
  area: string
}

export interface RenderableText extends RenderableWidgetBase {
  type: 'text'
  headingKey?: string
  captionKey?: string
  textKeys?: string[]
}
export interface RenderableControls extends RenderableWidgetBase {
  type: 'controls'
  controls: RenderableControl[]
}
export interface RenderableViz extends RenderableWidgetBase {
  type: 'viz'
  kind: VizKind
  component: ChartComponentName
  presentation: VizPresentation
}
export interface RenderableMultiplier extends RenderableWidgetBase {
  type: 'multiplier'
}
export interface RenderableEquivalence extends RenderableWidgetBase {
  type: 'equivalence'
  orientation: 'horizontal' | 'vertical'
}

/** A widget resolved for rendering (discriminated by `type`). */
export type RenderableWidget =
  | RenderableText
  | RenderableControls
  | RenderableViz
  | RenderableMultiplier
  | RenderableEquivalence

/** A slide resolved for rendering (tech-spec §17.2). `params` is the effective derivation signature
 *  (scene params with `forced` applied); `grid` names the geometry; `widgets` are render-ready. */
export interface RenderableSlide {
  slug: string
  scene: SceneId
  grid: GridTemplateId
  params: DerivationParams
  widgets: RenderableWidget[]
}

/** Client-only controls (no refetch): both baseline controls (`baseline` select + `baselineSlider`)
 *  and the `rMultiplier` R-amplifier — all ADR-026 client-transforms. `horizon` mutates
 *  DerivationParams and refetches (ADR-021). */
const CLIENT_ONLY_CONTROLS: ReadonlySet<ControlKey> = new Set<ControlKey>([
  'baseline',
  'baselineSlider',
  'rMultiplier',
])

const controlMode = (key: ControlKey): DerivationMode =>
  CLIENT_ONLY_CONTROLS.has(key) ? 'client-only' : 'server-refetch'

/** Resolve a viz `kind` to its concrete component. The global stacked-area shows the domains as stacked
 *  layers (business §6.1); the rest are fixed. */
const resolveComponent = (kind: VizKind): ChartComponentName => {
  switch (kind) {
    case 'mainStacked':
    case 'globalStackedArea':
      return 'GlobalStackedAreaChart'
    case 'crossing':
      return 'CrossingChart'
    case 'donut':
      return 'FootprintDonut'
    case 'fossilComparison':
      return 'FossilComparisonChart'
    case 'fluxBar':
      return 'FluxBarChart'
  }
}

/** Resolve one authored widget. Each widget owns its resolution: viz → concrete component +
 *  presentation; controls → mode-tagged controls; the rest pass config through. */
const resolveWidget = (widget: WidgetDef): RenderableWidget => {
  const base = { id: widget.id, area: widget.area }
  switch (widget.type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        headingKey: widget.headingKey,
        captionKey: widget.captionKey,
        textKeys: widget.textKeys,
      }
    case 'controls':
      return {
        ...base,
        type: 'controls',
        controls: widget.keys.map((key) => ({ key, mode: controlMode(key) })),
      }
    case 'viz':
      return {
        ...base,
        type: 'viz',
        kind: widget.kind,
        component: resolveComponent(widget.kind),
        presentation: { metrics: widget.metrics },
      }
    case 'multiplier':
      return { ...base, type: 'multiplier' }
    case 'equivalence':
      return { ...base, type: 'equivalence', orientation: widget.orientation }
  }
}

/**
 * Resolve an authored slide against the current scene's params into a render-ready unit (§17.2).
 * `params` is the scene's live `DerivationParams` (§10.1); the slide's immutable `forced` overrides
 * are applied on top so horizon locks (crossing/footprint) always win.
 */
export const renderSlide = (def: SlideDef, params: DerivationParams): RenderableSlide => {
  const effective: DerivationParams = { ...params, ...def.forced }
  return {
    slug: def.slug,
    scene: def.scene,
    grid: def.grid,
    params: effective,
    widgets: def.widgets.map((w) => resolveWidget(w)),
  }
}
