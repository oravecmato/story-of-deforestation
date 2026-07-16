import { defineStore } from 'pinia'
import type { DerivationParams, Scope, Horizon, RScenario, DomainId } from '../../shared/types'
import {
  PRESET_PARAMS,
  DEFAULT_DOMAIN_ID,
  coerceDerivationParams,
  paramsToQuery,
} from '../../shared/config/derivation'

// View store (tech-spec §10.1) — control/view state, the single source of truth for the composer.
// `derivationParams` is the cache key; changing any field EXCEPT `timeRange` yields a new signature →
// the data store refetches. `horizon` is the signature control (ADR-019) — part of DerivationParams
// and the URL — and drives both the projection extent and the equivalence panel. `timeRange` is pure
// ECharts dataZoom view-state (never a refetch, never a data crop — ADR-005), NOT in the URL;
// selecting a new scope/domain resets it to null (domains span different x-ranges).

export const useViewStore = defineStore('view', {
  state: () => ({
    scope: PRESET_PARAMS.scope as Scope,
    domainId: DEFAULT_DOMAIN_ID as DomainId, // meaningful only in local scope
    horizon: PRESET_PARAMS.horizon as Horizon,
    rScenario: PRESET_PARAMS.rScenario as RScenario,
    baseline: PRESET_PARAMS.baseline,
    timeRange: null as [number, number] | null,
  }),

  getters: {
    /** The cache-key surface (ADR-005). Includes domainId only in local scope. */
    derivationParams(state): DerivationParams {
      const p: DerivationParams = {
        scope: state.scope,
        horizon: state.horizon,
        rScenario: state.rScenario,
        baseline: state.baseline,
      }
      if (state.scope === 'local') p.domainId = state.domainId
      return p
    },
    /** DerivationParams as a route/query object (URL sync, ADR-017). */
    query(): Record<string, string> {
      return paramsToQuery(this.derivationParams)
    },
  },

  actions: {
    /** Initialize from a route query, falling back to the preset for any missing/invalid key. */
    initFromQuery(query: Record<string, unknown>) {
      const p = coerceDerivationParams(query)
      this.scope = p.scope
      this.horizon = p.horizon
      this.rScenario = p.rScenario
      this.baseline = p.baseline
      if (p.domainId) this.domainId = p.domainId
    },

    setScope(scope: Scope) {
      if (scope === this.scope) return
      this.scope = scope
      this.timeRange = null // new x-range
    },
    setDomain(domainId: DomainId) {
      if (domainId === this.domainId) return
      this.domainId = domainId
      this.timeRange = null // new x-range
    },
    setHorizon(horizon: Horizon) {
      this.horizon = horizon
    },
    setRScenario(rScenario: RScenario) {
      this.rScenario = rScenario
    },
    setBaseline(baseline: number) {
      this.baseline = baseline
    },
    setTimeRange(timeRange: [number, number] | null) {
      this.timeRange = timeRange
    },
  },
})
