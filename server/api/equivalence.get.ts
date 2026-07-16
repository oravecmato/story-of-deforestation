import { createContainer } from '../di/container'
import { parseDerivationParams, parseEquivalenceExtras } from '../utils/params'

// GET /api/equivalence → EquivalenceDTO (tech-spec §8, business §4.4). Forward-committed car/country
// equivalents; `locale` selects the reference country (sk → Slovakia, else → UK) per request.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const params = parseDerivationParams(query)
  const { locale } = parseEquivalenceExtras(query)
  return createContainer().equivalence.equivalence(params, locale)
})
