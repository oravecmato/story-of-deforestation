<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutPreset } from '../../../shared/types'

// The closed layout presets (design §5, ADR-024/025/026). `GenericSlide` fills the named slots; this
// component is purely presentational (no Pinia):
//  - `text`          → heading + copy only (no stage, no controls).
//  - `viz-text`      → a quiet controls row + one viz above the full-width copy.
//  - `duo-viz-text`  → two side-by-side vizzes above the copy (stacked on narrow viewports).
//  - `duo-viz-equiv` → a thin caption ON TOP, the controls row, the two vizzes, then a full-width
//                      equivalence strip. No bottom copy block (slide 6).
//  - `lab`           → the ADR-026 baseline lab (slide 7): a caption ON TOP + controls + two vizzes
//                      STACKED in the main column (3/4 width), with a full-height equivalence strip in
//                      a quarter-width right column. No bottom copy block.
//
// CHART-IDENTITY CONTRACT (ADR-025, §17.3): the `#viz` stage is rendered UNCONDITIONALLY for every
// preset and every top-level block carries a stable `key`, so switching `duo-viz-text` → `duo-viz-equiv`
// keeps the stage vnode (and its `viz.id`-keyed `<VChart>` instances) matched across the render — the
// 5→6 charts are preserved and only `setOption`-animate. A structural `v-if` fork that relocates the
// viz outlet would remount ECharts and is forbidden; `lab` therefore reflows via CSS grid-areas on the
// SAME block order, never a template fork.
const props = defineProps<{ preset: LayoutPreset }>()

/** The controls bar shows on every preset except the pure-text intro. */
const hasBar = computed(() => props.preset !== 'text')
/** A thin caption sits on top of the caption-led presets. */
const hasCaption = computed(() => props.preset === 'duo-viz-equiv' || props.preset === 'lab')
/** An equivalence strip sits with the equivalence-led presets (foot on slide 6, aside on the lab). */
const hasEquiv = computed(() => props.preset === 'duo-viz-equiv' || props.preset === 'lab')
/** The bottom copy block shows on every preset except the caption/equivalence-led ADR-025/026 ones. */
const hasCopy = computed(() => props.preset !== 'duo-viz-equiv' && props.preset !== 'lab')
/** The two-column duo grid applies to both duo presets. */
const isDuo = computed(() => props.preset === 'duo-viz-text' || props.preset === 'duo-viz-equiv')
/** The lab stacks its two vizzes vertically in the main column. */
const isStack = computed(() => props.preset === 'lab')
</script>

<template>
  <section class="slide" :class="`slide--${preset}`">
    <div v-if="hasCaption" key="caption" class="slide__caption">
      <slot name="caption" />
    </div>

    <header v-if="hasBar" key="bar" class="slide__bar">
      <div class="slide__controls"><slot name="controls" /></div>
      <div class="slide__badge"><slot name="badge" /></div>
      <div class="slide__settings"><slot name="settings" /></div>
    </header>

    <!-- Unconditional stage: keyed so its `viz.id`-keyed charts survive the preset change (ADR-025). -->
    <div
      key="stage"
      class="slide__stage"
      :class="{ 'slide__stage--duo': isDuo, 'slide__stage--stack': isStack }"
    >
      <slot name="viz" />
    </div>

    <div v-if="hasEquiv" key="equiv" class="slide__equivalence">
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
/* The settings menu (baseline) pins to the far right of the bar — its trigger's right edge meets the
   container edge. Collapsed entirely when the slide surfaces no settings control. */
.slide__settings {
  margin-left: auto;
}
.slide__settings:empty {
  display: none;
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
/* The lab stacks its two vizzes vertically in the main column. */
.slide__stage--stack {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
@media (max-width: 1119px) {
  .slide__stage--duo {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* The `lab` preset (slide 7): the caption, controls bar and stacked-viz stage fill a 3/4-width main
   column; the equivalence strip fills a quarter-width right column spanning the full height. Reflows
   the SAME block order via grid-areas (never a template fork) so the charts are not remounted. */
.slide--lab {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
  grid-template-rows: auto auto 1fr;
  grid-template-areas:
    'caption aside'
    'bar     aside'
    'stage   aside';
  gap: 16px 24px;
  align-items: start;
}
.slide--lab .slide__caption {
  grid-area: caption;
}
.slide--lab .slide__bar {
  grid-area: bar;
}
.slide--lab .slide__stage {
  grid-area: stage;
}
.slide--lab .slide__equivalence {
  grid-area: aside;
  align-self: stretch;
}
@media (max-width: 1119px) {
  .slide--lab {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
    grid-template-areas:
      'caption'
      'bar'
      'stage'
      'aside';
  }
}
</style>
