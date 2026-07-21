<script setup lang="ts">
import { computed } from 'vue'
import { HORIZON_ANCHOR_YEAR, horizonTargetYear } from '../../../shared/config/derivation'
import { useViewStore } from '../../stores/view'

// The single reusable window caption (point 5): every scene figure — the ×N badge and the equivalence
// strip — is summed over the SAME forward window, anchored at HORIZON_ANCHOR_YEAR (2026) and closing at
// the horizon's target year. Rather than each widget threading years through props, this Pinia-aware
// leaf reads the live horizon itself and renders "over 2026–N" (or the single-year "in 2026" when the
// horizon is `today`), so the copy stays in lockstep with the controls and never goes stale.
const { t } = useI18n()
const view = useViewStore()

const label = computed<string>(() => {
  const from = HORIZON_ANCHOR_YEAR
  const to = horizonTargetYear(view.horizon)
  return from === to ? t('window.single', { year: from }) : t('window.range', { from, to })
})
</script>

<template>
  <span class="window-label">{{ label }}</span>
</template>
