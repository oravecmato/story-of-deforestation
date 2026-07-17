import type { ThemeTokens } from '../types'

// Single source for the V1 dark theme (design §2, tech-spec §13). Both `app.config.ts` (→ ECharts
// palette via the chart-option base) and the PrimeVue Aura preset consume this, so chrome and charts
// stay one dark-mode-correct definition. Fixed dark in V1 (no light toggle, ADR-002).
export const THEME_TOKENS: ThemeTokens = {
  bg: '#0D1117',
  surface1: '#161B22',
  surface2: '#1C232D',
  border: '#2A313B',
  text: { hi: '#E8ECF2', mid: '#A7B0BD', low: '#6E7681' },
  accent: '#3FB6A8',
  data: { stock: '#5FBE6E', forgoneSink: '#E8A13A', fossil: '#5B6B7F', total: '#CE5B4E' },
  bandOpacity: 0.18,
  negative: '#E5534B',
}
