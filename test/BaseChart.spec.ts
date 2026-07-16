// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { EChartsOption } from 'echarts'
import BaseChart from '../app/components/charts/BaseChart.vue'

// Light tier-1 smoke test: the dumb wrapper renders <VChart> inside <ClientOnly> and forwards the
// option + loading. VChart (nuxt-echarts) and ClientOnly (Nuxt) are stubbed since there is no Nuxt
// runtime here. The real chart logic lives in the pure option classes (test/charts.spec.ts).
const stubs = {
  ClientOnly: { template: '<div class="client-only"><slot /></div>' },
  VChart: {
    props: ['option', 'loading'],
    template: '<div class="vchart" :data-loading="String(loading)" :data-series="option.series.length" />',
  },
}

const option: EChartsOption = { series: [{ type: 'line', data: [] }] }

describe('BaseChart.vue', () => {
  it('renders VChart inside ClientOnly and forwards the option', () => {
    const wrapper = mount(BaseChart, { props: { option }, global: { stubs } })
    const vchart = wrapper.find('.vchart')
    expect(vchart.exists()).toBe(true)
    expect(vchart.attributes('data-series')).toBe('1')
    expect(vchart.attributes('data-loading')).toBe('false')
  })

  it('forwards the loading flag', () => {
    const wrapper = mount(BaseChart, { props: { option, loading: true }, global: { stubs } })
    expect(wrapper.find('.vchart').attributes('data-loading')).toBe('true')
  })
})
