import type {
  DerivationParams,
  GlobalResultDTO,
  ReferenceDTO,
  EquivalenceDTO,
} from '#shared/types'
import { paramsToQuery } from '#shared/config/derivation'

// Typed BFF client (tech-spec §9). The ONLY place the store touches the network; one method per
// endpoint returning the matching DTO. Pure factory over an injected `$fetch`-shaped function (the api
// plugin wires Nuxt's `$fetch`; tests pass a stub) → the store never calls World Bank directly.
// `$fetch` is used INSTEAD of axios so the request is isomorphic: on the server Nuxt routes it to the
// Nitro handler in-process (no network hop, so no self-request through Vercel's deployment-protection
// auth wall — which returns an SSO login page and breaks SSR), while on the client it is a normal
// same-origin request carrying the browser's cookies. A relative URL (no baseURL) is what enables the
// server-side internal routing; never point this at an absolute origin.

/** Normalized error surfaced to the store (tech-spec §9): localized key, never a literal message. */
export interface StoreError {
  status: number | null
  errorKey: string
  retryable: boolean
}

export interface ApiClient {
  global(params: DerivationParams): Promise<GlobalResultDTO>
  reference(params: DerivationParams): Promise<ReferenceDTO>
  equivalence(params: DerivationParams, locale: string): Promise<EquivalenceDTO>
}

/** The subset of `$fetch` this client depends on (so tests can pass a plain stub). */
export type FetchFn = <T>(url: string, opts: { query: Record<string, string> }) => Promise<T>

/** Map any `$fetch` (ofetch) failure to a typed StoreError (server 400s carry a localized
 *  `data.errorKey`). ofetch throws a `FetchError` with `statusCode` and the parsed body on `data`. */
export function toStoreError(error: unknown): StoreError {
  const e = error as { statusCode?: number; status?: number; data?: { errorKey?: string } }
  const status = e.statusCode ?? e.status ?? null
  const serverKey = e.data?.errorKey
  const retryable = status == null || status >= 500 // network/5xx retryable; 4xx is a contract bug
  return {
    status,
    errorKey: serverKey ?? (retryable ? 'error.network' : 'error.request'),
    retryable,
  }
}

export function createApiClient(fetchFn: FetchFn): ApiClient {
  const get = async <T>(url: string, query: Record<string, string>): Promise<T> => {
    try {
      return await fetchFn<T>(url, { query })
    } catch (error) {
      throw toStoreError(error)
    }
  }
  return {
    global: (p) => get<GlobalResultDTO>('/api/global', paramsToQuery(p)),
    reference: (p) => get<ReferenceDTO>('/api/reference', paramsToQuery(p)),
    equivalence: (p, locale) =>
      get<EquivalenceDTO>('/api/equivalence', { ...paramsToQuery(p), locale }),
  }
}
