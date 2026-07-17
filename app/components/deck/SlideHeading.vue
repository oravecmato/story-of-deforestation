<script setup lang="ts">
// A slide's heading (tech-spec §17.2). Copy is an i18n key only (ADR-011); sits above the text block,
// below the visualisation.
defineProps<{ headingKey: string }>()
const { t } = useI18n()
</script>

<template>
  <h2 class="slide-heading">{{ t(headingKey) }}</h2>
</template>

<style scoped>
.slide-heading {
  font-size: 22px;
  line-height: 30px;
  color: var(--c-text-hi);
  margin: 0 0 8px;
}
</style>
