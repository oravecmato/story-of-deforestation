import type { AxiosInstance } from 'axios'
import type { DataPoint, Series, SeriesMeta } from '../../shared/types'
import { getIndicatorByCode } from '../../shared/config/indicators'
import type { FetchOpts, SourceAdapter } from './SourceAdapter'

// WdiAdapter (tech-spec §4). Hides the World Bank WDI quirks behind the uniform `Series` model:
// data in response[1], aggregate rows, holes (null preserved), early-ending series (mrnev), and the
// AR5 nowcast-tail duplication. Timeout + retry (8s, 2 backoff retries on network/5xx) live in the
// injected Axios instance (di/container), so every adapter inherits them uniformly.

const SOURCE = 'WDI'

/** One raw WDI observation row (response[1] element). */
interface WdiRow {
  countryiso3code: string
  date: string
  value: number | null
  country?: { id: string; value: string }
}

export class WdiAdapter implements SourceAdapter {
  constructor(private readonly http: AxiosInstance) {}

  async fetchIndicator(iso3: string, indicatorCode: string, opts?: FetchOpts): Promise<Series> {
    const params: Record<string, string | number> = {
      format: 'json',
      per_page: opts?.perPage ?? 1000,
    }
    if (opts?.mostRecentNonEmpty) params.mrnev = 1
    else if (opts?.dateRange) params.date = `${opts.dateRange[0]}:${opts.dateRange[1]}`

    const res = await this.http.get(`/country/${iso3}/indicator/${indicatorCode}`, { params })
    const rows = extractRows(res.data)
    // Preserve internal holes, but drop the absent-future tail before deduping the nowcast.
    const points = trimNowcastTail(dropTrailingNulls(normalizeRows(rows, iso3)))
    return buildSeries(iso3, indicatorCode, points)
  }

  async fetchIndicatorMulti(
    iso3List: string[],
    indicatorCode: string,
    opts?: FetchOpts,
  ): Promise<Series[]> {
    // Fan out per country (ADR-010); a failed country becomes a recorded gap, not a thrown error.
    const settled = await Promise.allSettled(
      iso3List.map((iso3) => this.fetchIndicator(iso3, indicatorCode, opts)),
    )
    return settled.map((result, i) => {
      const iso3 = iso3List[i]!
      if (result.status === 'fulfilled') return result.value
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
      return buildSeries(iso3, indicatorCode, [], reason)
    })
  }
}

/** response[0] is metadata; the data array lives in response[1] (or null when empty). */
function extractRows(body: unknown): WdiRow[] {
  if (!Array.isArray(body) || body.length < 2) return []
  const rows = body[1]
  return Array.isArray(rows) ? (rows as WdiRow[]) : []
}

function normalizeRows(rows: WdiRow[], iso3: string): DataPoint[] {
  const points = rows
    // Drop aggregate rows (no ISO3 code); keep holes (null values) — do not drop them.
    .filter((row) => row.countryiso3code !== '')
    .map<DataPoint>((row) => ({
      source: SOURCE,
      geo: row.countryiso3code || iso3,
      year: Number(row.date),
      value: row.value,
    }))
  // WDI returns newest-first; charts and cumulative integration need oldest-first.
  points.sort((a, b) => a.year - b.year)
  return points
}

/**
 * Drop absent-future years (trailing nulls) so the series ends on a real value. Internal holes
 * (nulls between real observations) are kept — only the tail after the last real value is removed.
 */
function dropTrailingNulls(points: DataPoint[]): DataPoint[] {
  let end = points.length
  while (end > 0 && points[end - 1]!.value === null) end--
  return end === points.length ? points : points.slice(0, end)
}

/**
 * Drop the AR5 provisional nowcast tail: the final year repeats the previous year's value
 * (probe-verified 2023 ≡ 2022 across the EN.GHG.* family), so charts end on genuinely distinct data.
 */
function trimNowcastTail(points: DataPoint[]): DataPoint[] {
  const last = points.at(-1)
  const prev = points.at(-2)
  if (
    last &&
    prev &&
    last.value !== null &&
    prev.value !== null &&
    last.value === prev.value &&
    last.year === prev.year + 1
  ) {
    return points.slice(0, -1)
  }
  return points
}

/** Year of the last point carrying a real (non-null) value — feeds the min-common referenceYear. */
function lastRealYear(points: DataPoint[]): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i]!.value !== null) return points[i]!.year
  }
  return null
}

function buildSeries(
  iso3: string,
  indicatorCode: string,
  points: DataPoint[],
  failure?: string,
): Series {
  const indicator = getIndicatorByCode(indicatorCode)
  const meta: SeriesMeta = {
    indicatorId: indicator.id,
    seriesType: indicator.seriesType,
    unit: indicator.unit,
    latestDataYear: lastRealYear(points),
    gaps:
      points.length === 0 ? [{ geo: iso3, reason: failure ?? 'no-data' }] : [],
    isEstimate: false,
    projectedFrom: null,
    reconstructedBefore: null,
  }
  return { id: `${indicatorCode}:${iso3}`, points, meta }
}
