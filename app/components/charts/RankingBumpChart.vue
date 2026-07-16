<script setup lang="ts">
import { computed } from 'vue'
import type { RankingDTO } from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { RankingBumpOption } from '../../charts/RankingBumpOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (global): official vs full domain-rank bump chart. Pinia-unaware — parent supplies the DTO.
const props = defineProps<{
  ranking: RankingDTO
  ctx: ChartContext
  loading?: boolean
}>()

const option = computed(() => new RankingBumpOption(props.ranking, props.ctx).build())
</script>

<template>
  <BaseChart :option="option" :loading="loading" />
</template>
