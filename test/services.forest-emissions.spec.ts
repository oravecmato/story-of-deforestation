import { describe, it, expect } from 'vitest'
import type { Series, DomainId } from '../shared/types'
import type { DomainConfig } from '../shared/config/domains'
import type { SourceAdapter, FetchOpts } from '../server/adapters/SourceAdapter'
import { ForestAreaService } from '../server/services/ForestAreaService'
import type { Reconstruction } from '../server/services/Reconstruction'
import { EmissionsService } from '../server/services/EmissionsService'
import { mkSeries, values } from './helpers/series'

const noReconstruction: Reconstruction = { forDomain: () => [] }

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
    const svc = new ForestAreaService(adapter, twoCountryDomains, noReconstruction)
    const perCountry = await svc.domainAreaByCountry('amazon')

    expect(calls.map((c) => c.iso3)).toEqual(['BRA', 'PER'])
    expect(calls.every((c) => c.code === 'AG.LND.FRST.K2')).toBe(true)
    expect(perCountry).toHaveLength(2)
    expect(values(perCountry[0]!)).toEqual([100, 90])
    expect(values(perCountry[1]!)).toEqual([10, 8])
  })

  it('forwards FetchOpts (date range, per-page) to the adapter', async () => {
    const { adapter, calls } = stubAdapter((iso3) => mkSeries(iso3, [[1990, 1]]))
    const svc = new ForestAreaService(adapter, twoCountryDomains, noReconstruction)
    await svc.domainAreaByCountry('amazon', { dateRange: [1990, 2023], perPage: 500 })
    expect(calls[0]!.opts).toEqual({ dateRange: [1990, 2023], perPage: 500 })
  })

  it('splices the LUH2 reconstruction anchored MULTIPLICATIVELY to measured@1990 (ADR-026)', () => {
    const { adapter } = stubAdapter((iso3) => mkSeries(iso3, [[1990, 1]]))
    // LUH2@1990 = 100, so k = measured@1990 / 100 = 200 / 100 = 2; pre-1990 points scale by k.
    const recon: Reconstruction = {
      forDomain: () => [
        { year: 1800, areaKm2: 150 },
        { year: 1980, areaKm2: 110 },
        { year: 1990, areaKm2: 100 },
      ],
    }
    const svc = new ForestAreaService(adapter, twoCountryDomains, recon)
    const measured = mkSeries('AMAZON', [[1990, 200], [1991, 190]], {
      indicatorId: 'forestArea',
      unit: 'km2',
      latestDataYear: 1991,
    })

    const full = svc.reconstruct('amazon', measured)

    expect(full.meta.reconstructedBefore).toBe(1990)
    // pre-1990 reconstructed, then measured 1990+ unchanged (no double 1990 point).
    expect(full.points.map((p) => p.year)).toEqual([1800, 1980, 1990, 1991])
    expect(values(full)).toEqual([300, 220, 200, 190]) // 150*2, 110*2, then measured
    expect(full.points[0]!.source).toBe('LUH2')
    // reconstructed points inherit the aggregated measured series' geo
    expect(full.points[0]!.geo).toBe(measured.points[0]!.geo)
  })

  it('returns measured area unchanged when the domain has no reconstruction asset', () => {
    const { adapter } = stubAdapter((iso3) => mkSeries(iso3, [[1990, 1]]))
    const svc = new ForestAreaService(adapter, twoCountryDomains, noReconstruction)
    const measured = mkSeries('AMAZON', [[1990, 200], [1991, 190]])
    const full = svc.reconstruct('amazon', measured)
    expect(full).toBe(measured)
    expect(full.meta.reconstructedBefore).toBeNull()
  })

  it('returns measured area unchanged when the anchor year (1990) is missing from measured data', () => {
    const { adapter } = stubAdapter((iso3) => mkSeries(iso3, [[1990, 1]]))
    const recon: Reconstruction = { forDomain: () => [{ year: 1990, areaKm2: 100 }] }
    const svc = new ForestAreaService(adapter, twoCountryDomains, recon)
    const measured = mkSeries('AMAZON', [[1991, 190], [1992, 180]])
    expect(svc.reconstruct('amazon', measured)).toBe(measured)
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
