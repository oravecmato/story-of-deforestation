<script setup lang="ts">
import { ref } from 'vue'
import type { EChartsOption } from 'echarts'
import type { ThemeTokens } from '../../../shared/types'

// Tier-1 dumb chart wrapper (tech-spec §11.4): a client-only <VChart> with autoresize; no domain
// logic. Options are built by the chart-option classes and passed in as props. <VChart> (nuxt-echarts)
// and <ClientOnly> are auto-registered by Nuxt. When the embedded dataZoom moves it emits the resulting
// [startYear, endYear] timeRange (null once fully zoomed out) so the owning chart can bubble it up to
// the view store — the option's start/endValue then reseed the selection across rebuilds (horizon/R
// toggles) without a refetch or crop (ADR-005).
withDefaults(
  defineProps<{
    option: EChartsOption
    loading?: boolean
    theme?: ThemeTokens
  }>(),
  { loading: false, theme: undefined },
)

const emit = defineEmits<{ timeRange: [range: [number, number] | null] }>()

type DataZoomState = { start?: number; end?: number; startValue?: number; endValue?: number }
const chartRef = ref<{ getOption: () => { dataZoom?: DataZoomState[] } } | null>(null)

const yearOf = (ms: number) => new Date(ms).getUTCFullYear()

function onDatazoom() {
  const dz = chartRef.value?.getOption().dataZoom?.[0]
  if (!dz) return
  const { start, end, startValue, endValue } = dz
  // Fully zoomed out (covers the whole extent) → clear the timeRange so it isn't pinned to the edges.
  if ((start == null || start <= 0) && (end == null || end >= 100)) {
    emit('timeRange', null)
    return
  }
  if (startValue == null || endValue == null) return
  emit('timeRange', [yearOf(startValue), yearOf(endValue)])
}
</script>

<template>
  <div class="base-chart" :style="theme ? { backgroundColor: 'transparent', color: theme.text.mid } : undefined">
    <ClientOnly>
      <VChart ref="chartRef" :option="option" :loading="loading" autoresize @datazoom="onDatazoom" />
      <template #fallback>
        <div class="base-chart__placeholder" aria-hidden="true" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.base-chart {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 240px;
}
/* vue-echarts renders <x-vue-echarts class="echarts"> with no intrinsic height; a child height:100%
   can't resolve against our min-height-only box, so ECharts would init at 0px and draw nothing.
   Flex-filling gives it a measurable non-zero height (autoresize handles later size changes). */
.base-chart :deep(.echarts) {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}
.base-chart__placeholder {
  flex: 1 1 auto;
  width: 100%;
}
</style>
