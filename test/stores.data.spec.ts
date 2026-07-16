import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { ApiClient, StoreError } from '../app/services/apiClient'
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
    domain: make('domain'),
    global: make('global'),
    ranking: make('ranking'),
    reference: make('reference'),
    equivalence: make('equivalence'),
  } as unknown as ApiClient
  return { client, counts }
}

describe('useDataStore.loadForCurrentView', () => {
  it('global scope fetches global + ranking + reference + equivalence', async () => {
    const data = useDataStore()
    const { client, counts } = stubClient()
    await data.loadForCurrentView(client)
    expect(counts).toEqual({ global: 1, ranking: 1, reference: 1, equivalence: 1 })
    expect(counts.domain).toBeUndefined()
  })

  it('local scope fetches domain + equivalence only', async () => {
    const view = useViewStore()
    view.setScope('local')
    const data = useDataStore()
    const { client, counts } = stubClient()
    await data.loadForCurrentView(client)
    expect(counts).toEqual({ domain: 1, equivalence: 1 })
  })

  it('a warm cache short-circuits the second load (no refetch)', async () => {
    const data = useDataStore()
    const { client, counts } = stubClient()
    await data.loadForCurrentView(client)
    await data.loadForCurrentView(client)
    expect(counts.global).toBe(1)
    expect(counts.equivalence).toBe(1)
  })

  it('inFlight dedupes concurrent identical loads', async () => {
    const data = useDataStore()
    const { client, counts } = stubClient()
    await Promise.all([data.loadForCurrentView(client), data.loadForCurrentView(client)])
    expect(counts.global).toBe(1)
  })

  it('populates the getters after a global load', async () => {
    const data = useDataStore()
    const { client } = stubClient()
    await data.loadForCurrentView(client)
    expect(data.currentMainResult).toMatchObject({ tag: 'global' })
    expect(data.currentRanking).toMatchObject({ tag: 'ranking' })
    expect(data.currentReference).toMatchObject({ tag: 'reference' })
    expect(data.currentEquivalence).toMatchObject({ tag: 'equivalence' })
  })

  it('captures a StoreError and clears loading on failure', async () => {
    const err: StoreError = { status: 502, errorKey: 'error.network', retryable: true }
    const data = useDataStore()
    const { client } = stubClient({ global: () => Promise.reject(err) })
    await expect(data.loadForCurrentView(client)).rejects.toBe(err)
    expect(data.errors.global).toEqual(err)
    expect(data.loading.global).toBe(false)
  })
})
