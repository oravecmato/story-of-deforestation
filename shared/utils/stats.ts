import type {
  Series,
  BandSeries,
  DataPoint,
  SeriesMeta,
  RRange,
  RScenario,
} from '../types'

/**
 * Pure, composable, isomorphic statistics core (tech-spec §5, business §8).
 * `series in → series out`, uniform point shape, nulls preserved. This is the single
 * authoritative derivation path (ADR-005): endpoints are deterministic functions of their inputs.
 *
 * NOTE (deferred): the Series-level `state × state` correlation guard is added when the (dormant)
 * correlation view is wired. `pearson`/`lagCorrelation` numerics live here already.
 */

// ── Unit-conversion constants for the forgone sink ──────────────────────────────────────────────
// Forest area (AG.LND.FRST.K2) is in km²; R is in t CO₂ / ha / yr; emission series are in Mt CO₂.
// forgoneSink[Mt CO₂/yr] = area[km²] × KM2_TO_HA[ha/km²] × R[t CO₂/ha/yr] × T_TO_MT[Mt/t].
export const KM2_TO_HA = 100
export const T_TO_MT = 1e-6

// ── internal helpers ────────────────────────────────────────────────────────────────────────────

function cloneMeta(meta: SeriesMeta, override: Partial<SeriesMeta> = {}): SeriesMeta {
  return { ...meta, gaps: [...meta.gaps], ...override }
}

/** Rebuild a series applying `fn` to each point's value, preserving source/geo/year and meta. */
function mapValues(
  series: Series,
  fn: (value: number | null, index: number, point: DataPoint) => number | null,
  metaOverride: Partial<SeriesMeta> = {},
  idSuffix?: string,
): Series {
  return {
    id: idSuffix ? `${series.id}:${idSuffix}` : series.id,
    points: series.points.map((p, i) => ({ ...p, value: fn(p.value, i, p) })),
    meta: cloneMeta(series.meta, metaOverride),
  }
}

/** Select the central R value for the chosen scenario (business §4.1). */
export function pickR(r: RRange, scenario: RScenario): number {
  if (scenario === 'conservative') return r.low
  if (scenario === 'high') return r.high
  return r.mid
}

// ── generic transforms (business §8) ────────────────────────────────────────────────────────────

/** Centered moving average over a window; averages only non-null neighbours. */
export function movingAvg(s: Series, window = 9): Series {
  const half = Math.floor(window / 2)
  const pts = s.points
  return mapValues(s, (_v, i) => {
    const nbrs = pts.slice(Math.max(0, i - half), i + half + 1).filter((q) => q.value != null)
    if (nbrs.length === 0) return null
    return nbrs.reduce((sum, q) => sum + (q.value as number), 0) / nbrs.length
  })
}

/** Deviation from the centered moving average (isolates year-to-year volatility). */
export function detrend(s: Series, window = 9): Series {
  const trend = movingAvg(s, window)
  return mapValues(s, (v, i) => {
    const t = trend.points[i]?.value
    return v == null || t == null ? null : v - t
  })
}

/** First differences (flow); a trend-removal cross-check without Slutzky–Yule artifacts. */
export function diff(s: Series): Series {
  const points: DataPoint[] = s.points.slice(1).map((p, i) => {
    const prev = s.points[i]?.value
    const cur = p.value
    return { ...p, value: prev == null || cur == null ? null : cur - prev }
  })
  return { id: `${s.id}:diff`, points, meta: cloneMeta(s.meta, { seriesType: 'flow' }) }
}

/** Cumulative sum (state); the conceptual inverse of `diff`. Nulls contribute 0 (carry forward). */
export function cumulative(s: Series): Series {
  let acc = 0
  const points: DataPoint[] = s.points.map((p) => {
    if (p.value != null) acc += p.value
    return { ...p, value: acc }
  })
  return { id: `${s.id}:cumulative`, points, meta: cloneMeta(s.meta, { seriesType: 'state' }) }
}


/**
 * Sum several homogeneous series (e.g. a domain's retained per-country forest area) into one,
 * aligned by year. A year's value is the sum of the non-null contributors, or `null` if none has
 * data that year (holes preserved). Contributor gaps are merged; `latestDataYear` is the last year
 * that has a real summed value.
 *
 * PURE aggregation — no coverage/exclusion logic. Deciding WHICH countries may contribute is the
 * `CoverageGate`'s job (§6, ADR-020); callers pass only the retained contributors.
 */
