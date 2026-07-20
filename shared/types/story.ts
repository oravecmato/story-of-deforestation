import type { DerivationParams } from './params'

// Story-deck presentation types (tech-spec §17.1, ADR-021/024). This is a FRONTEND-ONLY layer: it
// adds no server route, DTO or param. A `SlideDef[]` is authored config; a `VizConfig.metrics` set is
// a client-side presentation transform over a DTO the store already holds (never a refetch).

/** The five scenes. Sibling slides in a scene share params + chart instances (in-place animation).
 *  `baseline` is the ADR-026 baseline-manipulation scene (slider slide + its crossing/equivalence
 *  sibling). */
export type SceneId = 'intro' | 'main' | 'crossing' | 'footprint' | 'baseline'

/** The closed layout presets (tech-spec §11/§17, ADR-024/025/026). Text sits BELOW the
 *  visualisation(s); `duo-viz-equiv` (slide 6) instead carries a thin caption ON TOP, drops the text
 *  block, and adds a full-width equivalence strip below the duo viz. The ADR-026 baseline scene uses
 *  `lab`: a caption ON TOP, the controls row, two vizzes stacked in the main column, and a full-height
 *  equivalence strip aside (a quarter-width right column), no bottom copy. */
export type LayoutPreset = 'text' | 'viz-text' | 'duo-viz-text' | 'duo-viz-equiv' | 'lab'

/** The unit the slide-6 equivalence strip renders all four figures in (ADR-025, §17.4). Pure client
 *  view state (no refetch, not in the URL); `country` is locale-driven (SVK/UK). Default `car`. */
export type EquivalenceUnit = 'mtco2' | 'car' | 'country'

/** Which chart-option class / tier-2 component a visualisation uses. `mainStacked` resolves to the
 *  global stacked-area or the single-domain stack depending on the scene's scope (business §6.1). */
export type VizKind =
  | 'mainStacked'
  | 'globalStackedArea'
  | 'crossing'
  | 'donut'
  | 'fossilComparison'

/** Controls a slide may surface (subset of its scene's controls). `baseline` and `baselineSlider` are
 *  client-only (no refetch — both baseline controls are the ADR-026 client-transform, `baselineSlider`
 *  extending the range back to `BASELINE_FLOOR`); `horizon`/`domain` are part of `DerivationParams` and
 *  refetch (ADR-021). */
export type ControlKey = 'horizon' | 'domain' | 'baseline' | 'baselineSlider'

/** Whether a control mutates `DerivationParams` (server-refetch) or is pure view state (client-only,
 *  since ADR-026 — the `baseline` controls). */
export type DerivationMode = 'server-refetch' | 'client-only'

/** A single visualisation on a slide. `id` is the STABLE chart identity SHARED across a scene's slides
 *  (ADR-022) so the 2→3 / 5→6 reveals animate in place. `metrics` is the presentation transform. */
export interface VizConfig {
  id: string
  kind: VizKind
  metrics: string[]
}

/** The presentation transform handed to a chart-option class: the DTO-metric subset to render. An
 *  empty set means "the option's default full metric set" (tech-spec §11.1). */
export interface VizPresentation {
  metrics: string[]
}

/** One authored slide. Copy is i18n keys only (never prose). `params` seeds the scene's authored
 *  defaults on first entry (reset policy A); `forced` is an immutable override (e.g. scope:'global'). */
export interface SlideDef {
  slug: string
  scene: SceneId
  layout: LayoutPreset
  headingKey?: string
  /** A single localized line rendered ON TOP by the `duo-viz-equiv` preset in place of the text
   *  block (slide 6, ADR-025). Ignored by the other presets. */
  captionKey?: string
  textKeys: string[]
  visualizations: VizConfig[]
  controls?: ControlKey[]
  params?: Partial<DerivationParams>
  forced?: Partial<DerivationParams>
  /** Authored default for the client-transform `baseline` (ADR-026) — not a DerivationParam, so it
   *  seeds the scene's baseline on first entry but never refetches. */
  baseline?: number
}
