import { describe, it, expect } from 'vitest'
import type { Series, SeriesMeta } from '../shared/types'
import { CoverageGate, countryKey } from '../server/utils/coverage'

/** A per-country series with a real ISO stamped on every point (matches the WdiAdapter shape). */
function country(
  iso: string,
  rows: Array<[number, number | null]>,
  latestDataYear: number | null,
  meta: Partial<SeriesMeta> = {},
): Series {
  return {
    id: iso,
    points: rows.map(([year, value]) => ({ source: 'test', geo: iso, year, value })),
    meta: {
      indicatorId: 'x',
      seriesType: 'flow',
      unit: 'u',
      latestDataYear,
      gaps: [],
      isEstimate: false,
      projectedFrom: null,
      ...meta,
    },
  }
}

/** An empty (no-data) per-country series: the adapter stamps the ISO in the gap. */
function noData(iso: string): Series {
  return {
    id: `stock:${iso}`,
    points: [],
    meta: {
      indicatorId: 'x',
      seriesType: 'flow',
      unit: 'u',
      latestDataYear: null,
      gaps: [{ geo: iso, reason: 'no-data' }],
      isEstimate: false,
      projectedFrom: null,
    },
  }
}

describe('CoverageGate', () => {
  const gate = new CoverageGate()

  it('union: a country incomplete on stock is excluded from BOTH metrics', () => {
    // area complete to 2023 for all; stock reaches 2022 (modal) except CCC which ends 2021.
    const area = [
      country('AAA', [[2021, 10], [2022, 10], [2023, 10]], 2023),
      country('BBB', [[2021, 5], [2022, 5], [2023, 5]], 2023),
      country('CCC', [[2021, 1], [2022, 1], [2023, 1]], 2023),
    ]
    const stock = [
      country('AAA', [[2020, 100], [2021, 100], [2022, 100]], 2022),
      country('BBB', [[2020, 50], [2021, 50], [2022, 50]], 2022),
      country('CCC', [[2020, 3], [2021, 3]], 2021), // short-ending laggard
    ]

    const v = gate.evaluate([
      { indicator: 'forestArea', series: area },
      { indicator: 'deforestationStock', series: stock },
    ])

    expect(v.excluded.has('CCC')).toBe(true) // incomplete on stock → out of both
    expect(v.excluded.has('AAA')).toBe(false)
    expect(v.excluded.has('BBB')).toBe(false)
    expect(v.windowEnd.get('deforestationStock')).toBe(2022) // laggard doesn't drag the window
    expect(v.windowEnd.get('forestArea')).toBe(2023)
    expect(v.gaps).toContainEqual({ geo: 'CCC', reason: 'incomplete-coverage' })
  })

  it('excludes a country with an internal hole (null between first real and the window)', () => {
    const stock = [
      country('AAA', [[2020, 1], [2021, 1], [2022, 1]], 2022),
      country('BBB', [[2020, 1], [2021, 1], [2022, 1]], 2022),
      country('DDD', [[2020, 1], [2021, null], [2022, 1]], 2022), // hole at 2021
    ]
    const v = gate.evaluate([{ indicator: 'deforestationStock', series: stock }])
    expect(v.excluded.has('DDD')).toBe(true)
    expect(v.gaps).toContainEqual({ geo: 'DDD', reason: 'incomplete-coverage' })
  })

  it('keeps a country whose only null is a leading pre-data year', () => {
    const stock = [
      country('AAA', [[2020, 1], [2021, 1], [2022, 1]], 2022),
      country('BBB', [[2020, 1], [2021, 1], [2022, 1]], 2022),
      country('EEE', [[2020, null], [2021, 5], [2022, 6]], 2022), // leading null only
    ]
    const v = gate.evaluate([{ indicator: 'deforestationStock', series: stock }])
    expect(v.excluded.has('EEE')).toBe(false)
    expect(v.gaps).toEqual([])
  })

  it('excludes a no-data country and keys it stably from its gap (so it drops from area too)', () => {
    const area = [country('GGG', [[2022, 9], [2023, 9]], 2023)]
    const stock = [noData('GGG')]
    const v = gate.evaluate([
      { indicator: 'forestArea', series: area },
      { indicator: 'deforestationStock', series: stock },
    ])
    expect(countryKey(stock[0]!)).toBe('GGG') // stable across indicators despite empty points
    expect(v.excluded.has('GGG')).toBe(true)
    expect(v.gaps).toContainEqual({ geo: 'GGG', reason: 'no-data' })
  })

  it('excludes nothing when every country is complete on every indicator', () => {
    const area = [
      country('AAA', [[2022, 1], [2023, 1]], 2023),
      country('BBB', [[2022, 1], [2023, 1]], 2023),
    ]
    const stock = [
      country('AAA', [[2021, 1], [2022, 1]], 2022),
      country('BBB', [[2021, 1], [2022, 1]], 2022),
    ]
    const v = gate.evaluate([
      { indicator: 'forestArea', series: area },
      { indicator: 'deforestationStock', series: stock },
    ])
    expect(v.excluded.size).toBe(0)
    expect(v.gaps).toEqual([])
  })
})
