import type { DerivationParams, Horizon, RScenario, DomainId } from '../types'
import { DOMAINS } from './domains'

// Shared derivation-parameter surface (tech-spec §8/§10). The enums + baseline floor live here so the
// server validator (throws 400) and the client URL-sync (falls back to the preset) share one source
// of truth. `coerceDerivationParams` is the LENIENT client path: any missing/invalid key falls back
// to the preset (ADR-017). `paramsKey` is the deterministic cache/CDN key (endpoint + params).

export const HORIZONS: readonly Horizon[] = ['today', '20y', '30y', '50y', '75y', '100y']
export const R_SCENARIOS: readonly RScenario[] = ['conservative', 'mid', 'high']
// LUH2 reconstruction reaches back to 1800 (ADR-026, business §7.2a); the slider may open the sink
// integral anywhere from here on. `baseline` is a CLIENT-TRANSFORM (not a DerivationParam): it never
// refetches — the client re-derives locally from the full-range area the server ships.
export const BASELINE_FLOOR = 1800
// Default sink-integration origin = first measured year (World Bank AG.LND.FRST.K2 starts 1990).
export const DEFAULT_BASELINE = 1990
// Latest selectable baseline year — the upper bound shared by the coarse `BaselineControl` select and
// the `BaselineSlider` (which extends the lower bound down to `BASELINE_FLOOR`). The two controls are
// alternative ways to set the SAME client-transform origin (ADR-026), so they share this ceiling.
export const BASELINE_MAX = 2020

/** Calendar year the horizon axis is anchored at (ADR-019). `today` targets this year: measured series
 *  are nowcast up to the present so every series' extent is uniform (no inter-series gap). */
export const HORIZON_ANCHOR_YEAR = 2026

// The R-amplification factor (slide 10). A CLIENT-TRANSFORM like `baseline` (ADR-026): a coefficient
// that scales the sink rate R uniformly across every derived figure, so the forgone sink grows by the
// same factor everywhere. It never refetches — the client re-derives from the DTO the server already
// shipped. Some climate models put the true forgone sink several times higher; the slider explores 1×
// (the measured rate) up to 6× in whole steps.
export const R_MULTIPLIER_MIN = 1
export const R_MULTIPLIER_MAX = 6
export const R_MULTIPLIER_STEP = 1
export const DEFAULT_R_MULTIPLIER = 1

const HORIZON_YEAR_OFFSET: Record<Horizon, number> = {
  today: 0,
  '20y': 20,
  '30y': 30,
  '50y': 50,
  '75y': 75,
  '100y': 100,
}

/** Number of forward years the horizon spans (0 | 20 | 30 | 50 | 75 | 100) — drives equivalence. */
export const horizonYears = (h: Horizon): number => HORIZON_YEAR_OFFSET[h]

/** Absolute target year for the projected series' upper bound = anchor + offset. */
export const horizonTargetYear = (h: Horizon): number => HORIZON_ANCHOR_YEAR + HORIZON_YEAR_OFFSET[h]

/**
 * The magnitude window (multiplier badge + slides 5/6 donut/fossil/equivalence, ADR-019/ADR-025): a
 * FORWARD finite window that opens at the `referenceYear` (last measured year) and spans the chosen
 * horizon's forward reach. Every scene figure (donut, fossil bar, equivalence strip) and the ×N
 * multiplier sum the TRUE finite integral over this one window (business §2.4 quantity #2), so stock,
 * forgone and fossil are the same kind of quantity. `today` (offset 0) closes at the reference year
 * itself → a single-year window `[referenceYear, referenceYear]`, keeping continuity with the measured
 * ratio. The baseline stays ORTHOGONAL: it sets the DEPTH of the forgone sink (via cumulative loss at
 * every forward year), while the horizon sets the WIDTH of this window.
 */
export const sceneWindow = (referenceYear: number, h: Horizon): { from: number; to: number } => ({
  from: referenceYear,
  to: referenceYear + horizonYears(h),
})

/** Opening state (business §4): today / mid. Opens on measured data nowcast to the present. */
export const PRESET_PARAMS: DerivationParams = {
  horizon: 'today',
  rScenario: 'mid',
}

const first = (v: unknown): string | undefined => {
  const raw = Array.isArray(v) ? v[0] : v
  return raw == null ? undefined : String(raw).trim()
}

const asEnum = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
  const s = first(v)
  return s !== undefined && (allowed as readonly string[]).includes(s) ? (s as T) : fallback
}

/**
 * Coerce the client-transform `baseline` view-state from a query value (ADR-026). Invalid/missing →
 * fallback (default 1990, the first measured year). Clamped to the LUH2 reconstruction floor (1800).
 */
export const coerceBaseline = (v: unknown, fallback: number = DEFAULT_BASELINE): number => {
  const n = Number(first(v))
  return Number.isInteger(n) && n >= BASELINE_FLOOR ? n : fallback
}

/**
 * Coerce the client-transform `rMultiplier` view-state from a query value (slide 10). Invalid/missing →
 * fallback (default 1×, the measured rate). Clamped to the discrete [1, 6] amplification range.
 */
export const coerceRMultiplier = (
  v: unknown,
  fallback: number = DEFAULT_R_MULTIPLIER,
): number => {
  const n = Number(first(v))
  return Number.isInteger(n) && n >= R_MULTIPLIER_MIN && n <= R_MULTIPLIER_MAX ? n : fallback
}

export const isDomainId = (id: string | undefined): id is DomainId => id != null && id in DOMAINS

/**
 * Lenient client-side coercion of a route query into DerivationParams: invalid/missing keys fall back
 * to `preset` (never throws).
 */
export function coerceDerivationParams(
  query: Record<string, unknown>,
  preset: DerivationParams = PRESET_PARAMS,
): DerivationParams {
  return {
    horizon: asEnum(query.horizon, HORIZONS, preset.horizon),
    rScenario: asEnum(query.rScenario, R_SCENARIOS, preset.rScenario),
  }
}

/** Deterministic cache/CDN key for an endpoint + params (stable field order). */
export function paramsKey(endpoint: string, p: DerivationParams): string {
  return [endpoint, p.horizon, p.rScenario].join(':')
}

/** DerivationParams → a plain query object for the router / apiClient. */
export function paramsToQuery(p: DerivationParams): Record<string, string> {
  return {
    horizon: p.horizon,
    rScenario: p.rScenario,
  }
}
