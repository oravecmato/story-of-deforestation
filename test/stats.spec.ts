import { describe, it, expect } from 'vitest'
import type { BandSeries, RRange } from '../shared/types'
import {
  movingAvg,
  detrend,
  diff,
  cumulative,
  areaLoss,
  cumulativeLoss,
  forgoneSink,
  fullEmissions,
  sumWindow,
  multiplier,
  crossingYear,
  referenceYear,
  aggregateForgoneSink,
  sharePercent,
  projectSeries,
  pearson,
  lagCorrelation,
  KM2_TO_HA,
  T_TO_MT,
} from '../shared/utils/stats'
import { mkSeries, values, years } from './helpers/series'

describe('generic transforms', () => {
  it('movingAvg: centered window, non-null neighbours only', () => {
    const s = mkSeries('s', [1, 2, 3, 4, 5])
    expect(values(movingAvg(s, 3))).toEqual([1.5, 2, 3, 4, 4.5])
  })

  it('movingAvg: skips nulls in the average', () => {
    const s = mkSeries('s', [2, null, 4])
    // i0: mean(2) = 2 ; i1: mean(2,4) = 3 ; i2: mean(4) = 4
    expect(values(movingAvg(s, 3))).toEqual([2, 3, 4])
  })

  it('detrend: value minus centered moving average', () => {
    const s = mkSeries('s', [1, 2, 3, 4, 5])
    const d = detrend(s, 3)
    expect(values(d)).toEqual([1 - 1.5, 0, 0, 0, 5 - 4.5])
  })

  it('diff: first differences, seriesType flow, shifted years', () => {
    const s = mkSeries('s', [1, 2, 4, 7])
    const d = diff(s)
    expect(values(d)).toEqual([1, 2, 3])
    expect(years(d)).toEqual([1991, 1992, 1993])
    expect(d.meta.seriesType).toBe('flow')
  })

  it('cumulative: running sum, seriesType state, nulls carry', () => {
    const s = mkSeries('s', [1, 2, 3, 4, 5])
    const c = cumulative(s)
    expect(values(c)).toEqual([1, 3, 6, 10, 15])
    expect(c.meta.seriesType).toBe('state')
    expect(values(cumulative(mkSeries('n', [5, null, 5])))).toEqual([5, 5, 10])
  })
})

