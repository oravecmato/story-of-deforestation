import { describe, it, expect } from 'vitest'
import { EQUIVALENCE_CONFIG, resolveReferenceCountry } from '../shared/config/equivalences'

describe('equivalence config', () => {
  it('anchors the EPA car factor at 4.6 t CO2/yr', () => {
    expect(EQUIVALENCE_CONFIG.carAnnualTonsCO2).toBe(4.6)
    expect(EQUIVALENCE_CONFIG.sourceRefs.some((s) => /EPA/.test(s))).toBe(true)
  })

  it('uses forward-committed semantics (driven by the global horizon, ADR-019)', () => {
    expect(EQUIVALENCE_CONFIG.semantics).toBe('forward-committed')
  })

  it('resolves Slovakia for the sk locale', () => {
    expect(resolveReferenceCountry('sk').iso3).toBe('SVK')
    expect(resolveReferenceCountry('sk').labelKey).toBe('country.svk')
  })

  it('falls back to the UK for en and any other locale', () => {
    for (const locale of ['en', 'de', 'fr', '', 'xx']) {
      expect(resolveReferenceCountry(locale).iso3).toBe('GBR')
    }
  })

  it('gives every reference country a keyed label and a cited source', () => {
    const countries = [
      EQUIVALENCE_CONFIG.defaultReferenceCountry,
      ...Object.values(EQUIVALENCE_CONFIG.referenceCountryByLocale),
    ]
    for (const c of countries) {
      expect(c.iso3).toMatch(/^[A-Z]{3}$/)
      expect(c.labelKey).toMatch(/^country\./)
      expect(c.source.length).toBeGreaterThan(0)
    }
  })
})
