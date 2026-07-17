<script setup lang="ts">
// A slide's body copy (tech-spec §17.2): one paragraph per i18n key, full-width, below the viz. Copy
// is i18n keys only (ADR-011) — this component holds no prose.
defineProps<{ textKeys: string[] }>()
const { t } = useI18n()
</script>

<template>
  <div class="slide-text">
    <p v-for="key in textKeys" :key="key" class="slide-text__p">{{ t(key) }}</p>
  </div>
</template>

<style scoped>
.slide-text {
  max-width: 68ch;
}
.slide-text__p {
  margin: 0 0 12px;
  color: var(--c-text-mid);
  font-size: 16px;
  line-height: 26px;
}
.slide-text__p:last-child {
  margin-bottom: 0;
}
</style>
