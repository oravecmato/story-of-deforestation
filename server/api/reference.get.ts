import type { Series } from '../../shared/types'
import { createContainer } from '../di/container'
import { parseDerivationParams } from '../utils/params'

// GET /api/reference → ReferenceDTO (tech-spec §8). Global fossil bar + share-of-footprint donut,
// always shown in global scope. The route coordinates two services: it reads the global deforestation
// composite (stock + aggregate forgone sink) at referenceYear and hands those scalars to
// ReferenceService, which fetches the fossil denominator and computes the shares.

const valueAt = (s: Series, year: number): number =>
  s.points.find((p) => p.year === year)?.value ?? 0

export default defineEventHandler(async (event) => {
  const params = parseDerivationParams(getQuery(event))
  const { aggregation, reference } = createContainer()

  const global = await aggregation.globalResult(params)
  const referenceYear = global.referenceYear
  const stockAtRef = global.perDomainStock.reduce((sum, s) => sum + valueAt(s, referenceYear), 0)
  const forgoneSinkAtRef = valueAt(global.aggregateForgoneSink, referenceYear)

  return reference.reference({ params, referenceYear, stockAtRef, forgoneSinkAtRef })
})
