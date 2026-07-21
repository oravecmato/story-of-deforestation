<script setup lang="ts">
import { computed } from 'vue'
import type { GlobalResultDTO, GlobalDerived, VizPresentation } from '#shared/types'
import BaseChart from './BaseChart.vue'
import { GlobalStackedAreaOption } from '../../charts/GlobalStackedAreaOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (global main): per-domain stacked area + aggregate forgone-sink band. Pinia-unaware — the
// parent supplies the DTO, the baseline-derived tail (ADR-026), chart context, metric presentation and
// loading via props. The slide's `presentation` drives the stock-only→+forgone reveal (2→3).
const props = defineProps<{
  result: GlobalResultDTO
  derived: GlobalDerived
  ctx: ChartContext
  presentation?: VizPresentation
  loading?: boolean
}>()

const chart = computed(
  () => new GlobalStackedAreaOption({ ...props.result, ...props.derived }, props.ctx, props.presentation),
)
const option = computed(() => chart.value.build())
</script>

<template>
  <BaseChart :option="option" :y-unit="chart.yUnit()" :theme="ctx.theme" :loading="loading" />
</template>
