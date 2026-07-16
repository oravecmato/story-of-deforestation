<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'
import { useUiStore, type Locale } from '../../stores/ui'

// Header language toggle (UI §11, design §6). Switching is a pure view re-resolution (ADR-011):
// it updates @nuxtjs/i18n (cookie-persisted) AND the ui store locale, which reactively re-anchors
// the equivalence reference country (business §4.4) without any data refetch.
const { locale, t, setLocale } = useI18n()
const ui = useUiStore()

const options = [
  { value: 'en', label: t('language.en') },
  { value: 'sk', label: t('language.sk') },
]

const model = computed<string>({
  get: () => locale.value,
  set: (next) => {
    if (!next || next === locale.value) return
    setLocale(next as Locale)
    ui.setLocale(next as Locale)
  },
})
</script>

<template>
  <SelectButton
    v-model="model"
    :options="options"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    :aria-label="t('language.label')"
  />
</template>
