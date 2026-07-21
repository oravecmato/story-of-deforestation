import { describe, it, expect } from 'vitest'
import type { EChartsOption } from 'echarts'
import type {
  Series,
  BandSeries,
  DerivationParams,
  GlobalResultDTO,
  GlobalDerived,
  ReferenceDTO,
  ThemeTokens,
} from '../shared/types'
import { CompactNumberFormatter } from '../app/format/Formatter'
import type { ChartContext } from '../app/charts/BaseChartOption'
import { PROJECTED_SUFFIX } from '../app/charts/BaseChartOption'
import { GlobalStackedAreaOption } from '../app/charts/GlobalStackedAreaOption'
import { CrossingOption, type CrossingInput } from '../app/charts/CrossingOption'
import { FootprintDonutOption } from '../app/charts/FootprintDonutOption'
import { FossilComparisonOption } from '../app/charts/FossilComparisonOption'

// --- fixtures --------------------------------------------------------------

const THEME: ThemeTokens = {
  bg: '#0D1117',
  surface1: '#161B22',
  surface2: '#1C232D',
  border: '#2A313B',
  text: { hi: '#E8ECF2', mid: '#A7B0BD', low: '#6E7681' },
  accent: '#3FB6A8',
  data: { stock: '#5FBE6E', forgoneSink: '#E8A13A', fossil: '#5B6B7F', total: '#CE5B4E' },
  bandOpacity: 0.18,
  negative: '#E5534B',
}

function ctx(over: Partial<ChartContext> = {}): ChartContext {
  return {
    t: (k) => k,
    theme: THEME,
    formatter: new CompactNumberFormatter(),
    breakpoint: 'lg',
    horizon: 'today',
    baseline: 2015,
    rScenario: 'mid',
    ...over,
  }
}

function series(id: string, rows: Array<[number, number | null]>, projectedFrom: number | null = null): Series {
  return {
    id,
    points: rows.map(([year, value]) => ({ source: 'X', geo: 'G', year, value })),
    meta: { indicatorId: id, seriesType: 'flow', unit: 'MtCO2', latestDataYear: rows.at(-1)?.[0] ?? null, gaps: [], isEstimate: false, projectedFrom, reconstructedBefore: null },
  }
}

/** rows: [year, lower, mid, upper] */
function band(id: string, rows: Array<[number, number, number, number]>, projectedFrom: number | null = null): BandSeries {
  return {
    id,
    points: rows.map(([year, , mid]) => ({ source: 'D', geo: 'G', year, value: mid })),
    lower: rows.map(([year, lo]) => ({ source: 'D', geo: 'G', year, value: lo })),
    upper: rows.map(([year, , , up]) => ({ source: 'D', geo: 'G', year, value: up })),
    meta: { indicatorId: id, seriesType: 'flow', unit: 'MtCO2', latestDataYear: rows.at(-1)?.[0] ?? null, gaps: [], isEstimate: true, projectedFrom, reconstructedBefore: null },
  }
}

const globalParams: DerivationParams = { horizon: 'today', rScenario: 'mid' }

interface AnySeries {
  name?: string
  type?: string
  stack?: string
  data?: unknown[]
  lineStyle?: { type?: string; color?: string; opacity?: number }
  areaStyle?: { color?: string }
  markLine?: { data?: Array<{ xAxis?: number }>; label?: { formatter?: (p: { value: unknown }) => string } }
  markPoint?: { data?: unknown[] }
}
const seriesOf = (o: EChartsOption): AnySeries[] => o.series as unknown as AnySeries[]

interface AxisLike {
  max?: number
  interval?: number
  inverse?: boolean
}

// --- GlobalStackedAreaOption -----------------------------------------------

