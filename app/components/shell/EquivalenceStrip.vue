<script setup lang="ts">
import type { StripCell } from '../../story/equivalenceStrip'
import type { StoreError } from '../../services/apiClient'
import LoadingSkeleton from '../state/LoadingSkeleton.vue'
import EmptyState from '../state/EmptyState.vue'
import ErrorRetry from '../state/ErrorRetry.vue'
import UnitToggle from '../controls/UnitToggle.vue'

// Equivalence strip (UI §6.7, ADR-025/026, §17.4), now a dumb leaf (ADR-027). FOUR colour-coded
// magnitudes — each a client-side reduction over the already-fetched GLOBAL DTO across the forward
// window — are resolved into fully presentation-ready `StripCell`s by the Widget seam and passed in;
// this component only renders. It keeps the self-binding `UnitToggle` control (the interactive tier
// stays Pinia-aware) which reprojects all four cells at once. `layout` selects the four-across footer
// bar (`horizontal`, default — slide 6) or a stacked full-height aside column (`vertical` — the
// slide-7 lab's quarter-width right column).
withDefaults(
  defineProps<{
    title: string
    cells: StripCell[]
    loading: boolean
    error: StoreError | null
    layout?: 'horizontal' | 'vertical'
  }>(),
  { layout: 'horizontal' },
)
defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="strip" :class="{ 'strip--vertical': layout === 'vertical' }" :aria-label="title">
    <div class="strip__head">
      <h2 class="strip__title">{{ title }}</h2>
      <UnitToggle />
    </div>

    <ErrorRetry v-if="error" :error="error" @retry="$emit('retry')" />
    <LoadingSkeleton v-else-if="loading && !cells.length" height="96px" />
    <div v-else-if="cells.length" class="strip__grid">
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="strip__cell"
        :style="{ '--cell-color': cell.color }"
      >
        <p class="strip__value mono">
          <span v-if="cell.prefix" class="strip__prefix">{{ cell.prefix }}</span>
          {{ cell.value }}
          <span class="strip__unit">{{ cell.unit }}</span>
        </p>
        <p class="strip__caption">{{ cell.caption }}</p>
        <p v-if="cell.note" class="strip__note">{{ cell.note }}</p>
      </div>
    </div>
    <EmptyState v-else />
  </section>
</template>

<style scoped>
.strip {
  border-top: 1px solid var(--c-border-hairline);
  background: var(--c-surface-1);
  border-radius: 10px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.strip__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.strip__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text-hi);
}
.strip__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
/* Vertical layout (the slide-7 lab's quarter-width aside): fill the column's full height with a fixed
   head, then let the figure grid grow to take the remaining height and distribute the four cells down
   one column with even space between them. Overrides the responsive rule below via specificity. */
.strip--vertical {
  height: 100%;
}
.strip--vertical .strip__grid {
  grid-template-columns: minmax(0, 1fr);
  flex: 1 1 auto;
  min-height: 0;
  align-content: space-between;
  gap: 20px;
}
.strip__cell {
  padding-left: 12px;
  border-left: 3px solid var(--cell-color);
}
.strip__value {
  margin: 0;
  font-size: 24px;
  line-height: 30px;
  font-weight: 500;
  color: var(--cell-color);
}
.strip__prefix {
  color: var(--c-text-mid);
  font-size: 18px;
}
.strip__unit {
  font-size: 13px;
  color: var(--c-text-mid);
  font-weight: 400;
}
.strip__caption {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--c-text-mid);
}
.strip__note {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--c-text-low);
}
@media (max-width: 899px) {
  .strip__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
