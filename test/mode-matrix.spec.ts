// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import MultiplierBadge from '../app/components/shell/MultiplierBadge.vue'
import MagnitudePanels from '../app/components/shell/MagnitudePanels.vue'
import { useDataStore } from '../app/stores/data'
import { useViewStore } from '../app/stores/view'
import { paramsKey } from '../shared/config/derivation'
import type { GlobalResultDTO } from '../shared/types'

// Critical-component mode-matrix tests (tech-spec §15, UI §8, ADR-019 — single accounting): the
// multiplier shows whenever it is present; the share/ranking/fossil panels are global-only while the
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

  it('renders ×N when the multiplier is present', () => {
    const view = useViewStore()
    view.scope = 'global'
    const data = useDataStore()
    data.dtoCache.set(paramsKey('global', view.derivationParams), globalResult({ multiplier: 3.2 }))

    const w = mount(MultiplierBadge)
    expect(w.find('.multiplier').exists()).toBe(true)
    expect(w.text()).toContain('×3.2')
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

  it('global → share, ranking, fossil and crossing panels', () => {
    const view = useViewStore()
    view.scope = 'global'
    const w = mount(MagnitudePanels)
    const t = titles(w)
    expect(t).toContain('panel.donut.title')
    expect(t).toContain('panel.ranking.title')
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
