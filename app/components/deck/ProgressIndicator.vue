<script setup lang="ts">
import { computed } from 'vue'
import { SLUGS, slideIndex } from '../../story/slides'

// The deck's dot progress indicator (design §5.1). Reads the active slug from the route and marks the
// current position; the numeric "slide N / total" read-out lives in the header. Presentational only.
const props = defineProps<{ slug: string }>()
const { t } = useI18n()

const activeIndex = computed(() => slideIndex(props.slug))
const total = computed(() => SLUGS.length)
</script>

<template>
  <div class="progress" role="group" :aria-label="t('deck.progress', { n: activeIndex + 1, total })">
    <span
      v-for="(s, i) in SLUGS"
      :key="s"
      class="progress__dot"
      :class="{ 'progress__dot--active': i === activeIndex }"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.progress {
  display: flex;
  align-items: center;
  gap: 10px;
}
.progress__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-border-strong);
  transition: background-color 160ms ease;
}
.progress__dot--active {
  background: var(--c-accent);
}
</style>