export function sumSeries(series: Series[], id: string, geo = 'SUM'): Series {
  const first = series[0]
  const years = new Set<number>()
  for (const s of series) for (const p of s.points) years.add(p.year)
  const sortedYears = [...years].sort((a, b) => a - b)

  const byYear = series.map((s) => new Map(s.points.map((p) => [p.year, p.value])))
  const points: DataPoint[] = sortedYears.map((year) => {
    let sum = 0
    let any = false
    for (const m of byYear) {
      const v = m.get(year)
      if (v != null) {
        sum += v
        any = true
      }
    }
    return { source: 'derived', geo, year, value: any ? sum : null }
  })

  const lastReal = [...points].reverse().find((p) => p.value != null)?.year ?? null

  const meta: SeriesMeta = {
    indicatorId: first?.meta.indicatorId ?? id,
    seriesType: first?.meta.seriesType ?? 'state',
    unit: first?.meta.unit ?? 'unit',
    latestDataYear: lastReal,
    gaps: series.flatMap((s) => s.meta.gaps),
    isEstimate: false,
    projectedFrom: null,
    reconstructedBefore: null,
  }
  return { id, points, meta }
}

// ── correlation (dormant in V1; guard added with the correlation view — business §2.7) ───────────

/** Pearson product-moment correlation. Returns NaN for n < 3. */
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 3 || ys.length !== n) return NaN
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const ax = (xs[i] as number) - mx
    const ay = (ys[i] as number) - my
    num += ax * ay
    dx += ax * ax
    dy += ay * ay
  }
  return num / Math.sqrt(dx * dy)
}

/** Correlation of y[t] against x[t − lag] for lag = 0..maxLag (index-aligned arrays). */
export function lagCorrelation(
  xs: number[],
  ys: number[],
  maxLag: number,
): Array<{ lag: number; r: number }> {
  const out: Array<{ lag: number; r: number }> = []
  for (let lag = 0; lag <= maxLag; lag++) {
    const x: number[] = []
    const y: number[] = []
    for (let i = lag; i < ys.length; i++) {
      const xv = xs[i - lag]
      const yv = ys[i]
      if (xv != null && yv != null) {
        x.push(xv)
        y.push(yv)
      }
    }
    out.push({ lag, r: pearson(x, y) })
  }
  return out
}

// ── domain derivations (business §2.2, §2.5) ─────────────────────────────────────────────────────

/** Annual forest-area loss = −diff(area), clipped to losses (area gains count as 0 loss). */
export function areaLoss(area: Series): Series {
  const points: DataPoint[] = area.points.slice(1).map((p, i) => {
    const prev = area.points[i]?.value
    const cur = p.value
    const loss = prev == null || cur == null ? null : Math.max(0, prev - cur)
    return { ...p, value: loss }
  })
  return {
    id: `${area.id}:areaLoss`,
    points,
    meta: cloneMeta(area.meta, { indicatorId: 'areaLoss', seriesType: 'flow', isEstimate: false }),
  }
}

/** Cumulative area loss from `baseline` onward (state). The origin is caller-supplied — the server
 *  passes BASELINE_FLOOR (full range, ADR-026); the client re-derives per the slider (§7.2a). */
export function cumulativeLoss(area: Series, baseline: number): Series {
  const scoped: Series = {
    ...area,
    points: area.points.filter((p) => p.year >= baseline),
  }
  const cum = cumulative(areaLoss(scoped))
  return {
    id: `${area.id}:cumulativeLoss`,
    points: cum.points,
    meta: cloneMeta(area.meta, {
      indicatorId: 'cumulativeLoss',
      seriesType: 'state',
      isEstimate: false,
    }),
  }
}

/**
 * Extend a series past its last measured year up to `targetYear` with a linear-trend extrapolation
 * (ADR-019, business §2.4a). The slope is a least-squares fit over the last `lookback` measured
 * points; the line is anchored on the last measured value (so the dashed projection continues from
 * where measurement ends, no step at the join year) and clamped ≥ 0. Appended points carry
 * `source: 'projected'`; the returned meta's `projectedFrom` = last measured year — the join year the
 * charts split (solid → dashed) at. `targetYear ≤ last measured year` returns the series unchanged
 * (`projectedFrom = null`). Applied PER DOMAIN before `× R` and aggregation.
 */
