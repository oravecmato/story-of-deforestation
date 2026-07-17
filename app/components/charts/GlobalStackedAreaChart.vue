<script setup lang="ts">
import { computed } from 'vue'
import type { GlobalResultDTO, VizPresentation } from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { GlobalStackedAreaOption } from '../../charts/GlobalStackedAreaOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (global main): per-domain stacked area + aggregate forgone-sink band. Pinia-unaware — the
// parent supplies the DTO, chart context, metric presentation and loading via props. The slide's
// `presentation` drives the stock-only→+forgone reveal (2→3). dataZoom selections bubble up as
// `timeRange`; the parent persists them to the view store.
const props = defineProps<{
  result: GlobalResultDTO
  ctx: ChartContext
  presentation?: VizPresentation
  loading?: boolean
}>()
const emit = defineEmits<{ timeRange: [range: [number, number] | null] }>()

const option = computed(() =>
  new GlobalStackedAreaOption(props.result, props.ctx, props.presentation).build(),
)
</script>

<template>
  <BaseChart :option="option" :loading="loading" @time-range="emit('timeRange', $event)" />
</template>