describe('GlobalStackedAreaOption', () => {
  const dto = (): GlobalResultDTO & GlobalDerived => ({
    params: globalParams,
    referenceYear: 2001,
    perDomainArea: [],
    perDomainStock: [series('stock:amazon', [[2001, 10]]), series('stock:congo', [[2001, 20]])],
    perDomainForgoneSink: [band('fs:amazon', [[2001, 2, 3, 4]]), band('fs:congo', [[2001, 3, 4, 5]])],
    aggregateStock: series('stock:global', [[2001, 30]]),
    aggregateForgoneSink: band('agg', [[2001, 5, 8, 11]]),
    aggregateFullEmissions: series('aggFull', [[2001, 50]]),
    multiplier: 1.6,
    crossingYear: null,
  })

  it('per-domain layers + forgone stacked on top + aggregate band on the upper edge', () => {
    const s = seriesOf(new GlobalStackedAreaOption(dto(), ctx()).build())
    // 2 domain areas, forgone area, total top-edge line, band lower + upper
    expect(s).toHaveLength(6)
    expect(s.slice(0, 2).every((x) => x.stack === 'stock')).toBe(true)
    const forgone = s.find((x) => x.name === 'series.forgoneSink')!
    expect(forgone.stack).toBe('stock') // stacked with the domain layers, adds to the world sum
    // the stack's dashed top surface is the non-stacked total top-edge line
    const totalEdge = s.find((x) => x.name === PROJECTED_SUFFIX + 'total')!
    expect(totalEdge.stack).toBeUndefined()
    expect(totalEdge.lineStyle?.type).toBe('dashed')
    const lo = s.find((x) => x.name === '__bandLower')!
    expect(lo.data?.[0]).toEqual([Date.UTC(2001, 0, 1), 35]) // aggregateStock(30) + forgone.lower(5)
  })

  it('stock-only presentation (main scene, slide 2 global) → domain layers + top-edge; no forgone/band', () => {
    const o = new GlobalStackedAreaOption(dto(), ctx(), { metrics: ['stock'] }).build()
    const s = seriesOf(o)
    expect(s.find((x) => x.name === 'series.forgoneSink')).toBeUndefined()
    expect(s.find((x) => x.name === '__bandUpper')).toBeUndefined()
    // 2 domain areas + one solid total top-edge
    expect(s).toHaveLength(3)
    const edge = s.find((x) => x.name === PROJECTED_SUFFIX + 'total')!
    expect(edge.lineStyle?.type).toBe('solid')
    expect((o.legend as { data?: string[] }).data).toEqual(['domain.amazon', 'domain.congo'])
  })
})

// --- CrossingOption ---------------------------------------------------------

describe('CrossingOption', () => {
  it('crossing marked with a guide line on stock + a dot on forgone', () => {
    const input: CrossingInput = {
      stock: series('stock', [[2000, 10], [2001, 12]]),
      forgoneSink: band('fs', [[2000, 5, 8, 11], [2001, 6, 10, 14]]),
      crossingYear: 2001,
    }
    const s = seriesOf(new CrossingOption(input, ctx()).build())
    const stock = s.find((x) => x.name === 'series.stock')!
    expect(stock.markLine?.data?.[0]?.xAxis).toBe(Date.UTC(2001, 0, 1))
    // the guide label reads the year, not the raw epoch-ms of the time axis
    expect(stock.markLine?.label?.formatter?.({ value: Date.UTC(2001, 0, 1) })).toBe('2001')
    const forgone = s.find((x) => x.name === 'series.forgoneSink')!
    expect(forgone.markPoint?.data).toHaveLength(1)
  })

  it('no crossing year (still within measured range) → stock + forgone, no markers', () => {
    const input: CrossingInput = {
      stock: series('stock', [[2000, 10]]),
      forgoneSink: band('fs', [[2000, 5, 8, 11]]),
      crossingYear: null,
    }
    const s = seriesOf(new CrossingOption(input, ctx()).build())
    const stock = s.find((x) => x.name === 'series.stock')!
    expect(stock.markLine).toBeUndefined()
  })
})

// --- FootprintDonutOption ---------------------------------------------------

describe('FootprintDonutOption', () => {
  // Forward window [referenceYear 2020, 2020 + horizonYears('20y') = 2040] (§17.4, ADR-025). Every
  // slice is a TRUE finite integral Σ over the window (business §2.4 #2): stock/fossil AND forgone
  // summed over the window (pre-referenceYear and past-target points excluded). Stock Σ = 30, fossil
  // Σ = 180, forgone Σ = 100.
  const main = (): GlobalResultDTO & GlobalDerived => ({
    params: globalParams,
    referenceYear: 2020,
    perDomainArea: [],
    perDomainStock: [],
    perDomainForgoneSink: [],
    // 2010 pre-referenceYear and 2050 past-target → excluded; 2020+2030+2040 in-window → Σ = 30.
    aggregateStock: series('stock:global', [[2010, 999], [2020, 5], [2030, 10], [2040, 15], [2050, 999]]),
    // forgone band mid 2020..2040 → 20+30+50 = 100 (a TRUE Σ, not rate × years).
    aggregateForgoneSink: band('agg', [[2020, 15, 20, 25], [2030, 25, 30, 35], [2040, 45, 50, 55], [2050, 994, 999, 1004]]),
    aggregateFullEmissions: series('aggFull', [[2020, 50]]),
    multiplier: 1.6,
    crossingYear: null,
  })
  const reference = (): ReferenceDTO => ({
    params: globalParams,
    referenceYear: 2020,
    // 2010 pre-referenceYear and 2050 past-target → excluded; 2020+2030+2040 in-window → Σ = 180.
    fossilTotal: series('fossil', [[2010, 999], [2020, 50], [2030, 60], [2040, 70], [2050, 999]]),
  })
  const data = () => ({ reference: reference(), main: main() })

  it('full set (slide 5) → 3 slices (fossil, stock, forgone sink) as window totals', () => {
    const s = seriesOf(new FootprintDonutOption(data(), ctx({ horizon: '20y' })).build())
    expect(s[0]!.type).toBe('pie')
    const slices = s[0]!.data as Array<{ name: string; value: number }>
    expect(slices.map((d) => d.value)).toEqual([180, 30, 100]) // fossil Σ, stock Σ, forgone Σ
  })

  it('fossil removed (slide 6) → 2 deforestation slices (stock + forgone sink)', () => {
    const s = seriesOf(
      new FootprintDonutOption(data(), ctx({ horizon: '20y' }), {
        metrics: ['stock', 'forgoneSink'],
      }).build(),
    )
    const slices = s[0]!.data as Array<{ name: string; value: number }>
    expect(slices.map((d) => d.name)).toEqual(['series.stock', 'series.forgoneSink'])
    expect(slices.map((d) => d.value)).toEqual([30, 100])
  })
})

