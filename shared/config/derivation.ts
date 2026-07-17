import type { DerivationParams, Scope, Horizon, RScenario, DomainId } from '../types'
import { DOMAINS } from './domains'

// Shared derivation-parameter surface (tech-spec §8/§10). The enums + baseline floor live here so the
// server validator (throws 400) and the client URL-sync (falls back to the preset) share one source
// of truth. `coerceDerivationParams` is the LENIENT client path: any missing/invalid key falls back
// to the preset (ADR-017). `paramsKey` is the deterministic cache/CDN key (endpoint + params).

export const SCOPES: readonly Scope[] = ['global', 'local']
export const HORIZONS: readonly Horizon[] = ['today', '20y', '30y', '50y', '75y', '100y']
export const R_SCENARIOS: readonly RScenario[] = ['conservative', 'mid', 'high']
export const BASELINE_FLOOR = 1990 // FAOSTAT / sink-integration origin (business §7.2)

/** Calendar year the horizon axis is anchored at (ADR-019). `today` = this year, no projection. */
export const HORIZON_ANCHOR_YEAR = 2026

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
 * The footprint-scene magnitude window (slides 5/6, ADR-025): a symmetric finite window that opens at
 * the `baseline` year and closes at the horizon target year. Every scene figure (donut, fossil bar,
 * equivalence strip) sums the TRUE finite integral over this one window (business §2.4 quantity #2),
 * so stock, forgone and fossil are the same kind of quantity. `today` closes at the current-year
 * anchor, so it still shows a meaningful cumulative-to-today (never zero).
 */
export const sceneWindow = (baseline: number, h: Horizon): { from: number; to: number } => ({
  from: baseline,
  to: horizonTargetYear(h),
})

/** Default domain when the user first switches to local scope (business §3.1). */
export const DEFAULT_DOMAIN_ID: DomainId = 'amazon'

/** Opening state (business §4): global / today / mid / 1990. Opens on measured data (no projection). */
export const PRESET_PARAMS: DerivationParams = {
  scope: 'global',
  horizon: 'today',
  rScenario: 'mid',
  baseline: BASELINE_FLOOR,
}

const first = (v: unknown): string | undefined => {
  const raw = Array.isArray(v) ? v[0] : v
  return raw == null ? undefined : String(raw).trim()
}

const asEnum = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
  const s = first(v)
  return s !== undefined && (allowed as readonly string[]).includes(s) ? (s as T) : fallback
}

const asBaseline = (v: unknown, fallback: number): number => {
  const n = Number(first(v))
  return Number.isInteger(n) && n >= BASELINE_FLOOR ? n : fallback
}

export const isDomainId = (id: string | undefined): id is DomainId => id != null && id in DOMAINS

/**
 * Lenient client-side coercion of a route query into DerivationParams: invalid/missing keys fall back
 * to `preset`. Local scope without a valid domain falls back to the default domain (never throws).
 */
export function coerceDerivationParams(
  query: Record<string, unknown>,
  preset: DerivationParams = PRESET_PARAMS,
): DerivationParams {
  const scope = asEnum(query.scope, SCOPES, preset.scope)
  const params: DerivationParams = {
    scope,
    horizon: asEnum(query.horizon, HORIZONS, preset.horizon),
    rScenario: asEnum(query.rScenario, R_SCENARIOS, preset.rScenario),
    baseline: asBaseline(query.baseline, preset.baseline),
  }
  if (scope === 'local') {
    const id = first(query.domainId)
    params.domainId = isDomainId(id) ? id : (preset.domainId ?? DEFAULT_DOMAIN_ID)
  }
  return params
}

/** Deterministic cache/CDN key for an endpoint + params (stable field order). */
export function paramsKey(endpoint: string, p: DerivationParams): string {
  return [endpoint, p.scope, p.domainId ?? '', p.horizon, p.rScenario, p.baseline].join(':')
}

/** DerivationParams → a plain query object for the router / apiClient (drops undefined domainId). */
export function paramsToQuery(p: DerivationParams): Record<string, string> {
  const q: Record<string, string> = {
    scope: p.scope,
    horizon: p.horizon,
    rScenario: p.rScenario,
    baseline: String(p.baseline),
  }
  if (p.domainId) q.domainId = p.domainId
  return q
}
