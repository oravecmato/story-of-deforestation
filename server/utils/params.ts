import { createError } from 'h3'
import type { DerivationParams, DomainId } from '../../shared/types'
import {
  SCOPES,
  HORIZONS,
  R_SCENARIOS,
  BASELINE_FLOOR,
  isDomainId,
} from '../../shared/config/derivation'

// Request-param parsing/validation (tech-spec §8). Pure functions of the query object so they are
// trivially testable; the routes do the h3 extraction and pass the plain query in. Every endpoint is
// a deterministic function of its query string (the full DerivationParams signature) → CDN-cacheable
// by URL. Invalid input → 400 carrying a localized error KEY (never a literal message) in `data`.
// The enums + floor are shared with the client URL-sync (shared/config/derivation.ts).

export type Query = Record<string, unknown>

/** 400 with a localized error key (UI resolves the message). */
const badRequest = (errorKey: string): never => {
  throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { errorKey } })
}

/** First value of a query field as a trimmed string, or undefined. */
const str = (v: unknown): string | undefined => {
  const raw = Array.isArray(v) ? v[0] : v
  return raw == null ? undefined : String(raw).trim()
}

const oneOf = <T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
  key: string,
): T => {
  if (value === undefined) return fallback
  if ((allowed as readonly string[]).includes(value)) return value as T
  return badRequest(key)
}

const parseBaseline = (value: string | undefined): number => {
  if (value === undefined) return BASELINE_FLOOR
  const n = Number(value)
  if (!Number.isInteger(n) || n < BASELINE_FLOOR) return badRequest('error.param.baseline')
  return n
}

/** Parse DerivationParams for global-family routes (scope from query, defaults to global). */
export function parseDerivationParams(query: Query): DerivationParams {
  const scope = oneOf(str(query.scope), SCOPES, 'global', 'error.param.scope')
  const params: DerivationParams = {
    scope,
    horizon: oneOf(str(query.horizon), HORIZONS, 'today', 'error.param.horizon'),
    rScenario: oneOf(str(query.rScenario), R_SCENARIOS, 'mid', 'error.param.rScenario'),
    baseline: parseBaseline(str(query.baseline)),
  }
  if (scope === 'local') {
    const domainId = str(query.domainId)
    if (!domainId) return badRequest('error.param.domainRequired')
    if (!isDomainId(domainId)) return badRequest('error.param.domainId')
    params.domainId = domainId
  }
  return params
}

/** Parse params for `/api/domain/[id]`: scope is forced local; domainId comes from the path. */
export function parseDomainRouteParams(
  id: string | undefined,
  query: Query,
): DerivationParams & { domainId: DomainId } {
  if (!id) badRequest('error.param.domainRequired')
  if (!isDomainId(id as string)) return badRequest('error.param.domainId')
  return {
    scope: 'local',
    domainId: id as DomainId,
    horizon: oneOf(str(query.horizon), HORIZONS, 'today', 'error.param.horizon'),
    rScenario: oneOf(str(query.rScenario), R_SCENARIOS, 'mid', 'error.param.rScenario'),
    baseline: parseBaseline(str(query.baseline)),
  }
}

/** Equivalence extra: the locale-driven reference country. The horizon is part of DerivationParams. */
export function parseEquivalenceExtras(query: Query): { locale: string } {
  return { locale: str(query.locale) ?? 'en' }
}
