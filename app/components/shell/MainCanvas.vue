<script setup lang="ts">
import { computed } from 'vue'
import type {
  DomainResultDTO,
  GlobalResultDTO,
  DomainDerived,
  GlobalDerived,
} from '../../../shared/types'
import AsyncPanel from './AsyncPanel.vue'
import MultiplierBadge from './MultiplierBadge.vue'
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
// chart components as props.
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
const globalDerived = computed(() => data.currentDerived as GlobalDerived | undefined)
const domainDerived = computed(() => data.currentDerived as DomainDerived | undefined)
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
        <MultiplierBadge />
      </div>
    </template>
    <GlobalStackedAreaChart
      v-if="view.scope === 'global' && globalResult && globalDerived"
      :result="globalResult"
      :derived="globalDerived"
      :ctx="chartCtx"
      :loading="loading"
    />
    <MainStackedChart
      v-else-if="domainResult && domainDerived"
      :result="domainResult"
      :derived="domainDerived"
      :ctx="chartCtx"
      :loading="loading"
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
