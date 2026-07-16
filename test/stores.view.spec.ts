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
})
