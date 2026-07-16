<script setup lang="ts">
import Button from 'primevue/button'
import { useViewStore } from '../../stores/view'

// The dataZoom reset affordance (UI §4): only shown once a year range is active. The range itself
// is dragged on the chart's embedded slider; this just reports the current selection and clears it
// back to the full range. Pure view state — clearing the range never triggers a refetch (ADR-005).
const { t } = useI18n()
const view = useViewStore()
</script>

<template>
  <div v-if="view.timeRange" class="time-range-zoom">
    <span class="time-range-zoom__range mono">{{ view.timeRange[0] }}–{{ view.timeRange[1] }}</span>
    <Button
      class="time-range-zoom__reset"
      :label="t('timeRange.reset')"
      severity="secondary"
      text
      size="small"
      @click="view.setTimeRange(null)"
    />
  </div>
</template>

<style scoped>
.time-range-zoom {
  display: flex;
  align-items: center;
  gap: 8px;
}
.time-range-zoom__range {
  color: var(--c-text-mid);
  font-size: 12px;
}
</style>
