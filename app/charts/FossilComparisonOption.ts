import type { EChartsOption, SeriesOption } from 'echarts'
import type { GlobalResultDTO, ReferenceDTO } from '../../shared/types'
import { BaseChartOption } from './BaseChartOption'

export interface FossilComparisonData {
  reference: ReferenceDTO
  main: GlobalResultDTO
}

// Fossil comparison (§11.2, global only): two side-by-side total bars — deforestation emissions
// (stock + forgone sink) vs global fossil emissions — on a SHARED Y scale (identical max + tick
// interval) so the two panels are visually comparable, overriding ECharts' per-axis auto-scale.
// Both totals are read at the composite referenceYear (ADR-016).
export class FossilComparisonOption extends BaseChartOption<FossilComparisonData> {
  private totals(): { deforestation: number; fossil: number } {
    const { main, reference } = this.data
    const refYear = main.referenceYear
    const deforestation = this.valueAt(main.aggregateFullEmissions, refYear)
    return { deforestation, fossil: this.valueAt(reference.fossilTotal, refYear) }
  }

  protected buildSeries(): SeriesOption[] {
    const { theme } = this.ctx
    const { deforestation, fossil } = this.totals()
    const defoColor = theme.data.forgoneSink
    return [
      { type: 'bar', xAxisIndex: 0, yAxisIndex: 0, barWidth: '55%', itemStyle: { color: defoColor }, data: [deforestation] },
      { type: 'bar', xAxisIndex: 1, yAxisIndex: 1, barWidth: '55%', itemStyle: { color: theme.data.fossil }, data: [fossil] },
    ]
  }

  override build(): EChartsOption {
    const { theme, t } = this.ctx
    const { deforestation, fossil } = this.totals()
    const { max, interval } = this.sharedYAxis([deforestation], [fossil])
    const yAxis = {
      type: 'value' as const,
      max,
      interval,
      axisLabel: { color: theme.text.mid },
      splitLine: { lineStyle: { color: theme.border } },
    }
    const xAxis = (label: string, gridIndex: number) => ({
      type: 'category' as const,
      gridIndex,
      data: [label],
      axisLine: { lineStyle: { color: theme.border } },
      axisLabel: { color: theme.text.mid },
    })
    return {
      color: this.themeColors(),
      backgroundColor: 'transparent',
      textStyle: { color: theme.text.mid },
      grid: [
        { left: '6%', right: '54%', top: 32, bottom: 40, containLabel: true },
        { left: '54%', right: '6%', top: 32, bottom: 40, containLabel: true },
      ],
      xAxis: [xAxis(t('fossil.deforestation'), 0), xAxis(t('fossil.fossil'), 1)],
      yAxis: [{ ...yAxis, gridIndex: 0 }, { ...yAxis, gridIndex: 1 }],
      tooltip: { trigger: 'item', backgroundColor: theme.surface2, borderColor: theme.border, textStyle: { color: theme.text.hi } },
      series: this.buildSeries(),
    }
  }
}
