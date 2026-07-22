import type { EChartsOption, SeriesOption } from 'echarts'
import { BaseChartOption } from './BaseChartOption'

// Illustrative gross-flux bar (slide 8, business §7.2 / §2.4). A purely EDITORIAL diagram — the values
// are hardcoded, not fetched — that shows why the sink rate R is a NET quantity: a forest both absorbs
// CO₂ (photosynthesis, the living biomass) and releases it (respiration/decay of dead wood), and the R
// we count is the GROSS FLUX = absorbed − released. Two categories share one Y-axis: the "absorbed"
// bar is a stack of the released-equivalent base (same colour as the release bar) topped by the net
// sink (amber), so the amber cap reads as exactly the difference between the two bars = the forgone
// sink we integrate. The "released" bar is the base amount alone. No presentation transform, no DTO.
export interface FluxBarData {
  /** Gross CO₂ the forest sequesters (the taller bar). */
  absorbed: number
  /** CO₂ the forest returns to the atmosphere (the shorter bar). */
  released: number
}

export class FluxBarOption extends BaseChartOption<FluxBarData> {
  private net(): number {
    return Math.max(0, this.data.absorbed - this.data.released)
  }

  protected buildSeries(): SeriesOption[] {
    const { theme, t } = this.ctx
    const { released } = this.data
    const bar = { type: 'bar' as const, barWidth: '48%' as const }
    // Category 0 = Absorbed (stacked: released-equivalent base + net-sink cap); category 1 = Released
    // (the base amount only). Same 'released' colour in both so the amber cap on category 0 visually IS
    // the gap between the two bars.
    return [
      {
        ...bar,
        name: t('flux.released'),
        stack: 'flux',
        itemStyle: { color: theme.data.fossil },
        data: [released, released],
      },
      {
        ...bar,
        name: t('flux.net'),
        stack: 'flux',
        itemStyle: { color: theme.data.forgoneSink },
        data: [this.net(), null],
      },
    ]
  }

  override build(): EChartsOption {
    const { theme, t } = this.ctx
    const { max, interval } = this.sharedYAxis([this.data.absorbed])
    const { legendTop, gridTop } = this.legendReserve(2)
    return {
      color: this.themeColors(),
      backgroundColor: 'transparent',
      textStyle: { color: theme.text.mid },
      grid: { left: 24, right: 24, top: Math.max(32, gridTop), bottom: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: [t('flux.absorbed'), t('flux.released')],
        axisLine: { lineStyle: { color: theme.border } },
        axisLabel: { color: theme.text.mid },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        max,
        interval,
        axisLine: { show: false },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: theme.border } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: theme.surface2,
        borderColor: theme.border,
        textStyle: { color: theme.text.hi },
        formatter: this.axisTooltipFormatter(),
      },
      legend: {
        textStyle: { color: theme.text.mid },
        data: [t('flux.released'), t('flux.net')],
        ...(legendTop != null ? { top: legendTop, left: 'center' } : {}),
      },
      series: this.buildSeries(),
    }
  }
}
