import { THEME_TOKENS } from '../shared/config/theme'

// Theme tokens (design §2, tech-spec §13). PrimeVue Aura dark consumes these for chrome; the
// chart-option base maps the same tokens to the ECharts palette, so charts and app chrome share
// one dark-mode-correct source. Fixed dark in V1 (no light toggle, ADR-002). Must live under the
// srcDir (`app/`, future.compatibilityVersion 4) for Nuxt to merge it into useAppConfig().
export default defineAppConfig({ theme: THEME_TOKENS })
