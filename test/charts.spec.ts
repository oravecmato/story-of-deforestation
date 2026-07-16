import { describe, it, expect } from 'vitest'
import type { EChartsOption } from 'echarts'
import type {
  Series,
  BandSeries,
  DerivationParams,
  DomainResultDTO,
  GlobalResultDTO,
  RankingDTO,
  ReferenceDTO,
  ThemeTokens,
} from '../shared/types'
import { CompactNumberFormatter } from '../app/format/Formatter'
import type { ChartContext } from '../app/charts/BaseChartOption'
import { PROJECTED_SUFFIX } from '../app/charts/BaseChartOption'
import { MainStackedOption } from '../app/charts/MainStackedOption'
import { GlobalStackedAreaOption } from '../app/charts/GlobalStackedAreaOption'
import { CrossingOption, type CrossingInput } from '../app/charts/CrossingOption'
import { RankingBumpOption } from '../app/charts/RankingBumpOption'
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
  data: { stock: '#5FBE6E', forgoneSink: '#E8A13A', fossil: '#5B6B7F' },
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
    rScenario: 'mid',
    timeRange: null,
    ...over,
  }
}

function series(id: string, rows: Array<[number, number | null]>, projectedFrom: number | null = null): Series {
  return {
    id,
    points: rows.map(([year, value]) => ({ source: 'X', geo: 'G', year, value })),
    meta: { indicatorId: id, seriesType: 'flow', unit: 'MtCO2', latestDataYear: rows.at(-1)?.[0] ?? null, gaps: [], isEstimate: false, projectedFrom },
  }
}

/** rows: [year, lower, mid, upper] */
function band(id: string, rows: Array<[number, number, number, number]>, projectedFrom: number | null = null): BandSeries {
  return {
    id,
    points: rows.map(([year, , mid]) => ({ source: 'D', geo: 'G', year, value: mid })),
    lower: rows.map(([year, lo]) => ({ source: 'D', geo: 'G', year, value: lo })),
    upper: rows.map(([year, , , up]) => ({ source: 'D', geo: 'G', year, value: up })),
    meta: { indicatorId: id, seriesType: 'flow', unit: 'MtCO2', latestDataYear: rows.at(-1)?.[0] ?? null, gaps: [], isEstimate: true, projectedFrom },
  }
}

const localParams: DerivationParams = { scope: 'local', domainId: 'amazon', horizon: 'today', rScenario: 'mid', baseline: 1995 }
const globalParams: DerivationParams = { scope: 'global', horizon: 'today', rScenario: 'mid', baseline: 1990 }

interface AnySeries {
  name?: string
  type?: string
  stack?: string
  data?: unknown[]
  lineStyle?: { type?: string; color?: string; opacity?: number }
  areaStyle?: { color?: string }
  markLine?: { data?: Array<{ xAxis?: number }> }
  markPoint?: { data?: unknown[] }
}
const seriesOf = (o: EChartsOption): AnySeries[] => o.series as unknown as AnySeries[]

interface AxisLike {
  max?: number
  interval?: number
  inverse?: boolean
}

// --- MainStackedOption ------------------------------------------------------

describe('MainStackedOption', () => {
  const dto = (): DomainResultDTO => ({
    params: localParams,
    referenceYear: 2001,
    area: series('area', [[2000, 100]]),
    cumulativeLoss: series('loss', [[2000, 1]]),
    stock: series('stock', [[2000, 10], [2001, 12]]),
    forgoneSink: band('fs', [[2000, 5, 8, 11], [2001, 6, 10, 14]]),
    fullEmissions: series('full', [[2000, 15]]),
    multiplier: 1.5,
    crossingYear: null,
  })

  it('continuous stock + forgone stacked fills + dashed forgone top-edge + CI band', () => {
    const s = seriesOf(new MainStackedOption(dto(), ctx()).build())
    // stock area, forgone area, stock top-edge, forgone top-edge, band lower + upper
    expect(s).toHaveLength(6)
    expect(s[0]!.stack).toBe('main')
    const forgone = s.find((x) => x.name === 'series.forgoneSink')!
    expect(forgone.stack).toBe('main') // stacked on stock, not an independent floating line
    // the forgone's dashed identity is its non-stacked top-edge overlay line
    const forgoneEdge = s.find((x) => x.name === PROJECTED_SUFFIX + 'forgone')!
    expect(forgoneEdge.stack).toBeUndefined()
    expect(forgoneEdge.lineStyle?.type).toBe('dashed')
    const fill = s.find((x) => x.name === '__bandUpper')!
    expect(fill.areaStyle?.color).toBe('rgba(232, 161, 58, 0.18)')
    const lo = s.find((x) => x.name === '__bandLower')!
    expect(lo.data?.[0]).toEqual([Date.UTC(2000, 0, 1), 15]) // stock(10) + forgone.lower(5)
  })

  it('future horizon → dashed-lighter projected top-edge twin + join-year divider', () => {
    const d = dto()
    d.stock = series('stock', [[2000, 10], [2001, 12], [2002, 14]], 2001)
    const s = seriesOf(new MainStackedOption(d, ctx({ horizon: '20y' })).build())
    // stock top-edge is split into a measured ('stockm') + a dashed-lighter projected ('stockp') twin
    const twin = s.find((x) => x.name === PROJECTED_SUFFIX + 'stockp')!
    expect(twin).toBeDefined()
    expect(twin.lineStyle?.type).toBe('dashed')
    expect(twin.lineStyle?.opacity).toBe(0.55)
    // the continuous stock area carries the join-year divider markLine
    const area = s.find((x) => x.name === 'series.stock')!
    expect(area.markLine?.data?.[0]?.xAxis).toBe(Date.UTC(2001, 0, 1))
  })

  it('is zoomable → embeds inside + slider dataZoom; timeRange seeds start/endValue', () => {
    const o = new MainStackedOption(dto(), ctx({ timeRange: [2005, 2015] })).build()
    const dz = o.dataZoom as Array<{ type?: string; startValue?: number; endValue?: number; filterMode?: string }>
    expect(dz.map((z) => z.type)).toEqual(['inside', 'slider'])
    expect(dz.every((z) => z.filterMode === 'none')).toBe(true)
    expect(dz[0]).toMatchObject({ startValue: Date.UTC(2005, 0, 1), endValue: Date.UTC(2015, 0, 1) })
  })

  it('no timeRange → dataZoom present without a fixed range (full extent)', () => {
    const o = new MainStackedOption(dto(), ctx({ timeRange: null })).build()
    const dz = o.dataZoom as Array<{ startValue?: number; endValue?: number }>
    expect(dz).toHaveLength(2)
    expect(dz[0]!.startValue).toBeUndefined()
  })
})

