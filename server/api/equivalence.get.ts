import type { DerivationParams } from '../../shared/types'
import { paramsKey } from '../../shared/config/derivation'
import { createContainer } from '../di/container'
import { parseDerivationParams, parseEquivalenceExtras } from '../utils/params'

// GET /api/equivalence → EquivalenceDTO (tech-spec §8, business §4.4). Forward-committed car/country
// equivalents; `locale` selects the reference country (sk → Slovakia, else → UK) per request.
//
// Memoised with defineCachedFunction (in-instance layer atop the CDN edge cache), keyed by the params
// signature PLUS the locale (the reference country differs per locale); 6h fresh with SWR.
const cachedEquivalence = defineCachedFunction(
  (params: DerivationParams, locale: string) =>
    createContainer().equivalence.equivalence(params, locale),
  {
    name: 'api',
    group: 'equivalence',
    maxAge: 60 * 60 * 6,
    swr: true,
    getKey: (params: DerivationParams, locale: string) => `${paramsKey('equivalence', params)}:${locale}`,
  },
)

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const params = parseDerivationParams(query)
  const { locale } = parseEquivalenceExtras(query)
  return cachedEquivalence(params, locale)
})
