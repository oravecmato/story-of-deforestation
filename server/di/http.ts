import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

// Server Axios factory (tech-spec §4/§7, per user B-4). One shared instance carries the WDI base URL,
// an 8s per-request timeout, and a retry interceptor: up to 2 retries with exponential backoff
// (250 → 500 ms) on network errors and 5xx ONLY — never on 4xx (a 4xx is a contract/geocode bug to
// surface, not to hammer). Every adapter constructed with this instance inherits the behaviour.

export const WDI_BASE_URL = 'https://api.worldbank.org/v2'
export const REQUEST_TIMEOUT_MS = 8000
export const MAX_RETRIES = 2
const BASE_DELAY_MS = 250

/** Exponential backoff: attempt 1 → 250 ms, attempt 2 → 500 ms. */
export const retryDelayMs = (attempt: number): number => BASE_DELAY_MS * 2 ** (attempt - 1)

/** Retry network/timeout errors (no response) and 5xx; never 4xx. */
export function isRetryableError(error: AxiosError): boolean {
  if (!error.response) return true // network error or timeout
  const status = error.response.status
  return status >= 500 && status <= 599
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

type RetryConfig = InternalAxiosRequestConfig & { _retryCount?: number }

export function createServerAxios(): AxiosInstance {
  const instance = axios.create({
    baseURL: WDI_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    params: { format: 'json' },
  })

  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined
    if (!config) return Promise.reject(error)
    const attempt = (config._retryCount ?? 0) + 1
    if (attempt > MAX_RETRIES || !isRetryableError(error)) return Promise.reject(error)
    config._retryCount = attempt
    await delay(retryDelayMs(attempt))
    return instance(config)
  })

  return instance
}
