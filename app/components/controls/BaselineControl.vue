<script setup lang="ts">
import Select from 'primevue/select'
import { computed } from 'vue'
import { BASELINE_FLOOR } from '../../../shared/config/derivation'
import { useViewStore } from '../../stores/view'

// Baseline year (UI §3, design §6): floor 1990 (sink-integration origin, business §7.2). Compact
// select stepping in 5s; label pattern "from loss after {year}". Changing it re-derives cumulative
// loss (and therefore the forgone sink). The 1990 origin stays fixed regardless of the composite
// stock floor (2000) applied server-side.
const { t } = useI18n()
const view = useViewStore()

// Offer 1990 → 2020 in 5-year steps (compact). Baseline is a coarse origin, not a fine control.
const years = computed(() => {
  const out: number[] = []
  for (let y = BASELINE_FLOOR; y <= 2020; y += 5) out.push(y)
  return out.map((y) => ({ value: y, label: t('baseline.pattern', { year: y }) }))
})

const model = computed<number>({
  get: () => view.baseline,
  set: (v) => {
    if (typeof v === 'number') view.setBaseline(v)
  },
})
</script>

<template>
  <Select
    v-model="model"
    :options="years"
    option-label="label"
    option-value="value"
    :aria-label="t('baseline.label')"
    class="baseline-select"
  />
</template>

<style scoped>
.baseline-select {
  min-width: 12rem;
}
</style>
