import type { EChartsOption, SeriesOption } from 'echarts'
import { BaseChartOption } from './BaseChartOption'

// Illustrative gross-flux bar (slide 8, business §7.2 / §2.4). A purely EDITORIAL diagram — the values
// are hardcoded, not fetched — that shows why the sink rate R is a NET quantity: a forest both absorbs
// CO₂ (photosynthesis, the living biomass) and releases it (respiration/decay of dead wood), and the R
// we count is the GROSS FLUX = absorbed − released.
//
// The reading (design chosen with the user): the "absorbed" bar is a stack whose lower part — a
// HATCHED grey base of height `released` — is the share of absorption that decay cancels out, and whose
// upper part — a solid amber cap of height `net` — is the net sink R that actually survives. The
// standalone "released" bar is that same grey at solid fill; it sits at exactly the height of the
// hatched base beside it, so the eye ties the two together ("this hatched chunk is what gets released")
// and the amber cap reads as precisely the difference between the two bars = the forgone sink we
// integrate. Legend names the two TEXTURES on the absorbed bar (hatch = cancelled by decay, amber = net
// R); it no longer collides with the axis' bar labels (absorbed / released). No presentation transform,
// no DTO.
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
    // A diagonal line hatch carved into the grey with the dark background colour, so the base reads as
    // "subtracted / offset" against the solid release bar next to it. dashArrayX solid in X + a gapped
    // dashArrayY, rotated 45°, gives evenly spaced diagonal stripes.
    const hatch = {
      color: this.rgba(theme.bg, 0.55),
      dashArrayX: [1, 0] as [number, number],
      dashArrayY: [3, 5] as [number, number],
      rotation: -Math.PI / 4,
    }
    // Category 0 = Absorbed (hatched-grey base + amber cap); category 1 = Released (solid grey, its own
    // series so the standalone bar stays UN-hatched while the base above carries the decal).
    return [
      {
        ...bar,
        name: t('flux.offset'),
        stack: 'flux',
        itemStyle: { color: theme.data.fossil, decal: hatch },
        data: [released, null],
      },
      {
        ...bar,
        name: t('flux.net'),
        stack: 'flux',
        itemStyle: { color: theme.data.forgoneSink },
        data: [this.net(), null],
      },
      {
        ...bar,
        name: t('flux.released'),
        stack: 'flux',
        itemStyle: { color: theme.data.fossil },
        data: [null, released],
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
      // Legend names the two textures that make up the absorbed bar; the standalone grey release bar is
      // left off (its axis label already says "CO₂ released" and it matches the hatched base's colour).
      legend: {
        textStyle: { color: theme.text.mid },
        data: [t('flux.offset'), t('flux.net')],
        ...(legendTop != null ? { top: legendTop, left: 'center' } : {}),
      },
      series: this.buildSeries(),
    }
  }
}
