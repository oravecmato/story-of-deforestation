<script setup lang="ts">
import { computed, markRaw, ref, watch, type Component } from 'vue'
import type { ControlKey } from '#shared/types'
import type { RenderableWidget, ChartComponentName } from '../../story/SlideFactory'
import TextWidget from './TextWidget.vue'
import EquivalenceStrip from '../shell/EquivalenceStrip.vue'
import MultiplierBadge from '../shell/MultiplierBadge.vue'
import LoadingSkeleton from '../state/LoadingSkeleton.vue'
import ErrorRetry from '../state/ErrorRetry.vue'
import EmptyState from '../state/EmptyState.vue'
import HorizonSelect from '../controls/HorizonSelect.vue'
import BaselineControl from '../controls/BaselineControl.vue'
import BaselineSlider from '../controls/BaselineSlider.vue'
import RMultiplierControl from '../controls/RMultiplierControl.vue'
import GlobalStackedAreaChart from '../charts/GlobalStackedAreaChart.vue'
import CrossingChart from '../charts/CrossingChart.vue'
import FootprintDonut from '../charts/FootprintDonut.vue'
import FossilComparisonChart from '../charts/FossilComparisonChart.vue'
import FluxBarChart from '../charts/FluxBarChart.vue'
import type { CrossingInput } from '../../charts/CrossingOption'
import type { StoreError } from '../../services/apiClient'
import { deriveStripValues, toUnit, type StripCell, type UnitBasis, type UnitIcon } from '../../story/equivalenceStrip'
import { EQUIVALENCE_CONFIG, resolveReferenceCountry } from '#shared/config/equivalences'
import { useDataStore } from '../../stores/data'
import { useViewStore } from '../../stores/view'
import { useUiStore } from '../../stores/ui'
import { useChartContext } from '../../composables/useChartContext'
import { useFormatter } from '../../composables/useFormatter'
import { useReload } from '../../composables/useReload'

// The widget renderer (tech-spec §17.2, ADR-027): the ONE Pinia-aware seam of the deck. It dispatches a
// pure `RenderableWidget` to its concrete leaf and binds live state — a viz's DTO + chart context +
// presentation, the scene's controls, the multiplier badge, the equivalence strip. The leaves stay
// Pinia-unaware (charts are dumb by ADR-013); geometry is the caller's concern (this component knows
// nothing about where it sits on the grid). Sibling slides in a scene reuse a widget's `id`, so the
// parent keys by it and the viz's `<VChart>` animates in place across a scene's slides (ADR-022).
const props = defineProps<{ widget: RenderableWidget }>()

const { t } = useI18n()
const data = useDataStore()
const view = useViewStore()
const ui = useUiStore()
const chartCtx = useChartContext()
const formatter = useFormatter()
const reload = useReload()

/** The tier-2 control component for a deck control key. */
const CONTROL_COMPONENTS: Record<ControlKey, Component> = {
  horizon: markRaw(HorizonSelect),
  baseline: markRaw(BaselineControl),
  baselineSlider: markRaw(BaselineSlider),
  rMultiplier: markRaw(RMultiplierControl),
}

const CHART_COMPONENTS: Record<ChartComponentName, Component> = {
  GlobalStackedAreaChart: markRaw(GlobalStackedAreaChart),
  CrossingChart: markRaw(CrossingChart),
  FootprintDonut: markRaw(FootprintDonut),
  FossilComparisonChart: markRaw(FossilComparisonChart),
  FluxBarChart: markRaw(FluxBarChart),
}

// The coarse `baseline` control is a settings menu pinned to the bar's right edge; every other control
// stays inline on the left. Split here since a controls widget owns its own row arrangement.
const inlineControls = computed(() =>
  props.widget.type === 'controls' ? props.widget.controls.filter((c) => c.key !== 'baseline') : [],
)
const settingsControls = computed(() =>
  props.widget.type === 'controls' ? props.widget.controls.filter((c) => c.key === 'baseline') : [],
)

/** The global crossing input (aggregate). The forgone sink + crossing year are baseline-derived
 *  (ADR-026); the stock curve is the baseline-independent DTO. */
const crossingInput = computed<CrossingInput | undefined>(() => {
  const main = data.currentMainResult
  const derived = data.currentDerived
  if (!main || !derived) return undefined
  return {
    stock: main.aggregateStock,
    forgoneSink: derived.aggregateForgoneSink,
    crossingYear: derived.crossingYear,
  }
})

/** The ×N badge value, resolved from the live baseline-independent DTO (ADR-019/026). A null value
 *  collapses the badge to nothing; the window caption is printed by the badge's own `WindowLabel`. */
