import { describe, it, expect } from 'vitest'
import { parseDerivationParams, parseEquivalenceExtras } from '../server/utils/params'

/** Assert a parser throws a 400 carrying the given localized error key. */
const expect400 = (fn: () => unknown, errorKey: string): void => {
  try {
    fn()
    throw new Error('expected a 400 to be thrown')
  } catch (e) {
    const err = e as { statusCode?: number; data?: { errorKey?: string } }
    expect(err.statusCode).toBe(400)
    expect(err.data?.errorKey).toBe(errorKey)
  }
}

describe('parseDerivationParams', () => {
  it('defaults to today / mid on an empty query (baseline is client-only, ADR-026)', () => {
    expect(parseDerivationParams({})).toEqual({
      horizon: 'today',
      rScenario: 'mid',
    })
  })

  it('parses a full valid query (ignores baseline — not a server param)', () => {
    expect(parseDerivationParams({ horizon: '50y', rScenario: 'high', baseline: '2005' })).toEqual({
      horizon: '50y',
      rScenario: 'high',
    })
  })

  it('rejects out-of-enum values (baseline is no longer a server param — ignored, not rejected)', () => {
    expect400(() => parseDerivationParams({ horizon: 'eternity' }), 'error.param.horizon')
    expect400(() => parseDerivationParams({ rScenario: 'reckless' }), 'error.param.rScenario')
  })

  it('takes the first value of a repeated query field', () => {
    expect(parseDerivationParams({ horizon: ['50y', 'today'] }).horizon).toBe('50y')
  })
})

describe('parseEquivalenceExtras', () => {
  it('defaults locale=en (horizon lives in DerivationParams)', () => {
    expect(parseEquivalenceExtras({})).toEqual({ locale: 'en' })
  })

  it('parses the locale', () => {
    expect(parseEquivalenceExtras({ locale: 'sk' })).toEqual({ locale: 'sk' })
  })
})
