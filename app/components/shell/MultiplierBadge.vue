<script setup lang="ts">
import { computed } from 'vue'
import { useFormatter } from '../../composables/useFormatter'

// The live ×N headline (UI §7, design §6), now a dumb leaf (ADR-027): the ratio and its forward window
// `[from, to]` are resolved in the Widget seam and passed in; this component only renders. A `today`
// window collapses `from === to` to the single-year caption; a longer horizon widens it. A null value
// (official mode / no data) renders nothing. Shown through the injected Formatter's mono multiplier
// form (×3.2). Real DOM text (a11y §12).
const props = defineProps<{ value: number | null; window: { from: number; to: number } | null }>()

const { t } = useI18n()
const formatter = useFormatter()

const formatted = computed(() => (props.value != null ? formatter.multiplier(props.value) : ''))
const caption = computed<string | null>(() => {
  const w = props.window
  if (!w) return null
  return w.from === w.to
    ? t('multiplier.caption', { year: w.from })
    : t('multiplier.captionWindow', { from: w.from, to: w.to })
})
</script>

<template>
  <div v-if="value != null" class="multiplier">
    <span class="multiplier__value mono">{{ formatted }}</span>
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
