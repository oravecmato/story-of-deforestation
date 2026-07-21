<script setup lang="ts">
import Slider from 'primevue/slider'
import { computed } from 'vue'
import { R_MULTIPLIER_MIN, R_MULTIPLIER_MAX, R_MULTIPLIER_STEP } from '../../../shared/config/derivation'
import { useViewStore } from '../../stores/view'

// R-amplification slider (slide 10). A discrete 1×–6× coefficient that scales the sink rate R
// uniformly across every derived figure (client-transform like `baseline`, ADR-026): dragging it
// re-derives the forgone sink live on the client with no refetch. The current factor reads out beside
// the track. Sits next to the baseline slider in the `amplified` scene.
const { t } = useI18n()
const view = useViewStore()

const model = computed<number>({
  get: () => view.rMultiplier,
  set: (v) => {
    if (typeof v === 'number') view.setRMultiplier(v)
  },
})
</script>

<template>
  <div class="r-multiplier">
    <span class="r-multiplier__factor mono">×{{ view.rMultiplier }}</span>
    <Slider
      v-model="model"
      :min="R_MULTIPLIER_MIN"
      :max="R_MULTIPLIER_MAX"
      :step="R_MULTIPLIER_STEP"
      :aria-label="t('rMultiplier.label')"
      class="r-multiplier__track"
    />
  </div>
</template>

<style scoped>
.r-multiplier {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 12rem;
}
.r-multiplier__factor {
  font-size: 13px;
  color: var(--c-text-mid);
  min-width: 3ch;
}
.r-multiplier__track {
  flex: 1 1 auto;
}
</style>
