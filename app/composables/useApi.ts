import type { ApiClient } from '../services/apiClient'

// Accessor for the injected typed BFF client (provided by plugins/api.ts).
export const useApi = (): ApiClient => useNuxtApp().$api as ApiClient
