import { describe, it, expect } from 'vitest'
import type { DerivationParams, GlobalResultDTO, Series } from '../shared/types'
import { deriveGlobal } from '../app/composables/useDerived'
import { mkSeries } from './helpers/series'

// Isomorphic derive layer (ADR-026 §3.2a): the baseline-dependent tail recomputed off the
// baseline-INDEPENDENT DTO at a chosen baseline. cumulativeLoss reaches back to `baseline`; the
// forgone-sink family is clamped to the composite stock floor (2000).

const valueAt = (s: Series, y: number): number => s.points.find((p) => p.year === y)?.value ?? NaN

// Forest area declining 10 km²/yr 1990→2005 (state); deforestation stock flat 100 Mt/yr 2000→2005 (flow).
const area = (id: string): Series =>
  mkSeries(
    id,
    Array.from({ length: 16 }, (_, i) => [1990 + i, 1000 - 10 * i] as [number, number]),
    { indicatorId: 'forestArea', unit: 'km2', seriesType: 'state', latestDataYear: 2005 },
  )
const stock = (id: string): Series =>
  mkSeries(
    id,
    Array.from({ length: 6 }, (_, i) => [2000 + i, 100] as [number, number]),
    { indicatorId: 'deforestationStock', unit: 'Mt CO2', seriesType: 'flow', latestDataYear: 2005 },
  )

const globalDTO = {
  params: { horizon: 'today', rScenario: 'mid' } as DerivationParams,
  referenceYear: 2005,
  perDomainArea: [area('area:amazon'), area('area:congo')],
  perDomainStock: [stock('stock:amazon'), stock('stock:congo')],
  aggregateStock: mkSeries(
    'stock:global',
    Array.from({ length: 6 }, (_, i) => [2000 + i, 200] as [number, number]),
    { indicatorId: 'deforestationStock', unit: 'Mt CO2', seriesType: 'flow', latestDataYear: 2005 },
  ),
} as unknown as GlobalResultDTO

describe('deriveGlobal', () => {
  it('per-domain forgone sinks (R per domain) + asymmetric aggregate band + full family', () => {
    const g = deriveGlobal(globalDTO, 1990)
    expect(g.perDomainForgoneSink).toHaveLength(2)
    expect(g.aggregateForgoneSink).toBeDefined()
    const ry = globalDTO.referenceYear
    const stockRy = valueAt(globalDTO.aggregateStock, ry)
    const forgoneRy = valueAt(g.aggregateForgoneSink, ry)
    expect(forgoneRy).toBeGreaterThan(0)
    expect(valueAt(g.aggregateFullEmissions, ry)).toBeCloseTo(stockRy + forgoneRy, 9)
    expect(g.multiplier).toBeGreaterThanOrEqual(1)
    expect(typeof g.crossingYear === 'number' || g.crossingYear === null).toBe(true)
  })

  it('is baseline-reactive at the aggregate level', () => {
    const ry = globalDTO.referenceYear
    const early = deriveGlobal(globalDTO, 1990)
    const late = deriveGlobal(globalDTO, 1998)
    expect(valueAt(early.aggregateForgoneSink, ry)).toBeGreaterThan(
      valueAt(late.aggregateForgoneSink, ry),
    )
  })
})
