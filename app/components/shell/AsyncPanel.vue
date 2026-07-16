<script setup lang="ts">
import PanelCard from './PanelCard.vue'
import LoadingSkeleton from '../state/LoadingSkeleton.vue'
import EmptyState from '../state/EmptyState.vue'
import ErrorRetry from '../state/ErrorRetry.vue'
import type { StoreError } from '../../services/apiClient'

// Panel chrome + per-region state machine (UI §9): error → retry, loading (no data yet) → skeleton,
// data → default slot, otherwise → empty. The `badge` slot renders regardless of state (the
// multiplier lives above the canvas even while it loads).
defineProps<{
  title: string
  dataYear?: number
  loading: boolean
  error: StoreError | null
  hasData: boolean
}>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <PanelCard :title="title" :data-year="dataYear">
    <slot name="badge" />
    <ErrorRetry v-if="error" :error="error" @retry="emit('retry')" />
    <LoadingSkeleton v-else-if="loading && !hasData" />
    <template v-else-if="hasData"><slot /></template>
    <EmptyState v-else />
  </PanelCard>
</template>
