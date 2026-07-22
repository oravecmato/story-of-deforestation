<script setup lang="ts">
import Select from 'primevue/select'
import { computed, useId } from 'vue'
import type { Horizon } from '#shared/types'
import { HORIZONS } from '#shared/config/derivation'
import { useViewStore } from '../../stores/view'

// Mobile twin of HorizonSelect (design §5.1): the button group is too wide for a phone, so the same
// horizon options collapse into a compact dropdown preceded by an inline "Time horizon:" label. Same
// view-store binding as the desktop form — picking a horizon re-derives and the data store refetches.
const { t } = useI18n()
const view = useViewStore()
const selectId = useId()

const options = computed(() => HORIZONS.map((value) => ({ value, label: t(`horizon.${value}`) })))

const model = computed<Horizon>({
  get: () => view.horizon,
  set: (v) => {
    if (v) view.setHorizon(v)
  },
})
</script>

<template>
  <div class="horizon-mobile">
    <label class="horizon-mobile__label" :for="selectId">{{ t('horizon.label') }}:</label>
    <Select
      v-model="model"
      :input-id="selectId"
      :options="options"
      option-label="label"
      option-value="value"
      :aria-label="t('horizon.label')"
      class="horizon-mobile__select"
    />
  </div>
</template>

<style scoped>
.horizon-mobile {
  display: flex;
  align-items: center;
  gap: 10px;
}
.horizon-mobile__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-mid);
  white-space: nowrap;
}
.horizon-mobile__select {
  flex: 0 0 auto;
}
</style>