export function projectSeries(series: Series, targetYear: number, lookback = 9): Series {
  const measured = series.points.filter((p) => p.value != null)
  const lastMeasured = measured[measured.length - 1]
  if (lastMeasured == null || targetYear <= lastMeasured.year) {
    return { ...series, points: [...series.points], meta: cloneMeta(series.meta, { projectedFrom: null }) }
  }

  const recent = measured.slice(-lookback)
  const n = recent.length
  const meanX = recent.reduce((a, p) => a + p.year, 0) / n
  const meanY = recent.reduce((a, p) => a + (p.value as number), 0) / n
  let sxx = 0
  let sxy = 0
  for (const p of recent) {
    const dx = p.year - meanX
    sxx += dx * dx
    sxy += dx * ((p.value as number) - meanY)
  }
  const slope = sxx === 0 ? 0 : sxy / sxx

  // Anchor the trend line on the LAST MEASURED point (not the regression intercept) so the projection
  // continues smoothly from where measurement ends — "the solid line simply became dashed" (§2.4a). A
  // noisy/curved decline leaves the last point off the fitted line, so reading values off the raw line
  // would step down at the join year; anchoring keeps the slope but removes that artificial cliff.
  const anchorY = lastMeasured.value as number
  const projected: DataPoint[] = []
  for (let year = lastMeasured.year + 1; year <= targetYear; year++) {
    projected.push({
      source: 'projected',
      geo: lastMeasured.geo,
      year,
      value: Math.max(0, anchorY + slope * (year - lastMeasured.year)),
    })
  }

  // latestDataYear stays the measured boundary so referenceYear + composite scalars (ADR-016) never
  // read the projected tail; projectedFrom records where the dashed segment begins.
  return {
    ...series,
    points: [...series.points, ...projected],
    meta: cloneMeta(series.meta, { projectedFrom: lastMeasured.year }),
  }
}

/**
 * The first PROJECTED year at which a series reaches zero — the year its linear projection implies
 * the flow has fully halted (`projectSeries` clamps at 0, so it stays 0 thereafter). Only projected
 * years (year > `projectedFrom`) count; a series with no projection, or whose projected tail never
 * reaches zero (e.g. a rising trend), returns null. Used to couple a domain's forgone sink to its
 * OWN stock projection: once the stock says deforestation stops, the sink must stop growing rather
 * than track area's independent trend (business §2.4b).
 */
export function projectedHaltYear(series: Series): number | null {
  const from = series.meta.projectedFrom
  if (from == null) return null
  for (const p of series.points) {
    if (p.year > from && p.value === 0) return p.year
  }
  return null
}

/**
 * Hold a cumulative (state) series constant from `haltYear` onward at the level it reached the year
 * before — a plateau. A `null` haltYear returns the series unchanged; years before `haltYear` are
 * untouched. This is how a domain's cumulative area loss (and thus forgone sink) is coupled to its
 * stock-projection halt: when stock is projected to zero, cumulative loss plateaus instead of rising
 * on area's independent trend (business §2.4b).
 */
export function freezeCumulativeAfter(cumLoss: Series, haltYear: number | null): Series {
  if (haltYear == null) return cumLoss
  const plateau =
    [...cumLoss.points].reverse().find((p) => p.year < haltYear && p.value != null)?.value ?? null
  const points: DataPoint[] = cumLoss.points.map((p) =>
    p.year >= haltYear ? { ...p, value: plateau } : p,
  )
  return { ...cumLoss, points }
}

/**
 * Forgone sink = R × cumulative area loss (business §2.2), converted to Mt CO₂/yr.
 * The central line uses the scenario-selected R; the band spans the RRange endpoints (may be
 * asymmetric — business §6, §16.26). `isEstimate = true`.
 */
export function forgoneSink(cumLoss: Series, r: RRange, scenario: RScenario): BandSeries {
  const rMid = pickR(r, scenario)
  const conv = (km2: number | null, rate: number): number | null =>
    km2 == null ? null : km2 * KM2_TO_HA * rate * T_TO_MT
  const meta = cloneMeta(cumLoss.meta, {
    indicatorId: 'forgoneSink',
    seriesType: 'flow',
    unit: 'Mt CO2',
    isEstimate: true,
  })
  return {
    id: `${cumLoss.id}:forgoneSink`,
    points: cumLoss.points.map((p) => ({ ...p, value: conv(p.value, rMid) })),
    lower: cumLoss.points.map((p) => ({ ...p, value: conv(p.value, r.low) })),
    upper: cumLoss.points.map((p) => ({ ...p, value: conv(p.value, r.high) })),
    meta,
  }
}

