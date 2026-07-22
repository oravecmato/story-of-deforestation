<script setup lang="ts">
import type { StripCell } from '../../story/equivalenceStrip'
import type { StoreError } from '../../services/apiClient'
import LoadingSkeleton from '../state/LoadingSkeleton.vue'
import EmptyState from '../state/EmptyState.vue'
import ErrorRetry from '../state/ErrorRetry.vue'
import UnitSelect from '../controls/UnitSelect.vue'
import WindowLabel from './WindowLabel.vue'
import UnitIcon from '../icons/UnitIcon.vue'

// Equivalence strip (UI §6.7, ADR-025/026, §17.4), now a dumb leaf (ADR-027). FOUR colour-coded
// magnitudes — each a client-side reduction over the already-fetched GLOBAL DTO across the forward
// window — are resolved into fully presentation-ready `StripCell`s by the Widget seam and passed in;
// this component only renders. It keeps the self-binding `UnitSelect` control (the interactive tier
// stays Pinia-aware) which reprojects all four cells at once. `layout` selects the four-across footer
// bar (`horizontal`, default — slide 6) or a stacked full-height aside column (`vertical` — the
// slide-7 lab's quarter-width right column) — but ONLY on desktop; at tablet BOTH variants reflow to a
// 2×2 grid, at mobile to a single column (§9). `busy` (a horizon-switch refetch with cells already on
// screen) draws a blur veil over the four cells instead of tearing them down to a skeleton — the
// skeleton is reserved for the first-ever load.
withDefaults(
  defineProps<{
    title: string
    cells: StripCell[]
    loading: boolean
    error: StoreError | null
    layout?: 'horizontal' | 'vertical'
    busy?: boolean
  }>(),
  { layout: 'horizontal', busy: false },
)
defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="strip" :class="{ 'strip--vertical': layout === 'vertical' }" :aria-label="title">
    <div class="strip__head">
      <div class="strip__titles">
        <h2 class="strip__title">{{ title }}</h2>
        <WindowLabel class="strip__window" />
      </div>
      <UnitSelect :full-width="layout === 'vertical'" />
    </div>

    <ErrorRetry v-if="error && !cells.length" :error="error" @retry="$emit('retry')" />
    <LoadingSkeleton v-else-if="loading && !cells.length" height="96px" />
    <!-- Once cells exist, keep them mounted through refetches; a veil blurs them (and blocks pointer
         events) while new data loads. The skeleton above is only for the first-ever load. -->
    <div v-else-if="cells.length" class="strip__body">
      <div class="strip__grid" :class="{ 'strip__grid--busy': busy }">
        <div
          v-for="cell in cells"
          :key="cell.key"
          class="strip__cell"
          :style="{ '--cell-color': cell.color }"
        >
          <p class="strip__value mono">
            <span v-if="cell.prefix" class="strip__prefix">{{ cell.prefix }}</span>
            {{ cell.value }}
            <span class="strip__unit">
              <template v-if="cell.unitIcon">
                <span v-if="cell.unitIcon !== 'car'" class="strip__times" aria-hidden="true">×</span>
                <UnitIcon :name="cell.unitIcon" class="strip__unit-icon" />
              </template>
              <template v-else>{{ cell.unit }}</template>
            </span>
          </p>
          <p class="strip__caption">{{ cell.caption }}</p>
        </div>
      </div>
      <div v-if="busy" class="strip__veil" aria-hidden="true" />
      <div v-if="error" class="strip__error-overlay">
        <ErrorRetry :error="error" @retry="$emit('retry')" />
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
.strip__titles {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.strip__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text-hi);
}
.strip__window {
  font-size: 12px;
  color: var(--c-text-low);
}
/* The body wraps the figure grid so the loading veil can overlay ONLY the four cells (not the head). */
.strip__body {
  position: relative;
}
.strip__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
/* Cell (desktop default): a vertical accent line hugging the left edge of the figure. */
.strip__cell {
  padding-left: 12px;
  border-left: 3px solid var(--cell-color);
}

/* --- Desktop vertical variant (the slide-7 lab's quarter-width aside, >= $bp-desktop): fill the
   column's full height with a fixed head, then let the body/grid grow into the rest and split it into
   four EQUAL rows so each cell's left accent line spans a full quarter of the height — the four lines
   abut with only a few-px gap. Guarded to desktop so tablet/mobile reflow (below) still applies. --- */
@media (min-width: 1120px) {
  .strip--vertical {
    height: 100%;
  }
  .strip--vertical .strip__body {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }
  .strip--vertical .strip__grid {
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: 1fr;
    gap: 6px;
    flex: 1 1 auto;
    min-height: 0;
  }
  .strip--vertical .strip__cell {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

/* --- Tablet (< $bp-desktop): BOTH variants collapse to a 2×2 grid, and the accent line moves from the
   left edge to a horizontal underline BENEATH each cell; the grid gap is the margin after it. --- */
@media (max-width: 1119px) {
  .strip__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .strip__cell {
    padding-left: 0;
    padding-bottom: 10px;
    border-left: none;
    border-bottom: 3px solid var(--cell-color);
  }
}

/* --- Mobile (< 600): a single column — one cell (with its underline) per row. --- */
@media (max-width: 599px) {
  .strip__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Refetch (horizon switch) with cells already on screen: blur + darken over the figure and block
   pointer events, purely visual — the skeleton is reserved for the first-ever load. */
.strip__grid--busy {
  pointer-events: none;
}
.strip__veil {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: rgba(13, 17, 23, 0.4);
  backdrop-filter: blur(2px);
  border-radius: 10px;
  transition: opacity 120ms ease;
}
/* A failed refetch keeps the stale cells but surfaces the retry over them. */
.strip__error-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(13, 17, 23, 0.72);
  border-radius: 10px;
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
  white-space: nowrap;
}
.strip__times {
  margin-right: 7px;
}
.strip__unit-icon {
  margin: 0 3px;
}
.strip__caption {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--c-text-mid);
}
</style>
