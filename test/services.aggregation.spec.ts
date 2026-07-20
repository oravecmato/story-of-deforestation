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
import { HORIZON_ANCHOR_YEAR } from '../shared/config/derivation'
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
  const forest = new ForestAreaService(adapter, DOMAINS_1, { forDomain: () => [] })
  const emissions = new EmissionsService(adapter)
  const agg = new AggregationService(forest, emissions, DOMAINS_1, new CoverageGate())
  return { agg, emissions }
}

const base: DerivationParams = {
  scope: 'local',
  domainId: 'amazon',
  horizon: 'today',
  rScenario: 'mid',
}

describe('AggregationService.domainResult', () => {
  it('clamps area to baseline and stock to the composite floor (2000); referenceYear = min-common', async () => {
    const { agg } = makeAgg()
    const dto = await agg.domainResult('amazon', base)

    expect(dto.referenceYear).toBe(2002)
    expect(dto.area.points[0]!.year).toBe(1990) // area from baseline
    expect(dto.stock.points[0]!.year).toBe(2000) // stock from composite floor
    // The forgone-sink family (cumulativeLoss/forgoneSink/fullEmissions/multiplier/crossingYear) is
    // NOT shipped — the client derives it at the live baseline (ADR-026, see test/derived.spec.ts).
    expect('cumulativeLoss' in dto).toBe(false)
    expect('forgoneSink' in dto).toBe(false)
    expect('multiplier' in dto).toBe(false)
  })

  it('future horizon: projects the stock past the last measured year, keeps refYear measured', async () => {
    const { agg } = makeAgg()
    const dto = await agg.domainResult('amazon', { ...base, horizon: '30y' })
    expect(dto.stock.meta.projectedFrom).toBe(2002)
    expect(dto.stock.points.at(-1)!.year).toBeGreaterThan(2002)
    expect(dto.referenceYear).toBe(2002) // composite scalar stays on measured data
  })

  it('today horizon: nowcasts area + stock uniformly to the anchor year (no inter-series gap)', async () => {
    const { agg } = makeAgg()
    const dto = await agg.domainResult('amazon', base) // horizon 'today'
    // Both series now reach the same anchor year (HORIZON_ANCHOR_YEAR = 2026), projected off their own
    // last measured year — so a stock series that lags fresher area data is filled to close the gap.
    expect(dto.area.points.at(-1)!.year).toBe(HORIZON_ANCHOR_YEAR)
    expect(dto.stock.points.at(-1)!.year).toBe(HORIZON_ANCHOR_YEAR)
    expect(dto.area.meta.projectedFrom).toBe(2002)
    expect(dto.stock.meta.projectedFrom).toBe(2002)
    expect(dto.referenceYear).toBe(2002) // composite scalar stays measured (horizon-invariant)
  })
})

describe('AggregationService.globalResult', () => {
  it('global: baseline-independent stacked per-domain area + stock + aggregate stock', async () => {
    const { agg } = makeAgg()
    const dto = await agg.globalResult({ ...base, scope: 'global' })
    expect(dto.perDomainArea).toHaveLength(1)
    expect(dto.perDomainArea[0]!.points[0]!.year).toBe(1990) // full-range area from BASELINE_FLOOR
    expect(dto.perDomainStock).toHaveLength(1)
    expect(dto.aggregateStock).toBeDefined()
    // The forgone-sink family is client-derived, not shipped (ADR-026).
    expect('perDomainForgoneSink' in dto).toBe(false)
    expect('aggregateForgoneSink' in dto).toBe(false)
    expect('multiplier' in dto).toBe(false)
  })
})

// Two-domain setup with OPPOSITE stock trends: AAA (amazon) rising, BBB (congo) falling. Projected
// individually, congo's linear extrapolation would clamp at 0 while amazon runs away, so a naive
// project-then-sum diverges from the authoritative sum-then-project aggregate (Option B fixes this).
const DOMAINS_2 = {
  amazon: { ...DOMAINS.amazon, isoCodes: ['AAA'] } as DomainConfig,
  congo: { ...DOMAINS.congo, isoCodes: ['BBB'] } as DomainConfig,
} as Record<DomainId, DomainConfig>

const area2 = (iso: string): Series =>
  mkSeries(
    iso,
    Array.from({ length: 16 }, (_, i) => [2000 + i, 1000 - 5 * i] as [number, number]),
    { indicatorId: 'forestArea', unit: 'km2', seriesType: 'state', latestDataYear: 2015 },
  )

const stock2 = (iso: string): Series => {
  const rising = iso === 'AAA'
  return mkSeries(
    iso,
    Array.from(
      { length: 16 },
      (_, i) => [2000 + i, rising ? 100 + 5 * i : 200 - 12 * i] as [number, number],
    ),
    { indicatorId: 'deforestationStock', unit: 'Mt CO2', seriesType: 'flow', latestDataYear: 2015 },
  )
}

function makeAgg2(): AggregationService {
  const adapter: SourceAdapter = {
    async fetchIndicator(iso3, code) {
      if (code === FOSSIL_CODE) return fossilSeries()
      return code === FOREST_CODE ? area2(iso3) : stock2(iso3)
    },
    async fetchIndicatorMulti(isoList, code, opts) {
      return Promise.all(isoList.map((iso3) => this.fetchIndicator(iso3, code, opts)))
    },
  }
  const forest = new ForestAreaService(adapter, DOMAINS_2, { forDomain: () => [] })
  const emissions = new EmissionsService(adapter)
  return new AggregationService(forest, emissions, DOMAINS_2, new CoverageGate())
}

describe('AggregationService.globalResult stock additivity (Option B)', () => {
  it('Σ perDomainStock == aggregateStock at every projected year (no per-domain runaway)', async () => {
    const agg = makeAgg2()
    const dto = await agg.globalResult({ scope: 'global', horizon: '100y', rScenario: 'mid' })

    const byYear = (s: Series) => new Map(s.points.map((p) => [p.year, p.value]))
    const aggByYear = byYear(dto.aggregateStock)
    const perDomainByYear = dto.perDomainStock.map(byYear)

    // Every layer is projected to the aggregate's horizon and the stack sums to the aggregate.
    for (const [year, aggVal] of aggByYear) {
      const layerSum = perDomainByYear.reduce((acc, m) => acc + (m.get(year) ?? 0), 0)
      expect(layerSum).toBeCloseTo(aggVal ?? 0, 6)
    }
    // Projection actually happened and both layers reach the horizon (no runaway/clamped layer dropout).
    expect(dto.aggregateStock.meta.projectedFrom).toBe(2015)
    for (const layer of dto.perDomainStock) {
      expect(layer.meta.projectedFrom).toBe(2015)
      expect(layer.points.at(-1)!.year).toBe(dto.aggregateStock.points.at(-1)!.year)
    }
  })
})

describe('ReferenceService', () => {
  it('ships the baseline-independent fossil denominator series + referenceYear (ADR-026)', async () => {
    const { emissions } = makeAgg()
    const ref = new ReferenceService(emissions)
    const dto = await ref.reference({ params: base, referenceYear: 2002 })
    expect(dto.referenceYear).toBe(2002)
    expect(dto.fossilTotal.points.find((p) => p.year === 2002)?.value).toBe(36000)
    // The donut slices + share % are NOT computed here — they are client-derived at the live baseline.
    expect('composition' in dto).toBe(false)
    expect('sharePercent' in dto).toBe(false)
  })
})
