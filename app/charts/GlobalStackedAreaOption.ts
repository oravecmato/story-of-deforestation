import type { EChartsOption, SeriesOption } from 'echarts'
import type { GlobalResultDTO, GlobalDerived } from '../../shared/types'
import { BaseChartOption } from './BaseChartOption'

// Global main chart (§11.2, §4.2): per-domain stacked area + the aggregate forgone sink as one more
// stacked layer on top, so the total Y = Σ domain stocks + forgone sink. Each layer is a SINGLE
// continuous stacked-area fill into 'stock' (no measured/projected split → no gap, no double-count);
// the forgone sink stacks LAST so it stays on top. The measured-vs-projected cue is a faded
// forecast-zone shade + join-year divider (from the last measured year) + the forgone's own
// dashed-lighter top-edge line; the aggregate CI band hugs the upper edge (business §3, §5, §2.4a).
export class GlobalStackedAreaOption extends BaseChartOption<GlobalResultDTO & GlobalDerived> {
  protected buildSeries(): SeriesOption[] {
    const { theme, t } = this.ctx
    const forgone = this.data.aggregateForgoneSink
    const stock = this.data.aggregateStock
    // The forgone sink (extra stacked layer + band) appears only when the slide's metric set includes
    // it — the main-scene reveal on the global chart, mirroring MainStackedOption (§11.2).
    const showForgone = this.has('forgoneSink')
    const stockJoin = this.data.perDomainStock[0]?.meta.projectedFrom ?? null
    const join = stockJoin ?? (showForgone ? forgone.meta.projectedFrom : null) ?? null
    const endYear =
      this.data.perDomainStock[0]?.points.at(-1)?.year ?? forgone.points.at(-1)?.year ?? null
    const projectionMarks =
      join != null
        ? {
            markLine: this.projectionDivider(join),
            ...(endYear != null ? { markArea: this.forecastZone(join, endYear) } : {}),
          }
        : {}

    const lastDomain = this.data.perDomainStock.length - 1
    const domainAreas: SeriesOption[] = this.data.perDomainStock.map((s, i) => ({
      name: s.id,
      type: 'line',
      stack: 'stock',
      areaStyle: {},
      lineStyle: { opacity: 0 },
      symbol: 'none',
      showSymbol: false,
      emphasis: { focus: 'series' },
      data: this.pairs(s),
      // when the forgone layer is hidden it can't carry the projection divider, so the top domain does.
      ...(!showForgone && i === lastDomain ? projectionMarks : {}),
    }))

    if (!showForgone) {
      // Stock-only: the stack's top surface is Σ domain stocks; a solid measured top-edge traces it.
      const stockTop = this.stackedTop(...this.data.perDomainStock)
      return [...domainAreas, ...this.edgeLines(stockTop, stockJoin, theme.data.stock, false, 'total')]
    }

    const forgoneArea: SeriesOption = {
      name: t('series.forgoneSink'),
      type: 'line',
      stack: 'stock',
      showSymbol: false,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      itemStyle: { color: theme.data.forgoneSink },
      areaStyle: { color: this.rgba(theme.data.forgoneSink, 0.35) },
      data: this.pairs(forgone),
      ...projectionMarks,
    }

    // The whole stack's top surface is the forgone-sink top (Σ domain stocks + forgone). Its own
    // dashed-lighter top-edge line keeps the forgone's estimate identity across the projection join.
    const total = this.stackedTop(...this.data.perDomainStock, forgone)

    return [
      ...domainAreas,
      forgoneArea,
      ...this.edgeLines(total, forgone.meta.projectedFrom ?? join, theme.data.forgoneSink, true, 'total'),
      ...this.bandSeries(this.bandOnTop(stock, forgone)),
    ]
  }

  // Legend shows the per-domain layers + (when present) the forgone sink; projected twins
  // (name-suffixed) and band helpers (names prefixed '__') are omitted (§11.1).
  override build(): EChartsOption {
    const data = [...this.data.perDomainStock.map((s) => s.id)]
    if (this.has('forgoneSink')) data.push(this.ctx.t('series.forgoneSink'))
    return {
      ...super.build(),
      legend: { textStyle: { color: this.ctx.theme.text.mid }, data },
    }
  }
}
