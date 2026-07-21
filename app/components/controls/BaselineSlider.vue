<script setup lang="ts">
import Slider from 'primevue/slider'
import { computed } from 'vue'
import { BASELINE_FLOOR, BASELINE_MAX } from '#shared/config/derivation'
import { useViewStore } from '../../stores/view'

// Baseline slider (ADR-026): the fine, full-range alternative to the coarse `BaselineControl` select.
// It drags the sink-integration origin continuously from the LUH2 reconstruction floor (1800) up to
// the latest selectable year (BASELINE_MAX), re-deriving cumulative loss → forgone sink live on the
// client — a pure client-transform, never a refetch. The current year reads out beside the track.
const { t } = useI18n()
const view = useViewStore()

const model = computed<number>({
  get: () => view.baseline,
  set: (v) => {
    if (typeof v === 'number') view.setBaseline(v)
  },
})
</script>

<template>
  <div class="baseline-slider">
    <span class="baseline-slider__year mono">{{ view.baseline }}</span>
    <Slider
      v-model="model"
      :min="BASELINE_FLOOR"
      :max="BASELINE_MAX"
      :step="1"
      :aria-label="t('baseline.label')"
      class="baseline-slider__track"
    />
  </div>
</template>

<style scoped>
.baseline-slider {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 16rem;
}
.baseline-slider__year {
  font-size: 13px;
  color: var(--c-text-mid);
  min-width: 3ch;
}
.baseline-slider__track {
  flex: 1 1 auto;
}
</style>
