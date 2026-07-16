import type { EChartsOption, SeriesOption } from 'echarts'
import type { ReferenceDTO } from '../../shared/types'
import { BaseChartOption } from './BaseChartOption'

// Footprint composition donut (§11.2): three slices — fossil, stock, and the forgone sink — reading
// ReferenceDTO.composition. The forgone sink is always present now (§5, single 'full' accounting).
export class FootprintDonutOption extends BaseChartOption<ReferenceDTO> {
  protected buildSeries(): SeriesOption[] {
    const { theme, t } = this.ctx
    const c = this.data.composition
    const slices = [
      { name: t('series.fossil'), value: c.fossil, itemStyle: { color: theme.data.fossil } },
      { name: t('series.stock'), value: c.stock, itemStyle: { color: theme.data.stock } },
      { name: t('series.forgoneSink'), value: c.forgoneSink, itemStyle: { color: theme.data.forgoneSink } },
    ]
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
