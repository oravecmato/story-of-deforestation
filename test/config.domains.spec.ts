import { describe, it, expect } from 'vitest'
import { DOMAINS, ALL_DOMAINS, getDomain, ALLOMETRIC_FACTOR } from '../shared/config/domains'
import type { DomainId } from '../shared/types'

// Published config-ready total `r` table (tech-spec §2.1, business §6). Derived `r` must match
// these to 2 decimals so the app's numbers stay traceable to the cited literature.
const PUBLISHED_R: Record<DomainId, { mid: number; low: number; high: number }> = {
  congo: { mid: 3.0, low: 2.41, high: 3.6 },
  seasia: { mid: 1.96, low: 0.63, high: 3.27 },
  amazon: { mid: 1.36, low: 0.0, high: 2.23 },
  other_tropical: { mid: 2.27, low: 0.63, high: 3.6 },
}

const round2 = (n: number) => Math.round(n * 100) / 100

describe('domain config integrity', () => {
  it('has exactly the four locked domains', () => {
    expect(Object.keys(DOMAINS).sort()).toEqual(
      ['amazon', 'congo', 'other_tropical', 'seasia'].sort(),
    )
    expect(ALL_DOMAINS).toHaveLength(4)
  })

  it('locks the allometric factor at 1.24', () => {
    expect(ALLOMETRIC_FACTOR).toBe(1.24)
    for (const d of ALL_DOMAINS) expect(d.allometricFactor).toBe(1.24)
  })

  it('derives total r = rAboveground × 1.24, matching the published table', () => {
    for (const d of ALL_DOMAINS) {
      expect(d.r.mid).toBeCloseTo(d.rAboveground.mid * ALLOMETRIC_FACTOR, 10)
      expect(d.r.low).toBeCloseTo(d.rAboveground.low * ALLOMETRIC_FACTOR, 10)
      expect(d.r.high).toBeCloseTo(d.rAboveground.high * ALLOMETRIC_FACTOR, 10)

      const pub = PUBLISHED_R[d.id]
      expect(round2(d.r.mid)).toBe(pub.mid)
      expect(round2(d.r.low)).toBe(pub.low)
      expect(round2(d.r.high)).toBe(pub.high)
    }
  })

  it('keeps r endpoints ordered low ≤ mid ≤ high', () => {
    for (const d of ALL_DOMAINS) {
      expect(d.r.low).toBeLessThanOrEqual(d.r.mid)
      expect(d.r.mid).toBeLessThanOrEqual(d.r.high)
    }
  })

  it('has non-empty, unique ISO membership with no cross-domain overlap', () => {
    const seen = new Set<string>()
    for (const d of ALL_DOMAINS) {
      expect(d.isoCodes.length).toBeGreaterThan(0)
      // unique within a domain
      expect(new Set(d.isoCodes).size).toBe(d.isoCodes.length)
      for (const iso of d.isoCodes) {
        expect(iso).toMatch(/^[A-Z]{3}$/)
        expect(seen.has(iso), `${iso} appears in more than one domain`).toBe(false)
        seen.add(iso)
      }
    }
  })

  it('excludes the three named domains and arid outliers from other_tropical', () => {
    const other = new Set(getDomain('other_tropical').isoCodes)
    for (const named of [...DOMAINS.amazon.isoCodes, ...DOMAINS.congo.isoCodes, ...DOMAINS.seasia.isoCodes]) {
      expect(other.has(named)).toBe(false)
    }
    // ≥5% forest-cover floor drops these hyper-arid Sahel states
    for (const arid of ['NER', 'MRT', 'TCD']) expect(other.has(arid)).toBe(false)
  })

  it('requires every domain to carry labelKey, caveats and sources', () => {
    for (const d of ALL_DOMAINS) {
      expect(d.labelKey).toMatch(/^domain\./)
      expect(d.caveatKeys.length).toBeGreaterThan(0)
      expect(d.sourceRefs.length).toBeGreaterThan(0)
    }
  })
})
