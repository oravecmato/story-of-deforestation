<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useViewStore } from '../../stores/view'
import { resolveReferenceCountry } from '../../../shared/config/equivalences'
import UnitToggle from './UnitToggle.vue'

// Equivalence-strip unit selector (UI §6.7, design §6). The strip cells now show only a pictogram
// (car glyph / country flag) with no words, so the ACTIVE unit's full meaning has to live here: the
// collapsed trigger reads "Jednotka:" over the selected unit's long label — "Mt CO₂", "ročné emisie
// osobného automobilu", "ročné emisie Slovenska". Those strings are too long to sit inline as toggle
// buttons, so clicking the trigger opens a popover holding the compact segmented `UnitToggle` (its
// original short-label form, unchanged). Same hand-rolled popover pattern as `BaselineControl`
// (PrimeVue inner control, custom shell + outside-click/Escape close) so the app's popovers stay
// consistent. Pure view state — no refetch, out of the URL.
// `fullWidth` (set by the strip's vertical/lab layout) stretches the trigger to fill its column; the
// horizontal footer variant leaves it content-width so it doesn't span the whole strip head.
defineProps<{ fullWidth?: boolean }>()

const { t, locale } = useI18n()
const view = useViewStore()

/** The selected unit's long label for the trigger (the country name is locale-driven, business §4.4). */
const selectedLabel = computed(() => {
  switch (view.unit) {
    case 'mtco2':
      return t('equivalenceStrip.unit.mtco2')
    case 'car':
      return t('equivalenceStrip.unit.carLong')
    case 'country':
      return t('equivalenceStrip.unit.countryLong', {
        country: t(resolveReferenceCountry(String(locale.value)).labelKey),
      })
  }
  return ''
})

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const toggle = () => (open.value = !open.value)
const close = () => (open.value = false)

// Picking a unit closes the popover so the trigger immediately reflects the new choice.
watch(() => view.unit, close)

// Close on outside click / Escape (capture phase, before PrimeVue's own overlay handlers).
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
  <div ref="root" class="unit-select" :class="{ 'unit-select--block': fullWidth }">
    <button
      type="button"
      class="unit-select__trigger"
      :aria-label="t('equivalenceStrip.unit.label')"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <span class="unit-select__label">{{ t('equivalenceStrip.unit.label') }}:</span>
      <span class="unit-select__value">
        <span class="unit-select__value-text">{{ selectedLabel }}</span>
        <svg class="unit-select__caret" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>

    <div v-if="open" class="unit-select__popover" role="dialog" :aria-label="t('equivalenceStrip.unit.label')">
      <UnitToggle />
    </div>
  </div>
</template>

<style scoped>
.unit-select {
  position: relative;
  /* Horizontal footer default: only as wide as its content, so the picker doesn't span the strip head. */
  flex: 0 0 auto;
}
/* Vertical/lab aside: claim the column's remaining width so the trigger is a stable, full-width field
   whose size does NOT jump as the selected unit's label changes length. */
.unit-select--block {
  flex: 1 1 auto;
  min-width: 0;
}
.unit-select__trigger {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  max-width: 100%;
  padding: 5px 10px;
  border: 1px solid var(--c-border-hairline);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.unit-select--block .unit-select__trigger {
  display: flex;
  width: 100%;
  box-sizing: border-box;
}
.unit-select__trigger:hover,
.unit-select__trigger[aria-expanded='true'] {
  border-color: var(--c-border-strong);
  background: var(--c-surface-2);
}
.unit-select__trigger:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}
.unit-select__label {
  font-size: 11px;
  line-height: 14px;
  color: var(--c-text-low);
}
.unit-select__value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}
.unit-select__value-text {
  font-size: 13px;
  line-height: 18px;
  font-weight: 500;
  color: var(--c-text-hi);
  white-space: nowrap;
}
.unit-select__caret {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--c-text-mid);
}
.unit-select__popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  padding: 10px;
  /* Size the popover to its own content, never to the (possibly narrow) content-width trigger, and
     keep its rows on one line so the segmented toggle never wraps. */
  width: max-content;
  white-space: nowrap;
  background: var(--c-surface-1);
  border: 1px solid var(--c-border-strong);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
</style>
