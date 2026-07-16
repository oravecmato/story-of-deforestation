import { watch } from 'vue'
import { useViewStore } from '../stores/view'

// URL sync (tech-spec §10.1, ADR-017). Maps derivationParams ↔ route.query with `replace` (no history
// spam): initializes the view store from the query on load (preset fallback for missing/invalid keys),
// then rewrites the query on every derivation change. `timeRange` stays out of the URL (pure view state);
// `horizon` is part of derivationParams so it IS synced. Call once from the app shell setup.
export function useRouteSync(): void {
  const route = useRoute()
  const router = useRouter()
  const view = useViewStore()

  view.initFromQuery(route.query)

  watch(
    () => view.query,
    (query) => {
      router.replace({ query })
    },
    { deep: true },
  )
}
