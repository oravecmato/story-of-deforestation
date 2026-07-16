import axios from 'axios'
import { createApiClient, toStoreError, type ApiClient } from '../services/apiClient'

// Client Axios + typed apiClient (tech-spec §9, ADR-004). `baseURL` resolves to an absolute origin
// during SSR (from the incoming request) and a relative path on the client, so the same code fetches
// our BFF from both tiers. A response interceptor normalizes every failure to a typed StoreError.
export default defineNuxtPlugin(() => {
  const baseURL = import.meta.server ? useRequestURL().origin : ''
  const http = axios.create({ baseURL, timeout: 15000 })

  http.interceptors.response.use(undefined, (error) => Promise.reject(toStoreError(error)))

  return { provide: { api: createApiClient(http) as ApiClient } }
})
