import type { EChartsOption, SeriesOption } from 'echarts'
import type { GlobalResultDTO, GlobalDerived, ReferenceDTO } from '#shared/types'
import { sceneWindow } from '#shared/config/derivation'
import { BaseChartOption } from './BaseChartOption'

export interface FossilComparisonData {
  reference: ReferenceDTO
  main: GlobalResultDTO & GlobalDerived
}

// Fossil comparison (§11.2, global only): ONE grid, TWO categories on a single shared Y-axis
// (ADR-024), restructured from the old two-grid design so slide 6 can animate. The deforestation
// category is a stacked bar (official stock + forgone sink); fossil is its own bar. Slide 5 shows
// both categories (metrics include 'fossil'); slide 6 drops 'fossil' → the fossil bar leaves, only
// the deforestation category remains and the single Y-axis rescales to its range ("zoom in", UI §6.3).
// All three magnitudes are the TRUE finite integral over the forward window `[referenceYear,
// referenceYear + horizonYears(horizon)]` (§17.4, ADR-025) — so the bar reads the same basis as the
// equivalence strip and the donut: stock, forgone and fossil are each a genuine Σ over the one window
// (business §2.4 quantity #2), the forgone sink included (not rate × years).
export class FossilComparisonOption extends BaseChartOption<FossilComparisonData> {
  private totals(): { stock: number; forgone: number; fossil: number } {
    const { main, reference } = this.data
    const { from, to } = sceneWindow(main.referenceYear, this.ctx.horizon)
    return {
      stock: this.sumWindow(main.aggregateStock, from, to),
      forgone: this.sumWindow(main.aggregateForgoneSink, from, to),
      fossil: this.sumWindow(reference.fossilTotal, from, to),
    }
  }

  protected buildSeries(): SeriesOption[] {
    const { theme, t } = this.ctx
    const { stock, forgone, fossil } = this.totals()
    const showFossil = this.has('fossil')
    // Category order: deforestation (index 0) always; fossil (index 1) only while in the metric set.
    // Each series' data is aligned to the visible categories; the deforestation stack nulls the
    // fossil slot and vice-versa.
    const bar = { type: 'bar' as const, barWidth: '45%' as const }
    const series: SeriesOption[] = [
      { ...bar, name: t('series.stock'), stack: 'defo', itemStyle: { color: theme.data.stock }, data: showFossil ? [stock, null] : [stock] },
      { ...bar, name: t('series.forgoneSink'), stack: 'defo', itemStyle: { color: theme.data.forgoneSink }, data: showFossil ? [forgone, null] : [forgone] },
    ]
    if (showFossil) {
      series.push({ ...bar, name: t('series.fossil'), itemStyle: { color: theme.data.fossil }, data: [null, fossil] })
    }
    return series
  }

  override build(): EChartsOption {
    const { theme, t } = this.ctx
    const { stock, forgone, fossil } = this.totals()
    const showFossil = this.has('fossil')
    const deforestation = stock + forgone
    const categories = showFossil
      ? [t('fossil.deforestation'), t('fossil.fossil')]
      : [t('fossil.deforestation')]
    // The single Y-axis is "nice"-scaled over the VISIBLE category totals — removing fossil recomputes
    // it to the deforestation range (the animated rescale).
    const { max, interval } = showFossil
      ? this.sharedYAxis([deforestation], [fossil])
      : this.sharedYAxis([deforestation])
    const legendData = [t('series.stock'), t('series.forgoneSink')]
    if (showFossil) legendData.push(t('series.fossil'))
    const { legendTop, gridTop } = this.legendReserve(legendData.length)
    return {
      color: this.themeColors(),
      backgroundColor: 'transparent',
      textStyle: { color: theme.text.mid },
      grid: { left: 48, right: 24, top: Math.max(32, gridTop), bottom: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: theme.border } },
        axisLabel: { color: theme.text.mid },
      },
      yAxis: {
        type: 'value',
        max,
        interval,
        axisLine: { show: false },
        axisLabel: { color: theme.text.mid },
        splitLine: { lineStyle: { color: theme.border } },
      },
      tooltip: { trigger: 'axis', backgroundColor: theme.surface2, borderColor: theme.border, textStyle: { color: theme.text.hi }, formatter: this.axisTooltipFormatter() },
      legend: {
        textStyle: { color: theme.text.mid },
        data: legendData,
        ...(legendTop != null ? { top: legendTop, left: 'center' } : {}),
      },
      series: this.buildSeries(),
    }
  }
}
