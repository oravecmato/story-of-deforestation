<script setup lang="ts">
import { computed } from 'vue'
import type {
  ReferenceDTO,
  GlobalResultDTO,
  GlobalDerived,
  VizPresentation,
} from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { FootprintDonutOption } from '../../charts/FootprintDonutOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (global): share-of-footprint composition donut. Pinia-unaware — parent supplies both DTOs, the
// baseline-derived tail (ADR-026), and the metric presentation. Slices are window totals from the global
// series (§17.4); the forgone slice is the client-derived `aggregateForgoneSink`. The slide's
// `presentation` drives the 3→2 slice drop (fossil removed, 5→6).
const props = defineProps<{
  reference: ReferenceDTO
  main: GlobalResultDTO
  derived: GlobalDerived
  ctx: ChartContext
  presentation?: VizPresentation
  loading?: boolean
}>()

const option = computed(() =>
  new FootprintDonutOption(
    { reference: props.reference, main: { ...props.main, ...props.derived } },
    props.ctx,
    props.presentation,
  ).build(),
)
</script>

<template>
  <BaseChart :option="option" :loading="loading" />
</template>
