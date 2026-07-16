<script setup lang="ts">
import Button from 'primevue/button'
import type { StoreError } from '../../services/apiClient'

// Per-region fetch failure with a retry affordance (UI §9, design §2.3: error red). Isolated to the
// failing panel. Emits `retry` so the parent can re-run just that endpoint's fetch.
const { t } = useI18n()
defineProps<{ error: StoreError }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="error-retry">
    <p class="error-retry__title">{{ t('state.error.title') }}</p>
    <Button
      size="small"
      severity="secondary"
      :label="t('state.error.retry')"
      @click="emit('retry')"
    />
  </div>
</template>

<style scoped>
.error-retry {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 160px;
}
.error-retry__title {
  margin: 0;
  color: var(--c-negative);
  font-size: 13px;
}
</style>
