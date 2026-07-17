<script setup lang="ts">
import { computed } from 'vue'
import type { DomainResultDTO, VizPresentation } from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { MainStackedOption } from '../../charts/MainStackedOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (local main): measured stock + forgone sink. Pinia-unaware — the parent supplies the DTO,
// chart context, metric presentation and loading via props; the option rebuilds whenever any of them
// change (tech-spec §11.4). The slide's `presentation` drives the stock-only→+forgone reveal (2→3).
// dataZoom selections bubble up as `timeRange`; the parent persists them to the view store.
const props = defineProps<{
  result: DomainResultDTO
  ctx: ChartContext
  presentation?: VizPresentation
  loading?: boolean
}>()
const emit = defineEmits<{ timeRange: [range: [number, number] | null] }>()

const option = computed(() =>
  new MainStackedOption(props.result, props.ctx, props.presentation).build(),
)
</script>

<template>
  <BaseChart :option="option" :loading="loading" @time-range="emit('timeRange', $event)" />
</template>
