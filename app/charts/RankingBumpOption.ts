import type { EChartsOption, SeriesOption } from 'echarts'
import type { RankingDTO } from '../../shared/types'
import { BaseChartOption } from './BaseChartOption'

// Ranking bump chart (§11.2, ADR-019): today vs at-horizon domain ranks side by side; each domain is
// a line connecting its two ranks, so the projection reshuffle (per-domain R differences compounding
// over the horizon) is legible at a glance. The Y axis is inverted (rank 1 at the top).
export class RankingBumpOption extends BaseChartOption<RankingDTO> {
  protected buildSeries(): SeriesOption[] {
    const { t } = this.ctx
    const horizonRank = new Map(this.data.atHorizon.map((e) => [e.domainId, e.rank]))
    return this.data.today.map((e) => ({
      name: t(`domain.${e.domainId}`),
      type: 'line',
      symbol: 'circle',
      symbolSize: 10,
      lineStyle: { width: 3 },
      data: [
        [0, e.rank],
        [1, horizonRank.get(e.domainId) ?? e.rank],
      ],
    }))
  }

  override build(): EChartsOption {
    const base = super.build()
    const { theme, t } = this.ctx
    const count = this.data.today.length
    return {
      ...base,
      xAxis: {
        type: 'category',
        data: [t('ranking.today'), t('ranking.atHorizon')],
        axisLine: { lineStyle: { color: theme.border } },
        axisLabel: { color: theme.text.mid },
      },
      yAxis: {
        type: 'value',
        inverse: true,
        min: 1,
        max: count,
        interval: 1,
        axisLabel: { color: theme.text.low },
        splitLine: { lineStyle: { color: theme.border } },
      },
    }
  }
}
