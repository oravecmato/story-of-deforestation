import type { EChartsOption, SeriesOption } from 'echarts'
import type { GlobalResultDTO, GlobalDerived, ReferenceDTO } from '../../shared/types'
import { sceneWindow } from '../../shared/config/derivation'
import { BaseChartOption } from './BaseChartOption'

export interface FootprintDonutData {
  reference: ReferenceDTO
  main: GlobalResultDTO & GlobalDerived
}

// Footprint composition donut (§11.2): fossil, stock and the forgone sink slices. Each slice is the
// TRUE finite integral over the forward window `[referenceYear, referenceYear + horizonYears(horizon)]`
// (§17.4, ADR-025) — the same basis as the equivalence strip and the fossil bar: all three metrics are
// summed over the one window (business §2.4 quantity #2), so the forgone sink is a genuine Σ of its
// annual rate, not rate × years. Slide 5 shows all three; slide 6 drops `fossil` from the metric set →
// the donut animates to the two deforestation slices (stock + forgone sink) and rescales.
export class FootprintDonutOption extends BaseChartOption<FootprintDonutData> {
  protected buildSeries(): SeriesOption[] {
    const { theme, t } = this.ctx
    const { reference, main } = this.data
    const { from, to } = sceneWindow(main.referenceYear, this.ctx.horizon)
    const c = {
      fossil: this.sumWindow(reference.fossilTotal, from, to),
      stock: this.sumWindow(main.aggregateStock, from, to),
      forgoneSink: this.sumWindow(main.aggregateForgoneSink, from, to),
    }
    const slices = [
      { metric: 'fossil', name: t('series.fossil'), value: c.fossil, itemStyle: { color: theme.data.fossil } },
      { metric: 'stock', name: t('series.stock'), value: c.stock, itemStyle: { color: theme.data.stock } },
      { metric: 'forgoneSink', name: t('series.forgoneSink'), value: c.forgoneSink, itemStyle: { color: theme.data.forgoneSink } },
    ]
      .filter((s) => this.has(s.metric))
      .map(({ metric: _metric, ...slice }) => slice)
    return [
      {
        type: 'pie',
        radius: ['55%', '75%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: theme.surface1, borderWidth: 2 },
        label: { color: theme.text.mid },
        data: slices,
      },
    ]
  }

  // A donut has no cartesian grid/axes; keep only the palette + tooltip/legend chrome.
  override build(): EChartsOption {
    const { theme } = this.ctx
    return {
      color: this.themeColors(),
      backgroundColor: 'transparent',
      textStyle: { color: theme.text.mid },
      tooltip: { trigger: 'item', backgroundColor: theme.surface2, borderColor: theme.border, textStyle: { color: theme.text.hi } },
      legend: { bottom: 0, textStyle: { color: theme.text.mid } },
      series: this.buildSeries(),
    }
  }
}