// --- GlobalStackedAreaOption -----------------------------------------------

describe('GlobalStackedAreaOption', () => {
  const dto = (): GlobalResultDTO => ({
    params: globalParams,
    referenceYear: 2001,
    perDomainStock: [series('stock:amazon', [[2001, 10]]), series('stock:congo', [[2001, 20]])],
    perDomainForgoneSink: [series('fs:amazon', [[2001, 3]]), series('fs:congo', [[2001, 4]])],
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

// --- RankingBumpOption ------------------------------------------------------

describe('RankingBumpOption', () => {
  const dto: RankingDTO = {
    params: globalParams,
    referenceYear: 2001,
    today: [
      { domainId: 'amazon', value: 100, rank: 1 },
      { domainId: 'congo', value: 50, rank: 2 },
    ],
    atHorizon: [
      { domainId: 'congo', value: 120, rank: 1 },
      { domainId: 'amazon', value: 110, rank: 2 },
    ],
  }

  it('one line per domain connecting today → atHorizon rank; inverse Y capped at domain count', () => {
    const opt = new RankingBumpOption(dto, ctx()).build()
    const s = seriesOf(opt)
    expect(s).toHaveLength(2)
    const amazon = s.find((x) => x.name === 'domain.amazon')!
    expect(amazon.data).toEqual([[0, 1], [1, 2]])
    const y = opt.yAxis as unknown as AxisLike
    expect(y.inverse).toBe(true)
    expect(y.max).toBe(2)
  })
})

// --- FootprintDonutOption ---------------------------------------------------

describe('FootprintDonutOption', () => {
  const dto = (): ReferenceDTO => ({
    params: globalParams,
    referenceYear: 2001,
    fossilTotal: series('fossil', [[2001, 200]]),
    sharePercent: 8,
    composition: { fossil: 200, stock: 10, forgoneSink: 6 },
  })

  it('always 3 slices (fossil, stock, forgone sink)', () => {
    const s = seriesOf(new FootprintDonutOption(dto(), ctx()).build())
    expect(s[0]!.type).toBe('pie')
    expect(s[0]!.data).toHaveLength(3)
  })
})

// --- FossilComparisonOption -------------------------------------------------

describe('FossilComparisonOption', () => {
  const main: GlobalResultDTO = {
    params: globalParams,
    referenceYear: 2001,
    perDomainStock: [series('stock:amazon', [[2001, 10]]), series('stock:congo', [[2001, 20]])],
    perDomainForgoneSink: [series('fs:amazon', [[2001, 3]]), series('fs:congo', [[2001, 4]])],
    aggregateStock: series('stock:global', [[2001, 30]]),
    aggregateForgoneSink: band('agg', [[2001, 5, 8, 11]]),
    aggregateFullEmissions: series('aggFull', [[2001, 50]]),
    multiplier: 1.6,
    crossingYear: null,
  }
  const reference: ReferenceDTO = {
    params: globalParams,
    referenceYear: 2001,
    fossilTotal: series('fossil', [[2001, 200]]),
    sharePercent: 25,
    composition: { fossil: 200, stock: 30, forgoneSink: 20 },
  }

  it('deforestation bar = aggregateFullEmissions@refYear; two bars on paired grids', () => {
    const opt = new FossilComparisonOption({ reference, main }, ctx()).build()
    const s = seriesOf(opt)
    expect(s).toHaveLength(2)
    expect(s[0]!.data).toEqual([50])
    expect(s[1]!.data).toEqual([200])
  })

  it('both Y axes share one nice max + interval (overriding auto-scale)', () => {
    const opt = new FossilComparisonOption({ reference, main }, ctx()).build()
    const [left, right] = opt.yAxis as unknown as AxisLike[]
    expect(left!.max).toBe(200)
    expect(left!.interval).toBe(50)
    expect(right!.max).toBe(left!.max)
    expect(right!.interval).toBe(left!.interval)
  })
})
