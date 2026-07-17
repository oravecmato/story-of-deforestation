<script setup lang="ts">
import { computed } from 'vue'
import type { ReferenceDTO, GlobalResultDTO, VizPresentation } from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { FossilComparisonOption } from '../../charts/FossilComparisonOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (global only): deforestation vs global fossil emissions, one grid / two categories on a
// single shared Y-axis. Pinia-unaware — parent supplies both DTOs and the metric presentation. The
// slide's `presentation` drives the fossil-removal + axis rescale (5→6).
const props = defineProps<{
  reference: ReferenceDTO
  main: GlobalResultDTO
  ctx: ChartContext
  presentation?: VizPresentation
  loading?: boolean
}>()

const option = computed(() =>
  new FossilComparisonOption(
    { reference: props.reference, main: props.main },
    props.ctx,
    props.presentation,
  ).build(),
)
</script>

<template>
  <BaseChart :option="option" :loading="loading" />
</template>
