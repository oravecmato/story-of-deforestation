import { describe, it, expect } from 'vitest'
import type { BandSeries, GlobalResultDTO, Series } from '../shared/types'
import { deriveStripValues, toUnit, MT_TO_T } from '../app/story/equivalenceStrip'

// Slide-6 equivalence-strip reductions (ADR-025, §17.4). Pure: the FORWARD window
// `[referenceYear, referenceYear + horizonYears(horizon)]` over the already-fetched global DTO — every
// magnitude a TRUE finite integral Σ (business §2.4 #2), including the forgone sink — plus the unit
// conversions. The window is anchored at the DTO's referenceYear; the baseline stays orthogonal (it
// sets the forgone-sink DEPTH already baked into the series, not the window bounds).

const stock: Series = {
  id: 'aggregateStock',
  points: [
    { source: 'derived', geo: 'GLOBAL', year: 2010, value: 999 }, // pre-referenceYear → excluded
    { source: 'derived', geo: 'GLOBAL', year: 2020, value: 200 }, // referenceYear
    { source: 'projected', geo: 'GLOBAL', year: 2040, value: 300 },
    { source: 'projected', geo: 'GLOBAL', year: 2050, value: 400 },
    { source: 'projected', geo: 'GLOBAL', year: 2070, value: 500 },
  ],
  meta: {
    indicatorId: 'aggregateStock',
    seriesType: 'flow',
    unit: 'Mt CO2',
    latestDataYear: 2020,
    gaps: [],
    isEstimate: false,
    projectedFrom: 2020,
    reconstructedBefore: null,
  },
}

const forgone: BandSeries = {
  id: 'aggregateForgoneSink',
  points: [
    { source: 'derived', geo: 'GLOBAL', year: 2010, value: 40 }, // pre-referenceYear → excluded
    { source: 'derived', geo: 'GLOBAL', year: 2020, value: 50 }, // level @referenceYear
    { source: 'projected', geo: 'GLOBAL', year: 2040, value: 120 },
    { source: 'projected', geo: 'GLOBAL', year: 2050, value: 130 },
    { source: 'projected', geo: 'GLOBAL', year: 2070, value: 140 },
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
    reconstructedBefore: null,
  },
}

const global = {
  referenceYear: 2020,
  aggregateStock: stock,
  aggregateForgoneSink: forgone,
} as unknown as GlobalResultDTO

describe('deriveStripValues', () => {
  it('sums stock AND integrates the forgone flow over the forward window [referenceYear, refYear+horizonYears]', () => {
    // referenceYear 2020, horizon 20y → window [2020, 2040]
    const v = deriveStripValues(global, forgone, '20y')
    // stock window excludes 2010 (pre-refYear) and 2050/2070 (past target): 200 + 300 = 500
    expect(v.stockPeriod).toBe(500)
    // annual forgone = level at referenceYear (2020) → the 2020 point
    expect(v.forgoneAnnual).toBe(50)
    // forgone to horizon = TRUE Σ over the window: 50 + 120 = 170
    expect(v.forgonePeriod).toBe(170)
    // combined = stock window + forgone over the window
    expect(v.combinedPeriod).toBe(670)
  })

  it('grows the window with the horizon (upper edge)', () => {
    // referenceYear 2020, horizon 30y → window [2020, 2050]: 2050 now falls inside
    const v = deriveStripValues(global, forgone, '30y')
    expect(v.stockPeriod).toBe(900) // 200 + 300 + 400
    expect(v.forgonePeriod).toBe(300) // 50 + 120 + 130
    expect(v.combinedPeriod).toBe(1200)
  })

  it('collapses to the single reference year at horizon today (continuity with the measured ratio)', () => {
    // referenceYear 2020, horizon today → window [2020, 2020]: the measured year only
    const v = deriveStripValues(global, forgone, 'today')
    expect(v.stockPeriod).toBe(200) // 2020 only
    expect(v.forgonePeriod).toBe(50) // 2020 only
    expect(v.combinedPeriod).toBe(250)
  })

  it('anchors the window at the DTO referenceYear (not a fixed calendar year)', () => {
    // A DTO whose referenceYear is 2040 shifts the window forward: 30y → [2040, 2070]
    const shifted = { ...global, referenceYear: 2040 } as unknown as GlobalResultDTO
    const v = deriveStripValues(shifted, forgone, '30y')
    expect(v.stockPeriod).toBe(1200) // 300 + 400 + 500
    expect(v.forgoneAnnual).toBe(120) // level at 2040
    expect(v.forgonePeriod).toBe(390) // 120 + 130 + 140
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
