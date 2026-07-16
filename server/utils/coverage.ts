import type { Series, SeriesMeta } from '../../shared/types'

// CoverageGate (tech-spec §6, ADR-020) — the single source of truth for country exclusion.
//
// A domain aggregate is a sum over its member countries of several indicators (deforestation stock +
// forest area, the latter driving the forgone sink). Those indicators have uneven per-country
// coverage, so some countries can only be represented in one metric. To keep a domain's stock and
// forgone sink describing the SAME set of countries, one decision is made here — over ALL of a
// domain's indicators at once — and applied uniformly by AggregationService when it sums each metric.
//
// Union criterion: a country is excluded if it is incomplete on ANY indicator, where "complete" =
// reaches that indicator's MODAL last-real year with a real value AND has no internal hole between its
// first real value and that year. Leading pre-data nulls never trigger exclusion.

export interface CoverageContribution {
  /** Stable indicator key (e.g. 'deforestationStock', 'forestArea'). */
  indicator: string
  /** Per-country series for this indicator (one entry per member country). */
  series: Series[]
}

export interface CoverageVerdict {
  /** ISO codes excluded from EVERY metric (single source of truth). */
  excluded: Set<string>
  /** Coverage gaps for excluded countries (no-data preserved; partial → incomplete-coverage). */
  gaps: SeriesMeta['gaps']
  /** Per-indicator modal last-real year — the window each metric's sum is clipped to. */
  windowEnd: Map<string, number | null>
}

/** The stable country key for a per-country series — identical across indicators even when one
 *  indicator's series is empty (no data): first real datum's geo, else first point geo, else the
 *  recorded gap's geo (the adapter stamps the ISO there), else the series id. */
export function countryKey(series: Series): string {
  return (
    series.points.find((p) => p.value != null)?.geo ??
    series.points[0]?.geo ??
    series.meta.gaps[0]?.geo ??
    series.id
  )
}

/** The modal (most-common) year in a list; ties resolve to the more recent year. Null if empty. */
function modalYear(years: number[]): number | null {
  if (years.length === 0) return null
  const counts = new Map<number, number>()
  for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1)
  let best: number | null = null
  let bestCount = 0
  for (const [year, count] of counts) {
    if (count > bestCount || (count === bestCount && best != null && year > best)) {
      best = year
      bestCount = count
    }
  }
  return best
}

function valueAtYear(series: Series, year: number): number | null {
  return series.points.find((p) => p.year === year)?.value ?? null
}

export class CoverageGate {
  /** Decide, across all of a domain's indicators, which countries are excluded (union criterion). */
  evaluate(contributions: CoverageContribution[]): CoverageVerdict {
    const excluded = new Set<string>()
    const gaps: SeriesMeta['gaps'] = []
    const windowEnd = new Map<string, number | null>()

    const pushGap = (geo: string, reason: string): void => {
      if (!gaps.some((g) => g.geo === geo && g.reason === reason)) gaps.push({ geo, reason })
    }

    for (const { indicator, series } of contributions) {
      const latestYears = series
        .map((s) => s.meta.latestDataYear)
        .filter((y): y is number => y != null)
      const end = modalYear(latestYears)
      windowEnd.set(indicator, end)

      for (const s of series) {
        const key = countryKey(s)
        const firstReal = s.points.find((p) => p.value != null)?.year
        if (firstReal == null) {
          // No data at all for this indicator → the country cannot be represented → exclude it.
          excluded.add(key)
          if (s.meta.gaps.length > 0) for (const g of s.meta.gaps) pushGap(g.geo, g.reason)
          else pushGap(key, 'no-data')
          continue
        }
        if (end == null) continue
        const reachesWindow = valueAtYear(s, end) != null
        const hasInternalHole = s.points.some(
          (p) => p.value == null && p.year >= firstReal && p.year <= end,
        )
        if (!reachesWindow || hasInternalHole) {
          excluded.add(key)
          pushGap(key, 'incomplete-coverage')
        }
      }
    }

    return { excluded, gaps, windowEnd }
  }
}
