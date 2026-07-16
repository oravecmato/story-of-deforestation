<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'
import type { Horizon } from '../../../shared/types'
import { HORIZONS } from '../../../shared/config/derivation'
import { useViewStore } from '../../stores/view'

// The signature interaction (UI §3, ADR-019): a wide SelectButton today / +20 … +100 y that sets the
// projected range's upper edge. `today` = last measured year; the future categories extend a dashed
// forward projection. Changing it re-derives (new DerivationParams signature) → the data store refetches.
const { t } = useI18n()
const view = useViewStore()

const options = computed(() => HORIZONS.map((value) => ({ value, label: t(`horizon.${value}`) })))

const model = computed<Horizon>({
  get: () => view.horizon,
  set: (v) => {
    if (v) view.setHorizon(v)
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
    :aria-label="t('horizon.label')"
    class="horizon-select"
  />
</template>

<style scoped>
/* The signature control reads larger than the secondary controls (design §5.1). */
.horizon-select :deep(.p-togglebutton) {
  font-weight: 600;
  min-width: 4.5rem;
}
</style>
