import type { DerivationParams } from './params'

// Story-deck presentation types (tech-spec §17.1, ADR-021/024/027). This is a FRONTEND-ONLY layer: it
// adds no server route, DTO or param. A `SlideDef[]` is authored config; a `VizWidget.metrics` set is a
// client-side presentation transform over a DTO the store already holds (never a refetch).
//
// WIDGET MODEL (ADR-027): a slide is an ARRAY OF WIDGETS, not a fixed set of heading/text/viz/control
// slots. Every element that fills a part of the grid is a widget with a `type` discriminator, a stable
// `id`, a grid `area`, and its own config. `SlideLayout` knows nothing about what a widget IS — it only
// lays widgets out on the grid its `GridTemplate` names. Per-type logic lives with the type: the pure
// resolution (kind→component, control mode) in the factory, the Pinia binding in the `Widget` renderer.

/** The five scenes. Sibling slides in a scene share params + widget `id`s (in-place animation).
 *  `baseline` is the ADR-026 baseline-manipulation scene (the interactive back-projection lab). */
export type SceneId = 'intro' | 'main' | 'crossing' | 'footprint' | 'baseline'

/** The named grid templates a slide arranges its widgets on (ADR-027). Replaces the old closed
 *  `LayoutPreset` union: geometry is now a `GridTemplate` (columns/rows/areas), and a slide places each
 *  widget into one of the template's named areas. The library lives in `app/story/gridTemplates.ts`. */
export type GridTemplateId = 'text' | 'viz-text' | 'duo-viz-text' | 'duo-viz-equiv' | 'lab'

/** The unit the equivalence widget renders its four figures in (ADR-025, §17.4). Pure client view
 *  state (no refetch, not in the URL); `country` is locale-driven (SVK/UK). Default `car`. */
export type EquivalenceUnit = 'mtco2' | 'car' | 'country'

/** Which chart-option class / tier-2 component a visualisation uses. `mainStacked` resolves to the
 *  global stacked-area or the single-domain stack depending on the scene's scope (business §6.1). */
export type VizKind =
  | 'mainStacked'
  | 'globalStackedArea'
  | 'crossing'
  | 'donut'
  | 'fossilComparison'

/** Controls a slide may surface. `baseline`/`baselineSlider` are client-only (no refetch — the ADR-026
 *  client-transform); `horizon`/`domain` mutate `DerivationParams` and refetch (ADR-021). */
export type ControlKey = 'horizon' | 'domain' | 'baseline' | 'baselineSlider'

/** Whether a control mutates `DerivationParams` (server-refetch) or is pure view state (client-only,
 *  since ADR-026 — the `baseline` controls). */
export type DerivationMode = 'server-refetch' | 'client-only'

/** The widget kinds a slide may place on its grid (ADR-027). Each maps to one concrete leaf renderer. */
export type WidgetType =
  | 'heading'
  | 'text'
  | 'caption'
  | 'controls'
  | 'viz'
  | 'multiplier'
  | 'equivalence'

/** Fields every widget carries: a STABLE identity (`id`) SHARED across a scene's slides so the reveal
 *  (2→3) and the fossil-removal (5→6) animate in place (ADR-022), and the grid `area` it occupies. */
interface WidgetBase {
  id: string
  type: WidgetType
  /** The `GridTemplate` area name this widget is placed in. */
  area: string
}

/** A heading line (i18n key only, ADR-011). */
export interface HeadingWidget extends WidgetBase {
  type: 'heading'
  headingKey: string
}

/** Body copy — one paragraph per i18n key (ADR-011). */
export interface TextWidget extends WidgetBase {
  type: 'text'
  textKeys: string[]
}

/** A thin caption line rendered on top of the equivalence-led slides (ADR-025). */
export interface CaptionWidget extends WidgetBase {
  type: 'caption'
  captionKey: string
}

/** The controls bar for a slide (a subset of its scene's controls). Renders the inline controls plus
 *  the pinned-right `baseline` settings menu; the arrangement is the widget's own concern. */
export interface ControlsWidget extends WidgetBase {
  type: 'controls'
  keys: ControlKey[]
}

/** A visualisation. `kind` resolves to a concrete chart component per the scene's scope (business §6.1);
 *  `metrics` is the presentation transform handed to the chart-option class. */
export interface VizWidget extends WidgetBase {
  type: 'viz'
  kind: VizKind
  metrics: string[]
}

/** The live ×N multiplier headline (UI §6.6). Data-driven visibility; authored only where it belongs
 *  (the `main` scene once the forgone sink is revealed — slide 3), so no resolution logic. */
export interface MultiplierWidget extends WidgetBase {
  type: 'multiplier'
}

/** The equivalence strip (ADR-025/026, §17.4). `orientation` picks the four-across footer (`horizontal`,
 *  default — slide 6) or the stacked full-height aside (`vertical` — the lab's quarter-width column). */
export interface EquivalenceWidget extends WidgetBase {
  type: 'equivalence'
  orientation: 'horizontal' | 'vertical'
}

/** One authored widget (discriminated by `type`). */
export type WidgetDef =
  | HeadingWidget
  | TextWidget
  | CaptionWidget
  | ControlsWidget
  | VizWidget
  | MultiplierWidget
  | EquivalenceWidget

/** The presentation transform handed to a chart-option class: the DTO-metric subset to render. An
 *  empty set means "the option's default full metric set" (tech-spec §11.1). */
export interface VizPresentation {
  metrics: string[]
}

/** One authored slide (ADR-027). A slide is its scene wiring plus a grid template and the widgets it
 *  places on it. Copy is i18n keys only (never prose). `params` seeds the scene's authored defaults on
 *  first entry (reset policy A); `forced` is an immutable override (e.g. scope:'global'). */
export interface SlideDef {
  slug: string
  scene: SceneId
  grid: GridTemplateId
  widgets: WidgetDef[]
  params?: Partial<DerivationParams>
  forced?: Partial<DerivationParams>
  /** Authored default for the client-transform `baseline` (ADR-026) — not a DerivationParam, so it
   *  seeds the scene's baseline on first entry but never refetches. */
  baseline?: number
}
