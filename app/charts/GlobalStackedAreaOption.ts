import type { SeriesOption } from 'echarts'
import type { DomainId, GlobalResultDTO, GlobalDerived } from '#shared/types'
import { BaseChartOption } from './BaseChartOption'

// Congo's dedicated layer colour: a soft rose/pink, unique among the domain layers (green / grey-blue
// / teal) and distinct from the forgone-sink amber.
const CONGO_COLOR = '#fb7185'

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
    // it — the main-scene reveal on the global chart (§11.2).
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

    // Every domain layer gets an EXPLICIT colour so none is ever auto-assigned from the theme palette.
    // ECharts advances the palette only over series without an explicit colour, so leaving even one
    // domain to the palette would hand it the forgone-sink amber (which the forgone layer already owns
    // on top) — that is exactly the clash to avoid. The three non-Congo domains keep their original
    // palette colours (stock-green / fossil-grey / accent-teal); Congo takes its own violet.
    const domainColors: Record<DomainId, string> = {
      amazon: theme.data.stock,
      congo: CONGO_COLOR,
      seasia: theme.data.fossil,
      other_tropical: theme.accent,
    }
    const lastDomain = this.data.perDomainStock.length - 1
    const domainAreas: SeriesOption[] = this.data.perDomainStock.map((s, i) => {
      // Legend + tooltip must read the pretty, translated domain name — not the raw series id
      // (`stock:congo`). The id half after the colon is the DomainId, which is also the `domain.*`
      // i18n key. The name stays stable + unique per domain, so the cross-slide animation id mapping
      // is unaffected.
      const domainId = s.id.slice(s.id.indexOf(':') + 1) as DomainId
      return {
        name: t(`domain.${domainId}`),
        type: 'line',
        stack: 'stock',
        areaStyle: {},
        lineStyle: { opacity: 0 },
        symbol: 'none',
        showSymbol: false,
        emphasis: { focus: 'series' },
        // The explicit colour drives both the (invisible) line and the stacked area fill.
        itemStyle: { color: domainColors[domainId] },
        data: this.pairs(s),
        // when the forgone layer is hidden it can't carry the projection divider, so the top domain does.
        ...(!showForgone && i === lastDomain ? projectionMarks : {}),
      }
    })

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
}
