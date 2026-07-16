import { definePreset, palette } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import { THEME_TOKENS as t } from '../../shared/config/theme'

// PrimeVue v4 preset (tech-spec §13, design §2): Aura restyled so the chrome shares the app's
// ThemeTokens. `primary` is a ramp generated from the accent token; the dark surface ramp is pinned
// to the bg/surface/border tokens so panels, controls and popovers match the ECharts panels exactly.
// Forced dark in V1 (ADR-002) via a stable `.app-dark` selector on <html> (set in nuxt.config).
export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: palette(t.accent),
  },
  components: {
    // The time-horizon selector is the signature pill (design §6); everything else stays quiet, so no
    // per-component overrides beyond the surface/primary ramps are needed in V1.
  },
  colorScheme: {
    dark: {
      primary: {
        color: t.accent,
        contrastColor: t.bg,
        hoverColor: t.accent,
        activeColor: t.accent,
      },
      surface: {
        0: '#ffffff',
        50: t.text.hi,
        100: t.text.mid,
        200: t.text.mid,
        300: t.text.low,
        400: t.text.low,
        500: t.border,
        600: t.border,
        700: t.border,
        800: t.surface2,
        900: t.surface1,
        950: t.bg,
      },
    },
  },
})
