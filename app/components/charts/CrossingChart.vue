<script setup lang="ts">
import { computed } from 'vue'
import BaseChart from './BaseChart.vue'
import { CrossingOption, type CrossingInput } from '../../charts/CrossingOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (local/global, full): stock vs cumulative forgone sink with the crossing marked. Pinia-unaware
// — the parent resolves the scope-agnostic CrossingInput (local or aggregate) and passes it in.
const props = defineProps<{
  input: CrossingInput
  ctx: ChartContext
  loading?: boolean
}>()

const chart = computed(() => new CrossingOption(props.input, props.ctx))
const option = computed(() => chart.value.build())
</script>

<template>
  <BaseChart :option="option" :y-unit="chart.yUnit()" :theme="ctx.theme" :loading="loading" />
</template>
