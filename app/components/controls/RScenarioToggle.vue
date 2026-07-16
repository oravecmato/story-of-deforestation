<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'
import type { RScenario } from '../../../shared/types'
import { useViewStore } from '../../stores/view'

// Sink-scenario band (UI §3, design §6): conservative · mid · high, mid preselected. Secondary to
// the time-horizon selector by size/contrast. Changing it re-derives the forgone-sink band.
const { t } = useI18n()
const view = useViewStore()

const options = computed(() => [
  { value: 'conservative' as RScenario, label: t('rscenario.conservative') },
  { value: 'mid' as RScenario, label: t('rscenario.mid') },
  { value: 'high' as RScenario, label: t('rscenario.high') },
])

const model = computed<RScenario>({
  get: () => view.rScenario,
  set: (v) => {
    if (v) view.setRScenario(v)
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
    :aria-label="t('rscenario.label')"
  />
</template>
