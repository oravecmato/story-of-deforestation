<script setup lang="ts">
import { computed } from 'vue'
import PanelCard from './PanelCard.vue'
import LoadingSkeleton from '../state/LoadingSkeleton.vue'
import EmptyState from '../state/EmptyState.vue'
import ErrorRetry from '../state/ErrorRetry.vue'
import { useDataStore } from '../../stores/data'
import { useFormatter } from '../../composables/useFormatter'
import { useReload } from '../../composables/useReload'

// Equivalence panel (UI §6, ADR-019). Framing = annual rate / committed debt (never an infinite
// total). It has NO own preset row: it follows the global time-horizon control. The headline is always
// the annual rate at the reference year; at a future horizon (+20 … +100 y) it adds the committed
// total over that window (`annualRate × horizonYears`). Car + reference-country factors come from
// config; the country re-anchors reactively with the locale (business §4.4) because the fetch key
// includes the locale.
const { t } = useI18n()
const data = useDataStore()
const formatter = useFormatter()
const reload = useReload()

const eq = computed(() => data.currentEquivalence)
const hasData = computed(() => eq.value != null)
const countryKey = computed(() =>
  eq.value ? `country.${eq.value.countryEquivalent.iso3.toLowerCase()}` : '',
)
</script>

<template>
  <PanelCard :title="t('panel.equivalence.title')" :data-year="eq?.referenceYear">
    <ErrorRetry v-if="data.errors.equivalence" :error="data.errors.equivalence" @retry="reload" />
    <LoadingSkeleton v-else-if="data.loading.equivalence && !hasData" height="120px" />
    <div v-else-if="eq" class="equivalence__values">
      <p class="equivalence__line">
        <span class="equivalence__value mono">{{ formatter.format(eq.annualRateCO2) }} {{ t('unit.mtco2') }}</span>
        <span class="equivalence__caption">{{ t('equivalence.annualRate') }}</span>
      </p>
      <p v-if="eq.cumulativeCO2 != null" class="equivalence__line">
        <span class="equivalence__value mono">{{ formatter.format(eq.cumulativeCO2) }} {{ t('unit.mtco2') }}</span>
        <span class="equivalence__caption">{{ t('equivalence.committed') }}</span>
      </p>
      <p class="equivalence__line">
        <span class="equivalence__prefix">≈</span>
        <span class="equivalence__value mono">{{ formatter.format(eq.carEquivalent) }}</span>
        <span class="equivalence__caption">{{ t('equivalence.cars') }}</span>
      </p>
      <p class="equivalence__line">
        <span class="equivalence__prefix">≈</span>
        <span class="equivalence__value mono">{{ formatter.multiplier(eq.countryEquivalent.times) }}</span>
        <span class="equivalence__caption">{{ t('equivalence.country', { country: t(countryKey) }) }}</span>
      </p>
    </div>
    <EmptyState v-else />
  </PanelCard>
</template>

<style scoped>
.equivalence__values {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.equivalence__line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}
.equivalence__prefix {
  color: var(--c-text-mid);
  font-size: 18px;
}
.equivalence__value {
  font-size: 22px;
  line-height: 26px;
  color: var(--c-text-hi);
  font-weight: 500;
}
.equivalence__caption {
  color: var(--c-text-mid);
  font-size: 13px;
}
</style>
