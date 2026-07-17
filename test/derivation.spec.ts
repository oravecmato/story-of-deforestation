import { describe, it, expect } from 'vitest'
import {
  coerceDerivationParams,
  paramsKey,
  paramsToQuery,
  isDomainId,
  PRESET_PARAMS,
  DEFAULT_DOMAIN_ID,
} from '../shared/config/derivation'

describe('coerceDerivationParams (lenient client path)', () => {
  it('empty query → preset', () => {
    expect(coerceDerivationParams({})).toEqual(PRESET_PARAMS)
  })

  it('parses a valid full local query', () => {
    expect(
      coerceDerivationParams({ scope: 'local', domainId: 'congo', horizon: '50y', rScenario: 'high', baseline: '2005' }),
    ).toEqual({ scope: 'local', domainId: 'congo', horizon: '50y', rScenario: 'high', baseline: 2005 })
  })

  it('falls back to preset for invalid enum / sub-1990 baseline (never throws)', () => {
    expect(coerceDerivationParams({ scope: 'moon', horizon: 'x', rScenario: 'y', baseline: '1980' })).toEqual(
      PRESET_PARAMS,
    )
  })

  it('local scope without a valid domain → default domain', () => {
    expect(coerceDerivationParams({ scope: 'local' }).domainId).toBe(DEFAULT_DOMAIN_ID)
    expect(coerceDerivationParams({ scope: 'local', domainId: 'atlantis' }).domainId).toBe(DEFAULT_DOMAIN_ID)
  })

  it('takes the first value of a repeated field', () => {
    expect(coerceDerivationParams({ horizon: ['50y', 'today'] }).horizon).toBe('50y')
  })
})

describe('paramsKey / paramsToQuery', () => {
  it('key is stable and endpoint-scoped', () => {
    const p = { scope: 'global', horizon: 'today', rScenario: 'mid', baseline: 1990 } as const
    expect(paramsKey('global', p)).toBe('global:global::today:mid:1990')
    expect(paramsKey('reference', p)).not.toBe(paramsKey('global', p))
  })

  it('query drops domainId in global, includes it in local', () => {
    expect(paramsToQuery({ scope: 'global', horizon: 'today', rScenario: 'mid', baseline: 1990 })).toEqual({
      scope: 'global',
      horizon: 'today',
      rScenario: 'mid',
      baseline: '1990',
    })
    expect(
      paramsToQuery({ scope: 'local', domainId: 'amazon', horizon: '30y', rScenario: 'mid', baseline: 1995 }),
    ).toMatchObject({ scope: 'local', domainId: 'amazon', baseline: '1995' })
  })
})

describe('isDomainId', () => {
  it('accepts known domains, rejects the rest', () => {
    expect(isDomainId('amazon')).toBe(true)
    expect(isDomainId('other_tropical')).toBe(true)
    expect(isDomainId('narnia')).toBe(false)
    expect(isDomainId(undefined)).toBe(false)
  })
})
