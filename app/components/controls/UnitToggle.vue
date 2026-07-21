<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'
import type { EquivalenceUnit } from '#shared/types'
import { useViewStore } from '../../stores/view'

// The equivalence-strip unit switcher (UI §6.7, design §6, ADR-025): a compact segmented pill that
// retints/relabels all four strip figures at once — Mt CO₂ · one car's annual · one country's annual.
// Pure view state (no refetch, out of the URL). Default `car`. The `country` label is locale-driven
// (Slovakia in SK, the UK in EN) and re-resolves with the language, never a data fetch (business §4.4).
const { t } = useI18n()
const view = useViewStore()

const options = computed<Array<{ value: EquivalenceUnit; label: string }>>(() => [
  { value: 'mtco2', label: t('equivalenceStrip.unit.mtco2') },
  { value: 'car', label: t('equivalenceStrip.unit.car') },
  { value: 'country', label: t('equivalenceStrip.unit.country') },
])

const model = computed<EquivalenceUnit>({
  get: () => view.unit,
  set: (v) => {
    if (v) view.setUnit(v)
  },
})
</script>

<template>
  <SelectButton
    v-model="model"
    :options="options"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    :aria-label="t('equivalenceStrip.unit.label')"
    class="unit-toggle"
  />
</template>

<style scoped>
.unit-toggle :deep(.p-togglebutton) {
  font-size: 13px;
}
</style>
