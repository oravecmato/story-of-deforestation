import { describe, it, expect } from 'vitest'
import {
  coerceDerivationParams,
  coerceBaseline,
  paramsKey,
  paramsToQuery,
  isDomainId,
  PRESET_PARAMS,
  DEFAULT_BASELINE,
} from '../shared/config/derivation'

describe('coerceDerivationParams (lenient client path)', () => {
  it('empty query → preset', () => {
    expect(coerceDerivationParams({})).toEqual(PRESET_PARAMS)
  })

  it('parses a valid full query (baseline is not a DerivationParam, ADR-026)', () => {
    expect(coerceDerivationParams({ horizon: '50y', rScenario: 'high' })).toEqual({
      horizon: '50y',
      rScenario: 'high',
    })
  })

  it('falls back to preset for invalid enum (never throws)', () => {
    expect(coerceDerivationParams({ horizon: 'x', rScenario: 'y' })).toEqual(PRESET_PARAMS)
  })

  it('takes the first value of a repeated field', () => {
    expect(coerceDerivationParams({ horizon: ['50y', 'today'] }).horizon).toBe('50y')
  })
})

describe('paramsKey / paramsToQuery', () => {
  it('key is stable and endpoint-scoped (baseline is not part of it, ADR-026)', () => {
    const p = { horizon: 'today', rScenario: 'mid' } as const
    expect(paramsKey('global', p)).toBe('global:today:mid')
    expect(paramsKey('reference', p)).not.toBe(paramsKey('global', p))
  })

  it('query mirrors the params (no baseline — ADR-026)', () => {
    expect(paramsToQuery({ horizon: 'today', rScenario: 'mid' })).toEqual({
      horizon: 'today',
      rScenario: 'mid',
    })
  })
})

describe('coerceBaseline (client-transform view-state, ADR-026)', () => {
  it('parses a valid integer year', () => {
    expect(coerceBaseline('2005')).toBe(2005)
  })

  it('accepts a pre-1990 reconstruction year (floor 1800)', () => {
    expect(coerceBaseline('1850')).toBe(1850)
  })

  it('falls back to the default for missing / non-integer / sub-floor input', () => {
    expect(coerceBaseline(undefined)).toBe(DEFAULT_BASELINE)
    expect(coerceBaseline('2000.5')).toBe(DEFAULT_BASELINE)
    expect(coerceBaseline('1799')).toBe(DEFAULT_BASELINE)
    expect(coerceBaseline('abc', 1990)).toBe(1990)
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
