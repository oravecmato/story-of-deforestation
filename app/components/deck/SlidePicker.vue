<script setup lang="ts">
import Select from 'primevue/select'
import { computed, useId } from 'vue'
import { SLUGS } from '../../story/slides'

// The header slide indicator, as an interactive picker (replaces the static "Slide n of total"). The
// options read as a uniform "n of total" (deck.slideOf) with no leading label; the bound value tracks
// the current slug, so it auto-updates as the deck navigates, and a manual pick emits `navigate` to
// switch slides.
const props = defineProps<{ slug: string }>()
const emit = defineEmits<{ navigate: [slug: string] }>()
const { t } = useI18n()
const selectId = useId()

const options = computed(() =>
  SLUGS.map((slug, i) => ({ value: slug, label: t('deck.slideOf', { n: i + 1, total: SLUGS.length }) })),
)

const model = computed<string>({
  get: () => props.slug,
  set: (v) => {
    if (v && v !== props.slug) emit('navigate', v)
  },
})
</script>

<template>
  <Select
    v-model="model"
    :input-id="selectId"
    :options="options"
    option-label="label"
    option-value="value"
    :aria-label="t('deck.slideSelect')"
    class="slide-picker"
  />
</template>

<style scoped>
.slide-picker {
  flex: 0 0 auto;
}
</style>
