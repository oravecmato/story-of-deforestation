<script setup lang="ts">
import { computed } from 'vue'
import type { ReferenceDTO, GlobalResultDTO } from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { FossilComparisonOption } from '../../charts/FossilComparisonOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (global only): deforestation vs global fossil emissions on a shared Y scale. Pinia-unaware —
// parent supplies both DTOs.
const props = defineProps<{
  reference: ReferenceDTO
  main: GlobalResultDTO
  ctx: ChartContext
  loading?: boolean
}>()

const option = computed(() =>
  new FossilComparisonOption({ reference: props.reference, main: props.main }, props.ctx).build(),
)
</script>

<template>
  <BaseChart :option="option" :loading="loading" />
</template>
