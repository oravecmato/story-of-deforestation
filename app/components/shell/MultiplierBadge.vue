<script setup lang="ts">
import { computed } from 'vue'
import { useDataStore } from '../../stores/data'
import { useFormatter } from '../../composables/useFormatter'

// The live ×N headline (UI §7, design §6). fullEmissions ÷ WB reported stock at the reference year,
// sourced entirely from Pinia (server-derived, measured data only — ADR-019). Rendered through the
// injected Formatter's mono multiplier form (×3.2). Real DOM text (a11y §12).
const { t } = useI18n()
const data = useDataStore()
const formatter = useFormatter()

const visible = computed(() => data.multiplier != null)
const referenceYear = computed(() => data.currentMainResult?.referenceYear)
</script>

<template>
  <div v-if="visible" class="multiplier">
    <span class="multiplier__value mono">{{ formatter.multiplier(data.multiplier!) }}</span>
    <span v-if="referenceYear != null" class="multiplier__caption">{{
      t('multiplier.caption', { year: referenceYear })
    }}</span>
  </div>
</template>

<style scoped>
.multiplier {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-control);
  padding: 6px 12px;
}
.multiplier__value {
  font-size: 24px;
  line-height: 28px;
  color: var(--c-text-hi);
  font-weight: 500;
}
.multiplier__caption {
  font-size: 11px;
  line-height: 16px;
  color: var(--c-text-low);
}
</style>
