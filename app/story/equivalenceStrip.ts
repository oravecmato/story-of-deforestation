import type { BandSeries, EquivalenceUnit, GlobalResultDTO, Horizon, Series } from '../../shared/types'
import { sceneWindow } from '../../shared/config/derivation'

// Pure client-side reductions behind the slide-6 equivalence strip (ADR-025, §17.4). The four
// magnitudes are derived from the ALREADY-FETCHED global DTO over the footprint scene's symmetric
// window `[baseline, horizonTargetYear(horizon)]` — with no new endpoint and no refetch beyond the
// baseline/horizon controls that drive the charts above. Kept Vue/Pinia-free so it is unit-testable;
// the `EquivalenceStrip` component is the only Pinia-aware seam (reads the DTO + baseline + horizon +
// locale and calls these).

/** Mt CO₂ → tonnes CO₂ (for the passenger-car count). Mirrors `stats.MT_TO_T`. */
export const MT_TO_T = 1e6

/** The four strip magnitudes, all in Mt CO₂ before unit conversion (§17.4). */
export interface StripValues {
  /** Value 1 — stock released over the window (Σ `aggregateStock` across `[baseline, targetYear]`). */
  stockWindow: number
  /** Value 2 — forgone-sink annual rate at the last measured year (`referenceYear`). */
  forgoneAnnual: number
  /** Value 3 — forgone sink integrated over the window = the TRUE finite integral
   *  Σ `aggregateForgoneSink` across `[baseline, targetYear]` (business §2.4 quantity #2), the same
   *  basis as `stockWindow` and the fossil bar. */
  forgoneWindow: number
  /** Value 4 — combined total = value 1 + value 3 (stock + forgone over the window). */
  combined: number
}

/** Σ of a series' non-null values over the inclusive year window `[from, to]`. */
function sumWindow(series: Series, from: number, to: number): number {
  let sum = 0
  for (const p of series.points) {
    if (p.year >= from && p.year <= to && p.value != null) sum += p.value
  }
  return sum
}

/** The series' value at `year`, or — if that exact year is absent — the last real value at or before
 *  it (robust to a horizon that lands between the projected points). 0 if the window has no data. */
function levelAt(points: Series['points'], year: number): number {
  let level = 0
  for (const p of points) {
    if (p.year > year) break
    if (p.value != null) level = p.value
  }
  return level
}

/**
 * Reduce the global DTO into the strip's four Mt CO₂ magnitudes over the symmetric window
 * `[baseline, horizonTargetYear(horizon)]` (§17.4). The DTO's series are already projected to the
 * target year server-side. Value 2 is the annual forgone-sink rate at the DTO's `referenceYear`
 * (measured year); value 3 is the TRUE finite integral Σ of that flow over the window — the same
 * basis as `stockWindow`, so all magnitudes are the same kind of quantity (business §2.4 #2).
 */
export function deriveStripValues(
  global: GlobalResultDTO,
  baseline: number,
  horizon: Horizon,
): StripValues {
  const { from, to } = sceneWindow(baseline, horizon)
  const forgone: BandSeries = global.aggregateForgoneSink
  const stockWindow = sumWindow(global.aggregateStock, from, to)
  const forgoneAnnual = levelAt(forgone.points, global.referenceYear)
  // Forgone sink is a FLOW (Mt CO₂/yr): the loss over the window is the TRUE finite integral Σ of the
  // annual rate across the window's years — consistent with stock/fossil (business §2.4 #2).
  const forgoneWindow = sumWindow(forgone, from, to)
  return {
    stockWindow,
    forgoneAnnual,
    forgoneWindow,
    combined: stockWindow + forgoneWindow,
  }
}

/** Basis scalars for the non-`mtco2` units (§17.4). */
export interface UnitBasis {
  /** One passenger car's annual emissions, tonnes CO₂ (`equivalenceConfig.carAnnualTonsCO2`). */
  carAnnualTonsCO2: number
  /** The locale-driven reference country's annual emissions, Mt CO₂ (SVK/UK), or null if unresolved. */
  countryAnnualMt: number | null
}

/**
 * Convert one Mt CO₂ magnitude into the chosen unit (§17.4): `mtco2` is the value itself; `car`
 * divides by one car's annual (converting Mt→t); `country` divides by the reference country's annual
 * (Mt÷Mt → a ×times factor). Returns null when the basis is missing so the caller can show `n/a`.
 */
export function toUnit(valueMt: number, unit: EquivalenceUnit, basis: UnitBasis): number | null {
  switch (unit) {
    case 'mtco2':
      return valueMt
    case 'car':
      return (valueMt * MT_TO_T) / basis.carAnnualTonsCO2
    case 'country':
      return basis.countryAnnualMt && basis.countryAnnualMt !== 0
        ? valueMt / basis.countryAnnualMt
        : null
  }
}
