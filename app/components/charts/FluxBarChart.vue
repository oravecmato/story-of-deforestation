<script setup lang="ts">
import { computed } from 'vue'
import BaseChart from './BaseChart.vue'
import { FluxBarOption, type FluxBarData } from '../../charts/FluxBarOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 illustrative flux bar (slide 8). Pinia-unaware and DATA-FREE beyond the theme/i18n context:
// the absorbed/released values are editorial constants (business §7.2), so there is no DTO, no store
// read and no loading state — the parent only supplies the chart context.
const props = defineProps<{ ctx: ChartContext }>()

// Editorial illustration only (not measured): a forest absorbs ~100 units and releases ~60, so the net
// sink R we count is the ~40 difference. Round numbers keep the diagram readable.
const FLUX: FluxBarData = { absorbed: 100, released: 60 }

const chart = computed(() => new FluxBarOption(FLUX, props.ctx))
const option = computed(() => chart.value.build())
</script>

<template>
  <BaseChart :option="option" :y-unit="chart.yUnit()" :theme="ctx.theme" />
</template>
