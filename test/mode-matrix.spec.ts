// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiplierBadge from '../app/components/shell/MultiplierBadge.vue'

// Multiplier mode-matrix tests (tech-spec §15, UI §8, ADR-019 — single accounting): the dumb badge
// renders whatever the Widget seam resolves (ADR-027) — the ×N in full mode, nothing when the
// multiplier is absent (official mode / no data). Nuxt's auto-imported `useI18n` is stubbed so `t`
// echoes its key and we can assert on the caption text.
vi.stubGlobal('useI18n', () => ({ t: (k: string) => k, locale: { value: 'en' } }))

describe('MultiplierBadge (dumb leaf)', () => {
  it('renders ×N with a window caption', () => {
    const w = mount(MultiplierBadge, { props: { value: 3.2, window: { from: 2020, to: 2040 } } })
    expect(w.find('.multiplier').exists()).toBe(true)
    expect(w.text()).toContain('×3.2')
    expect(w.text()).toContain('multiplier.captionWindow')
  })

  it('collapses to the single-year caption when the window is a point', () => {
    const w = mount(MultiplierBadge, { props: { value: 1.2, window: { from: 2020, to: 2020 } } })
    expect(w.text()).toContain('×1.2')
    expect(w.text()).toContain('multiplier.caption')
    expect(w.text()).not.toContain('multiplier.captionWindow')
  })

  it('renders nothing when the multiplier is absent', () => {
    const w = mount(MultiplierBadge, { props: { value: null, window: null } })
    expect(w.find('.multiplier').exists()).toBe(false)
  })
})
