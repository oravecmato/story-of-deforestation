import type { DerivationParams } from '../../shared/types'
import { paramsKey } from '../../shared/config/derivation'
import { createContainer } from '../di/container'
import { parseDerivationParams } from '../utils/params'

// GET /api/reference → ReferenceDTO (tech-spec §8). Global fossil denominator series, always shown in
// global scope. Baseline-INDEPENDENT (ADR-026): it only needs the composite referenceYear (from the
// global aggregation) to hand ReferenceService, which fetches the fossil total. The donut's
// deforestation slices + share % are client-derived from the global DTO at the live baseline.
//
// Memoised with defineCachedFunction (in-instance layer atop the CDN edge cache), keyed by the params
// signature; 6h fresh with stale-while-revalidate.
const cachedReference = defineCachedFunction(
  async (params: DerivationParams) => {
    const { aggregation, reference } = createContainer()
    const global = await aggregation.globalResult(params)
    return reference.reference({ params, referenceYear: global.referenceYear })
  },
  {
    name: 'api',
    group: 'reference',
    maxAge: 60 * 60 * 6,
    swr: true,
    getKey: (params: DerivationParams) => paramsKey('reference', params),
  },
)

export default defineEventHandler((event) => cachedReference(parseDerivationParams(getQuery(event))))
