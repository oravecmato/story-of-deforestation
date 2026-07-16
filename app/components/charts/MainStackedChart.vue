<script setup lang="ts">
import { computed } from 'vue'
import type { DomainResultDTO } from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { MainStackedOption } from '../../charts/MainStackedOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (local main): measured stock + forgone sink. Pinia-unaware — the parent supplies the DTO,
// chart context and loading via props; the option rebuilds whenever any of them change (tech-spec
// §11.4). dataZoom selections bubble up as `timeRange`; the parent persists them to the view store.
const props = defineProps<{
  result: DomainResultDTO
  ctx: ChartContext
  loading?: boolean
}>()
const emit = defineEmits<{ timeRange: [range: [number, number] | null] }>()

const option = computed(() => new MainStackedOption(props.result, props.ctx).build())
</script>

<template>
  <BaseChart :option="option" :loading="loading" @time-range="emit('timeRange', $event)" />
</template>
