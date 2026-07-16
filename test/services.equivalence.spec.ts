import { describe, it, expect } from 'vitest'
import type { DerivationParams, DomainId } from '../shared/types'
import type { DomainConfig } from '../shared/config/domains'
import { DOMAINS } from '../shared/config/domains'
import type { SourceAdapter } from '../server/adapters/SourceAdapter'
import { ForestAreaService } from '../server/services/ForestAreaService'
import { EmissionsService } from '../server/services/EmissionsService'
import { AggregationService } from '../server/services/AggregationService'
import { EquivalenceService } from '../server/services/EquivalenceService'
import { CoverageGate } from '../server/utils/coverage'
import { EQUIVALENCE_CONFIG } from '../shared/config/equivalences'
import { MT_TO_T } from '../server/utils/stats'
import { mkSeries } from './helpers/series'

const FOREST_CODE = 'AG.LND.FRST.K2'
const FOSSIL_CODE = 'EN.GHG.CO2.MT.CE.AR5'

const DOMAINS_1 = {
  amazon: { ...DOMAINS.amazon, isoCodes: ['AAA'] } as DomainConfig,
} as Record<DomainId, DomainConfig>

const FOSSIL_BY_ISO: Record<string, number> = { GBR: 400, SVK: 30, WLD: 36000 }

function makeEquiv(): EquivalenceService {
  const adapter: SourceAdapter = {
    async fetchIndicator(iso3, code) {
      if (code === FOSSIL_CODE) {
        const v = FOSSIL_BY_ISO[iso3] ?? 0
        return mkSeries(iso3, [[2000, v], [2001, v], [2002, v]], {
          seriesType: 'flow',
          unit: 'Mt CO2',
          latestDataYear: 2002,
        })
      }
      if (code === FOREST_CODE) {
        return mkSeries(
          'AAA',
          Array.from({ length: 13 }, (_, i) => [1990 + i, 1000 - 10 * i] as [number, number]),
          { indicatorId: 'forestArea', unit: 'km2', latestDataYear: 2002 },
        )
      }
      return mkSeries('AAA', [[2000, 100], [2001, 100], [2002, 100]], {
        indicatorId: 'deforestationStock',
        seriesType: 'flow',
        unit: 'Mt CO2',
        latestDataYear: 2002,
      })
    },
    async fetchIndicatorMulti(isoList, code, opts) {
      return Promise.all(isoList.map((iso3) => this.fetchIndicator(iso3, code, opts)))
    },
  }
  const forest = new ForestAreaService(adapter, DOMAINS_1)
  const emissions = new EmissionsService(adapter)
  const agg = new AggregationService(forest, emissions, DOMAINS_1, new CoverageGate())
  return new EquivalenceService(agg, EQUIVALENCE_CONFIG)
}

const localToday: DerivationParams = {
  scope: 'local',
  domainId: 'amazon',
  horizon: 'today',
  rScenario: 'mid',
  baseline: 1990,
}

describe('EquivalenceService', () => {
  it('today, en locale → UK reference country; annual headline, no committed total', async () => {
    const svc = makeEquiv()
    const dto = await svc.equivalence(localToday, 'en')

    expect(dto.referenceYear).toBe(2002)
    // headline is the FULL annual rate = reported stock (100) + forgone sink (single accounting)
    expect(dto.annualRateCO2).toBeGreaterThan(100)
    expect(dto.cumulativeCO2).toBeNull()
    expect(dto.carEquivalent).toBeCloseTo((dto.annualRateCO2 * MT_TO_T) / 4.6, 3)
    expect(dto.countryEquivalent.iso3).toBe('GBR')
    expect(dto.countryEquivalent.times).toBeCloseTo(dto.annualRateCO2 / 400, 9)
  })

  it('future horizon forward-commits annualRate × horizonYears (rate stays measured)', async () => {
    const svc = makeEquiv()
    const today = await svc.equivalence(localToday, 'en')
    const h30 = await svc.equivalence({ ...localToday, horizon: '30y' }, 'en')
    expect(h30.annualRateCO2).toBeCloseTo(today.annualRateCO2, 9) // horizon-invariant
    expect(h30.cumulativeCO2).toBeCloseTo(today.annualRateCO2 * 30, 6)
    expect(h30.countryEquivalent.times).toBeCloseTo((today.annualRateCO2 * 30) / 400, 9)
  })

  it('sk locale switches the reference country to Slovakia', async () => {
    const svc = makeEquiv()
    const dto = await svc.equivalence(localToday, 'sk')
    expect(dto.countryEquivalent.iso3).toBe('SVK')
    expect(dto.countryEquivalent.times).toBeCloseTo(dto.annualRateCO2 / 30, 9)
  })
})
