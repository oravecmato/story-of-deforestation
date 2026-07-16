import { defineStore } from 'pinia'
import type {
  DerivationParams,
  DomainResultDTO,
  GlobalResultDTO,
  RankingDTO,
  ReferenceDTO,
  EquivalenceDTO,
} from '../../shared/types'
import { paramsKey } from '../../shared/config/derivation'
import { useViewStore } from './view'
import { useUiStore } from './ui'
import type { ApiClient, StoreError } from '../services/apiClient'

// Data store (tech-spec §10.2) — fetched/derived DTOs + caching. Cache key = endpoint + params
// signature; a hit returns instantly (server-authoritative first fetch warmed the CDN + this cache →
// instant re-toggle, ADR-005). `inFlight` dedupes simultaneous identical requests. `timeRange` never
// touches this store (pure view state). `loadForCurrentView` takes the ApiClient explicitly (DI, so
// the store stays free of Nuxt globals and is unit-testable); callers pass `useApi()`.

export type EndpointKey = 'domain' | 'global' | 'ranking' | 'reference' | 'equivalence'
type AnyDTO = DomainResultDTO | GlobalResultDTO | RankingDTO | ReferenceDTO | EquivalenceDTO

const noneLoading = (): Record<EndpointKey, boolean> => ({
  domain: false,
  global: false,
  ranking: false,
  reference: false,
  equivalence: false,
})
const noneError = (): Record<EndpointKey, StoreError | null> => ({
  domain: null,
  global: null,
  ranking: null,
  reference: null,
  equivalence: null,
})

/** Equivalence also varies by locale (view state; horizon is already in params), so its key extends
 *  the params key with the locale. */
const equivalenceKey = (params: DerivationParams, locale: string): string =>
  `${paramsKey('equivalence', params)}:${locale}`

export const useDataStore = defineStore('data', {
  state: () => ({
    cache: new Map<string, AnyDTO>(),
    inFlight: new Map<string, Promise<unknown>>(),
    loading: noneLoading(),
    errors: noneError(),
  }),

  getters: {
    currentMainResult(state): DomainResultDTO | GlobalResultDTO | undefined {
      const view = useViewStore()
      const endpoint = view.scope === 'global' ? 'global' : 'domain'
      return state.cache.get(paramsKey(endpoint, view.derivationParams)) as
        | DomainResultDTO
        | GlobalResultDTO
        | undefined
    },
    currentRanking(state): RankingDTO | undefined {
      const view = useViewStore()
      return state.cache.get(paramsKey('ranking', view.derivationParams)) as RankingDTO | undefined
    },
    currentReference(state): ReferenceDTO | undefined {
      const view = useViewStore()
      return state.cache.get(paramsKey('reference', view.derivationParams)) as
        | ReferenceDTO
        | undefined
    },
    currentEquivalence(state): EquivalenceDTO | undefined {
      const view = useViewStore()
      const ui = useUiStore()
      return state.cache.get(equivalenceKey(view.derivationParams, ui.locale)) as
        | EquivalenceDTO
        | undefined
    },
    multiplier(): number | undefined {
      return this.currentMainResult?.multiplier
    },
  },

  actions: {
    /** Fetch the endpoints the current mode matrix needs, in parallel, deduped by cache key. */
    async loadForCurrentView(client: ApiClient): Promise<void> {
      const view = useViewStore()
      const ui = useUiStore()
      const params = view.derivationParams

      const jobs: Array<Promise<unknown>> = []
      if (view.scope === 'global') {
        // Global scope: main stacked chart + ranking + share-of-footprint (all global-only panels).
        jobs.push(this.ensure('global', paramsKey('global', params), () => client.global(params)))
        jobs.push(this.ensure('ranking', paramsKey('ranking', params), () => client.ranking(params)))
        jobs.push(
          this.ensure('reference', paramsKey('reference', params), () => client.reference(params)),
        )
      } else {
        jobs.push(this.ensure('domain', paramsKey('domain', params), () => client.domain(params)))
      }
      // Equivalence panel is shown in both scopes.
      jobs.push(
        this.ensure('equivalence', equivalenceKey(params, ui.locale), () =>
          client.equivalence(params, ui.locale),
        ),
      )
      await Promise.all(jobs)
    },

    /** Cache-first, in-flight-deduped fetch for one endpoint. */
    ensure(endpoint: EndpointKey, key: string, fetcher: () => Promise<AnyDTO>): Promise<unknown> {
      const cached = this.cache.get(key)
      if (cached) return Promise.resolve(cached)
      const existing = this.inFlight.get(key)
      if (existing) return existing

      this.loading[endpoint] = true
      this.errors[endpoint] = null
      const promise = fetcher()
        .then((dto) => {
          this.cache.set(key, dto)
          return dto
        })
        .catch((error: StoreError) => {
          // The apiClient plugin interceptor already normalizes failures to StoreError.
          this.errors[endpoint] = error
          throw error
        })
        .finally(() => {
          this.inFlight.delete(key)
          this.loading[endpoint] = false
        })
      this.inFlight.set(key, promise)
      return promise
    },
  },
})
