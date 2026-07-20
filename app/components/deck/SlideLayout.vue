<script setup lang="ts">
import { computed } from 'vue'
import type { GridTemplateId } from '../../../shared/types'
import { GRID_TEMPLATES } from '../../story/gridTemplates'

// The geometry-only slide shell (ADR-027, design §5). It knows NOTHING about what a widget is — it only
// applies the named `GridTemplate`'s columns/rows/areas and hosts the widgets (placed by their own
// `grid-area`) in its default slot. Below the duo breakpoint it swaps to the template's `mobile`
// variant. Everything is driven by CSS custom properties on ONE `<section>` — no structural fork — so a
// widget keyed by `id` survives a slide→slide grid change and its chart only `setOption`-animates
// instead of remounting (chart-identity contract, ADR-022/025).
const props = defineProps<{ grid: GridTemplateId }>()

const template = computed(() => GRID_TEMPLATES[props.grid])

const style = computed(() => ({
  '--grid-cols': template.value.columns,
  '--grid-rows': template.value.rows,
  '--grid-areas': template.value.areas,
  '--grid-cols-m': template.value.mobile.columns,
  '--grid-rows-m': template.value.mobile.rows,
  '--grid-areas-m': template.value.mobile.areas,
}))
</script>

<template>
  <section class="slide" :style="style">
    <slot />
  </section>
</template>

<style scoped lang="scss">
.slide {
  display: grid;
  grid-template-columns: var(--grid-cols);
  grid-template-rows: var(--grid-rows);
  grid-template-areas: var(--grid-areas);
  gap: 16px 24px;
  align-items: stretch;
  min-height: 100%;
}
// Desktop: the slide is bound to the stage's fixed height and NEVER scrolls. Non-viz rows are `auto`
// (their natural size); viz rows are `minmax(0, 1fr)` in the grid templates, so they absorb whatever
// height is left and the charts inside shrink to fit (the deck always fills exactly one screen). The
// viz-shrink contract (charts must have a 0 min so they can follow their cell) lives in the Widget seam.
@include desktop {
  .slide {
    height: 100%;
  }
}
// Below the desktop boundary the mobile variants use `auto` rows: the slide grows with its content and
// the page scrolls naturally, so charts keep their own intrinsic height.
@include mobile {
  .slide {
    grid-template-columns: var(--grid-cols-m);
    grid-template-rows: var(--grid-rows-m);
    grid-template-areas: var(--grid-areas-m);
  }
}
</style>
