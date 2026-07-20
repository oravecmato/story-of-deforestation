// Canonical series data model (tech-spec §3.1). The authoritative shapes; everything flows
// through them. `value` is nullable so data holes are preserved end-to-end (business §7.1).

/** state = cumulative/level; flow = increment (business §2.7). Powers the axis-type choice and
 *  the (dormant) correlation guard. */
export type SeriesType = 'state' | 'flow'

/** A single normalized observation. Uniform point shape across every source (business §8). */
export interface DataPoint {
  source: string
  geo: string
  year: number
  value: number | null
}

export interface SeriesMeta {
  indicatorId: string
  seriesType: SeriesType
  unit: string
  /** For the "always show the year" honesty rule; feeds the min-common referenceYear (ADR-016). */
  latestDataYear: number | null
  /** Partial coverage / holes, recorded rather than hidden (business §7.1). */
  gaps: Array<{ geo: string; reason: string }>
  /** Measured (false) vs derived, e.g. the forgone sink (true). */
  isEstimate: boolean
  /** Join year where linear-trend projection starts (ADR-019); null = measured only (business §2.4a). */
  projectedFrom: number | null
  /** Join year (1990) BELOW which the series is LUH2-reconstructed (dashed); null = no reconstruction
   *  (ADR-026, business §7.2a). Set on the pre-1990 spliced area points. */
  reconstructedBefore: number | null
}

export interface Series {
  id: string
  points: DataPoint[]
  meta: SeriesMeta
}

/** A series carrying an uncertainty band (lower/upper); e.g. the forgone sink CI (business §2.2). */
export interface BandSeries extends Series {
  lower: DataPoint[]
  upper: DataPoint[]
}