// --- FossilComparisonOption -------------------------------------------------

describe('FossilComparisonOption', () => {
  // Forward window [referenceYear 2020, 2020 + horizonYears('20y') = 2040] (§17.4, ADR-025). All three
  // magnitudes are TRUE finite integrals Σ over the window (business §2.4 #2): stock Σ = 30, fossil Σ =
  // 180, forgone Σ = 100.
  const main: GlobalResultDTO & GlobalDerived = {
    params: globalParams,
    referenceYear: 2020,
    perDomainArea: [],
    perDomainStock: [],
    perDomainForgoneSink: [],
    aggregateStock: series('stock:global', [[2010, 999], [2020, 5], [2030, 10], [2040, 15], [2050, 999]]),
    aggregateForgoneSink: band('agg', [[2020, 15, 20, 25], [2030, 25, 30, 35], [2040, 45, 50, 55], [2050, 994, 999, 1004]]),
    aggregateFullEmissions: series('aggFull', [[2020, 50]]),
    multiplier: 1.6,
    crossingYear: null,
  }
  const reference: ReferenceDTO = {
    params: globalParams,
    referenceYear: 2020,
    fossilTotal: series('fossil', [[2010, 999], [2020, 50], [2030, 60], [2040, 70], [2050, 999]]),
  }

  it('slide 5 (fossil present) → deforestation stacked (stock+forgone) + fossil bar; two categories, axis dominated by fossil', () => {
    const opt = new FossilComparisonOption({ reference, main }, ctx({ horizon: '20y' })).build()
    const s = seriesOf(opt)
    expect(s).toHaveLength(3)
    const stockBar = s.find((x) => x.name === 'series.stock')!
    const forgoneBar = s.find((x) => x.name === 'series.forgoneSink')!
    const fossilBar = s.find((x) => x.name === 'series.fossil')!
    expect(stockBar.stack).toBe('defo')
    expect(forgoneBar.stack).toBe('defo')
    expect(stockBar.data).toEqual([30, null]) // stock Σ over window, fossil slot null
    expect(forgoneBar.data).toEqual([100, null]) // forgone Σ over window
    expect(fossilBar.stack).toBeUndefined()
    expect(fossilBar.data).toEqual([null, 180]) // fossil Σ over window
    const x = opt.xAxis as unknown as { data?: string[] }
    expect(x.data).toEqual(['fossil.deforestation', 'fossil.fossil'])
    const y = opt.yAxis as unknown as AxisLike
    expect(y.max).toBe(200) // dominated by fossil 180 → nice 200
    expect(y.interval).toBe(50)
  })

  it('slide 6 (fossil removed) → only the deforestation category; single Y-axis rescales to its range', () => {
    const opt = new FossilComparisonOption(
      { reference, main },
      ctx({ horizon: '20y' }),
      { metrics: ['stock', 'forgoneSink'] },
    ).build()
    const s = seriesOf(opt)
    expect(s).toHaveLength(2)
    expect(s.find((x) => x.name === 'series.fossil')).toBeUndefined()
    expect(s.find((x) => x.name === 'series.stock')!.data).toEqual([30])
    expect(s.find((x) => x.name === 'series.forgoneSink')!.data).toEqual([100])
    const x = opt.xAxis as unknown as { data?: string[] }
    expect(x.data).toEqual(['fossil.deforestation'])
    const y = opt.yAxis as unknown as AxisLike
    expect(y.max).toBe(150) // rescaled from 200 → deforestation total 130 → nice 150
    expect(y.interval).toBe(50)
  })
})
