import { describe, it, expect } from 'vitest'
import { INDICATORS, getIndicator } from '../shared/config/indicators'
import { SCOPE_SELECTOR_OPTIONS } from '../shared/config/scopeSelector'
import { DOMAINS } from '../shared/config/domains'

describe('indicator registry', () => {
  it('registers the three live-verified indicators with matching ids', () => {
    expect(Object.keys(INDICATORS).sort()).toEqual(
      ['deforestationStock', 'forestArea', 'fossil'].sort(),
    )
    for (const [key, cfg] of Object.entries(INDICATORS)) {
      expect(cfg.id).toBe(key)
      expect(cfg.code.length).toBeGreaterThan(0)
      expect(cfg.coverageFrom).toBeGreaterThanOrEqual(1990)
      expect(['state', 'flow']).toContain(cfg.seriesType)
    }
  })

  it('models forest area as state and emission flows as flow', () => {
    expect(getIndicator('forestArea').seriesType).toBe('state')
    expect(getIndicator('deforestationStock').seriesType).toBe('flow')
    expect(getIndicator('fossil').seriesType).toBe('flow')
  })

  it('throws on an unknown indicator id', () => {
    expect(() => getIndicator('nope')).toThrow(/Unknown indicator/)
  })
})

describe('scope selector config', () => {
  it('has exactly one global (default) entry mapping to null domain', () => {
    const global = SCOPE_SELECTOR_OPTIONS.filter((o) => o.scope === 'global')
    expect(global).toHaveLength(1)
    expect(global[0]!.domainId).toBeNull()
  })

  it('maps every local entry to a real, distinct domain id', () => {
    const locals = SCOPE_SELECTOR_OPTIONS.filter((o) => o.scope === 'local')
    const ids = locals.map((o) => o.domainId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).not.toBeNull()
      expect(DOMAINS[id!]).toBeDefined()
    }
    // every configured domain is reachable from the selector
    expect(new Set(ids)).toEqual(new Set(Object.keys(DOMAINS)))
  })

  it('draws exactly one divider (before the global entry)', () => {
    const dividers = SCOPE_SELECTOR_OPTIONS.filter((o) => o.divider)
    expect(dividers).toHaveLength(1)
    expect(dividers[0]!.scope).toBe('global')
  })
})
