<script setup lang="ts">
import { computed } from 'vue'
import type { DomainResultDTO, GlobalResultDTO } from '../../../shared/types'
import AsyncPanel from './AsyncPanel.vue'
import MultiplierBadge from './MultiplierBadge.vue'
import TimeRangeZoom from '../controls/TimeRangeZoom.vue'
import MainStackedChart from '../charts/MainStackedChart.vue'
import GlobalStackedAreaChart from '../charts/GlobalStackedAreaChart.vue'
import { useDataStore } from '../../stores/data'
import { useViewStore } from '../../stores/view'
import { useChartContext } from '../../composables/useChartContext'
import { useReload } from '../../composables/useReload'

// The dominant chart (UI §4). Global scope → domain-stacked area; local → single-domain stacked.
// The live ×N badge sits top-right above the canvas (full mode only, UI §7). Official mode renders
// the stock layer only — the chart-option classes enforce that from the DTO shape. This panel is the
// Pinia-aware owner: it reads the DTO + chart context from the stores and passes them into the dumb
// chart components as props, and persists their `timeRange` emits back to the view store.
const { t } = useI18n()
const data = useDataStore()
const view = useViewStore()
const chartCtx = useChartContext()
const reload = useReload()

const endpoint = computed(() => (view.scope === 'global' ? 'global' : 'domain'))
const loading = computed(() => data.loading[endpoint.value])
const error = computed(() => data.errors[endpoint.value])
const hasData = computed(() => data.currentMainResult != null)
const dataYear = computed(() => data.currentMainResult?.referenceYear)

const globalResult = computed(() => data.currentMainResult as GlobalResultDTO | undefined)
const domainResult = computed(() => data.currentMainResult as DomainResultDTO | undefined)

function onTimeRange(range: [number, number] | null) {
  const cur = view.timeRange
  if (range === cur || (range && cur && range[0] === cur[0] && range[1] === cur[1])) return
  view.setTimeRange(range)
}
</script>

<template>
  <AsyncPanel
    :title="t('panel.main.title')"
    :data-year="dataYear"
    :loading="loading"
    :error="error"
    :has-data="hasData"
    @retry="reload"
  >
    <template #badge>
      <div class="main-canvas__badge">
        <TimeRangeZoom />
        <MultiplierBadge />
      </div>
    </template>
    <GlobalStackedAreaChart
      v-if="view.scope === 'global' && globalResult"
      :result="globalResult"
      :ctx="chartCtx"
      :loading="loading"
      @time-range="onTimeRange"
    />
    <MainStackedChart
      v-else-if="domainResult"
      :result="domainResult"
      :ctx="chartCtx"
      :loading="loading"
      @time-range="onTimeRange"
    />
  </AsyncPanel>
</template>

<style scoped>
.main-canvas__badge {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 0;
}
.main-canvas__badge > :last-child {
  margin-left: auto;
}
</style>
