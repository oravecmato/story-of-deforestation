import { describe, it, expect } from 'vitest'
import type { DerivationParams } from '../shared/types'
import { createApiClient, toStoreError, type FetchFn } from '../app/services/apiClient'

function stub(): { fetchFn: FetchFn; calls: Array<{ url: string; query: unknown }> } {
  const calls: Array<{ url: string; query: unknown }> = []
  const fetchFn = (async (url: string, opts: { query: Record<string, string> }) => {
    calls.push({ url, query: opts.query })
    return { ok: true }
  }) as FetchFn
  return { fetchFn, calls }
}

const global: DerivationParams = { horizon: 'today', rScenario: 'mid' }

describe('createApiClient', () => {
  it('routes each endpoint to its URL with the params query', async () => {
    const { fetchFn, calls } = stub()
    const api = createApiClient(fetchFn)

    await api.global(global)
    expect(calls[0]).toEqual({
      url: '/api/global',
      query: { horizon: 'today', rScenario: 'mid' },
    })

    await api.reference(global)
    expect(calls[1]!.url).toBe('/api/reference')
  })

  it('appends the locale for equivalence', async () => {
    const { fetchFn, calls } = stub()
    const api = createApiClient(fetchFn)

    await api.equivalence({ horizon: '30y', rScenario: 'mid' }, 'sk')
    expect(calls[0]).toEqual({
      url: '/api/equivalence',
      query: { horizon: '30y', rScenario: 'mid', locale: 'sk' },
    })
  })

  it('normalizes a fetch failure to a StoreError', async () => {
    const fetchFn = (async () => {
      throw { statusCode: 400, data: { errorKey: 'error.param.baseline' } }
    }) as FetchFn
    const api = createApiClient(fetchFn)
    await expect(api.global(global)).rejects.toEqual({
      status: 400,
      errorKey: 'error.param.baseline',
      retryable: false,
    })
  })
})

describe('toStoreError', () => {
  it('maps a server 400 with an errorKey (non-retryable)', () => {
    const e = { statusCode: 400, data: { errorKey: 'error.param.baseline' } }
    expect(toStoreError(e)).toEqual({ status: 400, errorKey: 'error.param.baseline', retryable: false })
  })

  it('maps a 5xx to a retryable network error', () => {
    expect(toStoreError({ statusCode: 502 })).toEqual({
      status: 502,
      errorKey: 'error.network',
      retryable: true,
    })
  })

  it('maps a no-response network failure to retryable', () => {
    expect(toStoreError({})).toEqual({ status: null, errorKey: 'error.network', retryable: true })
  })
})
