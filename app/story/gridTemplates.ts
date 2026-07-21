import type { GridTemplateId } from '#shared/types'

// The named grid-template library (ADR-027, design §5). Each template is pure geometry: the CSS grid
// columns/rows and the `grid-template-areas` map a slide's widgets are placed into (a widget's `area`
// field names one cell/region). `SlideLayout` applies these via CSS custom properties and swaps to the
// `mobile` variant below the duo breakpoint — no template fork, so a widget keyed by `id` survives a
// slide→slide grid change and its chart only `setOption`-animates (chart-identity contract, ADR-022).
//
// AREA VOCABULARY (stable across templates so a shared widget keeps its area 5→6): `text` (the one
// generic text block — heading+caption+body rendered as a single centred unit) · `caption` (a thin
// top line where the text block is caption-only, slides 6/7) · `controls` · `badge` (the multiplier) ·
// `viz-a` / `viz-b` (the one or two vizzes) · `equiv` (the equivalence strip). A slide only fills the
// areas its widgets declare; unused cells collapse empty.

export interface GridTemplate {
  columns: string
  rows: string
  /** `grid-template-areas` value (quoted rows). */
  areas: string
  /** The narrow-viewport variant applied below the duo breakpoint (single column). */
  mobile: {
    columns: string
    rows: string
    areas: string
  }
}

/** Two side-by-side viz cells collapse to a single stacked column on narrow viewports. */
const DUO_MOBILE_COLS = 'minmax(0, 1fr)'

export const GRID_TEMPLATES: Record<GridTemplateId, GridTemplate> = {
  // Pure-text intro: one centred text block, no stage or controls (the `1fr` row gives it the whole
  // slide to centre within).
  text: {
    columns: 'minmax(0, 1fr)',
    rows: 'minmax(0, 1fr)',
    areas: '"text"',
    mobile: {
      columns: 'minmax(0, 1fr)',
      rows: 'auto',
      areas: '"text"',
    },
  },

  // A quiet controls row (controls left, multiplier badge right) + one viz above the full-width copy.
  'viz-text': {
    columns: 'minmax(0, 1fr) auto',
    rows: 'auto minmax(0, 1fr) auto',
    areas: '"controls badge" "viz-a viz-a" "text text"',
    mobile: {
      columns: 'minmax(0, 1fr) auto',
      rows: 'auto 1fr auto',
      areas: '"controls badge" "viz-a viz-a" "text text"',
    },
  },

  // Text block on the left, a single viz on the right (slide 8): both fill the full-height row so each
  // centres in its half. Stacks to text-then-viz on narrow viewports.
  'text-viz': {
    columns: 'minmax(0, 1fr) minmax(0, 1fr)',
    rows: 'minmax(0, 1fr)',
    areas: '"text viz-a"',
    mobile: {
      columns: 'minmax(0, 1fr)',
      rows: 'auto auto',
      areas: '"text" "viz-a"',
    },
  },

  // Two side-by-side vizzes above the copy (stacked on narrow viewports).
  'duo-viz-text': {
    columns: 'minmax(0, 1fr) minmax(0, 1fr)',
    rows: 'auto minmax(0, 1fr) auto',
    areas: '"controls controls" "viz-a viz-b" "text text"',
    mobile: {
      columns: DUO_MOBILE_COLS,
      rows: 'auto auto auto auto',
      areas: '"controls" "viz-a" "viz-b" "text"',
    },
  },

  // Caption on top · controls · duo viz · full-width equivalence strip at the foot. No bottom copy
  // (slide 6, ADR-025).
  'duo-viz-equiv': {
    columns: 'minmax(0, 1fr) minmax(0, 1fr)',
    rows: 'auto auto minmax(0, 1fr) auto',
    areas: '"caption caption" "controls controls" "viz-a viz-b" "equiv equiv"',
    mobile: {
      columns: DUO_MOBILE_COLS,
      rows: 'auto auto auto auto auto',
      areas: '"caption" "controls" "viz-a" "viz-b" "equiv"',
    },
  },

  // The ADR-026 baseline lab (slide 7): caption + controls + two vizzes STACKED in a 3/4-width main
  // column, with a full-height equivalence strip in a quarter-width right column.
  lab: {
    columns: 'minmax(0, 3fr) minmax(0, 1fr)',
    rows: 'auto auto minmax(0, 1fr) minmax(0, 1fr)',
    areas: '"caption equiv" "controls equiv" "viz-a equiv" "viz-b equiv"',
    mobile: {
      columns: DUO_MOBILE_COLS,
      rows: 'auto auto auto auto auto',
      areas: '"caption" "controls" "viz-a" "viz-b" "equiv"',
    },
  },
}
