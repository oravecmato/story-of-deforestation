import { describe, it, expect } from 'vitest'
import type { BandSeries, GlobalResultDTO, Series } from '../shared/types'
import { deriveStripValues, toUnit, MT_TO_T } from '../app/story/equivalenceStrip'

// Slide-6 equivalence-strip reductions (ADR-025, §17.4). Pure: the symmetric window
// `[baseline, horizonTargetYear(horizon)]` over the already-fetched global DTO — every magnitude a
// TRUE finite integral Σ (business §2.4 #2), including the forgone sink — plus the unit conversions.

const stock: Series = {
  id: 'aggregateStock',
  points: [
    { source: 'derived', geo: 'GLOBAL', year: 2010, value: 999 }, // pre-baseline → excluded
    { source: 'derived', geo: 'GLOBAL', year: 2015, value: 200 },
    { source: 'projected', geo: 'GLOBAL', year: 2030, value: 300 },
    { source: 'projected', geo: 'GLOBAL', year: 2046, value: 400 },
    { source: 'projected', geo: 'GLOBAL', year: 2056, value: 500 },
  ],
  meta: {
    indicatorId: 'aggregateStock',
    seriesType: 'flow',
    unit: 'Mt CO2',
    latestDataYear: 2020,
    gaps: [],
    isEstimate: false,
    projectedFrom: 2020,
  },
}

const forgone: BandSeries = {
  id: 'aggregateForgoneSink',
  points: [
    { source: 'derived', geo: 'GLOBAL', year: 2010, value: 40 }, // pre-baseline → excluded
    { source: 'derived', geo: 'GLOBAL', year: 2020, value: 50 }, // level @referenceYear
    { source: 'projected', geo: 'GLOBAL', year: 2030, value: 120 },
    { source: 'projected', geo: 'GLOBAL', year: 2046, value: 130 },
    { source: 'projected', geo: 'GLOBAL', year: 2056, value: 140 },
  ],
  lower: [],
  upper: [],
  meta: {
    indicatorId: 'aggregateForgoneSink',
    seriesType: 'flow',
    unit: 'Mt CO2',
    latestDataYear: 2020,
    gaps: [],
    isEstimate: true,
    projectedFrom: 2020,
  },
}

const global = {
  referenceYear: 2020,
  aggregateStock: stock,
  aggregateForgoneSink: forgone,
} as unknown as GlobalResultDTO

describe('deriveStripValues', () => {
  it('sums stock AND integrates the forgone flow over the symmetric window [baseline, targetYear]', () => {
    // baseline 2015, horizon 20y → window [2015, 2046]
    const v = deriveStripValues(global, 2015, '20y')
    // stock window excludes 2010 (pre-baseline) and 2056 (past target): 200 + 300 + 400 = 900
    expect(v.stockWindow).toBe(900)
    // annual forgone = level at referenceYear (2020) → the 2020 point
    expect(v.forgoneAnnual).toBe(50)
    // forgone to horizon = TRUE Σ over the window: 50 + 120 + 130 = 300 (2010 excluded, 2056 past)
    expect(v.forgoneWindow).toBe(300)
    // combined = stock window + forgone over the window
    expect(v.combined).toBe(1200)
  })

  it('grows the window with the horizon (upper edge)', () => {
    // baseline 2015, horizon 30y → window [2015, 2056]: 2056 now falls inside
    const v = deriveStripValues(global, 2015, '30y')
    expect(v.stockWindow).toBe(1400) // 200 + 300 + 400 + 500
    expect(v.forgoneWindow).toBe(440) // 50 + 120 + 130 + 140
    expect(v.combined).toBe(1840)
  })

  it('moves the lower edge with the baseline (later baseline → smaller window)', () => {
    // baseline 2020, horizon 20y → window [2020, 2046]: 2015 now excluded
    const v = deriveStripValues(global, 2020, '20y')
    expect(v.stockWindow).toBe(700) // 300 + 400
    expect(v.forgoneWindow).toBe(300) // 50 + 120 + 130
  })

  it('stays non-zero at horizon today (cumulative-to-today, no forward projection)', () => {
    // baseline 2015, horizon today → window [2015, 2026]: measured data only
    const v = deriveStripValues(global, 2015, 'today')
    expect(v.stockWindow).toBe(200) // 2015 only
    expect(v.forgoneWindow).toBe(50) // 2020 only
    expect(v.combined).toBe(250)
  })
})

describe('toUnit', () => {
  const basis = { carAnnualTonsCO2: 4.6, countryAnnualMt: 300 }

  it('mtco2 is the value itself', () => {
    expect(toUnit(900, 'mtco2', basis)).toBe(900)
  })

  it('car divides by one car annual (Mt→t)', () => {
    expect(toUnit(900, 'car', basis)).toBeCloseTo((900 * MT_TO_T) / 4.6, 3)
  })

  it('country divides by the reference-country annual (Mt÷Mt → ×times)', () => {
    expect(toUnit(900, 'country', basis)).toBeCloseTo(3, 6)
  })

  it('country is null when the basis is missing (→ Formatter shows n/a)', () => {
    expect(toUnit(900, 'country', { carAnnualTonsCO2: 4.6, countryAnnualMt: null })).toBeNull()
  })
})
