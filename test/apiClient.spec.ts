import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import type { DerivationParams } from '../shared/types'
import { createApiClient, toStoreError } from '../app/services/apiClient'

function stub(): { http: AxiosInstance; calls: Array<{ url: string; params: unknown }> } {
  const calls: Array<{ url: string; params: unknown }> = []
  const http = {
    get: async (url: string, config?: { params?: unknown }) => {
      calls.push({ url, params: config?.params })
      return { data: { ok: true } }
    },
  } as unknown as AxiosInstance
  return { http, calls }
}

const global: DerivationParams = { scope: 'global', horizon: 'today', rScenario: 'mid', baseline: 1990 }
const local: DerivationParams = { scope: 'local', domainId: 'amazon', horizon: '30y', rScenario: 'mid', baseline: 1995 }

describe('createApiClient', () => {
  it('routes each endpoint to its URL with the params query', async () => {
    const { http, calls } = stub()
    const api = createApiClient(http)

    await api.global(global)
    expect(calls[0]).toEqual({
      url: '/api/global',
      params: { scope: 'global', horizon: 'today', rScenario: 'mid', baseline: '1990' },
    })

    await api.ranking(global)
    expect(calls[1]!.url).toBe('/api/ranking')

    await api.reference(global)
    expect(calls[2]!.url).toBe('/api/reference')
  })

  it('builds the domain URL from the path and appends the locale for equivalence', async () => {
    const { http, calls } = stub()
    const api = createApiClient(http)

    await api.domain(local)
    expect(calls[0]!.url).toBe('/api/domain/amazon')

    await api.equivalence(local, 'sk')
    expect(calls[1]).toEqual({
      url: '/api/equivalence',
      params: { scope: 'local', domainId: 'amazon', horizon: '30y', rScenario: 'mid', baseline: '1995', locale: 'sk' },
    })
  })
})

describe('toStoreError', () => {
  it('maps a server 400 with an errorKey (non-retryable)', () => {
    const e = { response: { status: 400, data: { errorKey: 'error.param.baseline' } } }
    expect(toStoreError(e)).toEqual({ status: 400, errorKey: 'error.param.baseline', retryable: false })
  })

  it('maps a 5xx to a retryable network error', () => {
    expect(toStoreError({ response: { status: 502 } })).toEqual({
      status: 502,
      errorKey: 'error.network',
      retryable: true,
    })
  })

  it('maps a no-response network failure to retryable', () => {
    expect(toStoreError({})).toEqual({ status: null, errorKey: 'error.network', retryable: true })
  })
})
