<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { nextSlug, prevSlug } from '../../story/slides'
import ProgressIndicator from './ProgressIndicator.vue'

// Deck navigation (design §5.1, tech-spec §17.2): Back / Next over the authored slide order plus a dot
// progress indicator, with ←/→ keyboard shortcuts. It only changes the slug — the persistent
// `/story/:slug` route swaps the stage without remounting (ADR-023). The page owns scene entry + the
// URL param sync; this component is navigation only.
const props = defineProps<{ slug: string }>()
const emit = defineEmits<{ navigate: [slug: string] }>()
const { t } = useI18n()

const prev = computed(() => prevSlug(props.slug))
const next = computed(() => nextSlug(props.slug))

const go = (slug: string | null) => {
  if (slug) emit('navigate', slug)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') go(next.value)
  else if (e.key === 'ArrowLeft') go(prev.value)
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <nav class="deck-nav">
    <Button
      class="deck-nav__back"
      :label="t('deck.back')"
      icon="pi pi-chevron-left"
      severity="secondary"
      text
      :disabled="!prev"
      @click="go(prev)"
    />
    <ProgressIndicator :slug="slug" />
    <Button
      class="deck-nav__next"
      :label="t('deck.next')"
      icon="pi pi-chevron-right"
      icon-pos="right"
      :disabled="!next"
      @click="go(next)"
    />
  </nav>
</template>

<style scoped>
.deck-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 0;
  border-top: 1px solid var(--c-border-hairline);
}
</style>