describe('domain derivations', () => {
  it('areaLoss: -diff clipped to losses (gains → 0)', () => {
    const area = mkSeries('area', [100, 90, 95, 80])
    const loss = areaLoss(area)
    expect(values(loss)).toEqual([10, 0, 15])
    expect(years(loss)).toEqual([1991, 1992, 1993])
    expect(loss.meta.seriesType).toBe('flow')
  })

  it('cumulativeLoss: integrates loss from the baseline year', () => {
    const area = mkSeries('area', [
      [1990, 100],
      [1991, 90],
      [1992, 95],
      [1993, 80],
    ])
    expect(values(cumulativeLoss(area, 1990))).toEqual([10, 10, 25])
    // baseline 1991: scoped to [90,95,80] → losses [0,15] → cumulative [0,15]
    expect(values(cumulativeLoss(area, 1991))).toEqual([0, 15])
    expect(cumulativeLoss(area, 1990).meta.seriesType).toBe('state')
  })

  const amazonR: RRange = { mid: 1.36, low: 0, high: 2.23 } // asymmetric, floor 0

  it('forgoneSink: R × cumLoss with unit conversion, mid scenario', () => {
    const cumLoss = mkSeries('cl', [10_000, 25_000]) // km²
    const fs = forgoneSink(cumLoss, { mid: 2, low: 1, high: 3 }, 'mid')
    expect(KM2_TO_HA * T_TO_MT).toBeCloseTo(1e-4, 12) // conversion factor
    expect(fs.points.map((p) => p.value!)).toEqual([
      expect.closeTo(2, 10),
      expect.closeTo(5, 10),
    ]) // [2, 5]
    expect(fs.lower.map((p) => p.value!)).toEqual([expect.closeTo(1, 10), expect.closeTo(2.5, 10)])
    expect(fs.upper.map((p) => p.value!)).toEqual([expect.closeTo(3, 10), expect.closeTo(7.5, 10)])
    expect(fs.meta.isEstimate).toBe(true)
    expect(fs.meta.unit).toBe('Mt CO2')
    expect(fs.meta.seriesType).toBe('flow')
  })

  it('forgoneSink: preserves an asymmetric band (Amazon floor-0)', () => {
    const cumLoss = mkSeries('cl', [10_000])
    const fs = forgoneSink(cumLoss, amazonR, 'mid')
    const mid = fs.points[0]!.value!
    const low = fs.lower[0]!.value!
    const high = fs.upper[0]!.value!
    expect(low).toBe(0) // zero endpoint stays zero
    expect(mid - low).toBeCloseTo(1.36 * 10_000 * 1e-4, 10)
    expect(high - mid).toBeCloseTo(0.87 * 10_000 * 1e-4, 10)
    expect(mid - low).not.toBeCloseTo(high - mid) // genuinely asymmetric
  })

  it('forgoneSink: scenario picks the central line, band stays full CI', () => {
    const cumLoss = mkSeries('cl', [10_000])
    const high = forgoneSink(cumLoss, amazonR, 'high')
    const cons = forgoneSink(cumLoss, amazonR, 'conservative')
    expect(high.points[0]!.value).toBeCloseTo(2.23 * 10_000 * 1e-4, 10)
    expect(cons.points[0]!.value).toBe(0)
    // band endpoints are the same regardless of the drawn scenario line
    expect(high.lower[0]!.value).toBe(0)
    expect(high.upper[0]!.value).toBeCloseTo(2.23 * 10_000 * 1e-4, 10)
  })

  it('fullEmissions: pointwise sum, null stock → null', () => {
    const stock = mkSeries('stock', [
      [1990, 5],
      [1991, 6],
      [1992, null],
    ])
    const forgone = mkSeries('fs', [
      [1990, 2],
      [1991, 5],
      [1992, 9],
    ])
    expect(values(fullEmissions(stock, forgone))).toEqual([7, 11, null])
    expect(fullEmissions(stock, forgone).meta.isEstimate).toBe(true)
  })

  it('sumWindow: Σ non-null values over the inclusive window', () => {
    const s = mkSeries('s', [
      [2019, 1],
      [2020, 4],
      [2021, null],
      [2022, 6],
      [2025, 9],
    ])
    expect(sumWindow(s, 2020, 2022)).toBe(10) // 4 + 6 (2021 null skipped, 2019/2025 out of window)
    expect(sumWindow(s, 2020, 2020)).toBe(4) // single-year window
  })

  it('multiplier: Σfull / Σofficial over the window (today collapses to one year)', () => {
    const stock = mkSeries('stock', [
      [2020, 4],
      [2021, 6],
    ])
    const full = mkSeries('full', [
      [2020, 10],
      [2021, 20],
    ])
    expect(multiplier(stock, full, 2020, 2020)).toBe(2.5) // single-year window = measured ratio
    expect(multiplier(stock, full, 2020, 2021)).toBe(3) // (10+20)/(4+6)
    expect(multiplier(mkSeries('s', [[2020, 0]]), full, 2020, 2020)).toBeNaN()
  })

  it('crossingYear: first year forgone crosses (≥) stock, else null', () => {
    const stock = mkSeries('stock', [
      [2000, 10],
      [2001, 10],
      [2002, 10],
    ])
    const forgone = mkSeries('f', [
      [2000, 3],
      [2001, 9],
      [2002, 12],
    ])
    expect(crossingYear(stock, forgone)).toBe(2002)
    const never = mkSeries('f', [
      [2000, 1],
      [2001, 2],
      [2002, 3],
    ])
    expect(crossingYear(stock, never)).toBeNull()
  })

  it('referenceYear: min common latestDataYear', () => {
    const a = mkSeries('a', [1], { latestDataYear: 2023 })
    const b = mkSeries('b', [1], { latestDataYear: 2021 })
    const c = mkSeries('c', [1], { latestDataYear: 2022 })
    expect(referenceYear(a, b, c)).toBe(2021)
  })
})

describe('aggregation', () => {
  const band = (
    id: string,
    year: number,
    mid: number,
    low: number,
    high: number,
  ): BandSeries => ({
    id,
    points: [{ source: 't', geo: 'X', year, value: mid }],
    lower: [{ source: 't', geo: 'X', year, value: low }],
    upper: [{ source: 't', geo: 'X', year, value: high }],
    meta: {
      indicatorId: id,
      seriesType: 'flow',
      unit: 'Mt CO2',
      latestDataYear: year,
      gaps: [],
      isEstimate: true,
      projectedFrom: null,
      reconstructedBefore: null,
    },
  })

  it('aggregateForgoneSink: sums mid, combines deviations per side in quadrature', () => {
    const a = band('a', 2000, 10, 8, 13) // devs: low 2, high 3
    const b = band('b', 2000, 20, 15, 28) // devs: low 5, high 8
    const agg = aggregateForgoneSink([a, b])
    expect(agg.points[0]!.value).toBe(30)
    expect(agg.lower[0]!.value).toBeCloseTo(30 - Math.sqrt(2 ** 2 + 5 ** 2), 10) // ≈ 24.615
    expect(agg.upper[0]!.value).toBeCloseTo(30 + Math.sqrt(3 ** 2 + 8 ** 2), 10) // ≈ 38.544
  })

  it('aggregateForgoneSink: does NOT symmetrize an asymmetric input', () => {
    const asym = band('a', 2000, 10, 0, 10.87) // low dev 10, high dev 0.87
    const agg = aggregateForgoneSink([asym])
    const mid = agg.points[0]!.value!
    expect(mid - agg.lower[0]!.value!).toBeCloseTo(10, 10)
    expect(agg.upper[0]!.value! - mid).toBeCloseTo(0.87, 10)
  })

  it('sharePercent: percentage, NaN on zero denominator', () => {
    expect(sharePercent(5, 100)).toBe(5)
    expect(sharePercent(5, 0)).toBeNaN()
  })
})

