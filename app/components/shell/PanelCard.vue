<script setup lang="ts">
// Shared panel chrome (design §6): surface.1 card, hairline border, radius 10, an h2 title and an
// optional text.low data-year note. Pure presentation; every magnitude panel wraps its chart in one
// so the reference-year note (ADR-016) lives consistently in the panel header.
const { t } = useI18n()
defineProps<{ title: string; dataYear?: number }>()
</script>

<template>
  <section class="panel">
    <header class="panel__head">
      <h2 class="panel__title">{{ title }}</h2>
      <span v-if="dataYear != null" class="panel__year">{{ t('panel.dataYear', { year: dataYear }) }}</span>
    </header>
    <div class="panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.panel {
  background: var(--c-surface-1);
  border: 1px solid var(--c-border-hairline);
  border-radius: var(--radius-panel);
  padding: 20px 24px;
}
.panel__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.panel__title {
  font-size: 18px;
  line-height: 26px;
}
.panel__year {
  font-size: 12px;
  color: var(--c-text-low);
  white-space: nowrap;
}
</style>
