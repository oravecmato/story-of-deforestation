import { defineStore } from 'pinia'
import type { ThemeTokens } from '../../shared/types'

// UI store (tech-spec §10.3): locale, theme, presentation. V1 is fixed dark (ADR-002), so theme is
// not a toggle yet. `locale` is the single source of truth for the language and drives the
// locale-dependent equivalence reference country reactively (business §4.4) — no data refetch on
// language change. Kept in sync with @nuxtjs/i18n in Layer 8; the Formatter binding lands in Layer 7.

export type Locale = 'en' | 'sk'
export type Breakpoint = 'sm' | 'md' | 'lg'

export const useUiStore = defineStore('ui', {
  state: () => ({
    locale: 'en' as Locale,
    breakpoint: 'lg' as Breakpoint,
  }),
  getters: {
    // Active theme tokens (§10.3, §13). Fixed dark in V1, sourced from app.config so the chrome and
    // the ECharts palette share one definition. The chart-option factory reads this via `ui.theme`.
    theme: (): ThemeTokens => useAppConfig().theme as ThemeTokens,
  },
  actions: {
    setLocale(locale: Locale) {
      this.locale = locale
    },
    setBreakpoint(bp: Breakpoint) {
      this.breakpoint = bp
    },
  },
})