const multiplierState = computed(() => ({ value: data.multiplier ?? null }))

/** The equivalence strip state (§17.4): the four magnitudes reduced from the global DTO over the
 *  forward window, each formatted into a presentation-ready `StripCell` in the active unit. The strip
 *  leaf renders these; all store reads + derivation stay here in the widget seam (ADR-027). */
const equivalenceState = computed(() => {
  const title = t('panel.equivalence.title')
  const loading = data.loading.global
  const error = data.errors.global
  const global = data.currentMainResult
  const derived = data.currentDerived
  if (!global || !derived) return { title, cells: [] as StripCell[], loading, error }

  const values = deriveStripValues(global, derived.aggregateForgoneSink, view.horizon)
  const basis: UnitBasis = {
    carAnnualTonsCO2: EQUIVALENCE_CONFIG.carAnnualTonsCO2,
    countryAnnualMt: data.currentEquivalence?.referenceCountryAnnualCO2 ?? null,
  }
  const referenceCountry = resolveReferenceCountry(ui.locale)
  const unit = view.unit
  const prefix = unit === 'mtco2' ? '' : '≈'
  // The derived units are wordless in the strip — a pictogram alone (car glyph, or "×" + country flag);
  // their full meaning lives in the UnitSelect trigger. Only the raw Mt CO₂ unit carries a text label.
  const unitSuffix = unit === 'mtco2' ? t('unit.mtco2') : ''
  const unitIcon: UnitIcon | undefined =
    unit === 'mtco2' ? undefined : unit === 'car' ? 'car' : referenceCountry.iso3 === 'SVK' ? 'sk' : 'gb'
  const fmt = (valueMt: number) => formatter.format(toUnit(valueMt, unit, basis))

  const cells: StripCell[] = [
    { key: 'stockPeriod', color: ui.theme.data.stock, prefix, value: fmt(values.stockPeriod), unit: unitSuffix, unitIcon, caption: t('equivalenceStrip.stockPeriod') },
    { key: 'forgoneAnnual', color: ui.theme.data.forgoneSink, prefix, value: fmt(values.forgoneAnnual), unit: unitSuffix, unitIcon, caption: t('equivalenceStrip.forgoneAnnual') },
    { key: 'forgonePeriod', color: ui.theme.data.forgoneSink, prefix, value: fmt(values.forgonePeriod), unit: unitSuffix, unitIcon, caption: t('equivalenceStrip.forgonePeriod') },
    { key: 'combinedPeriod', color: ui.theme.data.total, prefix, value: fmt(values.combinedPeriod), unit: unitSuffix, unitIcon, caption: t('equivalenceStrip.combinedPeriod') },
  ]
  return { title, cells, loading, error }
})

/** A resolved visualisation ready to mount: its component, load state and bound props. */
interface VizState {
  is: Component
  loading: boolean
  error: StoreError | null
  ready: boolean
  props: Record<string, unknown>
}

/** Bind a viz widget against the live stores (DTO, load state, props). */
const vizState = computed<VizState | null>(() => {
  if (props.widget.type !== 'viz') return null
  const ctx = chartCtx.value
  const is = CHART_COMPONENTS[props.widget.component]
  const presentation = props.widget.presentation
  switch (props.widget.component) {
    case 'GlobalStackedAreaChart':
      return {
        is,
        loading: data.loading.global,
        error: data.errors.global,
        ready: data.currentMainResult != null && data.currentDerived != null,
        props: { result: data.currentMainResult, derived: data.currentDerived, ctx, presentation },
      }
    case 'CrossingChart':
      return {
        is,
        loading: data.loading.global,
        error: data.errors.global,
        ready: crossingInput.value != null,
        props: { input: crossingInput.value, ctx },
      }
    case 'FootprintDonut':
    case 'FossilComparisonChart':
      return {
        is,
        loading: data.loading.reference || data.loading.global,
        error: data.errors.reference || data.errors.global,
        ready:
          data.currentReference != null &&
          data.currentMainResult != null &&
          data.currentDerived != null,
        props: {
          reference: data.currentReference,
          main: data.currentMainResult,
          derived: data.currentDerived,
          ctx,
          presentation,
        },
      }
    case 'FluxBarChart':
      // Editorial illustration (slide 8): no DTO, no load state — always ready, only the chart context.
      return { is, loading: false, error: null, ready: true, props: { ctx } }
  }
  return null
})

