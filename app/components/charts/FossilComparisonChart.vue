<script setup lang="ts">
import { computed } from 'vue'
import type {
  ReferenceDTO,
  GlobalResultDTO,
  GlobalDerived,
  VizPresentation,
} from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { FossilComparisonOption } from '../../charts/FossilComparisonOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (global only): deforestation vs global fossil emissions, one grid / two categories on a
// single shared Y-axis. Pinia-unaware — parent supplies both DTOs, the baseline-derived tail (ADR-026),
// and the metric presentation. The slide's `presentation` drives the fossil-removal + axis rescale (5→6).
const props = defineProps<{
  reference: ReferenceDTO
  main: GlobalResultDTO
  derived: GlobalDerived
  ctx: ChartContext
  presentation?: VizPresentation
  loading?: boolean
}>()

const chart = computed(
  () =>
    new FossilComparisonOption(
      { reference: props.reference, main: { ...props.main, ...props.derived } },
      props.ctx,
      props.presentation,
    ),
)
const option = computed(() => chart.value.build())
</script>

<template>
  <BaseChart :option="option" :y-unit="chart.yUnit()" :theme="ctx.theme" :loading="loading" />
</template>
