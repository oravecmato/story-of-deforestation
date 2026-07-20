<script setup lang="ts">
import type { RenderableSlide } from '../../story/SlideFactory'
import SlideLayout from './SlideLayout.vue'
import Widget from './Widget.vue'

// The slide renderer (tech-spec §17.2, ADR-027). It is now purely generic: it hands the slide's grid to
// the geometry-only `SlideLayout` and drops each resolved widget into its grid area, keyed by the
// widget's stable `id`. Nothing here knows what a widget IS — that lives in `Widget` (the Pinia seam)
// and the pure factory. Keying by `id` (shared across a scene's slides) is what lets the 2→3 reveal and
// the 5→6 fossil-removal animate in place instead of remounting the charts (ADR-022).
defineProps<{ slide: RenderableSlide }>()
</script>

<template>
  <SlideLayout :grid="slide.grid">
    <div
      v-for="w in slide.widgets"
      :key="w.id"
      class="slide__widget"
      :style="{ gridArea: w.area }"
    >
      <Widget :widget="w" />
    </div>
  </SlideLayout>
</template>

<style scoped>
.slide__widget {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
</style>
