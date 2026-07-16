import type { EChartsOption, SeriesOption } from 'echarts'
import type { DomainResultDTO } from '../../shared/types'
import { BaseChartOption } from './BaseChartOption'

// Local main chart (§11.2, §4.1): a stacked chart of one domain — measured stock (solid green,
// bottom layer) + the forgone sink stacked on top (dashed amber + CI band), so the total Y =
// stock + forgone sink. Each metric is a SINGLE continuous stacked-area fill (no measured/projected
// split → no gap, no stack double-count); when `horizon !== 'today'` the measured-vs-projected cue is
// carried by thin non-stacked top-edge lines (solid measured → dashed-lighter projected) plus a faded
// forecast-zone shade and a join-year divider from the last measured year onward (§2.4a, §11.1).
export class MainStackedOption extends BaseChartOption<DomainResultDTO> {
  protected override zoomable(): boolean {
    return true
  }

  protected buildSeries(): SeriesOption[] {
    const { theme, t } = this.ctx
    const stock = this.data.stock
    const forgone = this.data.forgoneSink
    const join = stock.meta.projectedFrom ?? forgone.meta.projectedFrom
    const endYear = stock.points.at(-1)?.year ?? forgone.points.at(-1)?.year ?? null

    const stockArea: SeriesOption = {
      name: t('series.stock'),
      type: 'line',
      stack: 'main',
      showSymbol: false,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      itemStyle: { color: theme.data.stock },
      areaStyle: { color: this.rgba(theme.data.stock, 0.5) },
      data: this.pairs(stock),
      ...(join != null
        ? {
            markLine: this.projectionDivider(join),
            ...(endYear != null ? { markArea: this.forecastZone(join, endYear) } : {}),
          }
        : {}),
    }
    const forgoneArea: SeriesOption = {
      name: t('series.forgoneSink'),
      type: 'line',
      stack: 'main',
      showSymbol: false,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      itemStyle: { color: theme.data.forgoneSink },
      areaStyle: { color: this.rgba(theme.data.forgoneSink, 0.35) },
      data: this.pairs(forgone),
    }

    // Top-edge lines at absolute cumulative height: stock's top = stock; forgone's top = stock + forgone.
    return [
      stockArea,
      forgoneArea,
      ...this.edgeLines(stock, stock.meta.projectedFrom, theme.data.stock, false, 'stock'),
      ...this.edgeLines(this.stackedTop(stock, forgone), forgone.meta.projectedFrom, theme.data.forgoneSink, true, 'forgone'),
      ...this.bandSeries(this.bandOnTop(stock, forgone)),
    ]
  }

  // Legend shows only the two measured metrics — projected twins (name-suffixed) and band helpers
  // (names prefixed '__') are omitted (§11.1).
  override build(): EChartsOption {
    return {
      ...super.build(),
      legend: {
        textStyle: { color: this.ctx.theme.text.mid },
        data: [this.ctx.t('series.stock'), this.ctx.t('series.forgoneSink')],
      },
    }
  }
}
