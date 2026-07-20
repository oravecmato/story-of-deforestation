<script setup lang="ts">
import { computed } from 'vue'
import { useDataStore } from '../../stores/data'
import { useViewStore } from '../../stores/view'
import { useFormatter } from '../../composables/useFormatter'
import { horizonYears } from '../../../shared/config/derivation'

// The live ×N headline (UI §7, design §6). Σ fullEmissions ÷ Σ WB reported stock over the forward
// window `[referenceYear, referenceYear + horizonYears(horizon)]` (ADR-019), sourced entirely from
// Pinia (server-derived). `today` collapses to the single-year measured ratio; a longer horizon
// widens the window and grows the ratio. Rendered through the injected Formatter's mono multiplier
// form (×3.2). Real DOM text (a11y §12).
const { t } = useI18n()
const data = useDataStore()
const view = useViewStore()
const formatter = useFormatter()

const visible = computed(() => data.multiplier != null)
const referenceYear = computed(() => data.currentMainResult?.referenceYear)
/** The forward window the ×N ratio integrates over; `today` collapses `from === to`. */
const window = computed(() =>
  referenceYear.value != null
    ? { from: referenceYear.value, to: referenceYear.value + horizonYears(view.horizon) }
    : null,
)
const caption = computed<string | null>(() => {
  const w = window.value
  if (!w) return null
  return w.from === w.to
    ? t('multiplier.caption', { year: w.from })
    : t('multiplier.captionWindow', { from: w.from, to: w.to })
})
</script>

<template>
  <div v-if="visible" class="multiplier">
    <span class="multiplier__value mono">{{ formatter.multiplier(data.multiplier!) }}</span>
    <span v-if="caption != null" class="multiplier__caption">{{ caption }}</span>
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
