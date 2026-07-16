<script setup lang="ts">
import { computed } from 'vue'
import type { ReferenceDTO } from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { FootprintDonutOption } from '../../charts/FootprintDonutOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (global): share-of-footprint composition donut (2 slices official, 3 full). Pinia-unaware —
// parent supplies the DTO.
const props = defineProps<{
  reference: ReferenceDTO
  ctx: ChartContext
  loading?: boolean
}>()

const option = computed(() => new FootprintDonutOption(props.reference, props.ctx).build())
</script>

<template>
  <BaseChart :option="option" :loading="loading" />
</template>
