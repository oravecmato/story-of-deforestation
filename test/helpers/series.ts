import type { Series, SeriesMeta, DataPoint } from '../../shared/types'

/** Minimal Series builder for tests. Years default to 1990, 1991, … unless pairs are given. */
export function mkSeries(
  id: string,
  values: Array<number | null> | Array<[number, number | null]>,
  meta: Partial<SeriesMeta> = {},
): Series {
  const points: DataPoint[] = values.map((v, i) => {
    const [year, value] = Array.isArray(v) ? v : [1990 + i, v]
    return { source: 'test', geo: 'TST', year, value }
  })
  const base: SeriesMeta = {
    indicatorId: id,
    seriesType: 'state',
    unit: 'unit',
    latestDataYear: points.at(-1)?.year ?? null,
    gaps: [],
    isEstimate: false,
    projectedFrom: null,
    reconstructedBefore: null,
  }
  return { id, points, meta: { ...base, ...meta } }
}

export const values = (s: Series): Array<number | null> => s.points.map((p) => p.value)
export const years = (s: Series): number[] => s.points.map((p) => p.year)
