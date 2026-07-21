<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import type { EChartsOption, SetOptionOpts } from 'echarts'
import type { ThemeTokens } from '#shared/types'

// Tier-1 dumb chart wrapper (tech-spec §11.4): a client-only <VChart>; no domain logic. Options are
// built by the chart-option classes and passed in as props. <VChart> (nuxt-echarts) and <ClientOnly>
// are auto-registered by Nuxt.
const props = withDefaults(
  defineProps<{
    option: EChartsOption
    loading?: boolean
    theme?: ThemeTokens
    /** Y-axis unit (e.g. "MtCO₂"). Rendered by the wrapper — NOT ECharts' `yAxis.name` — as a vertical
     *  (bottom-to-top), left-side label centred along the axis. Omit for charts without a value axis
     *  (the donut), which then shows no unit label. */
    yUnit?: string
  }>(),
  { loading: false, theme: undefined, yUnit: undefined },
)

// The chart-identity contract (ADR-022/025/027): sibling slides in a scene reuse a viz's `id`, so the
// same <VChart> (hence the same ECharts instance) persists across the slide change and should ANIMATE
// the reveal/removal in place. Two things break that, both handled here:
//
// 1. MERGE: our option classes build a FRESH option object each recompute; vue-echarts' auto-watcher
//    would apply it with `notMerge: true` (a full wipe + redraw → no transition). We merge instead and
//    REPLACE only the `series` component, so ECharts diffs old vs new series and animates additions/
//    removals/updates. But `replaceMerge` maps existing↔new series ONLY by `id` (and positional index),
//    never by `name`, so a series without an `id` is always brand-new → re-animates from scratch. Our
//    option classes give every series a stable, unique `name` (metric labels + `\u200b`/`__`-prefixed
//    helper keys) but no `id`; `normalizedOption` promotes name → `id` so kept series tween, revealed
//    metrics (slide-2→3 forgone sink) animate IN, and dropped metrics (slide-5→6 fossil) animate OUT.
//
// 2. RESIZE SNAP: a sibling slide can change the viz box size (e.g. slide 3 adds the multiplier badge,
//    slide 6 adds the equivalence strip), shrinking the chart. ECharts `resize()` re-renders with
//    `animation.duration: 0` — it SNAPS any in-flight animation to its final frame. nuxt-echarts'
//    `autoresize` observes the box and fires that resize right AFTER the reveal `setOption`, so the
//    reveal never plays (a flash). We take over the update/resize lifecycle (`manual-update`, no
//    `autoresize`) and drive it in the right ORDER: on an option change we `resize()` FIRST (the DOM has
//    already reflowed to the final size — a no-op-ish snap of the still-static old chart) THEN
//    `setOption()` (the reveal now animates at the correct size, with no later resize to clobber it). A
//    self-managed ResizeObserver still handles genuine window/container resizes, but SKIPS when the
//    chart already matches the box, so the single transition-resize can't re-snap the animation.
const UPDATE_OPTIONS: SetOptionOpts = { notMerge: false, replaceMerge: ['series'] }

const normalizedOption = computed<EChartsOption>(() => {
  const { series } = props.option
  if (series == null) return props.option
  const list = Array.isArray(series) ? series : [series]
  const withIds = list.map((s, i) =>
    s.id != null ? s : { ...s, id: s.name != null ? String(s.name) : `series-${i}` },
  )
  return { ...props.option, series: withIds }
})

/** The subset of the <VChart> exposed API we drive in manual-update mode. */
interface VChartApi {
  setOption: (option: EChartsOption, updateOptions?: SetOptionOpts) => void
  resize: () => void
  getWidth: () => number
  getHeight: () => number
  getDom: () => HTMLElement | undefined
}
const vchart = ref<VChartApi | null>(null)

// Apply option deltas ourselves (manual-update disables vue-echarts' own watcher). `flush: 'post'` runs
// AFTER Vue has patched the DOM, so measuring/resizing sees the reflowed (final) viz box; resize-before-
// setOption keeps the reveal animating at the right size (see note 2). The initial render is still done
// by <VChart> from the bound `:option`, so we skip the leading run.
watch(
  normalizedOption,
  (opt) => {
    const api = vchart.value
    if (!api) return
    api.resize()
    api.setOption(opt, UPDATE_OPTIONS)
  },
  { flush: 'post' },
)

// Genuine container/window resizes: resize the chart, but ONLY when it actually differs from the box —
// during a slide transition our option watcher has already resized to the final size, so this no-ops
// and leaves the reveal animation running.
let ro: ResizeObserver | null = null
watch(vchart, (api) => {
  ro?.disconnect()
  ro = null
  const dom = api?.getDom?.()
  if (!api || !dom || typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(() => {
    if (api.getWidth() === dom.clientWidth && api.getHeight() === dom.clientHeight) return
    api.resize()
  })
  ro.observe(dom)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})
</script>

<template>
  <div
    class="base-chart"
    :class="{ 'base-chart--has-unit': yUnit }"
    :style="theme ? { backgroundColor: 'transparent', color: theme.text.mid } : undefined"
  >
    <div v-if="yUnit" class="base-chart__y-unit" :style="theme ? { color: theme.text.mid } : undefined">
      {{ yUnit }}
    </div>
    <ClientOnly>
      <VChart ref="vchart" :option="normalizedOption" :update-options="UPDATE_OPTIONS" :loading="loading" manual-update />
      <template #fallback>
        <div class="base-chart__placeholder" aria-hidden="true" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.base-chart {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 240px;
}
/* Reserve a narrow gutter on the left for the wrapper-drawn Y-axis unit so it never overlaps the plot
   or the axis tick labels. */
.base-chart--has-unit {
  padding-left: 18px;
}
/* The Y-axis unit: vertical, reading bottom-to-top, centred along the full axis height in the gutter. */
.base-chart__y-unit {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  /* Match ECharts' default axis-label size so the unit reads as prominent as the tick labels. */
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}
/* vue-echarts renders <x-vue-echarts class="echarts"> with no intrinsic height; a child height:100%
   can't resolve against our min-height-only box, so ECharts would init at 0px and draw nothing.
   Flex-filling gives it a measurable non-zero height (our ResizeObserver handles later size changes). */
.base-chart :deep(.echarts) {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}
.base-chart__placeholder {
  flex: 1 1 auto;
  width: 100%;
}
</style>
