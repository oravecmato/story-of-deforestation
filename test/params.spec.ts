import { describe, it, expect } from 'vitest'
import {
  parseDerivationParams,
  parseDomainRouteParams,
  parseEquivalenceExtras,
} from '../server/utils/params'

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
  it('defaults to global / today / mid on an empty query (baseline is client-only, ADR-026)', () => {
    expect(parseDerivationParams({})).toEqual({
      scope: 'global',
      horizon: 'today',
      rScenario: 'mid',
    })
  })

  it('parses a full valid global query (ignores baseline — not a server param)', () => {
    expect(parseDerivationParams({ scope: 'global', horizon: '50y', rScenario: 'high', baseline: '2005' })).toEqual({
      scope: 'global',
      horizon: '50y',
      rScenario: 'high',
    })
  })

  it('requires a valid domainId when scope=local', () => {
    expect(parseDerivationParams({ scope: 'local', domainId: 'amazon' })).toMatchObject({
      scope: 'local',
      domainId: 'amazon',
    })
    expect400(() => parseDerivationParams({ scope: 'local' }), 'error.param.domainRequired')
    expect400(() => parseDerivationParams({ scope: 'local', domainId: 'atlantis' }), 'error.param.domainId')
  })

  it('rejects out-of-enum values (baseline is no longer a server param — ignored, not rejected)', () => {
    expect400(() => parseDerivationParams({ scope: 'moon' }), 'error.param.scope')
    expect400(() => parseDerivationParams({ horizon: 'eternity' }), 'error.param.horizon')
    expect400(() => parseDerivationParams({ rScenario: 'reckless' }), 'error.param.rScenario')
  })

  it('takes the first value of a repeated query field', () => {
    expect(parseDerivationParams({ horizon: ['50y', 'today'] }).horizon).toBe('50y')
  })
})

describe('parseDomainRouteParams', () => {
  it('forces scope=local and takes the domainId from the path', () => {
    expect(parseDomainRouteParams('congo', { horizon: '50y' })).toEqual({
      scope: 'local',
      domainId: 'congo',
      horizon: '50y',
      rScenario: 'mid',
    })
  })

  it('rejects a missing / unknown path id', () => {
    expect400(() => parseDomainRouteParams(undefined, {}), 'error.param.domainRequired')
    expect400(() => parseDomainRouteParams('narnia', {}), 'error.param.domainId')
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
