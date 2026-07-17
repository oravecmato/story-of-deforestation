import { describe, it, expect } from 'vitest'
import type { Series, DerivationParams, DomainId } from '../shared/types'
import type { DomainConfig } from '../shared/config/domains'
import { DOMAINS } from '../shared/config/domains'
import type { SourceAdapter } from '../server/adapters/SourceAdapter'
import { ForestAreaService } from '../server/services/ForestAreaService'
import { EmissionsService } from '../server/services/EmissionsService'
import { AggregationService } from '../server/services/AggregationService'
import { ReferenceService } from '../server/services/ReferenceService'
import { CoverageGate } from '../server/utils/coverage'
import { mkSeries } from './helpers/series'

const FOREST_CODE = 'AG.LND.FRST.K2'
const FOSSIL_CODE = 'EN.GHG.CO2.MT.CE.AR5'

// Single-country amazon domain (keeps the summed math tractable; keeps the real amazon R).
const DOMAINS_1 = {
  amazon: { ...DOMAINS.amazon, isoCodes: ['AAA'] } as DomainConfig,
} as Record<DomainId, DomainConfig>

// Forest area declining 10 km²/yr, 1990→2002 (state); ends 2002.
const areaSeries = (): Series =>
  mkSeries(
    'AAA',
    Array.from({ length: 13 }, (_, i) => [1990 + i, 1000 - 10 * i] as [number, number]),
    { indicatorId: 'forestArea', unit: 'km2', seriesType: 'state', latestDataYear: 2002 },
  )

// Deforestation stock, flat 100 Mt/yr, 2000→2002 (flow); ends 2002.
const stockSeries = (): Series =>
  mkSeries('AAA', [[2000, 100], [2001, 100], [2002, 100]], {
    indicatorId: 'deforestationStock',
    unit: 'Mt CO2',
    seriesType: 'flow',
    latestDataYear: 2002,
  })

const fossilSeries = (): Series =>
  mkSeries('WLD', [[2000, 36000], [2001, 36000], [2002, 36000]], {
    indicatorId: 'fossil',
    unit: 'Mt CO2',
    seriesType: 'flow',
    latestDataYear: 2002,
  })

function makeAgg(): { agg: AggregationService; emissions: EmissionsService } {
  const adapter: SourceAdapter = {
    async fetchIndicator(iso3, code) {
      if (code === FOSSIL_CODE) return fossilSeries()
      return code === FOREST_CODE ? areaSeries() : stockSeries()
    },
    async fetchIndicatorMulti(isoList, code, opts) {
      return Promise.all(isoList.map((iso3) => this.fetchIndicator(iso3, code, opts)))
    },
  }
  const forest = new ForestAreaService(adapter, DOMAINS_1)
  const emissions = new EmissionsService(adapter)
  const agg = new AggregationService(forest, emissions, DOMAINS_1, new CoverageGate())
  return { agg, emissions }
}

const valueAt = (s: Series, y: number): number => s.points.find((p) => p.year === y)?.value ?? NaN

const base: DerivationParams = {
  scope: 'local',
  domainId: 'amazon',
  horizon: 'today',
  rScenario: 'mid',
  baseline: 1990,
}

describe('AggregationService.domainResult', () => {
  it('clamps area to baseline and stock to the composite floor (2000); referenceYear = min-common', async () => {
    const { agg } = makeAgg()
    const dto = await agg.domainResult('amazon', base)

    expect(dto.referenceYear).toBe(2002)
    expect(dto.area.points[0]!.year).toBe(1990) // area from baseline
    expect(dto.stock.points[0]!.year).toBe(2000) // stock from composite floor
    expect(dto.cumulativeLoss.points.at(-1)!.year).toBe(2002)
  })

  it('fullEmissions = stock + forgoneSink, multiplier = full/reported at refYear', async () => {
    const { agg } = makeAgg()
    const dto = await agg.domainResult('amazon', base)

    expect(dto.forgoneSink).toBeDefined()
    const ry = dto.referenceYear
    const stockRy = valueAt(dto.stock, ry)
    const forgoneRy = valueAt(dto.forgoneSink, ry)
    const fullRy = valueAt(dto.fullEmissions, ry)

    expect(fullRy).toBeCloseTo(stockRy + forgoneRy, 6)
    expect(dto.multiplier).toBeCloseTo(fullRy / stockRy, 6)
    // asymmetric band brackets the central line
    const lo = dto.forgoneSink.lower.find((p) => p.year === ry)!.value!
    const hi = dto.forgoneSink.upper.find((p) => p.year === ry)!.value!
    expect(lo).toBeLessThanOrEqual(forgoneRy)
    expect(hi).toBeGreaterThanOrEqual(forgoneRy)
    expect(typeof dto.crossingYear === 'number' || dto.crossingYear === null).toBe(true)
  })

  it('future horizon: projects the stock past the last measured year, keeps refYear measured', async () => {
    const { agg } = makeAgg()
    const dto = await agg.domainResult('amazon', { ...base, horizon: '30y' })
    expect(dto.stock.meta.projectedFrom).toBe(2002)
    expect(dto.stock.points.at(-1)!.year).toBeGreaterThan(2002)
    expect(dto.referenceYear).toBe(2002) // composite scalar stays on measured data
  })
})

describe('AggregationService.globalResult', () => {
  it('global: stacked per-domain stock + aggregate band + full family + multiplier', async () => {
    const { agg } = makeAgg()
    const dto = await agg.globalResult({ ...base, scope: 'global' })
    expect(dto.perDomainStock).toHaveLength(1)
    expect(dto.perDomainForgoneSink).toHaveLength(1)
    expect(dto.aggregateForgoneSink).toBeDefined()
    expect(dto.aggregateFullEmissions).toBeDefined()
    expect(dto.aggregateStock).toBeDefined()
    expect(dto.multiplier).toBeGreaterThanOrEqual(1)
  })
})

describe('ReferenceService', () => {
  it('3-slice composition and share over fossil + deforestation', async () => {
    const { emissions } = makeAgg()
    const ref = new ReferenceService(emissions)
    const dto = await ref.reference({
      params: base,
      referenceYear: 2002,
      stockAtRef: 100,
      forgoneSinkAtRef: 20,
    })
    expect(dto.composition).toEqual({ fossil: 36000, stock: 100, forgoneSink: 20 })
    // share = (100+20) / (36000+100+20)
    expect(dto.sharePercent).toBeCloseTo((120 / 36120) * 100, 9)
  })
})
