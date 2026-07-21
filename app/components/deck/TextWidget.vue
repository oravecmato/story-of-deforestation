<script setup lang="ts">
// A slide's text block (tech-spec §17.2, ADR-027). ONE generic widget that renders any of an optional
// heading, caption and body copy in the fixed order heading → caption → text, each with its own tag
// and type ramp (h2 hi-contrast heading · muted caption line · muted body paragraphs). The block is
// vertically centred in its grid cell so heading+caption+text read as a single contiguous unit (and
// can one day animate together). Copy is i18n keys only (ADR-011) — this component holds no prose.
defineProps<{
  headingKey?: string
  captionKey?: string
  textKeys?: string[]
}>()
const { t } = useI18n()
</script>

<template>
  <div class="slide-text">
    <h2 v-if="headingKey" class="slide-text__heading">{{ t(headingKey) }}</h2>
    <p v-if="captionKey" class="slide-text__caption">{{ t(captionKey) }}</p>
    <div v-if="textKeys?.length" class="slide-text__body">
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
  margin: 0;
  font-size: 22px;
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
</style>
