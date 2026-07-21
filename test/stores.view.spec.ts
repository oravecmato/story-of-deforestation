import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useViewStore } from '../app/stores/view'
import { PRESET_PARAMS } from '../shared/config/derivation'

beforeEach(() => setActivePinia(createPinia()))

describe('useViewStore', () => {
  it('opens on the preset', () => {
    const view = useViewStore()
    expect(view.derivationParams).toEqual(PRESET_PARAMS)
  })

  it('initFromQuery is lenient: preset fallback for invalid, parse for valid', () => {
    const view = useViewStore()
    view.initFromQuery({ horizon: '50y', rScenario: 'nope' })
    expect(view.derivationParams).toEqual({
      horizon: '50y',
      rScenario: 'mid', // invalid → preset
    })
  })

  it('query getter mirrors derivationParams as strings plus the client-transforms baseline+rMultiplier (ADR-026)', () => {
    const view = useViewStore()
    expect(view.query).toEqual({
      horizon: 'today',
      rScenario: 'mid',
      baseline: '1990',
      rMultiplier: '1',
    })
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
    view.enterScene('footprint', { params: { horizon: '50y' } })
    expect(view.currentScene).toBe('footprint')
    expect(view.derivationParams).toMatchObject({ horizon: '50y' })
  })

  it('applies immutable forced overrides on top of the seed', () => {
    const view = useViewStore()
    view.enterScene('crossing', {
      params: { horizon: 'today' },
      forced: { horizon: '100y' },
    })
    expect(view.horizon).toBe('100y')
  })

  it('restores a revisited scene rather than reseeding it (policy A)', () => {
    const view = useViewStore()
    view.enterScene('main', { params: { horizon: 'today' } })
    view.setHorizon('50y')

    view.enterScene('crossing', { forced: { horizon: '100y' } })
    expect(view.horizon).toBe('100y')

    view.enterScene('main', { params: { horizon: 'today' } })
    // The user's edits are restored, NOT the authored seed.
    expect(view.horizon).toBe('50y')
  })

  it('snapshots+restores the client-only rMultiplier per scene (slide 10, seeds 1× elsewhere)', () => {
    const view = useViewStore()
    view.enterScene('amplified', { params: { horizon: '100y' } })
    view.setRMultiplier(6)
    expect(view.rMultiplier).toBe(6)
    // leaving the scene seeds a fresh 1× (the measured rate) on first entry elsewhere
    view.enterScene('main', { params: { horizon: 'today' } })
    expect(view.rMultiplier).toBe(1)
    // returning restores the 6× the user set (policy A)
    view.enterScene('amplified', {})
    expect(view.rMultiplier).toBe(6)
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
      { baseline: 2000, forced: { horizon: '100y' } },
    )
    expect(view.currentScene).toBe('crossing')
    expect(view.horizon).toBe('100y') // forced beats query
    expect(view.baseline).toBe(2000) // authored fallback (query absent)
  })
})