describe('correlation (dormant core)', () => {
  it('pearson: ±1 for perfectly (anti)correlated, NaN for n<3', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10)
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 10)
    expect(pearson([1, 2], [1, 2])).toBeNaN()
  })

  // Reproduces the spike's documented self-test (business §10): a shared trend makes the LEVELS
  // correlation positive (common-trend trap), while detrend/diff recover the true negative signal,
  // strongest at lag 0.
  it('reproduces the spike self-test (levels trap vs detrended signal)', () => {
    let seed = 42
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const n = 60
    const cddVals = Array.from({ length: n }, (_, i) => 40 + i * 0.8 + (rand() - 0.5) * 30)
    const yieldVals = Array.from({ length: n }, (_, i) => {
      const droughtNow = cddVals[i]! - (40 + i * 0.8)
      const droughtPrev = i > 0 ? cddVals[i - 1]! - (40 + (i - 1) * 0.8) : 0
      return 800 + i * 25 + droughtNow * -8 + droughtPrev * -3 + (rand() - 0.5) * 80
    })
    const cdd = mkSeries(
      'cdd',
      cddVals.map((v, i): [number, number] => [1961 + i, v]),
    )
    const yld = mkSeries(
      'yield',
      yieldVals.map((v, i): [number, number] => [1961 + i, v]),
    )

    // Levels: misleadingly positive (dominated by the shared trend).
    expect(pearson(cddVals, yieldVals)).toBeCloseTo(0.756, 2)

    // Method A — detrend; Method B — first differences. Both negative, strongest at lag 0.
    const dCorr = lagCorrelation(values(detrend(cdd)) as number[], values(detrend(yld)) as number[], 4)
    const fCorr = lagCorrelation(values(diff(cdd)) as number[], values(diff(yld)) as number[], 4)
    expect(dCorr[0]!.r).toBeCloseTo(-0.885, 2)
    expect(fCorr[0]!.r).toBeCloseTo(-0.89, 2)

    const strongest = (arr: Array<{ lag: number; r: number }>) =>
      arr.reduce((m, x) => (Math.abs(x.r) > Math.abs(m.r) ? x : m)).lag
    expect(strongest(dCorr)).toBe(0)
    expect(strongest(fCorr)).toBe(0)
  })
})

describe('projectSeries (fix A: anchored on the last measured point)', () => {
  it('continues from the last measured value using the fitted slope (no step at the join)', () => {
    // Last point (20) sits ABOVE the regression line: slope = 5, line at 2002 = 19, actual = 20.
    // Reading off the raw line would step down to 24 at 2003; anchoring continues from 20 → 25.
    const s = mkSeries('s', [[2000, 10], [2001, 12], [2002, 20]])
    const p = projectSeries(s, 2004)

    expect(p.meta.projectedFrom).toBe(2002)
    expect(values(p).slice(0, 3)).toEqual([10, 12, 20]) // measured untouched
    const at = (y: number) => p.points.find((x) => x.year === y)!.value!
    expect(at(2003)).toBeCloseTo(25, 10) // 20 + slope(5)·1
    expect(at(2004)).toBeCloseTo(30, 10) // 20 + slope(5)·2
  })

  it('clamps a steep decline at zero (does not go negative)', () => {
    const s = mkSeries('s', [[2000, 30], [2001, 20], [2002, 10]]) // slope = -10, anchor 10
    const p = projectSeries(s, 2005)
    const at = (y: number) => p.points.find((x) => x.year === y)!.value!
    expect(at(2003)).toBeCloseTo(0, 10) // 10 − 10 = 0
    expect(at(2004)).toBe(0) // clamped, not −10
    expect(at(2005)).toBe(0)
  })

  it('returns the series unchanged (projectedFrom null) when the target is not in the future', () => {
    const s = mkSeries('s', [[2000, 10], [2001, 12], [2002, 20]])
    const p = projectSeries(s, 2002)
    expect(p.meta.projectedFrom).toBeNull()
    expect(values(p)).toEqual([10, 12, 20])
  })
})

describe('purity / determinism (ADR-005)', () => {
  it('does not mutate inputs and is repeatable', () => {
    const area = mkSeries('area', [100, 90, 80])
    const before = JSON.stringify(area)
    const cl1 = cumulativeLoss(area, 1990)
    const cl2 = cumulativeLoss(area, 1990)
    expect(JSON.stringify(area)).toBe(before) // input untouched
    expect(cl1).toEqual(cl2) // deterministic
    const fs1 = forgoneSink(cl1, { mid: 2, low: 1, high: 3 }, 'mid')
    const fs2 = forgoneSink(cl2, { mid: 2, low: 1, high: 3 }, 'mid')
    expect(fs1).toEqual(fs2)
  })
})
