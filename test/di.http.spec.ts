import { describe, it, expect } from 'vitest'
import type { AxiosError, AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import {
  createServerAxios,
  isRetryableError,
  retryDelayMs,
  WDI_BASE_URL,
  REQUEST_TIMEOUT_MS,
  MAX_RETRIES,
} from '../server/di/http'

const errWithStatus = (status: number): AxiosError =>
  ({ response: { status } }) as AxiosError
const networkErr = (): AxiosError => ({}) as AxiosError // no response

/** Axios normally attaches the request config to adapter rejections; mirror that so the retry interceptor engages. */
const rejectWith = (base: AxiosError, config: InternalAxiosRequestConfig): Promise<never> =>
  Promise.reject(Object.assign(base, { config }))

describe('isRetryableError', () => {
  it('retries network/timeout errors (no response)', () => {
    expect(isRetryableError(networkErr())).toBe(true)
  })
  it('retries 5xx', () => {
    expect(isRetryableError(errWithStatus(500))).toBe(true)
    expect(isRetryableError(errWithStatus(503))).toBe(true)
    expect(isRetryableError(errWithStatus(599))).toBe(true)
  })
  it('never retries 4xx', () => {
    expect(isRetryableError(errWithStatus(400))).toBe(false)
    expect(isRetryableError(errWithStatus(404))).toBe(false)
    expect(isRetryableError(errWithStatus(429))).toBe(false)
  })
})

describe('retryDelayMs — exponential backoff', () => {
  it('250 → 500 ms', () => {
    expect(retryDelayMs(1)).toBe(250)
    expect(retryDelayMs(2)).toBe(500)
  })
})

describe('createServerAxios', () => {
  it('carries the WDI base URL, timeout, and json format', () => {
    const http = createServerAxios()
    expect(http.defaults.baseURL).toBe(WDI_BASE_URL)
    expect(http.defaults.timeout).toBe(REQUEST_TIMEOUT_MS)
    expect(http.defaults.params).toMatchObject({ format: 'json' })
  })

  it(`retries a network error and succeeds within ${MAX_RETRIES} retries`, async () => {
    let calls = 0
    const adapter: AxiosAdapter = async (config) => {
      calls += 1
      if (calls <= 2) return rejectWith(networkErr(), config)
      return { data: 'ok', status: 200, statusText: 'OK', headers: {}, config }
    }
    const http = createServerAxios()
    http.defaults.adapter = adapter
    const res = await http.get('/ping')
    expect(res.data).toBe('ok')
    expect(calls).toBe(3) // original + 2 retries
  })

  it('gives up after MAX_RETRIES on a persistent 5xx', async () => {
    let calls = 0
    const adapter: AxiosAdapter = async (config) => {
      calls += 1
      return rejectWith(errWithStatus(503), config)
    }
    const http = createServerAxios()
    http.defaults.adapter = adapter
    await expect(http.get('/ping')).rejects.toBeDefined()
    expect(calls).toBe(1 + MAX_RETRIES) // original + 2 retries
  })

  it('never retries a 4xx', async () => {
    let calls = 0
    const adapter: AxiosAdapter = async (config) => {
      calls += 1
      return rejectWith(errWithStatus(404), config)
    }
    const http = createServerAxios()
    http.defaults.adapter = adapter
    await expect(http.get('/ping')).rejects.toBeDefined()
    expect(calls).toBe(1) // no retry
  })
})
