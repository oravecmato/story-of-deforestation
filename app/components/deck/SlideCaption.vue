<script setup lang="ts">
// The thin caption line the `duo-viz-equiv` preset renders ON TOP in place of the bottom text block
// (slide 6, ADR-025, §17.2). One localized line — copy is an i18n key only (ADR-011).
defineProps<{ captionKey: string }>()
const { t } = useI18n()
</script>

<template>
  <p class="slide-caption">{{ t(captionKey) }}</p>
</template>

<style scoped>
.slide-caption {
  margin: 0;
  max-width: 72ch;
  color: var(--c-text-mid);
  font-size: 15px;
  line-height: 22px;
}
</style>
