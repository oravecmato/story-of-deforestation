// Theme tokens shared between PrimeVue Aura dark chrome and the ECharts palette (tech-spec §13,
// design §2). One source of truth; `BaseChartOption.themeColors()` maps these to ECharts. Concrete
// values live in `app.config.ts`; charts receive them via `ChartContext.theme`.
export interface ThemeTokens {
  /** app backdrop */
  bg: string
  /** panels, canvas card */
  surface1: string
  /** raised controls, tooltip, popovers */
  surface2: string
  /** control outlines, focus track (border.strong) */
  border: string
  /** headings/hi, body/mid, captions/low */
  text: { hi: string; mid: string; low: string }
  /** focus ring, active toggle, links, crossing marker */
  accent: string
  /** data-layer colors only — never UI state (design §2): measured stock, derived forgone sink,
   *  fossil reference denominator, and the combined-total figure (red-adjacent, distinct from
   *  `negative` — design §2.3a, ADR-025). */
  data: { stock: string; forgoneSink: string; fossil: string; total: string }
  /** translucent band alpha for the forgone-sink CI */
  bandOpacity: number
  /** error red — negative crossings / data gaps (no separate warn/success in V1) */
  negative: string
}
