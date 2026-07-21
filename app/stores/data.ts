import { defineStore } from 'pinia'
import type {
  DerivationParams,
  GlobalResultDTO,
  GlobalDerived,
  ReferenceDTO,
  EquivalenceDTO,
} from '../../shared/types'
import { paramsKey } from '../../shared/config/derivation'
import { deriveGlobal } from '../composables/useDerived'
import { useViewStore } from './view'
import { useUiStore } from './ui'
import type { ApiClient, StoreError } from '../services/apiClient'

// Data store (tech-spec §10.2) — fetched/derived DTOs + caching. Cache key = endpoint + params
// signature; a hit returns instantly (server-authoritative first fetch warmed the CDN + this cache →
// instant re-select of an already-visited horizon/scene, ADR-005). `inFlight` dedupes simultaneous
// identical requests; `prefetch` warms the next slide's scene params on idle so forward deck
// navigation is instant (ADR-023).
// `loadForScene`/`prefetch` take the ApiClient explicitly (DI, so the store stays free of Nuxt globals
// and is unit-testable); callers pass `useApi()`.

export type EndpointKey = 'global' | 'reference' | 'equivalence'
type AnyDTO = GlobalResultDTO | ReferenceDTO | EquivalenceDTO

const noneLoading = (): Record<EndpointKey, boolean> => ({
  global: false,
  reference: false,
  equivalence: false,
})
const noneError = (): Record<EndpointKey, StoreError | null> => ({
  global: null,
  reference: null,
  equivalence: null,
})

/** Equivalence also varies by locale (view state; horizon is already in params), so its key extends
 *  the params key with the locale. */
const equivalenceKey = (params: DerivationParams, locale: string): string =>
  `${paramsKey('equivalence', params)}:${locale}`

/** The cache key for an endpoint + params (locale folded in only for equivalence). */
const keyFor = (endpoint: EndpointKey, params: DerivationParams, locale: string): string =>
  endpoint === 'equivalence' ? equivalenceKey(params, locale) : paramsKey(endpoint, params)

/** Dispatch one endpoint's apiClient call. */
const fetchEndpoint = (
  client: ApiClient,
  endpoint: EndpointKey,
  params: DerivationParams,
  locale: string,
): Promise<AnyDTO> => {
  switch (endpoint) {
    case 'global':
      return client.global(params)
    case 'reference':
      return client.reference(params)
    case 'equivalence':
      return client.equivalence(params, locale)
  }
}

/** The endpoints a scene needs by default (deck scenes pass an explicit subset). Equivalence is
 *  consumed by the slide-6 strip's country-unit basis (ADR-025, §17.4). */
const defaultEndpoints = (): EndpointKey[] => ['global', 'reference', 'equivalence']

/** Options for a scene load / prefetch: override the params and/or the endpoint set. */
export interface LoadOptions {
  params?: DerivationParams
  endpoints?: EndpointKey[]
}

export const useDataStore = defineStore('data', {
  state: () => ({
    dtoCache: new Map<string, AnyDTO>(),
    inFlight: new Map<string, Promise<unknown>>(),
    loading: noneLoading(),
    errors: noneError(),
  }),

  getters: {
    currentMainResult(state): GlobalResultDTO | undefined {
      const view = useViewStore()
      return state.dtoCache.get(paramsKey('global', view.derivationParams)) as
        | GlobalResultDTO
        | undefined
    },
    currentReference(state): ReferenceDTO | undefined {
      const view = useViewStore()
      return state.dtoCache.get(paramsKey('reference', view.derivationParams)) as
        | ReferenceDTO
        | undefined
    },
    currentEquivalence(state): EquivalenceDTO | undefined {
      const view = useViewStore()
      const ui = useUiStore()
      return state.dtoCache.get(equivalenceKey(view.derivationParams, ui.locale)) as
        | EquivalenceDTO
        | undefined
    },
    /** The baseline-dependent tail (ADR-026 §3.2a) re-derived off the current DTO at the live
     *  `view.baseline` (and `view.rMultiplier`, slide 10) via the isomorphic core — recomputed on every
     *  slider frame, no refetch. */
    currentDerived(): GlobalDerived | undefined {
      const view = useViewStore()
      const main = this.currentMainResult
      if (!main) return undefined
      return deriveGlobal(main, view.baseline, view.rMultiplier)
    },
    multiplier(): number | undefined {
      return this.currentDerived?.multiplier
    },
  },

  actions: {
    /** Fetch the endpoints the current scene needs, in parallel, deduped by cache key. `params`
     *  defaults to the current scene's `derivationParams`; `endpoints` defaults to the scope's full
     *  set (deck scenes pass the subset their visuals need). */
    async loadForScene(client: ApiClient, opts: LoadOptions = {}): Promise<void> {
      const view = useViewStore()
      const ui = useUiStore()
      const params = opts.params ?? view.derivationParams
      const endpoints = opts.endpoints ?? defaultEndpoints()
      await Promise.all(
        endpoints.map((ep) =>
          this.ensure(ep, keyFor(ep, params, ui.locale), () =>
            fetchEndpoint(client, ep, params, ui.locale),
          ),
        ),
      )
    },

    /** Idle-time warm of a future scene's params (ADR-023) — fire-and-forget, silent (no loading /
     *  error surfaces), skipping anything already cached or in flight. */
    prefetch(client: ApiClient, params: DerivationParams, endpoints?: EndpointKey[]): void {
      const ui = useUiStore()
      const eps = endpoints ?? defaultEndpoints()
      for (const ep of eps) {
        const key = keyFor(ep, params, ui.locale)
        if (this.dtoCache.has(key) || this.inFlight.has(key)) continue
        void this.ensure(
          ep,
          key,
          () => fetchEndpoint(client, ep, params, ui.locale),
          { silent: true },
        ).catch(() => {})
      }
    },

    /** Cache-first, in-flight-deduped fetch for one endpoint. `silent` (prefetch) skips the loading /
     *  error surfaces so an idle warm never flickers spinners. */
    ensure(
      endpoint: EndpointKey,
      key: string,
      fetcher: () => Promise<AnyDTO>,
      opts: { silent?: boolean } = {},
    ): Promise<unknown> {
      const cached = this.dtoCache.get(key)
      if (cached) return Promise.resolve(cached)
      const existing = this.inFlight.get(key)
      if (existing) return existing

      if (!opts.silent) {
        this.loading[endpoint] = true
        this.errors[endpoint] = null
      }
      const promise = fetcher()
        .then((dto) => {
          this.dtoCache.set(key, dto)
          return dto
        })
        .catch((error: StoreError) => {
          // The apiClient plugin interceptor already normalizes failures to StoreError.
          if (!opts.silent) this.errors[endpoint] = error
          throw error
        })
        .finally(() => {
          this.inFlight.delete(key)
          if (!opts.silent) this.loading[endpoint] = false
        })
      this.inFlight.set(key, promise)
      return promise
    },
  },
})
