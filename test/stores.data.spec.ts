import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { ApiClient, StoreError } from '../app/services/apiClient'
import type { DerivationParams } from '../shared/types'
import { paramsKey } from '../shared/config/derivation'
import { useViewStore } from '../app/stores/view'
import { useDataStore } from '../app/stores/data'

beforeEach(() => setActivePinia(createPinia()))

/** Counting ApiClient stub; each method returns a tagged DTO and records its call count. */
function stubClient(overrides: Partial<Record<keyof ApiClient, () => Promise<unknown>>> = {}): {
  client: ApiClient
  counts: Record<string, number>
} {
  const counts: Record<string, number> = {}
  const make =
    (name: keyof ApiClient) =>
    async (...args: unknown[]) => {
      counts[name] = (counts[name] ?? 0) + 1
      const override = overrides[name]
      if (override) return override()
      return { tag: name, args } as unknown
    }
  const client = {
    global: make('global'),
    reference: make('reference'),
    equivalence: make('equivalence'),
  } as unknown as ApiClient
  return { client, counts }
}

describe('useDataStore.loadForScene', () => {
  it('fetches global + reference + equivalence by default', async () => {
    const data = useDataStore()
    const { client, counts } = stubClient()
    await data.loadForScene(client)
    expect(counts).toEqual({ global: 1, reference: 1, equivalence: 1 })
  })

  it('a warm cache short-circuits the second load (no refetch)', async () => {
    const data = useDataStore()
    const { client, counts } = stubClient()
    await data.loadForScene(client)
    await data.loadForScene(client)
    expect(counts.global).toBe(1)
    expect(counts.equivalence).toBe(1)
  })

  it('inFlight dedupes concurrent identical loads', async () => {
    const data = useDataStore()
    const { client, counts } = stubClient()
    await Promise.all([data.loadForScene(client), data.loadForScene(client)])
    expect(counts.global).toBe(1)
  })

  it('populates the getters after a global load', async () => {
    const data = useDataStore()
    const { client } = stubClient()
    await data.loadForScene(client)
    expect(data.currentMainResult).toMatchObject({ tag: 'global' })
    expect(data.currentReference).toMatchObject({ tag: 'reference' })
    expect(data.currentEquivalence).toMatchObject({ tag: 'equivalence' })
  })

  it('captures a StoreError and clears loading on failure', async () => {
    const err: StoreError = { status: 502, errorKey: 'error.network', retryable: true }
    const data = useDataStore()
    const { client } = stubClient({ global: () => Promise.reject(err) })
    await expect(data.loadForScene(client)).rejects.toBe(err)
    expect(data.errors.global).toEqual(err)
    expect(data.loading.global).toBe(false)
  })

  it('honours an explicit endpoints subset (deck scene)', async () => {
    const data = useDataStore()
    const { client, counts } = stubClient()
    await data.loadForScene(client, { endpoints: ['global'] })
    expect(counts).toEqual({ global: 1 })
  })

  it('honours explicit params (a scene other than the current one)', async () => {
    const view = useViewStore()
    const data = useDataStore()
    const { client, counts } = stubClient()
    const other: DerivationParams = {
      horizon: '50y',
      rScenario: 'mid',
    }
    await data.loadForScene(client, { params: other, endpoints: ['global'] })
    expect(counts).toEqual({ global: 1 })
    // Current scene (different horizon) still needs a fetch — the explicit-params load didn't cache it.
    expect(data.dtoCache.has(paramsKey('global', view.derivationParams))).toBe(false)
  })
})

describe('useDataStore.prefetch', () => {
  const globalParams: DerivationParams = {
    horizon: 'today',
    rScenario: 'mid',
  }

  it('warms the cache silently (no loading flags flip)', async () => {
    const data = useDataStore()
    const { client, counts } = stubClient()
    data.prefetch(client, globalParams, ['global'])
    expect(data.loading.global).toBe(false)
    await Promise.resolve()
    await Promise.resolve()
    expect(counts.global).toBe(1)
    expect(data.dtoCache.has(paramsKey('global', globalParams))).toBe(true)
  })

  it('skips endpoints already cached', async () => {
    const data = useDataStore()
    const { client, counts } = stubClient()
    await data.loadForScene(client, { params: globalParams, endpoints: ['global'] })
    data.prefetch(client, globalParams, ['global'])
    await Promise.resolve()
    expect(counts.global).toBe(1)
  })

  it('swallows fetch failures (no error surface)', async () => {
    const err: StoreError = { status: 502, errorKey: 'error.network', retryable: true }
    const data = useDataStore()
    const { client } = stubClient({ global: () => Promise.reject(err) })
    data.prefetch(client, globalParams, ['global'])
    await Promise.resolve()
    await Promise.resolve()
    expect(data.errors.global).toBeNull()
    expect(data.loading.global).toBe(false)
  })
})
