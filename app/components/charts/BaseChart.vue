<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import type { ThemeTokens } from '../../../shared/types'

// Tier-1 dumb chart wrapper (tech-spec §11.4): a client-only <VChart> with autoresize; no domain
// logic. Options are built by the chart-option classes and passed in as props. <VChart> (nuxt-echarts)
// and <ClientOnly> are auto-registered by Nuxt.
withDefaults(
  defineProps<{
    option: EChartsOption
    loading?: boolean
    theme?: ThemeTokens
  }>(),
  { loading: false, theme: undefined },
)
</script>

<template>
  <div class="base-chart" :style="theme ? { backgroundColor: 'transparent', color: theme.text.mid } : undefined">
    <ClientOnly>
      <VChart :option="option" :loading="loading" autoresize />
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
/* vue-echarts renders <x-vue-echarts class="echarts"> with no intrinsic height; a child height:100%
   can't resolve against our min-height-only box, so ECharts would init at 0px and draw nothing.
   Flex-filling gives it a measurable non-zero height (autoresize handles later size changes). */
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
