<script setup lang="ts">
import { computed } from 'vue'
import type { DomainResultDTO, GlobalResultDTO } from '../../../shared/types'
import AsyncPanel from './AsyncPanel.vue'
import FootprintDonut from '../charts/FootprintDonut.vue'
import FossilComparisonChart from '../charts/FossilComparisonChart.vue'
import CrossingChart from '../charts/CrossingChart.vue'
import type { CrossingInput } from '../../charts/CrossingOption'
import { useDataStore } from '../../stores/data'
import { useViewStore } from '../../stores/view'
import { useChartContext } from '../../composables/useChartContext'
import { useFormatter } from '../../composables/useFormatter'
import { useReload } from '../../composables/useReload'

// Secondary magnitude panels (UI §5), rendered per the mode matrix (UI §8, ADR-019 — single accounting):
//  - Share-of-footprint donut + share %  → global.
//  - Deforestation vs fossil (shared Y)  → global.
//  - Stock × forgone-sink crossing       → both scopes.
// Panels that don't apply are hidden entirely (not greyed), keeping the composer clean. This panel is
// the Pinia-aware owner: it reads the DTOs + chart context from the stores and passes them into the
// dumb chart components as props (the charts themselves never touch Pinia).
const { t } = useI18n()
const data = useDataStore()
const view = useViewStore()
const chartCtx = useChartContext()
const formatter = useFormatter()
const reload = useReload()

const isGlobal = computed(() => view.scope === 'global')
const mainEndpoint = computed(() => (isGlobal.value ? 'global' : 'domain'))

const reference = computed(() => data.currentReference)
const globalResult = computed(() => data.currentMainResult as GlobalResultDTO | undefined)
const share = computed(() => reference.value?.sharePercent ?? null)

/** Scope-agnostic crossing input: global aggregates its stock/forgone sink, local uses the domain's
 *  own — so CrossingChart never sees a scope-specific DTO shape. */
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
</script>

<template>
  <div class="magnitude-panels">
    <!-- Share-of-footprint donut (global, always) -->
    <AsyncPanel
      v-if="isGlobal"
      :title="t('panel.donut.title')"
      :data-year="reference?.referenceYear"
      :loading="data.loading.reference"
      :error="data.errors.reference"
      :has-data="reference != null"
      @retry="reload"
    >
      <FootprintDonut
        v-if="reference && globalResult"
        :reference="reference"
        :main="globalResult"
        :ctx="chartCtx"
        :loading="data.loading.reference"
      />
      <p v-if="share != null" class="share-readout">
        <span class="share-readout__label">{{ t('share.label') }}</span>
        <span class="share-readout__value tabular">{{
          t('share.value', { value: `${formatter.format(share)}%` })
        }}</span>
      </p>
    </AsyncPanel>

    <!-- Deforestation vs fossil, shared Y-scale (global) -->
    <AsyncPanel
      v-if="isGlobal"
      :title="t('panel.fossil.title')"
      :data-year="reference?.referenceYear"
      :loading="data.loading.reference || data.loading.global"
      :error="data.errors.reference || data.errors.global"
      :has-data="reference != null && globalResult != null"
      @retry="reload"
    >
      <FossilComparisonChart
        v-if="reference && globalResult"
        :reference="reference"
        :main="globalResult"
        :ctx="chartCtx"
        :loading="data.loading.reference || data.loading.global"
      />
    </AsyncPanel>

    <!-- Stock × forgone-sink crossing (both scopes) -->
    <AsyncPanel
      :title="t('panel.crossing.title')"
      :data-year="data.currentMainResult?.referenceYear"
      :loading="data.loading[mainEndpoint]"
      :error="data.errors[mainEndpoint]"
      :has-data="crossingInput != null"
      @retry="reload"
    >
      <CrossingChart
        v-if="crossingInput"
        :input="crossingInput"
        :ctx="chartCtx"
        :loading="data.loading[mainEndpoint]"
      />
    </AsyncPanel>
  </div>
</template>

<style scoped>
.magnitude-panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}
.share-readout {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 0 0;
}
.share-readout__label {
  color: var(--c-text-mid);
  font-size: 13px;
}
.share-readout__value {
  color: var(--c-text-hi);
  font-weight: 500;
}
</style>
