<script setup lang="ts">
import Select from 'primevue/select'
import { computed, ref, useId, onMounted, onBeforeUnmount } from 'vue'
import { DEFAULT_BASELINE, BASELINE_MAX } from '#shared/config/derivation'
import { useViewStore } from '../../stores/view'

// Baseline year (UI §3, design §6): the sink-integration origin. Tucked behind a kebab (three-dot)
// settings menu that opens a popover holding a label + a compact year select (1990→BASELINE_MAX in 5s).
// Changing it re-derives cumulative loss (and therefore the forgone sink) — a pure client-transform
// (ADR-026), no refetch. This is the COARSE control over the measured range; the `BaselineSlider` is
// its full-range alternative. The trigger pins to the container's right edge (settings slot); the
// popover hangs below it and extends leftward.
const { t } = useI18n()
const view = useViewStore()
const selectId = useId()

// Offer 1990 → BASELINE_MAX in 5-year steps (compact). The popover label carries the meaning, so the
// options are bare year numbers.
const years = computed(() => {
  const out: Array<{ value: number; label: string }> = []
  for (let y = DEFAULT_BASELINE; y <= BASELINE_MAX; y += 5) out.push({ value: y, label: String(y) })
  return out
})

const model = computed<number>({
  get: () => view.baseline,
  set: (v) => {
    if (typeof v === 'number') view.setBaseline(v)
  },
})

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const toggle = () => (open.value = !open.value)
const close = () => (open.value = false)

// Close on outside click / Escape (capture phase so it fires before PrimeVue's own overlay handlers).
const onDocPointer = (e: PointerEvent) => {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close()
}
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') close()
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="baseline-menu">
    <button
      type="button"
      class="baseline-menu__trigger"
      :aria-label="t('baseline.label')"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <svg class="baseline-menu__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>

    <div v-if="open" class="baseline-menu__popover" role="dialog" :aria-label="t('baseline.label')">
      <label class="baseline-menu__label" :for="selectId">{{ t('baseline.menuLabel') }}</label>
      <Select
        v-model="model"
        :input-id="selectId"
        :options="years"
        option-label="label"
        option-value="value"
        append-to="self"
        class="baseline-menu__select"
      />
    </div>
  </div>
</template>

<style scoped>
.baseline-menu {
  position: relative;
}
.baseline-menu__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--c-border-hairline);
  border-radius: 8px;
  background: transparent;
  color: var(--c-text-mid);
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}
.baseline-menu__trigger:hover,
.baseline-menu__trigger[aria-expanded='true'] {
  color: var(--c-text-hi);
  border-color: var(--c-border-strong);
  background: var(--c-surface-2);
}
.baseline-menu__trigger:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}
.baseline-menu__icon {
  fill: currentColor;
}
.baseline-menu__popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  min-width: 20rem;
  max-width: min(24rem, 90vw);
  background: var(--c-surface-1);
  border: 1px solid var(--c-border-strong);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
.baseline-menu__label {
  font-size: 13px;
  line-height: 18px;
  color: var(--c-text-mid);
}
.baseline-menu__select {
  width: 100%;
}
</style>