// The last viz state whose data was ready. Once a chart has rendered we keep this snapshot so a
// subsequent refetch (switching horizon/baseline) does NOT tear the chart down to a skeleton: we keep
// the SAME component mounted with its previous props, and swap to the fresh props only when they
// arrive — so the option change animates in place (setOption, ADR-022) instead of remounting cold. The
// DTO objects referenced here stay valid because the store cache retains prior entries.
const lastReady = ref<VizState | null>(null)
watch(
  vizState,
  (s) => {
    if (s?.ready) lastReady.value = s
  },
  { immediate: true },
)

/** What the viz slot actually renders: the current state once its data is ready, otherwise the last
 *  ready snapshot (kept on screen through a refetch). Null only before the very first successful load. */
const displayed = computed<VizState | null>(() =>
  vizState.value?.ready ? vizState.value : lastReady.value,
)

/** A refetch is in flight while a chart is already on screen → show a veil over the live chart instead
 *  of a skeleton, and make the viz non-interactive for its duration (no cold skeleton on horizon switch). */
const refetching = computed(
  () => displayed.value != null && !!vizState.value?.loading && !vizState.value.ready,
)
</script>

<template>
  <TextWidget
    v-if="widget.type === 'text'"
    :heading-key="widget.headingKey"
    :caption-key="widget.captionKey"
    :text-keys="widget.textKeys"
  />

  <div v-else-if="widget.type === 'controls'" class="widget-controls">
    <div class="widget-controls__inline">
      <component
        :is="CONTROL_COMPONENTS[control.key]"
        v-for="control in inlineControls"
        :key="control.key"
      />
    </div>
    <div v-if="settingsControls.length" class="widget-controls__settings">
      <component :is="CONTROL_COMPONENTS[control.key]" v-for="control in settingsControls" :key="control.key" />
    </div>
  </div>

  <MultiplierBadge v-else-if="widget.type === 'multiplier'" :value="multiplierState.value" />

  <EquivalenceStrip
    v-else-if="widget.type === 'equivalence'"
    :layout="widget.orientation"
    :title="equivalenceState.title"
    :cells="equivalenceState.cells"
    :loading="equivalenceState.loading"
    :error="equivalenceState.error"
    @retry="reload"
  />

  <div v-else-if="widget.type === 'viz' && vizState" class="widget-viz">
    <!-- Once a chart exists, keep it mounted through refetches (animates in place); a veil covers it
         and blocks interaction while new data loads. The skeleton is only for the first-ever load. -->
    <template v-if="displayed">
      <component
        :is="displayed.is"
        v-bind="displayed.props"
        :class="{ 'widget-viz__chart--busy': refetching }"
      />
      <div v-if="refetching" class="widget-viz__veil" aria-hidden="true" />
      <div v-if="vizState.error" class="widget-viz__error-overlay">
        <ErrorRetry :error="vizState.error" @retry="reload" />
      </div>
    </template>
    <ErrorRetry v-else-if="vizState.error" :error="vizState.error" @retry="reload" />
    <LoadingSkeleton v-else-if="vizState.loading" />
    <EmptyState v-else />
  </div>
</template>

<style scoped lang="scss">
.widget-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 40px;
  width: 100%;
}
.widget-controls__inline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
/* The settings menu (baseline) pins to the far right of the bar. */
.widget-controls__settings {
  margin-left: auto;
}
.widget-viz {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
/* On mobile the grid rows are `auto`, so give the first-load skeleton a floor to fill (matches the
   chart's intrinsic min-height); on desktop the viz cell already has a definite height. */
@include mobile {
  .widget-viz {
    min-height: 240px;
  }
}
/* Refetch (e.g. horizon switch): the live chart stays mounted but is frozen out of interaction while
   the veil is up, so hovers/tooltips don't act on data that is about to change. */
.widget-viz__chart--busy {
  pointer-events: none;
}
/* Loading veil over a live chart during a refetch — a light blur + darken, purely visual (it never
   swallows pointer events; the chart underneath is already inert via --busy). */
.widget-viz__veil {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: rgba(13, 17, 23, 0.4);
  backdrop-filter: blur(2px);
  border-radius: 10px;
  transition: opacity 120ms ease;
}
/* A failed refetch keeps the stale chart but surfaces the retry over it. */
.widget-viz__error-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(13, 17, 23, 0.72);
  border-radius: 10px;
}
/* The viz-shrink contract (the generic half of the fixed-height fit — SlideLayout owns the geometry).
   On desktop a slide is bound to one screen and its viz rows are `minmax(0, 1fr)`, so the chart must be
   allowed to follow its cell down to any size: drop the base wrapper's intrinsic min-height so it never
   forces the row taller than the grid track. On mobile the rows are `auto` and the chart keeps its own
   min-height (a sensible intrinsic size) as the page flows naturally. */
@include desktop {
  .widget-viz :deep(.base-chart) {
    min-height: 0;
  }
}
</style>
