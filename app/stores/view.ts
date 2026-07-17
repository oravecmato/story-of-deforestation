import { defineStore } from 'pinia'
import type {
  DerivationParams,
  Scope,
  Horizon,
  RScenario,
  DomainId,
  SceneId,
  EquivalenceUnit,
} from '../../shared/types'
import {
  PRESET_PARAMS,
  DEFAULT_DOMAIN_ID,
  coerceDerivationParams,
  paramsToQuery,
} from '../../shared/config/derivation'

// View store (tech-spec §10.1) — per-scene control/view state. Because the deck is a single persistent
// route (§17, ADR-023), control state is keyed per SCENE, not one flat current-view: revisiting a scene
// restores its state (reset policy A); first entry seeds the slide's authored defaults. The CURRENT
// scene's params are held expanded as the flat fields (the live cache-key surface); the other scenes
// are snapshotted in `saved` and restored on return. `derivationParams` (everything except `timeRange`)
// is the cache key — changing it refetches; `horizon` is the signature control (ADR-019) and is in the
// URL. `timeRange` is pure ECharts dataZoom view-state (never a refetch/crop, ADR-005), NOT in the URL.
// Metric selection (stock-only vs +forgone) is NOT stored here — it is authored per-slide (§17) and
// applied as a presentation transform in the option class (§11), so slides 2→3 / 5→6 stay in the same
// scene with the same params and only the chart's metric set changes (in-place animation, ADR-022).

/** A scene's authored seed: defaults applied on first entry + immutable `forced` overrides. */
export interface SceneSeed {
  params?: Partial<DerivationParams>
  forced?: Partial<DerivationParams>
}

/** A snapshot of one scene's control/view state (policy A save/restore). */
interface SceneSnapshot {
  scope: Scope
  domainId: DomainId
  horizon: Horizon
  rScenario: RScenario
  baseline: number
  timeRange: [number, number] | null
}

export const useViewStore = defineStore('view', {
  state: () => ({
    currentScene: 'main' as SceneId,
    scope: PRESET_PARAMS.scope as Scope,
    domainId: DEFAULT_DOMAIN_ID as DomainId, // meaningful only in local scope
    horizon: PRESET_PARAMS.horizon as Horizon,
    rScenario: PRESET_PARAMS.rScenario as RScenario,
    baseline: PRESET_PARAMS.baseline,
    timeRange: null as [number, number] | null,
    /** The unit the slide-6 equivalence strip renders in (ADR-025, §17.4). Pure client view state —
     *  NOT part of `derivationParams`/`query` (no refetch, out of the URL like `timeRange`). Default
     *  `car`; the `country` unit is locale-driven (SVK/UK). Scene-invariant (only slide 6 reads it). */
    unit: 'car' as EquivalenceUnit,
    /** Snapshotted state of the scenes that are not current (restored on return, policy A). */
    saved: new Map<SceneId, SceneSnapshot>(),
  }),

  getters: {
    /** The cache-key surface (ADR-005) of the CURRENT scene. Includes domainId only in local scope. */
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
    /** Initialize the current scene's params from a route query, falling back to the preset for any
     *  missing/invalid key (composer path; the deck uses `initSceneFromQuery`). */
    initFromQuery(query: Record<string, unknown>) {
      const p = coerceDerivationParams(query)
      this.scope = p.scope
      this.horizon = p.horizon
      this.rScenario = p.rScenario
      this.baseline = p.baseline
      if (p.domainId) this.domainId = p.domainId
    },

    /** Hydrate a scene's params from the route query on initial load, with the scene's authored
     *  defaults as the fallback and its `forced` overrides applied on top (ADR-023). */
    initSceneFromQuery(scene: SceneId, query: Record<string, unknown>, seed: SceneSeed = {}) {
      const authored = { ...PRESET_PARAMS, ...seed.params } as DerivationParams
      const p = coerceDerivationParams(query, authored)
      const f = seed.forced ?? {}
      this.scope = f.scope ?? p.scope
      this.domainId = f.domainId ?? p.domainId ?? DEFAULT_DOMAIN_ID
      this.horizon = f.horizon ?? p.horizon
      this.rScenario = f.rScenario ?? p.rScenario
      this.baseline = f.baseline ?? p.baseline
      this.timeRange = null
      this.currentScene = scene
    },

    /** Enter a scene (deck navigation, ADR-023). Snapshots the current scene, then RESTORES the target
     *  if visited before (policy A) or SEEDS it from the slide's authored `params`; either way the
     *  immutable `forced` overrides are (re)applied. No-op re-entry only refreshes `forced`. */
    enterScene(scene: SceneId, seed: SceneSeed = {}) {
      if (scene === this.currentScene) {
        this.applyForced(seed.forced)
        return
      }
      this.saved.set(this.currentScene, this.snapshot())
      const prev = this.saved.get(scene)
      if (prev) this.restore(prev)
      else this.seedScene(seed)
      this.applyForced(seed.forced)
      this.currentScene = scene
    },

    /** Capture the current scene's live state for later restore (policy A). */
    snapshot(): SceneSnapshot {
      return {
        scope: this.scope,
        domainId: this.domainId,
        horizon: this.horizon,
        rScenario: this.rScenario,
        baseline: this.baseline,
        timeRange: this.timeRange,
      }
    },

    /** Load a previously-saved scene snapshot into the live fields. */
    restore(snap: SceneSnapshot) {
      this.scope = snap.scope
      this.domainId = snap.domainId
      this.horizon = snap.horizon
      this.rScenario = snap.rScenario
      this.baseline = snap.baseline
      this.timeRange = snap.timeRange
    },

    /** First-entry seed: authored defaults over the preset; timeRange starts empty. */
    seedScene(seed: SceneSeed) {
      const p = { ...PRESET_PARAMS, ...seed.params } as DerivationParams
      this.scope = p.scope
      this.domainId = p.domainId ?? DEFAULT_DOMAIN_ID
      this.horizon = p.horizon
      this.rScenario = p.rScenario
      this.baseline = p.baseline
      this.timeRange = null
    },

    /** Apply a slide's immutable `forced` overrides (scope/horizon locks, e.g. crossing/footprint). */
    applyForced(forced?: Partial<DerivationParams>) {
      if (!forced) return
      if (forced.scope != null) this.scope = forced.scope
      if (forced.domainId != null) this.domainId = forced.domainId
      if (forced.horizon != null) this.horizon = forced.horizon
      if (forced.rScenario != null) this.rScenario = forced.rScenario
      if (forced.baseline != null) this.baseline = forced.baseline
    },

    /** The main-scene domain control: Global (global scope) or a single domain (local scope). Resets
     *  the current scene's timeRange (scopes/domains span different x-ranges). */
    selectDomain(sel: 'global' | DomainId) {
      if (sel === 'global') this.setScope('global')
      else {
        this.setScope('local')
        this.setDomain(sel)
      }
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
    /** The equivalence-strip unit (client-only, no refetch, not in the URL — ADR-025, §17.4). */
    setUnit(unit: EquivalenceUnit) {
      this.unit = unit
    },
  },
})
