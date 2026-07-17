<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutPreset } from '../../../shared/types'

// The four closed layout presets (design §5, ADR-024/025). `GenericSlide` fills the named slots; this
// component is purely presentational (no Pinia):
//  - `text`          → heading + copy only (no stage, no controls).
//  - `viz-text`      → a quiet controls row + one viz above the full-width copy.
//  - `duo-viz-text`  → two side-by-side vizzes above the copy (stacked on narrow viewports).
//  - `duo-viz-equiv` → a thin caption ON TOP, the controls row, the two vizzes, then a full-width
//                      equivalence strip. No bottom copy block (slide 6).
//
// CHART-IDENTITY CONTRACT (ADR-025, §17.3): the `#viz` stage is rendered UNCONDITIONALLY for every
// preset and every top-level block carries a stable `key`, so switching `duo-viz-text` → `duo-viz-equiv`
// keeps the stage vnode (and its `viz.id`-keyed `<VChart>` instances) matched across the render — the
// 5→6 charts are preserved and only `setOption`-animate. A structural `v-if` fork that relocates the
// viz outlet would remount ECharts and is forbidden.
const props = defineProps<{ preset: LayoutPreset }>()

/** The controls bar shows on every preset except the pure-text intro. */
const hasBar = computed(() => props.preset !== 'text')
/** The bottom copy block shows on every preset except `duo-viz-equiv` (it uses a top caption instead). */
const hasCopy = computed(() => props.preset !== 'duo-viz-equiv')
/** The two-column duo grid applies to both duo presets. */
const isDuo = computed(() => props.preset === 'duo-viz-text' || props.preset === 'duo-viz-equiv')
</script>

<template>
  <section class="slide" :class="`slide--${preset}`">
    <div v-if="preset === 'duo-viz-equiv'" key="caption" class="slide__caption">
      <slot name="caption" />
    </div>

    <header v-if="hasBar" key="bar" class="slide__bar">
      <div class="slide__controls"><slot name="controls" /></div>
      <div class="slide__badge"><slot name="badge" /></div>
    </header>

    <!-- Unconditional stage: keyed so its `viz.id`-keyed charts survive the preset change (ADR-025). -->
    <div key="stage" class="slide__stage" :class="{ 'slide__stage--duo': isDuo }">
      <slot name="viz" />
    </div>

    <div v-if="preset === 'duo-viz-equiv'" key="equiv" class="slide__equivalence">
      <slot name="equivalence" />
    </div>

    <div v-if="hasCopy" key="copy" class="slide__copy">
      <slot name="heading" />
      <slot name="text" />
    </div>
  </section>
</template>

<style scoped>
.slide {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.slide--text {
  min-height: 40vh;
  justify-content: center;
}
.slide__caption {
  color: var(--c-text-mid);
  font-size: 15px;
  line-height: 22px;
  max-width: 72ch;
}
.slide__bar {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 40px;
}
.slide__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.slide__badge {
  margin-left: auto;
}
/* An empty stage (the text preset carries no viz) collapses so it adds no gap. */
.slide__stage:empty {
  display: none;
}
.slide__stage--duo {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
@media (max-width: 1119px) {
  .slide__stage--duo {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
