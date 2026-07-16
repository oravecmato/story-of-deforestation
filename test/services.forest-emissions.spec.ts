import { describe, it, expect } from 'vitest'
import type { Series, DomainId } from '../shared/types'
import type { DomainConfig } from '../shared/config/domains'
import type { SourceAdapter, FetchOpts } from '../server/adapters/SourceAdapter'
import { ForestAreaService } from '../server/services/ForestAreaService'
import { EmissionsService } from '../server/services/EmissionsService'
import { mkSeries, values } from './helpers/series'

/** Adapter stub: returns one canned series per (iso, code); records fan-out calls. */
function stubAdapter(
  byIso: (iso3: string, code: string) => Series,
): { adapter: SourceAdapter; calls: Array<{ iso3: string; code: string; opts?: FetchOpts }> } {
  const calls: Array<{ iso3: string; code: string; opts?: FetchOpts }> = []
  const adapter: SourceAdapter = {
    async fetchIndicator(iso3, code, opts) {
      calls.push({ iso3, code, opts })
      return byIso(iso3, code)
    },
    async fetchIndicatorMulti(isoList, code, opts) {
      return Promise.all(isoList.map((iso3) => this.fetchIndicator(iso3, code, opts)))
    },
  }
  return { adapter, calls }
}

const twoCountryDomains = {
  amazon: { id: 'amazon', isoCodes: ['BRA', 'PER'] } as DomainConfig,
} as Record<DomainId, DomainConfig>

describe('ForestAreaService', () => {
  it('fans out over the domain ISO set and returns the per-country area series', async () => {
    const { adapter, calls } = stubAdapter((iso3) =>
      mkSeries(
        iso3,
        iso3 === 'BRA'
          ? [[1990, 100], [1991, 90]]
          : [[1990, 10], [1991, 8]],
        { indicatorId: 'forestArea', unit: 'km2', latestDataYear: 1991 },
      ),
    )
    const svc = new ForestAreaService(adapter, twoCountryDomains)
    const perCountry = await svc.domainAreaByCountry('amazon')

    expect(calls.map((c) => c.iso3)).toEqual(['BRA', 'PER'])
    expect(calls.every((c) => c.code === 'AG.LND.FRST.K2')).toBe(true)
    expect(perCountry).toHaveLength(2)
    expect(values(perCountry[0]!)).toEqual([100, 90])
    expect(values(perCountry[1]!)).toEqual([10, 8])
  })

  it('forwards FetchOpts (date range, per-page) to the adapter', async () => {
    const { adapter, calls } = stubAdapter((iso3) => mkSeries(iso3, [[1990, 1]]))
    const svc = new ForestAreaService(adapter, twoCountryDomains)
    await svc.domainAreaByCountry('amazon', { dateRange: [1990, 2023], perPage: 500 })
    expect(calls[0]!.opts).toEqual({ dateRange: [1990, 2023], perPage: 500 })
  })
})

describe('EmissionsService', () => {
  it('returns the per-country deforestation-stock flow across a country set', async () => {
    const { adapter, calls } = stubAdapter((iso3) =>
      mkSeries(iso3, iso3 === 'BRA' ? [[2000, 500], [2001, 600]] : [[2000, 50], [2001, 60]], {
        indicatorId: 'deforestationStock',
        seriesType: 'flow',
        unit: 'Mt CO2',
        latestDataYear: 2001,
      }),
    )
    const svc = new EmissionsService(adapter)
    const perCountry = await svc.domainStockByCountry(['BRA', 'COL'])

    expect(calls.every((c) => c.code === 'EN.GHG.CO2.LU.DF.MT.CE.AR5')).toBe(true)
    expect(perCountry).toHaveLength(2)
    expect(values(perCountry[0]!)).toEqual([500, 600])
    expect(perCountry[1]!.meta.seriesType).toBe('flow')
  })

  it('fetches the global fossil denominator from the WLD aggregate', async () => {
    const { adapter, calls } = stubAdapter((iso3) =>
      mkSeries(iso3, [[2020, 36000]], { indicatorId: 'fossil', seriesType: 'flow', unit: 'Mt CO2' }),
    )
    const svc = new EmissionsService(adapter)
    const fossil = await svc.globalFossil()
    expect(calls[0]).toMatchObject({ iso3: 'WLD', code: 'EN.GHG.CO2.MT.CE.AR5' })
    expect(values(fossil)).toEqual([36000])
  })

  it('fetches a single reference country fossil total', async () => {
    const { adapter, calls } = stubAdapter((iso3) => mkSeries(iso3, [[2020, 400]]))
    const svc = new EmissionsService(adapter)
    await svc.countryFossil('GBR')
    expect(calls[0]).toMatchObject({ iso3: 'GBR', code: 'EN.GHG.CO2.MT.CE.AR5' })
  })
})
