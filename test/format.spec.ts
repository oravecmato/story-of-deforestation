import { describe, it, expect } from 'vitest'
import { CompactNumberFormatter } from '../app/format/Formatter'

const f = new CompactNumberFormatter()

describe('CompactNumberFormatter.format', () => {
  it('international compact notation (lowercase k, upper M/B)', () => {
    expect(f.format(3_200_000)).toBe('3.2M')
    expect(f.format(820_000)).toBe('820k')
    expect(f.format(1_100_000_000)).toBe('1.1B')
  })

  it('null / non-finite → n/a', () => {
    expect(f.format(null)).toBe('n/a')
    expect(f.format(Number.NaN)).toBe('n/a')
    expect(f.format(Number.POSITIVE_INFINITY)).toBe('n/a')
  })

  it('honors fractionDigits (default 1)', () => {
    expect(f.format(3_249_000)).toBe('3.2M')
    expect(f.format(3_249_000, { fractionDigits: 2 })).toBe('3.25M')
  })

  it('formats small integers without a suffix', () => {
    expect(f.format(42)).toBe('42')
    expect(f.format(0)).toBe('0')
  })
})

describe('Formatter.multiplier', () => {
  it('fixes to 1 decimal with the × sign', () => {
    expect(f.multiplier(3.24)).toBe('×3.2')
    expect(f.multiplier(1)).toBe('×1.0')
  })
})
