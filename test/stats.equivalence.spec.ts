import { describe, it, expect } from 'vitest'
import { sumSeries, equivalence, MT_TO_T } from '../server/utils/stats'
import { EQUIVALENCE_CONFIG } from '../shared/config/equivalences'
import type { DerivationParams } from '../shared/types'
import { mkSeries, values, years } from './helpers/series'

const PARAMS: DerivationParams = {
  scope: 'global',
  horizon: 'today',
  rScenario: 'mid',
  baseline: 1990,
}

describe('sumSeries (pure)', () => {
  it('sums contributors pointwise over the union of years, stamping geo/id', () => {
    const a = mkSeries('a', [[1990, 10], [1991, 20], [1992, 30]], { latestDataYear: 1992 })
    const b = mkSeries('b', [[1990, 1], [1991, 2], [1992, 3]], { latestDataYear: 1992 })

    const sum = sumSeries([a, b], 'domain-area', 'DOM')
    expect(years(sum)).toEqual([1990, 1991, 1992])
    expect(values(sum)).toEqual([11, 22, 33])
    expect(sum.meta.latestDataYear).toBe(1992)
    expect(sum.points.every((p) => p.geo === 'DOM')).toBe(true)
    expect(sum.id).toBe('domain-area')
  })

  it('unions uneven ranges — a short-ending contributor simply stops adding (no exclusion)', () => {
    // The CoverageGate (ADR-020) — not sumSeries — decides exclusion. Here nothing is dropped:
    // the short contributor just contributes nothing past its last year.
    const long1 = mkSeries('long1', [[2020, 100], [2021, 110], [2022, 120]], { latestDataYear: 2022 })
    const long2 = mkSeries('long2', [[2020, 10], [2021, 11], [2022, 12]], { latestDataYear: 2022 })
    const short = mkSeries('short', [[2020, 5], [2021, 6]], { latestDataYear: 2021 })

    const sum = sumSeries([long1, long2, short], 'dom')
    expect(years(sum)).toEqual([2020, 2021, 2022])
    expect(sum.meta.latestDataYear).toBe(2022)
    expect(values(sum)).toEqual([115, 127, 132]) // short adds in 2020/2021, absent in 2022
  })

  it('yields a null value only where every contributor is null', () => {
    const a = mkSeries('a', [[2000, null], [2001, 5]])
    const b = mkSeries('b', [[2000, null], [2001, 7]])
    const sum = sumSeries([a, b], 'dom')
    expect(values(sum)).toEqual([null, 12])
  })

  it('merges the contributors’ gaps into the summed series meta', () => {
    const a = mkSeries('a', [[2020, 1], [2021, 2]], {
      latestDataYear: 2021,
      gaps: [{ geo: 'AAA', reason: 'x' }],
    })
    const b = mkSeries('b', [[2020, 3], [2021, 4]], {
      latestDataYear: 2021,
      gaps: [{ geo: 'BBB', reason: 'y' }],
    })
    const sum = sumSeries([a, b], 'dom')
    expect(sum.meta.gaps).toContainEqual({ geo: 'AAA', reason: 'x' })
    expect(sum.meta.gaps).toContainEqual({ geo: 'BBB', reason: 'y' })
  })
})

describe('equivalence', () => {
  it('today horizon: no cumulative, car + country from the annual rate', () => {
    const dto = equivalence({
      params: PARAMS,
      referenceYear: 2022,
      horizon: 'today',
      annualRateCO2: 100, // Mt/yr
      referenceCountry: { iso3: 'GBR' },
      referenceCountryAnnualCO2: 400, // Mt/yr
      cfg: EQUIVALENCE_CONFIG,
    })
    expect(dto.cumulativeCO2).toBeNull()
    expect(dto.annualRateCO2).toBe(100)
    expect(dto.carEquivalent).toBeCloseTo((100 * MT_TO_T) / 4.6, 3)
    expect(dto.countryEquivalent).toEqual({ iso3: 'GBR', times: 100 / 400 })
    expect(dto.referenceYear).toBe(2022)
  })

  it('30y preset: forward-committed = annualRate × 30 drives the equivalents', () => {
    const dto = equivalence({
      params: PARAMS,
      referenceYear: 2022,
      horizon: '30y',
      annualRateCO2: 100,
      referenceCountry: { iso3: 'SVK' },
      referenceCountryAnnualCO2: 30,
      cfg: EQUIVALENCE_CONFIG,
    })
    expect(dto.cumulativeCO2).toBe(3000)
    expect(dto.carEquivalent).toBeCloseTo((3000 * MT_TO_T) / 4.6, 3)
    expect(dto.countryEquivalent).toEqual({ iso3: 'SVK', times: 3000 / 30 })
  })

  it('returns NaN times when the reference country has zero emissions', () => {
    const dto = equivalence({
      params: PARAMS,
      referenceYear: 2022,
      horizon: 'today',
      annualRateCO2: 100,
      referenceCountry: { iso3: 'XXX' },
      referenceCountryAnnualCO2: 0,
      cfg: EQUIVALENCE_CONFIG,
    })
    expect(Number.isNaN(dto.countryEquivalent.times)).toBe(true)
  })
})
