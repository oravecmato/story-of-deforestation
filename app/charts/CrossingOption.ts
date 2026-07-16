import type { SeriesOption } from 'echarts'
import type { Series, BandSeries } from '../../shared/types'
import { BaseChartOption, PROJECTED_OPACITY, PROJECTED_SUFFIX } from './BaseChartOption'

/** The crossing chart's minimal input — the measured stock curve, the forgone-sink band, and the
 *  crossing year. Both scopes map onto it: local uses the domain's own `stock`/`forgoneSink`, global
 *  its `aggregateStock`/`aggregateForgoneSink`, so this option is scope-agnostic. */
export interface CrossingInput {
  stock: Series
  forgoneSink: BandSeries
  crossingYear: number | null
}

// Crossing chart (§11.2): the annual stock impulse vs the cumulative forgone-sink level, with the
// crossing year marked (the moment the hidden cost overtakes the reported number — semantics
// unchanged, business §4.3). A vertical accent guide (markLine) sits on the stock series and a dot
// (markPoint) on the forgone-sink series. The extended horizon range is what finally gives the chart
// enough span to reach the crossing; the projected tail of each curve renders dashed-lighter (§11.1).
export class CrossingOption extends BaseChartOption<CrossingInput> {
  protected buildSeries(): SeriesOption[] {
    const { theme, t } = this.ctx
    const crossingYear = this.data.crossingYear
    const join = this.data.stock.meta.projectedFrom ?? this.data.forgoneSink.meta.projectedFrom

    const stockSplit = this.splitAtProjection(this.data.stock)
    const forgoneSplit = this.splitAtProjection(this.data.forgoneSink)

    const stock: SeriesOption = {
      name: t('series.stock'),
      type: 'line',
      showSymbol: false,
      lineStyle: { color: theme.data.stock },
      itemStyle: { color: theme.data.stock },
      data: this.pairs(stockSplit.measured),
    }
    const markLineData: Array<{ xAxis: number }> = []
    if (crossingYear != null) markLineData.push({ xAxis: this.toMs(crossingYear) })
    if (join != null) markLineData.push({ xAxis: this.toMs(join) })
    if (markLineData.length > 0) {
      stock.markLine = {
        symbol: 'none',
        silent: true,
        lineStyle: { color: theme.accent },
        data: markLineData,
      }
    }

    const forgone: SeriesOption = {
      name: t('series.forgoneSink'),
      type: 'line',
      showSymbol: false,
      ...this.estimateStyle(),
      lineStyle: { ...this.estimateStyle().lineStyle, color: theme.data.forgoneSink },
      itemStyle: { color: theme.data.forgoneSink },
      data: this.pairs(forgoneSplit.measured),
      markPoint:
        crossingYear != null
          ? {
              symbolSize: 10,
              itemStyle: { color: theme.accent },
              data: [
                {
                  name: t('chart.crossing.point'),
                  coord: [this.toMs(crossingYear), this.valueAt(this.data.forgoneSink, crossingYear)],
                },
              ],
            }
          : undefined,
    }

    const series: SeriesOption[] = [stock, forgone]
    if (stockSplit.projected) {
      series.push({
        name: t('series.stock') + PROJECTED_SUFFIX,
        type: 'line',
        showSymbol: false,
        lineStyle: { color: theme.data.stock, type: 'dashed', opacity: PROJECTED_OPACITY },
        itemStyle: { color: theme.data.stock },
        data: this.pairs(stockSplit.projected),
      })
    }
    if (forgoneSplit.projected) {
      series.push({
        name: t('series.forgoneSink') + PROJECTED_SUFFIX,
        type: 'line',
        showSymbol: false,
        lineStyle: { type: 'dashed', color: theme.data.forgoneSink, opacity: PROJECTED_OPACITY },
        itemStyle: { color: theme.data.forgoneSink },
        data: this.pairs(forgoneSplit.projected),
      })
    }
    return series
  }
}
