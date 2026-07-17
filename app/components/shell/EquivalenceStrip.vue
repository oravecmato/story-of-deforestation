<script setup lang="ts">
import { computed } from 'vue'
import type { EquivalenceUnit, GlobalResultDTO } from '../../../shared/types'
import LoadingSkeleton from '../state/LoadingSkeleton.vue'
import EmptyState from '../state/EmptyState.vue'
import ErrorRetry from '../state/ErrorRetry.vue'
import UnitToggle from '../controls/UnitToggle.vue'
import { deriveStripValues, toUnit, type UnitBasis } from '../../story/equivalenceStrip'
import { EQUIVALENCE_CONFIG, resolveReferenceCountry } from '../../../shared/config/equivalences'
import { useDataStore } from '../../stores/data'
import { useViewStore } from '../../stores/view'
import { useUiStore } from '../../stores/ui'
import { useFormatter } from '../../composables/useFormatter'
import { useReload } from '../../composables/useReload'

// Slide-6 equivalence strip (UI §6.7, ADR-025, §17.4). A full-width footer bar of FOUR colour-coded
// magnitudes, each a pure client-side reduction over the already-fetched GLOBAL DTO across the
// footprint scene's forward window `[HORIZON_ANCHOR_YEAR, horizonTargetYear(horizon)]` — it moves
// with the horizon control that drives the charts above and needs no extra fetch. A unit switcher (Mt CO₂ · car ·
// country, default car) reprojects all four at once; the `country` basis reuses the locale-driven
// equivalence resolution (re-resolved on language change, no data refetch). Numbers via the injected
// Formatter; units/labels localized.
const { t } = useI18n()
const data = useDataStore()
const view = useViewStore()
const ui = useUiStore()
const formatter = useFormatter()
const reload = useReload()

/** The footprint scene is forced global, so the main result is the global DTO. */
const global = computed<GlobalResultDTO | undefined>(
  () => data.currentMainResult as GlobalResultDTO | undefined,
)
const hasData = computed(() => global.value != null)

const values = computed(() =>
  global.value ? deriveStripValues(global.value, view.baseline, view.horizon) : null,
)
const referenceYear = computed(() => global.value?.referenceYear)

/** The locale-driven reference country (SVK/UK) — its label + its back-computed annual CO₂ scalar. */
const referenceCountry = computed(() => resolveReferenceCountry(ui.locale))
/** Reference-country annual emissions (Mt CO₂), back-computed from the equivalence DTO's `times`
 *  factor: `times = effectiveCO₂ / countryAnnual`, so `countryAnnual = effectiveCO₂ / times`. */
const countryAnnualMt = computed<number | null>(() => {
  const eq = data.currentEquivalence
  if (!eq) return null
  const effective = eq.cumulativeCO2 ?? eq.annualRateCO2
  const times = eq.countryEquivalent.times
  return Number.isFinite(times) && times !== 0 ? effective / times : null
})
const basis = computed<UnitBasis>(() => ({
  carAnnualTonsCO2: EQUIVALENCE_CONFIG.carAnnualTonsCO2,
  countryAnnualMt: countryAnnualMt.value,
}))

type CellToken = 'stock' | 'forgoneSink' | 'total'
interface Cell {
  key: string
  valueMt: number
  token: CellToken
  captionKey: string
  note?: string
}

const cells = computed<Cell[]>(() => {
  const v = values.value
  if (!v) return []
  const asOf = referenceYear.value != null ? t('panel.dataYear', { year: referenceYear.value }) : undefined
  return [
    { key: 'stockWindow', valueMt: v.stockWindow, token: 'stock', captionKey: 'equivalenceStrip.stockWindow' },
    { key: 'forgoneAnnual', valueMt: v.forgoneAnnual, token: 'forgoneSink', captionKey: 'equivalenceStrip.forgoneAnnual', note: asOf },
    { key: 'forgoneWindow', valueMt: v.forgoneWindow, token: 'forgoneSink', captionKey: 'equivalenceStrip.forgoneWindow' },
    { key: 'combined', valueMt: v.combined, token: 'total', captionKey: 'equivalenceStrip.combined' },
  ]
})

const cellColor = (token: CellToken): string => ui.theme.data[token]

/** The formatted magnitude in the active unit (Formatter renders `n/a` for a missing country basis). */
const formatValue = (valueMt: number): string =>
  formatter.format(toUnit(valueMt, view.unit, basis.value))

/** A "≈" prefix on the derived units (car/country); the raw Mt CO₂ figure is shown as-is. */
const prefix = computed(() => (view.unit === 'mtco2' ? '' : '≈'))

/** The trailing unit label appended after the number (localized; country carries the country name). */
const unitSuffix = computed<(unit: EquivalenceUnit) => string>(() => (unit) => {
  if (unit === 'mtco2') return t('unit.mtco2')
  if (unit === 'car') return t('equivalenceStrip.unit.carSuffix')
  return t('equivalenceStrip.unit.countrySuffix', { country: t(referenceCountry.value.labelKey) })
})
</script>

<template>
  <section class="strip" :aria-label="t('panel.equivalence.title')">
    <div class="strip__head">
      <h2 class="strip__title">{{ t('panel.equivalence.title') }}</h2>
      <UnitToggle />
    </div>

    <ErrorRetry v-if="data.errors.global" :error="data.errors.global" @retry="reload" />
    <LoadingSkeleton v-else-if="data.loading.global && !hasData" height="96px" />
    <div v-else-if="cells.length" class="strip__grid">
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="strip__cell"
        :style="{ '--cell-color': cellColor(cell.token) }"
      >
        <p class="strip__value mono">
          <span v-if="prefix" class="strip__prefix">{{ prefix }}</span>
          {{ formatValue(cell.valueMt) }}
          <span class="strip__unit">{{ unitSuffix(view.unit) }}</span>
        </p>
        <p class="strip__caption">{{ t(cell.captionKey) }}</p>
        <p v-if="cell.note" class="strip__note">{{ cell.note }}</p>
      </div>
    </div>
    <EmptyState v-else />
  </section>
</template>

<style scoped>
.strip {
  border-top: 1px solid var(--c-border-hairline);
  background: var(--c-surface-1);
  border-radius: 10px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.strip__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.strip__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text-hi);
}
.strip__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.strip__cell {
  padding-left: 12px;
  border-left: 3px solid var(--cell-color);
}
.strip__value {
  margin: 0;
  font-size: 24px;
  line-height: 30px;
  font-weight: 500;
  color: var(--cell-color);
}
.strip__prefix {
  color: var(--c-text-mid);
  font-size: 18px;
}
.strip__unit {
  font-size: 13px;
  color: var(--c-text-mid);
  font-weight: 400;
}
.strip__caption {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--c-text-mid);
}
.strip__note {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--c-text-low);
}
@media (max-width: 899px) {
  .strip__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
