import { useDataStore } from '../stores/data'
import { useApi } from './useApi'

// Re-run the current view's fetch (cache-first, so only failed/absent endpoints hit the network).
// Used by per-region ErrorRetry buttons (UI §9, ADR-010 per-region isolation).
export const useReload = (): (() => Promise<void>) => {
  const data = useDataStore()
  const api = useApi()
  return () => data.loadForCurrentView(api)
}
