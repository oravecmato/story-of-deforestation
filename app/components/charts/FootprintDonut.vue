<script setup lang="ts">
import { computed } from 'vue'
import type { ReferenceDTO, GlobalResultDTO, VizPresentation } from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { FootprintDonutOption } from '../../charts/FootprintDonutOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (global): share-of-footprint composition donut. Pinia-unaware — parent supplies both DTOs and
// the metric presentation. Slices are window totals from the global series (§17.4). The slide's
// `presentation` drives the 3→2 slice drop (fossil removed, 5→6).
const props = defineProps<{
  reference: ReferenceDTO
  main: GlobalResultDTO
  ctx: ChartContext
  presentation?: VizPresentation
  loading?: boolean
}>()

const option = computed(() =>
  new FootprintDonutOption(
    { reference: props.reference, main: props.main },
    props.ctx,
    props.presentation,
  ).build(),
)
</script>

<template>
  <BaseChart :option="option" :loading="loading" />
</template>
