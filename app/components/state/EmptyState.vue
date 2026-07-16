<script setup lang="ts">
// Empty result for a panel (UI §9): a quiet caption, no error styling.
const { t } = useI18n()
</script>

<template>
  <div class="empty-state">{{ t('state.empty') }}</div>
</template>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  color: var(--c-text-low);
  font-size: 13px;
}
</style>
