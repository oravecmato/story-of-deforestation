import type { AxiosError, AxiosInstance } from 'axios'
import type {
  DerivationParams,
  GlobalResultDTO,
  ReferenceDTO,
  EquivalenceDTO,
} from '#shared/types'
import { paramsToQuery } from '#shared/config/derivation'

// Typed BFF client (tech-spec §9). The ONLY place the store touches the network; one method per
// endpoint returning the matching DTO. Pure factory over an injected Axios instance (the axios plugin
// wires the real one; tests pass a stub) → the store never calls World Bank directly.

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

/** Map any Axios failure to a typed StoreError (server 400s carry a localized `data.errorKey`). */
export function toStoreError(error: unknown): StoreError {
  const ax = error as AxiosError<{ errorKey?: string }>
  const status = ax.response?.status ?? null
  const serverKey = ax.response?.data?.errorKey
  const retryable = status == null || status >= 500 // network/5xx retryable; 4xx is a contract bug
  return {
    status,
    errorKey: serverKey ?? (retryable ? 'error.network' : 'error.request'),
    retryable,
  }
}

export function createApiClient(http: AxiosInstance): ApiClient {
  const get = async <T>(url: string, query: Record<string, string>): Promise<T> => {
    const res = await http.get<T>(url, { params: query })
    return res.data
  }
  return {
    global: (p) => get<GlobalResultDTO>('/api/global', paramsToQuery(p)),
    reference: (p) => get<ReferenceDTO>('/api/reference', paramsToQuery(p)),
    equivalence: (p, locale) =>
      get<EquivalenceDTO>('/api/equivalence', { ...paramsToQuery(p), locale }),
  }
}
