import { defineStore } from 'pinia'
import type {
  DerivationParams,
  Horizon,
  RScenario,
  SceneId,
  EquivalenceUnit,
} from '#shared/types'
import {
  PRESET_PARAMS,
  DEFAULT_BASELINE,
  DEFAULT_R_MULTIPLIER,
  coerceDerivationParams,
  coerceBaseline,
  coerceRMultiplier,
  paramsToQuery,
} from '#shared/config/derivation'

// View store (tech-spec §10.1) — per-scene control/view state. Because the deck is a single persistent
// route (§17, ADR-023), control state is keyed per SCENE, not one flat current-view: revisiting a scene
// restores its state (reset policy A); first entry seeds the slide's authored defaults. The CURRENT
// scene's params are held expanded as the flat fields (the live cache-key surface); the other scenes
// are snapshotted in `saved` and restored on return. `derivationParams` is the cache key — changing it
// refetches; `horizon` is the signature control (ADR-019) and is in the URL.
// Metric selection (stock-only vs +forgone) is NOT stored here — it is authored per-slide (§17) and
// applied as a presentation transform in the option class (§11), so slides 2→3 / 5→6 stay in the same
// scene with the same params and only the chart's metric set changes (in-place animation, ADR-022).

/** A scene's authored seed: defaults applied on first entry + immutable `forced` overrides.
 *  `baseline` is a client-transform (ADR-026), authored alongside — not a DerivationParam. */
export interface SceneSeed {
  params?: Partial<DerivationParams>
  forced?: Partial<DerivationParams>
  baseline?: number
}

/** A snapshot of one scene's control/view state (policy A save/restore). */
interface SceneSnapshot {
  horizon: Horizon
  rScenario: RScenario
  baseline: number
  rMultiplier: number
}

export const useViewStore = defineStore('view', {
  state: () => ({
    currentScene: 'main' as SceneId,
    horizon: PRESET_PARAMS.horizon as Horizon,
    rScenario: PRESET_PARAMS.rScenario as RScenario,
    /** Sink-integration origin (ADR-026). Client-transform view-state: URL-synced for shareability
     *  but NEVER refetches — the server ships the full-range area and the client re-derives locally. */
    baseline: DEFAULT_BASELINE,
    /** R-amplification factor (slide 10). Client-transform view-state like `baseline`: URL-synced for
     *  shareability but NEVER refetches — it scales the sink rate R uniformly and the client re-derives
     *  the forgone sink locally. Per-scene (snapshotted), so leaving slide 10 restores 1× everywhere else. */
    rMultiplier: DEFAULT_R_MULTIPLIER,
    /** The unit the slide-6 equivalence strip renders in (ADR-025, §17.4). Pure client view state —
     *  NOT part of `derivationParams`/`query` (no refetch, out of the URL). Default
     *  `car`; the `country` unit is locale-driven (SVK/UK). Scene-invariant (only slide 6 reads it). */
    unit: 'car' as EquivalenceUnit,
    /** Snapshotted state of the scenes that are not current (restored on return, policy A). */
    saved: new Map<SceneId, SceneSnapshot>(),
  }),

  getters: {
    /** The cache-key surface (ADR-005) of the CURRENT scene. */
    derivationParams(state): DerivationParams {
      return {
        horizon: state.horizon,
        rScenario: state.rScenario,
      }
    },
    /** URL-sync object (ADR-017): the refetch cache-key surface PLUS the client-transform `baseline`
     *  (ADR-026 — in the URL for shareability, but not a DerivationParam, so it never refetches). */
    query(): Record<string, string> {
      return {
        ...paramsToQuery(this.derivationParams),
        baseline: String(this.baseline),
        rMultiplier: String(this.rMultiplier),
      }
    },
  },

  actions: {
    /** Initialize the current scene's params from a route query, falling back to the preset for any
     *  missing/invalid key (composer path; the deck uses `initSceneFromQuery`). */
    initFromQuery(query: Record<string, unknown>) {
      const p = coerceDerivationParams(query)
      this.horizon = p.horizon
      this.rScenario = p.rScenario
      this.baseline = coerceBaseline(query.baseline)
      this.rMultiplier = coerceRMultiplier(query.rMultiplier)
    },

    /** Hydrate a scene's params from the route query on initial load, with the scene's authored
     *  defaults as the fallback and its `forced` overrides applied on top (ADR-023). */
    initSceneFromQuery(scene: SceneId, query: Record<string, unknown>, seed: SceneSeed = {}) {
      const authored = { ...PRESET_PARAMS, ...seed.params } as DerivationParams
      const p = coerceDerivationParams(query, authored)
      const f = seed.forced ?? {}
      this.horizon = f.horizon ?? p.horizon
      this.rScenario = f.rScenario ?? p.rScenario
      this.baseline = coerceBaseline(query.baseline, seed.baseline ?? DEFAULT_BASELINE)
      this.rMultiplier = coerceRMultiplier(query.rMultiplier)
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
        horizon: this.horizon,
        rScenario: this.rScenario,
        baseline: this.baseline,
        rMultiplier: this.rMultiplier,
      }
    },

    /** Load a previously-saved scene snapshot into the live fields. */
    restore(snap: SceneSnapshot) {
      this.horizon = snap.horizon
      this.rScenario = snap.rScenario
      this.baseline = snap.baseline
      this.rMultiplier = snap.rMultiplier
    },

    /** First-entry seed: authored defaults over the preset. */
    seedScene(seed: SceneSeed) {
      const p = { ...PRESET_PARAMS, ...seed.params } as DerivationParams
      this.horizon = p.horizon
      this.rScenario = p.rScenario
      this.baseline = seed.baseline ?? DEFAULT_BASELINE
      this.rMultiplier = DEFAULT_R_MULTIPLIER
    },

    /** Apply a slide's immutable `forced` overrides (horizon lock, e.g. crossing/footprint). */
    applyForced(forced?: Partial<DerivationParams>) {
      if (!forced) return
      if (forced.horizon != null) this.horizon = forced.horizon
      if (forced.rScenario != null) this.rScenario = forced.rScenario
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
    /** The R-amplification factor (client-only, slide 10 — no refetch, re-derives the forgone sink). */
    setRMultiplier(rMultiplier: number) {
      this.rMultiplier = rMultiplier
    },
    /** The equivalence-strip unit (client-only, no refetch, not in the URL — ADR-025, §17.4). */
    setUnit(unit: EquivalenceUnit) {
      this.unit = unit
    },
  },
})
