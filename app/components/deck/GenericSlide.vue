<script setup lang="ts">
import { computed, markRaw, type Component } from 'vue'
import type { DomainResultDTO, GlobalResultDTO, ControlKey } from '../../../shared/types'
import type { RenderableSlide, RenderableViz, ChartComponentName } from '../../story/SlideFactory'
import SlideLayout from './SlideLayout.vue'
import SlideHeading from './SlideHeading.vue'
import SlideText from './SlideText.vue'
import SlideCaption from './SlideCaption.vue'
import EquivalenceStrip from '../shell/EquivalenceStrip.vue'
import MultiplierBadge from '../shell/MultiplierBadge.vue'
import LoadingSkeleton from '../state/LoadingSkeleton.vue'
import ErrorRetry from '../state/ErrorRetry.vue'
import EmptyState from '../state/EmptyState.vue'
import HorizonSelect from '../controls/HorizonSelect.vue'
import DomainSelect from '../controls/DomainSelect.vue'
import BaselineControl from '../controls/BaselineControl.vue'
import TimeRangeZoom from '../controls/TimeRangeZoom.vue'
import MainStackedChart from '../charts/MainStackedChart.vue'
import GlobalStackedAreaChart from '../charts/GlobalStackedAreaChart.vue'
import CrossingChart from '../charts/CrossingChart.vue'
import FootprintDonut from '../charts/FootprintDonut.vue'
import FossilComparisonChart from '../charts/FossilComparisonChart.vue'
import type { CrossingInput } from '../../charts/CrossingOption'
import type { StoreError } from '../../services/apiClient'
import { useDataStore } from '../../stores/data'
import { useViewStore } from '../../stores/view'
import { useChartContext } from '../../composables/useChartContext'
import { useReload } from '../../composables/useReload'

// The Pinia-aware slide renderer (tech-spec §17.2). It takes a pure `RenderableSlide` and binds it to
// live state: it mounts the scene's controls, the multiplier badge (slide 3 only), and each
// visualisation's tier-2 chart — resolving the DTO + chart context + presentation from the stores and
// keying the chart by `viz.id` so sibling slides in a scene animate in place (ADR-022). The charts
// themselves stay Pinia-unaware (ADR-013).
const props = defineProps<{ slide: RenderableSlide }>()

const data = useDataStore()
const view = useViewStore()
const chartCtx = useChartContext()
const reload = useReload()

/** The tier-2 control component for a deck control key. */
const CONTROL_COMPONENTS: Record<ControlKey, Component> = {
  horizon: markRaw(HorizonSelect),
  domain: markRaw(DomainSelect),
  baseline: markRaw(BaselineControl),
  timeRange: markRaw(TimeRangeZoom),
}
const controlComponent = (key: ControlKey): Component => CONTROL_COMPONENTS[key]

/** Scope-agnostic crossing input (the crossing scene is forced global → aggregate). */
const crossingInput = computed<CrossingInput | undefined>(() => {
  const main = data.currentMainResult
  if (!main) return undefined
  if (view.scope === 'global') {
    const g = main as GlobalResultDTO
    return { stock: g.aggregateStock, forgoneSink: g.aggregateForgoneSink, crossingYear: g.crossingYear }
  }
  const d = main as DomainResultDTO
  return { stock: d.stock, forgoneSink: d.forgoneSink, crossingYear: d.crossingYear }
})

function onTimeRange(range: [number, number] | null) {
  const cur = view.timeRange
  if (range === cur || (range && cur && range[0] === cur[0] && range[1] === cur[1])) return
  view.setTimeRange(range)
}

/** A resolved visualisation ready to mount: its component, load state and bound props. */
interface VizState {
  id: string
  is: Component
  loading: boolean
  error: StoreError | null
  ready: boolean
  props: Record<string, unknown>
  emitsTimeRange: boolean
}

const CHART_COMPONENTS: Record<ChartComponentName, Component> = {
  MainStackedChart: markRaw(MainStackedChart),
  GlobalStackedAreaChart: markRaw(GlobalStackedAreaChart),
  CrossingChart: markRaw(CrossingChart),
  FootprintDonut: markRaw(FootprintDonut),
  FossilComparisonChart: markRaw(FossilComparisonChart),
}

/** Resolve one visualisation against the live stores (DTO, load state, props). */
function resolveViz(viz: RenderableViz): VizState {
  const ctx = chartCtx.value
  const base = { id: viz.id, is: CHART_COMPONENTS[viz.component], emitsTimeRange: false }
  switch (viz.component) {
    case 'GlobalStackedAreaChart':
      return {
        ...base,
        loading: data.loading.global,
        error: data.errors.global,
        ready: data.currentMainResult != null,
        props: { result: data.currentMainResult, ctx, presentation: viz.presentation },
        emitsTimeRange: true,
      }
    case 'MainStackedChart':
      return {
        ...base,
        loading: data.loading.domain,
        error: data.errors.domain,
        ready: data.currentMainResult != null,
        props: { result: data.currentMainResult, ctx, presentation: viz.presentation },
        emitsTimeRange: true,
      }
    case 'CrossingChart':
      return {
        ...base,
        loading: data.loading.global,
        error: data.errors.global,
        ready: crossingInput.value != null,
        props: { input: crossingInput.value, ctx },
      }
    case 'FootprintDonut':
      return {
        ...base,
        loading: data.loading.reference || data.loading.global,
        error: data.errors.reference || data.errors.global,
        ready: data.currentReference != null && data.currentMainResult != null,
        props: {
          reference: data.currentReference,
          main: data.currentMainResult,
          ctx,
          presentation: viz.presentation,
        },
      }
    case 'FossilComparisonChart':
      return {
        ...base,
        loading: data.loading.reference || data.loading.global,
        error: data.errors.reference || data.errors.global,
        ready: data.currentReference != null && data.currentMainResult != null,
        props: {
          reference: data.currentReference,
          main: data.currentMainResult,
          ctx,
          presentation: viz.presentation,
        },
      }
  }
}

const visualStates = computed<VizState[]>(() => props.slide.visuals.map(resolveViz))
</script>

<template>
  <SlideLayout :preset="slide.layout">
    <template v-if="slide.captionKey" #caption>
      <SlideCaption :caption-key="slide.captionKey" />
    </template>

    <template v-if="slide.controls.length" #controls>
      <component :is="controlComponent(control.key)" v-for="control in slide.controls" :key="control.key" />
    </template>

    <template v-if="slide.showMultiplier" #badge>
      <MultiplierBadge />
    </template>

    <template v-if="visualStates.length" #viz>
      <div v-for="v in visualStates" :key="v.id" class="slide-viz">
        <ErrorRetry v-if="v.error" :error="v.error" @retry="reload" />
        <LoadingSkeleton v-else-if="v.loading && !v.ready" />
        <component
          :is="v.is"
          v-else-if="v.ready"
          v-bind="v.props"
          :loading="v.loading"
          @time-range="v.emitsTimeRange ? onTimeRange($event) : undefined"
        />
        <EmptyState v-else />
      </div>
    </template>

    <template v-if="slide.layout === 'duo-viz-equiv'" #equivalence>
      <EquivalenceStrip />
    </template>

    <template v-if="slide.headingKey" #heading>
      <SlideHeading :heading-key="slide.headingKey" />
    </template>
    <template v-if="slide.textKeys.length" #text>
      <SlideText :text-keys="slide.textKeys" />
    </template>
  </SlideLayout>
</template>

<style scoped>
.slide-viz {
  display: flex;
  flex-direction: column;
  min-height: 360px;
}
</style>
