import { createApiClient, type ApiClient, type FetchFn } from '../services/apiClient'

// Typed apiClient over Nuxt's `$fetch` (tech-spec §9, ADR-004). `$fetch` is isomorphic: during SSR it
// routes to the Nitro `/api/**` handler IN-PROCESS (no real HTTP hop, so it never self-requests through
// Vercel's deployment-protection auth wall — that wall returns an SSO login page for a cookie-less
// server call and was breaking every server-rendered slide); on the client it is a normal same-origin
// request that carries the browser's cookies. No baseURL is set on purpose — a relative URL is what
// enables the server-side internal routing. Error normalization to StoreError lives in createApiClient.
export default defineNuxtPlugin(() => {
  const api: ApiClient = createApiClient($fetch as unknown as FetchFn)
  return { provide: { api } }
})
