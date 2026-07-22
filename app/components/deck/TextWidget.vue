<script setup lang="ts">
import { computed } from 'vue'

// A slide's text block (tech-spec §17.2, ADR-027). ONE generic widget that renders any of an optional
// heading, caption and body copy in the fixed order heading → caption → text, each with its own tag
// and type ramp (h2 hi-contrast heading · muted caption line · muted body paragraphs). The block is
// vertically centred in its grid cell so heading+caption+text read as a single contiguous unit. Copy is
// i18n keys only (ADR-011) — this component holds no prose. On entry each present element reveals with a
// staggered slide-in-from-right + fade (see `revealStyle`); the parent re-keys this widget per slide so
// the reveal replays on every slide switch.
const props = defineProps<{
  headingKey?: string
  captionKey?: string
  textKeys?: string[]
}>()
const { t } = useI18n()

// The present elements in render order (heading → caption → body). A lone element runs the base 1s
// animation with no delay; when the block has more than one, each element below the top cascades in
// 400ms later and runs 200ms longer than the one above it.
const order = computed(() => {
  const present: Array<'heading' | 'caption' | 'body'> = []
  if (props.headingKey) present.push('heading')
  if (props.captionKey) present.push('caption')
  if (props.textKeys?.length) present.push('body')
  return present
})
const revealStyle = (kind: 'heading' | 'caption' | 'body') => {
  const i = Math.max(0, order.value.indexOf(kind))
  return { animationDuration: `${1000 + i * 200}ms`, animationDelay: `${i * 400}ms` }
}
</script>

<template>
  <div class="slide-text">
    <h2 v-if="headingKey" class="slide-text__heading slide-text__reveal" :style="revealStyle('heading')">
      {{ t(headingKey) }}
    </h2>
    <p v-if="captionKey" class="slide-text__caption slide-text__reveal" :style="revealStyle('caption')">
      {{ t(captionKey) }}
    </p>
    <div v-if="textKeys?.length" class="slide-text__body slide-text__reveal" :style="revealStyle('body')">
      <p v-for="key in textKeys" :key="key" class="slide-text__p">{{ t(key) }}</p>
    </div>
  </div>
</template>

<style scoped>
.slide-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
  max-width: 68ch;
}
/* Fixed inter-block spacing: the first block hugs the top of the centred stack, every subsequent
   block (caption after heading, body after either) gets a top gap. */
.slide-text > * + * {
  padding-top: 8px;
}
.slide-text__heading {
  margin: 0 0 10px;
  font-family: 'Arial Black', Arial, sans-serif;
  font-size: 27px;
  line-height: 30px;
  color: var(--c-text-hi);
}
.slide-text__caption {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  color: var(--c-text-mid);
}
.slide-text__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.slide-text__p {
  margin: 0;
  font-size: 16px;
  line-height: 26px;
  color: var(--c-text-mid);
}
/* Per-element entry reveal: slide in from the right while fading up. Duration/delay are set inline per
   element (staggered cascade). `both` fill keeps the element at the hidden start state through its delay
   and pinned at the resolved end state afterwards — so a delayed element stays invisible until its turn. */
.slide-text__reveal {
  animation-name: slide-text-reveal;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}
@keyframes slide-text-reveal {
  from {
    opacity: 0;
    transform: translateX(80px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .slide-text__reveal {
    animation: none;
  }
}
</style>
