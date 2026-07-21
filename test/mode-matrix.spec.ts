// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import MultiplierBadge from '../app/components/shell/MultiplierBadge.vue'
import { useViewStore } from '../app/stores/view'

// Multiplier mode-matrix tests (tech-spec §15, UI §8, ADR-019 — single accounting): the badge renders
// the ×N the Widget seam resolves (ADR-027) — nothing when the multiplier is absent (official mode / no
// data). Its forward-window caption is the Pinia-aware `WindowLabel`, so the badge now reads the live
// horizon from the store (point 5). Nuxt's auto-imported `useI18n` is stubbed so `t` echoes its key.
vi.stubGlobal('useI18n', () => ({ t: (k: string) => k, locale: { value: 'en' } }))
beforeEach(() => setActivePinia(createPinia()))

describe('MultiplierBadge (dumb leaf)', () => {
  it('renders ×N with a window-range caption for a multi-year horizon', () => {
    useViewStore().setHorizon('100y')
    const w = mount(MultiplierBadge, { props: { value: 3.2 } })
    expect(w.find('.multiplier').exists()).toBe(true)
    expect(w.text()).toContain('×3.2')
    expect(w.text()).toContain('window.range')
  })

  it('collapses to the single-year caption at the today horizon', () => {
    // default horizon is `today` → the window is a single anchor year
    const w = mount(MultiplierBadge, { props: { value: 1.2 } })
    expect(w.text()).toContain('×1.2')
    expect(w.text()).toContain('window.single')
    expect(w.text()).not.toContain('window.range')
  })

  it('renders nothing when the multiplier is absent', () => {
    const w = mount(MultiplierBadge, { props: { value: null } })
    expect(w.find('.multiplier').exists()).toBe(false)
  })
})
