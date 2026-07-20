import { computed, type ComputedRef } from 'vue'
import type { ChartContext } from '../charts/BaseChartOption'
import { useUiStore } from '../stores/ui'
import { useViewStore } from '../stores/view'
import { useFormatter } from './useFormatter'

// Chart context provider (tech-spec §11.3): the ONE Pinia-aware seam that assembles the injection
// bundle (i18n `t`, theme, formatter, breakpoint + the current horizon/baseline/rScenario) for the
// pure chart-option classes. Parent panels call this and pass the resulting `ctx` down to the dumb
// chart components as a prop, so the chart components themselves stay Pinia-unaware (ADR-007/013).
export function useChartContext(): ComputedRef<ChartContext> {
  const ui = useUiStore()
  const view = useViewStore()
  const formatter = useFormatter()
  const { t } = useI18n()

  return computed(() => ({
    t,
    theme: ui.theme,
    formatter,
    breakpoint: ui.breakpoint,
    horizon: view.horizon,
    baseline: view.baseline,
    rScenario: view.rScenario,
  }))
}