/** Pointwise sum stock + forgone sink (both annual flows, Mt CO₂/yr — business §2.5). */
export function fullEmissions(stock: Series, forgone: Series): Series {
  const forgoneByYear = new Map(forgone.points.map((p) => [p.year, p.value]))
  const points: DataPoint[] = stock.points.map((p) => {
    if (p.value == null) return { ...p, value: null }
    const f = forgoneByYear.get(p.year)
    return { ...p, value: p.value + (f ?? 0) }
  })
  return {
    id: `${stock.id}:fullEmissions`,
    points,
    meta: cloneMeta(stock.meta, {
      indicatorId: 'fullEmissions',
      seriesType: 'flow',
      isEstimate: true,
    }),
  }
}

/** Σ of a series' non-null values over the inclusive year window `[from, to]`. */
export function sumWindow(series: Series, from: number, to: number): number {
  let sum = 0
  for (const p of series.points) {
    if (p.year >= from && p.year <= to && p.value != null) sum += p.value
  }
  return sum
}

/** Multiplier = Σfull / Σofficial over the inclusive window `[from, to]` (business §4.2, ADR-019). A
 *  `today` window collapses to `[referenceYear, referenceYear]` = the measured-year ratio. NaN if the
 *  official sum is 0/absent. */
export function multiplier(stock: Series, full: Series, from: number, to: number): number {
  const official = sumWindow(stock, from, to)
  if (official === 0) return NaN
  return sumWindow(full, from, to) / official
}

/** First year the cumulative forgone sink crosses (≥) the stock curve; null if it never does. */
export function crossingYear(stock: Series, cumulativeForgone: Series): number | null {
  const stockByYear = new Map(stock.points.map((p) => [p.year, p.value]))
  for (const p of cumulativeForgone.points) {
    const s = stockByYear.get(p.year)
    if (p.value != null && s != null && p.value >= s) return p.year
  }
  return null
}

/** The most recent year where every supplied series has data = min common latestDataYear (ADR-016). */
export function referenceYear(...series: Series[]): number {
  const years = series
    .map((s) => s.meta.latestDataYear)
    .filter((y): y is number => y != null)
  if (years.length === 0) throw new Error('referenceYear: no series has a latestDataYear')
  return Math.min(...years)
}

// ── aggregation (business §3, §5) ────────────────────────────────────────────────────────────────

/**
 * Sum per-domain forgone sinks into one aggregate band. Deviations are combined in quadrature
 * **per side** so an asymmetric domain band (Amazon) is not symmetrized (business §5, §16.26):
 *   low  = midΣ − √Σ(mid_i − low_i)²
 *   high = midΣ + √Σ(high_i − mid_i)²
 */
export function aggregateForgoneSink(perDomain: BandSeries[]): BandSeries {
  const years = new Set<number>()
  for (const d of perDomain) for (const p of d.points) years.add(p.year)
  const sortedYears = [...years].sort((a, b) => a - b)

  const midByYear = perDomain.map((d) => new Map(d.points.map((p) => [p.year, p.value])))
  const lowByYear = perDomain.map((d) => new Map(d.lower.map((p) => [p.year, p.value])))
  const highByYear = perDomain.map((d) => new Map(d.upper.map((p) => [p.year, p.value])))

  const points: DataPoint[] = []
  const lower: DataPoint[] = []
  const upper: DataPoint[] = []

  for (const year of sortedYears) {
    let mid = 0
    let lowSq = 0
    let highSq = 0
    for (let i = 0; i < perDomain.length; i++) {
      const m = midByYear[i]?.get(year) ?? 0
      const lo = lowByYear[i]?.get(year) ?? m
      const hi = highByYear[i]?.get(year) ?? m
      mid += m
      lowSq += (m - lo) ** 2
      highSq += (hi - m) ** 2
    }
    const base = { source: 'derived', geo: 'GLOBAL', year }
    points.push({ ...base, value: mid })
    lower.push({ ...base, value: mid - Math.sqrt(lowSq) })
    upper.push({ ...base, value: mid + Math.sqrt(highSq) })
  }

  const meta: SeriesMeta = {
    indicatorId: 'aggregateForgoneSink',
    seriesType: 'flow',
    unit: 'Mt CO2',
    latestDataYear: sortedYears.length ? (sortedYears[sortedYears.length - 1] as number) : null,
    gaps: [],
    isEstimate: true,
    projectedFrom: null,
    reconstructedBefore: null,
  }
  return { id: 'aggregateForgoneSink', points, lower, upper, meta }
}

/** Share of a total footprint as a percentage. NaN if the denominator is 0 (business §4.3). */
export function sharePercent(numerator: number, denominator: number): number {
  return denominator === 0 ? NaN : (numerator / denominator) * 100
}
