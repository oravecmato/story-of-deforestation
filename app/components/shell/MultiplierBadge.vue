<script setup lang="ts">
import { computed } from 'vue'
import { useFormatter } from '../../composables/useFormatter'
import WindowLabel from './WindowLabel.vue'

// The live ×N headline (UI §7, design §6), a dumb leaf for the ratio (ADR-027): the value is resolved
// in the Widget seam and passed in; a null value (official mode / no data) renders nothing. The forward
// window it summarises is printed by the Pinia-aware `WindowLabel` (point 5), so the badge no longer
// carries year props. Shown through the injected Formatter's mono multiplier form (×3.2). Real DOM
// text (a11y §12).
const props = defineProps<{ value: number | null }>()

const formatter = useFormatter()

const formatted = computed(() => (props.value != null ? formatter.multiplier(props.value) : ''))
</script>

<template>
  <div v-if="value != null" class="multiplier">
    <span class="multiplier__value mono">{{ formatted }}</span>
    <WindowLabel class="multiplier__caption" />
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
