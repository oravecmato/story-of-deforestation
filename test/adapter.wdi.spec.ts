import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { AxiosInstance } from 'axios'
import { WdiAdapter } from '../server/adapters/WdiAdapter'

const here = dirname(fileURLToPath(import.meta.url))
const loadFixture = (file: string): unknown =>
  JSON.parse(readFileSync(join(here, 'fixtures', 'wdi', file), 'utf8'))

const FOREST = loadFixture('bra.AG.LND.FRST.K2.json') // AG.LND.FRST.K2 (state)
const STOCK = loadFixture('bra.EN.GHG.CO2.LU.DF.json') // EN.GHG.CO2.LU.DF.MT.CE.AR5 (flow)
const FOREST_CODE = 'AG.LND.FRST.K2'
const STOCK_CODE = 'EN.GHG.CO2.LU.DF.MT.CE.AR5'

/** Minimal Axios stub returning a fixed body; records the last request for param assertions. */
function stub(body: unknown): { adapter: WdiAdapter; calls: Array<{ url: string; params: unknown }> } {
  const calls: Array<{ url: string; params: unknown }> = []
  const http = {
    get: async (url: string, config?: { params?: unknown }) => {
      calls.push({ url, params: config?.params })
      return { data: body }
    },
  } as unknown as AxiosInstance
  return { adapter: new WdiAdapter(http), calls }
}

const wdiBody = (rows: unknown[] | null) => [{ page: 1, pages: 1, total: rows?.length ?? 0 }, rows]

describe('WdiAdapter — real fixtures', () => {
  it('parses response[1], sorts oldest-first, and maps to DataPoint (forest area, state)', async () => {
    const { adapter } = stub(FOREST)
    const series = await adapter.fetchIndicator('BRA', FOREST_CODE)

    // ascending by year
    const yrs = series.points.map((p) => p.year)
    expect([...yrs]).toEqual([...yrs].sort((a, b) => a - b))
    // uniform point shape
    for (const p of series.points) {
      expect(p.source).toBe('WDI')
      expect(p.geo).toBe('BRA')
    }
    // trailing future nulls (2024, 2025) dropped → ends on the last real year
    expect(series.points.at(-1)!.year).toBe(2023)
    expect(series.points.at(-1)!.value).toBeCloseTo(4929787.518, 3)
    expect(series.meta.latestDataYear).toBe(2023)
    // leading pre-1990 holes preserved (not dropped)
    expect(series.points[0]!.year).toBe(1960)
    expect(series.points[0]!.value).toBeNull()
    // meta from the indicator registry
    expect(series.meta.indicatorId).toBe('forestArea')
    expect(series.meta.seriesType).toBe('state')
    expect(series.meta.unit).toBe('km2')
    expect(series.meta.isEstimate).toBe(false)
    expect(series.meta.gaps).toEqual([])
    expect(series.id).toBe(`${FOREST_CODE}:BRA`)
  })

  it('trims the AR5 nowcast tail: 2023 ≡ 2022 dropped (deforestation stock, flow)', async () => {
    const { adapter } = stub(STOCK)
    const series = await adapter.fetchIndicator('BRA', STOCK_CODE)

    const years = series.points.map((p) => p.year)
    expect(years).not.toContain(2025) // trailing null dropped
    expect(years).not.toContain(2024) // trailing null dropped
    expect(years).not.toContain(2023) // nowcast duplicate dropped
    expect(series.points.at(-1)!.year).toBe(2022)
    expect(series.points.at(-1)!.value).toBeCloseTo(1024.764, 3)
    expect(series.meta.latestDataYear).toBe(2022)
    expect(series.meta.seriesType).toBe('flow')
    expect(series.meta.unit).toBe('Mt CO2')
  })
})

describe('WdiAdapter — normalization edge cases', () => {
  it('preserves internal holes (null between real observations)', async () => {
    const rows = [
      { countryiso3code: 'BRA', date: '2002', value: 5 },
      { countryiso3code: 'BRA', date: '2001', value: null },
      { countryiso3code: 'BRA', date: '2000', value: 3 },
    ]
    const { adapter } = stub(wdiBody(rows))
    const series = await adapter.fetchIndicator('BRA', STOCK_CODE)
    expect(series.points.map((p) => [p.year, p.value])).toEqual([
      [2000, 3],
      [2001, null],
      [2002, 5],
    ])
    expect(series.meta.latestDataYear).toBe(2002)
  })

  it('drops aggregate rows that carry no ISO3 code', async () => {
    const rows = [
      { countryiso3code: '', date: '2001', value: 999 }, // aggregate → dropped
      { countryiso3code: 'BRA', date: '2001', value: 5 },
      { countryiso3code: 'BRA', date: '2000', value: 3 },
    ]
    const { adapter } = stub(wdiBody(rows))
    const series = await adapter.fetchIndicator('BRA', FOREST_CODE)
    expect(series.points.every((p) => p.geo === 'BRA')).toBe(true)
    expect(series.points.map((p) => p.value)).toEqual([3, 5])
  })

  it('returns an empty series with a recorded gap when WDI has no data (response[1] null)', async () => {
    const { adapter } = stub(wdiBody(null))
    const series = await adapter.fetchIndicator('ATA', FOREST_CODE)
    expect(series.points).toEqual([])
    expect(series.meta.latestDataYear).toBeNull()
    expect(series.meta.gaps).toEqual([{ geo: 'ATA', reason: 'no-data' }])
  })
})

describe('WdiAdapter — request params', () => {
  it('requests mrnev for mostRecentNonEmpty, and a date range otherwise', async () => {
    const a = stub(FOREST)
    await a.adapter.fetchIndicator('BRA', FOREST_CODE, { mostRecentNonEmpty: true })
    expect(a.calls[0]!.params).toMatchObject({ format: 'json', mrnev: 1 })

    const b = stub(FOREST)
    await b.adapter.fetchIndicator('BRA', FOREST_CODE, { dateRange: [1990, 2023], perPage: 500 })
    expect(b.calls[0]!.params).toMatchObject({ date: '1990:2023', per_page: 500 })
    expect(b.calls[0]!.url).toBe(`/country/BRA/indicator/${FOREST_CODE}`)
  })
})

describe('WdiAdapter — fetchIndicatorMulti', () => {
  it('fans out per country and turns a failed country into a recorded gap, not a throw', async () => {
    const http = {
      get: async (url: string) => {
        if (url.includes('/COL/')) throw new Error('network down')
        return { data: FOREST }
      },
    } as unknown as AxiosInstance
    const adapter = new WdiAdapter(http)

    const seriesList = await adapter.fetchIndicatorMulti(['BRA', 'COL'], FOREST_CODE)
    expect(seriesList).toHaveLength(2)

    const bra = seriesList[0]!
    expect(bra.points.length).toBeGreaterThan(0)
    expect(bra.meta.gaps).toEqual([])

    const col = seriesList[1]!
    expect(col.points).toEqual([])
    expect(col.meta.gaps).toEqual([{ geo: 'COL', reason: 'network down' }])
  })
})
