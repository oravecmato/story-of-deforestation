import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useViewStore } from '../app/stores/view'
import { PRESET_PARAMS } from '../shared/config/derivation'

beforeEach(() => setActivePinia(createPinia()))

describe('useViewStore', () => {
  it('opens on the preset and derivationParams omits domainId in global', () => {
    const view = useViewStore()
    expect(view.derivationParams).toEqual(PRESET_PARAMS)
    expect(view.derivationParams.domainId).toBeUndefined()
  })

  it('includes domainId in local scope', () => {
    const view = useViewStore()
    view.setScope('local')
    view.setDomain('congo')
    expect(view.derivationParams).toMatchObject({ scope: 'local', domainId: 'congo' })
  })

  it('resets timeRange to null on scope or domain change (new x-range)', () => {
    const view = useViewStore()
    view.setTimeRange([2000, 2010])
    view.setScope('local')
    expect(view.timeRange).toBeNull()

    view.setTimeRange([2000, 2010])
    view.setDomain('seasia')
    expect(view.timeRange).toBeNull()
  })

  it('does not reset timeRange on horizon/rScenario/baseline change', () => {
    const view = useViewStore()
    view.setTimeRange([2000, 2010])
    view.setHorizon('50y')
    view.setRScenario('high')
    view.setBaseline(1995)
    expect(view.timeRange).toEqual([2000, 2010])
  })

  it('initFromQuery is lenient: preset fallback for invalid, parse for valid', () => {
    const view = useViewStore()
    view.initFromQuery({ scope: 'local', domainId: 'congo', horizon: '50y', rScenario: 'nope' })
    expect(view.derivationParams).toEqual({
      scope: 'local',
      domainId: 'congo',
      horizon: '50y',
      rScenario: 'mid', // invalid → preset
      baseline: 1990,
    })
  })

  it('query getter mirrors derivationParams as strings', () => {
    const view = useViewStore()
    expect(view.query).toEqual({ scope: 'global', horizon: 'today', rScenario: 'mid', baseline: '1990' })
  })

  it('defaults the equivalence unit to car and keeps it out of derivationParams/query (ADR-025)', () => {
    const view = useViewStore()
    expect(view.unit).toBe('car')
    view.setUnit('country')
    expect(view.unit).toBe('country')
    // client-only view state: never in the cache-key / URL surface
    expect(view.derivationParams).not.toHaveProperty('unit')
    expect(view.query).not.toHaveProperty('unit')
  })
})

describe('useViewStore scene keying (deck, policy A)', () => {
  it('first entry seeds a scene from its authored params', () => {
    const view = useViewStore()
    view.enterScene('footprint', { params: { scope: 'local', domainId: 'congo', horizon: '50y' } })
    expect(view.currentScene).toBe('footprint')
    expect(view.derivationParams).toMatchObject({ scope: 'local', domainId: 'congo', horizon: '50y' })
  })

  it('applies immutable forced overrides on top of the seed', () => {
    const view = useViewStore()
    view.enterScene('crossing', {
      params: { scope: 'local', domainId: 'amazon' },
      forced: { scope: 'global', horizon: '100y' },
    })
    expect(view.scope).toBe('global')
    expect(view.horizon).toBe('100y')
  })

  it('restores a revisited scene rather than reseeding it (policy A)', () => {
    const view = useViewStore()
    view.enterScene('main', { params: { horizon: 'today' } })
    view.setHorizon('50y')
    view.setTimeRange([2000, 2010])

    view.enterScene('crossing', { forced: { scope: 'global', horizon: '100y' } })
    expect(view.horizon).toBe('100y')

    view.enterScene('main', { params: { horizon: 'today' } })
    // The user's edits are restored, NOT the authored seed.
    expect(view.horizon).toBe('50y')
    expect(view.timeRange).toEqual([2000, 2010])
  })

  it('re-entering the current scene only refreshes forced', () => {
    const view = useViewStore()
    view.enterScene('main', { params: { horizon: 'today' } })
    view.setHorizon('50y')
    view.enterScene('main', { forced: { horizon: '30y' } })
    expect(view.currentScene).toBe('main')
    expect(view.horizon).toBe('30y')
  })

  it('initSceneFromQuery hydrates from query with authored fallback + forced on top', () => {
    const view = useViewStore()
    view.initSceneFromQuery(
      'crossing',
      { horizon: '50y' },
      { params: { baseline: 2000 }, forced: { scope: 'global', horizon: '100y' } },
    )
    expect(view.currentScene).toBe('crossing')
    expect(view.scope).toBe('global') // forced
    expect(view.horizon).toBe('100y') // forced beats query
    expect(view.baseline).toBe(2000) // authored fallback (query absent)
    expect(view.timeRange).toBeNull()
  })
})
