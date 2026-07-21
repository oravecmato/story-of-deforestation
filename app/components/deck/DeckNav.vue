<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { nextSlug, prevSlug } from '../../story/slides'

// Deck navigation (design §5.1, tech-spec §17.2): two full-height ghost lanes pinned to the left and
// right screen edges — the whole gutter between the content container and the viewport edge is a
// clickable target, with a thin white chevron centred in it. They sit at a low resting opacity and rise
// to full on hover (the lane spans the gutter's full width, so hovering anywhere at that X reveals the
// arrow). A lane only renders when there is a slide in that direction. ←/→ keyboard shortcuts stay. It
// only changes the slug — the persistent `/story/:slug` route swaps the stage without remounting
// (ADR-023); the page owns scene entry + URL sync.
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
  <div class="deck-nav">
    <button
      v-if="prev"
      type="button"
      class="deck-nav__lane deck-nav__lane--prev"
      :aria-label="t('deck.back')"
      @click="go(prev)"
    >
      <svg class="deck-nav__chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 5 L8 12 L15 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <button
      v-if="next"
      type="button"
      class="deck-nav__lane deck-nav__lane--next"
      :aria-label="t('deck.next')"
      @click="go(next)"
    >
      <svg class="deck-nav__chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 5 L16 12 L9 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* Full-height ghost lanes in the viewport gutters. `--arrow-lane` is defined on `.deck` (the page caps
   the content container's max-width by it, so the lanes never overlap the slide). */
.deck-nav__lane {
  position: fixed;
  top: 0;
  height: 100vh;
  width: var(--arrow-lane, 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--c-text-hi, #fff);
  cursor: pointer;
  opacity: 0.35;
  transition: opacity 0.18s ease;
  z-index: 20;
}
.deck-nav__lane--prev {
  left: 0;
}
.deck-nav__lane--next {
  right: 0;
}
.deck-nav__lane:hover,
.deck-nav__lane:focus-visible {
  opacity: 1;
}
.deck-nav__lane:focus-visible {
  outline: 2px solid var(--c-accent, #3fb6a8);
  outline-offset: -4px;
}
/* Icon sizes with the viewport but never shrinks below a legible minimum on small monitors. */
.deck-nav__chevron {
  width: clamp(22px, 2.4vw, 40px);
  height: clamp(22px, 2.4vw, 40px);
}
</style>
