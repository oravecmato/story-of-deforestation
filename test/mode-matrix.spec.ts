// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import MultiplierBadge from '../app/components/shell/MultiplierBadge.vue'
import MagnitudePanels from '../app/components/shell/MagnitudePanels.vue'
import { useDataStore } from '../app/stores/data'
import { useViewStore } from '../app/stores/view'
import { deriveGlobal } from '../app/composables/useDerived'
import { paramsKey } from '../shared/config/derivation'
import type { GlobalResultDTO } from '../shared/types'
import { mkSeries } from './helpers/series'

// Critical-component mode-matrix tests (tech-spec §15, UI §8, ADR-019 — single accounting): the
// multiplier shows whenever it is present; the share/fossil panels are global-only while the
// crossing panel renders in both scopes. Nuxt auto-imports the components rely on (`useI18n`,
// `useNuxtApp`) are stubbed — `t` echoes its key so we can assert on which panels render.
vi.stubGlobal('useI18n', () => ({
  t: (k: string) => k,
  locale: { value: 'en' },
  setLocale: () => {},
}))
vi.stubGlobal('useNuxtApp', () => ({ $api: {} }))

const globalResult = (over: Partial<GlobalResultDTO> = {}): GlobalResultDTO =>
  ({ referenceYear: 2020, perDomainStock: [], ...over }) as unknown as GlobalResultDTO

describe('MultiplierBadge', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders ×N when the multiplier is derivable', () => {
    const view = useViewStore()
    view.scope = 'global'
    const data = useDataStore()
    // The multiplier is CLIENT-DERIVED from the baseline-independent DTO at the live baseline
    // (ADR-026) — so feed a real per-domain area + aggregate stock and assert the derived ×N shows.
    const dto = globalResult({
      params: view.derivationParams,
      referenceYear: 2020,
      perDomainArea: [
        mkSeries('area:amazon', [[2000, 1000], [2010, 900], [2020, 800]], {
          indicatorId: 'forestArea',
          unit: 'km2',
          seriesType: 'state',
          latestDataYear: 2020,
        }),
      ],
      aggregateStock: mkSeries('aggregateStock', [[2000, 100], [2010, 100], [2020, 100]], {
        indicatorId: 'deforestationStock',
        unit: 'Mt CO2',
        seriesType: 'flow',
        latestDataYear: 2020,
      }),
    })
    data.dtoCache.set(paramsKey('global', view.derivationParams), dto)
    const expected = deriveGlobal(dto, view.baseline).multiplier

    const w = mount(MultiplierBadge)
    expect(w.find('.multiplier').exists()).toBe(true)
    expect(w.text()).toContain('×' + expected.toFixed(1))
  })

  it('is hidden when no multiplier is available', () => {
    const view = useViewStore()
    view.scope = 'global'

    const w = mount(MultiplierBadge)
    expect(w.find('.multiplier').exists()).toBe(false)
  })
})

describe('MagnitudePanels (scope visibility)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const titles = (w: ReturnType<typeof mount>) =>
    w.findAll('.panel__title').map((n) => n.text())

  it('global → share, fossil and crossing panels', () => {
    const view = useViewStore()
    view.scope = 'global'
    const w = mount(MagnitudePanels)
    const t = titles(w)
    expect(t).toContain('panel.donut.title')
    expect(t).toContain('panel.fossil.title')
    expect(t).toContain('panel.crossing.title')
  })

  it('local → only the crossing panel', () => {
    const view = useViewStore()
    view.setScope('local')
    const w = mount(MagnitudePanels)
    expect(titles(w)).toEqual(['panel.crossing.title'])
  })
})
