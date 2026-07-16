<script setup lang="ts">
// Non-blocking data-gap caption (UI §9, design §2.3): text.low, never the amber data color.
const { t } = useI18n()
defineProps<{ reason: string }>()
</script>

<template>
  <p class="gap-note">{{ t('state.gap', { reason }) }}</p>
</template>

<style scoped>
.gap-note {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--c-text-low);
}
</style>
