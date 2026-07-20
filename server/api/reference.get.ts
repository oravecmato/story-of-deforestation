import { createContainer } from '../di/container'
import { parseDerivationParams } from '../utils/params'

// GET /api/reference → ReferenceDTO (tech-spec §8). Global fossil denominator series, always shown in
// global scope. Baseline-INDEPENDENT (ADR-026): it only needs the composite referenceYear (from the
// global aggregation) to hand ReferenceService, which fetches the fossil total. The donut's
// deforestation slices + share % are client-derived from the global DTO at the live baseline.

export default defineEventHandler(async (event) => {
  const params = parseDerivationParams(getQuery(event))
  const { aggregation, reference } = createContainer()

  const global = await aggregation.globalResult(params)
  return reference.reference({ params, referenceYear: global.referenceYear })
})
