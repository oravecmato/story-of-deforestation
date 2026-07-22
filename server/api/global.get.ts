import type { DerivationParams } from '../../shared/types'
import { paramsKey } from '../../shared/config/derivation'
import { createContainer } from '../di/container'
import { parseDerivationParams } from '../utils/params'

// GET /api/global → GlobalResultDTO (tech-spec §8). The aggregation is a pure function of the
// DerivationParams, so it is memoised with defineCachedFunction — the in-instance layer atop the CDN
// edge cache (ADR-005/014). Keyed by the full params signature so every horizon/rScenario is a
// distinct entry; 6h fresh window (matches the CDN) with stale-while-revalidate.
const cachedGlobal = defineCachedFunction(
  (params: DerivationParams) => createContainer().aggregation.globalResult(params),
  {
    name: 'api',
    group: 'global',
    maxAge: 60 * 60 * 6,
    swr: true,
    getKey: (params: DerivationParams) => paramsKey('global', params),
  },
)

export default defineEventHandler((event) => cachedGlobal(parseDerivationParams(getQuery(event))))
