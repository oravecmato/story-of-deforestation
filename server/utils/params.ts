import { createError } from 'h3'
import type { DerivationParams } from '../../shared/types'
import { HORIZONS, R_SCENARIOS } from '../../shared/config/derivation'

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

/** Parse DerivationParams for the global-family routes. */
export function parseDerivationParams(query: Query): DerivationParams {
  return {
    horizon: oneOf(str(query.horizon), HORIZONS, 'today', 'error.param.horizon'),
    rScenario: oneOf(str(query.rScenario), R_SCENARIOS, 'mid', 'error.param.rScenario'),
  }
}

/** Equivalence extra: the locale-driven reference country. The horizon is part of DerivationParams. */
export function parseEquivalenceExtras(query: Query): { locale: string } {
  return { locale: str(query.locale) ?? 'en' }
}
