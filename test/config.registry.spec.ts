import { describe, it, expect } from 'vitest'
import { INDICATORS, getIndicator } from '../shared/config/indicators'

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
