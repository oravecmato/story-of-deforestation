// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, onMounted, onUnmounted } from 'vue'
import { mount } from '@vue/test-utils'
import DeckNav from '../app/components/deck/DeckNav.vue'
import SlideLayout from '../app/components/deck/SlideLayout.vue'
import { SLUGS, FIRST_SLUG, nextSlug, prevSlug } from '../app/story/slides'

// Deck navigation components (tech-spec §17.2). Nuxt's auto-imported `useI18n` is stubbed (t echoes its
// key). DeckNav is now two edge-arrow ghost lanes (plain <button>s + inline SVG chevrons), each present
// only when a slide exists in that direction — no PrimeVue, no progress dots.
vi.stubGlobal('useI18n', () => ({ t: (k: string) => k, locale: { value: 'en' } }))

describe('DeckNav (edge arrow lanes)', () => {
  const mountAt = (slug: string) => mount(DeckNav, { props: { slug } })

  it('renders only the Next lane on the first slide', () => {
    const w = mountAt(FIRST_SLUG)
    expect(w.find('.deck-nav__lane--prev').exists()).toBe(false)
    expect(w.find('.deck-nav__lane--next').exists()).toBe(true)
  })

  it('renders only the Back lane on the last slide', () => {
    const last = SLUGS[SLUGS.length - 1] as string
    const w = mountAt(last)
    expect(w.find('.deck-nav__lane--prev').exists()).toBe(true)
    expect(w.find('.deck-nav__lane--next').exists()).toBe(false)
  })

  it('renders both lanes on a middle slide', () => {
    const w = mountAt('main')
    expect(w.find('.deck-nav__lane--prev').exists()).toBe(true)
    expect(w.find('.deck-nav__lane--next').exists()).toBe(true)
  })

  it('emits navigate to the next slug on the Next lane click', async () => {
    const w = mountAt('main')
    await w.find('.deck-nav__lane--next').trigger('click')
    expect(w.emitted('navigate')?.[0]).toEqual([nextSlug('main')])
  })

  it('emits navigate to the previous slug on ArrowLeft', async () => {
    const w = mountAt('main')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await w.vm.$nextTick()
    expect(w.emitted('navigate')?.[0]).toEqual([prevSlug('main')])
    w.unmount()
  })

  it('ignores ArrowRight at the deck end (no navigate)', async () => {
    const last = SLUGS[SLUGS.length - 1] as string
    const w = mountAt(last)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await w.vm.$nextTick()
    expect(w.emitted('navigate')).toBeUndefined()
    w.unmount()
  })
})

describe('SlideLayout — chart identity across grid change (ADR-022/027)', () => {
  // The binding contract: the geometry-only shell swaps a slide's grid via CSS custom properties on ONE
  // <section> (no structural v-if fork), so a keyed <VChart> in its default slot survives the 5→6
  // duo-viz-text → duo-viz-equiv change and ECharts animates via setOption instead of remounting.
  it('does not remount the keyed slot child when the grid flips 5→6', async () => {
    let mounts = 0
    let unmounts = 0
    const VizStub = defineComponent({
      setup() {
        onMounted(() => {
          mounts++
        })
        onUnmounted(() => {
          unmounts++
        })
        return () => h('div', { class: 'viz-stub' }, 'chart')
      },
    })

    const w = mount(SlideLayout, {
      props: { grid: 'duo-viz-text' as const },
      slots: { default: () => h(VizStub, { key: 'donut' }) },
    })

    expect(mounts).toBe(1)
    expect(w.find('.viz-stub').exists()).toBe(true)

    await w.setProps({ grid: 'duo-viz-equiv' as const })

    // Same keyed instance — mounted once, never torn down across the grid flip.
    expect(mounts).toBe(1)
    expect(unmounts).toBe(0)
    expect(w.find('.viz-stub').exists()).toBe(true)
    w.unmount()
  })
})
