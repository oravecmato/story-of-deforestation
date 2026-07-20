<script setup lang="ts">
import { computed } from 'vue'
import type { DomainResultDTO, DomainDerived, VizPresentation } from '../../../shared/types'
import BaseChart from './BaseChart.vue'
import { MainStackedOption } from '../../charts/MainStackedOption'
import type { ChartContext } from '../../charts/BaseChartOption'

// Tier-2 (local main): measured stock + forgone sink. Pinia-unaware — the parent supplies the DTO,
// the baseline-derived tail (ADR-026), chart context, metric presentation and loading via props; the
// option rebuilds whenever any of them change (tech-spec §11.4). The slide's `presentation` drives the
// stock-only→+forgone reveal (2→3).
const props = defineProps<{
  result: DomainResultDTO
  derived: DomainDerived
  ctx: ChartContext
  presentation?: VizPresentation
  loading?: boolean
}>()

const option = computed(() =>
  new MainStackedOption({ ...props.result, ...props.derived }, props.ctx, props.presentation).build(),
)
</script>

<template>
  <BaseChart :option="option" :loading="loading" />
</template>
