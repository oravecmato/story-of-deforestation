import type { EChartsOption, SeriesOption } from 'echarts'
import type { Series, BandSeries, DataPoint, SeriesType, ThemeTokens, Horizon, VizPresentation } from '#shared/types'
import type { Formatter } from '../format/Formatter'
import { sumWindow } from '#shared/utils/stats'

/** Opacity applied to the projected (dashed) twin of a metric (design §2, business §2.4a). */
export const PROJECTED_OPACITY = 0.55
/** Zero-width suffix marking a projected twin's name so it is omitted from `legend.data` (§11.1). */
export const PROJECTED_SUFFIX = '\u200b'

// Chart-option class system (tech-spec §11, ADR-007). Pure: no fetch, no Vue reactivity, no side
// effects → the produced `Option` is directly unit-testable (ADR-013). Data is injected by
// `ChartOptionFactory` from Pinia; i18n `t` and the number `Formatter` arrive via `ChartContext`.

export interface ChartContext {
  /** i18n translator — the ONLY source of display strings (ADR-011). */
  t: (key: string, params?: Record<string, unknown>) => string
  /** shared theme tokens (§13) → ECharts palette. */
  theme: ThemeTokens
  /** injected number formatting (§11.5, ADR-018). */
  formatter: Formatter
  /** responsive option tweaks. */
  breakpoint: 'sm' | 'md' | 'lg'
  /** signature control (ADR-019): drives the projection extent + which years render dashed, and the
   *  WIDTH of the forward magnitude window `[referenceYear, referenceYear + horizonYears(horizon)]` the
   *  donut / fossil bar integrate over (§17.4, ADR-025). */
  horizon: Horizon
  /** sink-integration origin (business §7.2): sets the DEPTH of the forgone sink (via cumulative loss),
   *  ORTHOGONAL to the horizon window. Carried for chart annotations; the derive layer applies it. */
  baseline: number
  rScenario: 'conservative' | 'mid' | 'high'
}

type YearPoint = [number, number | null]

export abstract class BaseChartOption<TData> {
  constructor(
    protected readonly data: TData,
    protected readonly ctx: ChartContext,
    /** The slide's authored metric selection (§11.1/§17). Defaults to the empty set = the option's
     *  full metric set, so non-deck callers keep the complete chart. */
    protected readonly presentation: VizPresentation = { metrics: [] },
  ) {}

  /** Whether a metric is in the current presentation transform (§11.1). An **empty** set means the
   *  option's default FULL metric set → every metric shows (the reveal/drop is authored per slide). */
  protected has(metric: string): boolean {
    const m = this.presentation.metrics
    return m.length === 0 || m.includes(metric)
  }

  /** The only required per-chart method: map the DTO to ECharts series. */
  protected abstract buildSeries(): SeriesOption[]

  /** Assembles the shared scaffolding + `buildSeries()` into a full Option. Subclasses that need
   *  extra structure (two grids, markPoint…) override and spread `super.build()`. The legend is
   *  derived generically from the built series (helper twins/bands filtered) so no subclass has to
   *  hand-maintain `legend.data` (§11.1). */
  build(): EChartsOption {
    const series = this.buildSeries()
    const base = this.baseGrid()
    const data = this.legendData(series)
    const { legendTop, gridTop } = this.legendReserve(data.length)
    return {
      ...base,
      grid: { ...(base.grid as object), top: gridTop },
      series,
      legend: {
        ...(base.legend as object),
        data,
        ...(legendTop != null ? { top: legendTop, left: 'center' } : {}),
      },
    }
  }

  /** Mobile/tablet: the plain top legend wraps to several rows on a narrow width and would overlap the
   *  plot. Reserve vertical room for it — pin it to the top and push the grid down by the estimated
   *  legend height (rows × line height) — so the chart is always drawn fully below the legend no matter
   *  how many rows it wraps to. Desktop keeps the compact default (grid top 40, auto-placed legend).
   *  Rows are estimated from a conservative items-per-row for the breakpoint (mobile 2, tablet 3). */
  protected legendReserve(itemCount: number): { legendTop?: number; gridTop: number } {
    const { breakpoint } = this.ctx
    if (breakpoint === 'lg') return { gridTop: 40 }
    const perRow = breakpoint === 'md' ? 3 : 2
    const rows = Math.max(1, Math.ceil(itemCount / perRow))
    const legendTop = 8
    return { legendTop, gridTop: legendTop + rows * 24 + 8 }
  }

  // --- shared scaffolding -------------------------------------------------

  /** Theme tokens → ECharts palette: the three data colors then the accent. */
  protected themeColors(): string[] {
    const { data, accent } = this.ctx.theme
    return [data.stock, data.forgoneSink, data.fossil, accent]
  }

  /** state (cumulative level) and flow (increment) both render on a linear CO₂ value axis in V1;
   *  the seam exists so a future variant can pick 'log'/'time' without touching call sites. */
  protected axisTypeFor(_seriesType: SeriesType): 'value' | 'log' | 'time' {
    return 'value'
  }

  /** Dashed line — the measured-vs-estimate visual distinction for the forgone sink (design §2). */
  protected estimateStyle(): { lineStyle: { type: 'dashed' } } {
    return { lineStyle: { type: 'dashed' } }
  }

  /** Split a metric at `meta.projectedFrom` into a measured segment (solid) and a projected segment
   *  (dashed-lighter twin) — the ECharts solid→dashed workaround (§11.1). Both are full-length arrays
   *  (values nulled outside their segment) so stacked callers stay index-aligned; `overlap` keeps the
   *  join year in BOTH for a continuous non-stacked line, or excludes it from the projected side for
   *  stacked charts (no double-count at the join). `projectedFrom = null` → no projected twin. */
  protected splitAtProjection(
    s: Series,
    overlap = true,
  ): { measured: Series; projected: Series | null } {
    const join = s.meta.projectedFrom
    if (join == null) return { measured: s, projected: null }
    const measured: Series = {
      ...s,
      points: s.points.map((p) => (p.year <= join ? p : { ...p, value: null })),
    }
    const projected: Series = {
      ...s,
      points: s.points.map((p) =>
        (overlap ? p.year >= join : p.year > join) ? p : { ...p, value: null },
      ),
    }
    return { measured, projected }
  }

  /** Pointwise cumulative sum of stacked layers, aligned by the union of their years (a year is null
   *  only when every layer is null there). Gives the absolute height of a layer's TOP in the stack so
   *  non-stacked overlay lines (`edgeLines`) can trace the stacked surface without the split gap. */
  protected stackedTop(...layers: Series[]): Series {
    const years = new Set<number>()
    for (const s of layers) for (const p of s.points) years.add(p.year)
    const byYear = layers.map((s) => new Map(s.points.map((p) => [p.year, p.value])))
    const points: DataPoint[] = [...years]
      .sort((a, b) => a - b)
      .map((year) => {
        let sum = 0
        let any = false
        for (const m of byYear) {
          const v = m.get(year)
          if (v != null) {
            sum += v
            any = true
          }
        }
        return { source: 'derived', geo: 'STACK', year, value: any ? sum : null }
      })
    return { ...(layers[0] as Series), id: 'stackTop', points }
  }

  /** Top-edge line(s) tracing a stacked layer's surface at absolute (cumulative) height — NON-stacked,
   *  so the solid measured part and the dashed-lighter projected part meet at the join year with no gap
   *  (the split-area double-count is avoided because the fill is a single continuous stacked series and
   *  only these thin overlay lines carry the measured/projected visual). `dashedMeasured` = the forgone
   *  sink, whose measured part is itself an estimate (already dashed, §2.4a). */
  protected edgeLines(
    top: Series,
    join: number | null,
    color: string,
    dashedMeasured: boolean,
    key: string,
  ): SeriesOption[] {
    const measuredDash: 'solid' | 'dashed' = dashedMeasured ? 'dashed' : 'solid'
    const base = { type: 'line' as const, stack: undefined, silent: true, showSymbol: false, symbol: 'none' as const, z: 3 }
    if (join == null) {
      return [
        { ...base, name: PROJECTED_SUFFIX + key, lineStyle: { color, type: measuredDash }, data: this.pairs(top) },
      ]
    }
    const measured: Series = { ...top, points: top.points.map((p) => (p.year <= join ? p : { ...p, value: null })) }
    const projected: Series = { ...top, points: top.points.map((p) => (p.year >= join ? p : { ...p, value: null })) }
    return [
      { ...base, name: PROJECTED_SUFFIX + key + 'm', lineStyle: { color, type: measuredDash }, data: this.pairs(measured) },
      { ...base, name: PROJECTED_SUFFIX + key + 'p', lineStyle: { color, type: 'dashed', opacity: PROJECTED_OPACITY }, data: this.pairs(projected) },
    ]
  }

  /** Faded overlay shading the projected (forecast) zone from the join year to the series end — the
   *  "these years are estimated" region cue that replaces per-layer lighter fills (§2.4a). Embedded as
   *  a series `markArea`. */
  protected forecastZone(join: number, endYear: number): SeriesOption['markArea'] {
    return {
      silent: true,
      itemStyle: { color: this.rgba(this.ctx.theme.bg, 0.42) },
      data: [[{ xAxis: this.toMs(join) }, { xAxis: this.toMs(endYear) }]],
    }
  }

  /** Vertical divider at the projection join year — the visual "measurement ends here" marker (§11.1).
   *  Returned as a markLine to be embedded in a series literal. */
  protected projectionDivider(joinYear: number) {
    const { theme } = this.ctx
    return {
      symbol: 'none' as const,
      silent: true,
      label: { show: false },
      lineStyle: { color: theme.border, type: 'dashed' as const },
      data: [{ xAxis: this.toMs(joinYear) }],
    }
  }

  /** The Y-axis unit label (§11, design). Defaults to the cumulative CO₂ unit; a rate chart can
   *  override to `unit.mtco2yr`. Public so the wrapper (`BaseChart.vue`) can render it alongside the
   *  Y axis — the unit is drawn by the wrapper, not by ECharts (`yAxis.name`), so it can sit vertically
   *  centred along the axis. Also consumed by the axis tooltip + donut tooltip. */
  yUnit(): string {
    return this.ctx.t('unit.mtco2')
  }

  /** Helper series carry no legend/tooltip identity: the invisible projected twins (name prefixed or
   *  suffixed with the zero-width marker) and the CI band scaffolding (names prefixed `__`). Anything
   *  unnamed is a helper too. This single predicate is the source of truth for excluding them from BOTH
   *  the legend and the axis tooltip (§11.1) so no chart shows duplicated/phantom entries. */
  protected isHelperSeries(name: unknown): boolean {
    return typeof name !== 'string' || name.length === 0 || name.includes(PROJECTED_SUFFIX) || name.startsWith('__')
  }

  /** Deduped list of the real (public) series names in series order — the generic `legend.data`. */
  protected legendData(series: SeriesOption[]): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    for (const s of series) {
      const name = s.name
      if (this.isHelperSeries(name) || seen.has(name as string)) continue
      seen.add(name as string)
      out.push(name as string)
    }
    return out
  }

  /** The tooltip header text for one hovered axis point: the year for the time axis, else the category
   *  label. Keeps annual data reading as a plain year, matching the axis ticks. */
  protected tooltipHeader(p: { axisValue?: unknown; axisValueLabel?: string; name?: string }): string {
    if (typeof p.axisValue === 'number') return String(new Date(p.axisValue).getUTCFullYear())
    return p.axisValueLabel ?? (typeof p.axisValue === 'string' ? p.axisValue : p.name ?? '')
  }

  /** Map a hovered series name to the PUBLIC metric row it belongs to, or `null` if it is helper-only.
   *  A metric that is split at the projection join renders as a solid measured line (`series.stock`)
   *  plus a dashed projected TWIN (`series.stock` + suffix); in projected years only the twin carries
   *  a value while the measured line is null there. Folding the twin back onto its measured row (strip
   *  the trailing suffix) is what stops the tooltip reading `n/a` past the join (§11.1). Band
   *  scaffolding (`__`-prefixed) and edge-line helpers (suffix-PREFIXED) have no public row → `null`. */
  protected tooltipRowName(name: unknown): string | null {
    if (typeof name !== 'string' || name.length === 0 || name.startsWith('__')) return null
    const canonical = name.endsWith(PROJECTED_SUFFIX) ? name.slice(0, -PROJECTED_SUFFIX.length) : name
    if (canonical.length === 0 || canonical.includes(PROJECTED_SUFFIX) || canonical.startsWith('__')) return null
    return canonical
  }

  /** Axis-tooltip formatter shared by every cartesian chart: folds each metric's measured line and its
   *  projected twin into ONE row (so projected years read the twin's value instead of `n/a`), filters
   *  band/edge scaffolding, and formats each value through the injected `Formatter` + unit — the same
   *  numbers the axis labels use (§11.5, ADR-018). */
  protected axisTooltipFormatter(): (params: unknown) => string {
    const { formatter } = this.ctx
    const unit = this.yUnit()
    return (params: unknown): string => {
      const items = (Array.isArray(params) ? params : [params]) as Array<{
        seriesName?: string
        marker?: string
        value?: unknown
        axisValue?: unknown
        axisValueLabel?: string
        name?: string
      }>
      // Rows keyed by public metric name; the measured line (seen first in series order) sets the
      // marker, and a later twin backfills the value in projected years where the measured line is null.
      const byName = new Map<string, { marker: string; value: number | null }>()
      const order: string[] = []
      let header = ''
      for (const p of items) {
        if (!header) header = this.tooltipHeader(p)
        const key = this.tooltipRowName(p.seriesName)
        if (key == null) continue
        const raw = Array.isArray(p.value) ? p.value[p.value.length - 1] : p.value
        const num = typeof raw === 'number' ? raw : null
        const row = byName.get(key)
        if (!row) {
          byName.set(key, { marker: p.marker ?? '', value: num })
          order.push(key)
        } else if (row.value == null && num != null) {
          row.value = num
        }
      }
      const rows = order.map((k) => {
        const row = byName.get(k)!
        return `${row.marker}${k}: ${formatter.format(row.value)} ${unit}`
      })
      return rows.length > 0 ? `${header}<br/>${rows.join('<br/>')}` : ''
    }
  }

  /** Shared grid/axis/tooltip/legend defaults, all coloured from the theme tokens. */
  protected baseGrid(): EChartsOption {
    const { theme } = this.ctx
    return {
      color: this.themeColors(),
      backgroundColor: 'transparent',
      textStyle: { color: theme.text.mid },
      // `left` trimmed by 30px (was 48) — the Y-tick labels reserved more room than they need; with
      // `containLabel` the plot stretches left to fill it while the right edge stays put.
      grid: { left: 18, right: 24, top: 40, bottom: 48, containLabel: true },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: theme.border } },
        // `showMinLabel` forces the first tick's label (our earliest data year, e.g. 2000) to render —
        // a real year, not 0 — which the time axis otherwise drops in favour of a later "nice" tick.
        // On mobile/tablet the year ticks collide on the narrow axis → tilt them 45° (`containLabel`
        // grows the bottom margin to fit the taller rotated labels); desktop keeps them horizontal.
        axisLabel: {
          color: theme.text.low,
          formatter: '{yyyy}',
          showMinLabel: true,
          rotate: this.ctx.breakpoint === 'lg' ? 0 : 45,
        },
        // annual data → show only the year on ticks and in the tooltip header (not a full datetime).
        axisPointer: { label: { formatter: (p: { value: number | string | Date }) => String(new Date(p.value).getUTCFullYear()) } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        // Hide the Y min label (the 0 at the origin): with `xAxis.showMinLabel` on, the two min labels
        // sit at the same corner and visually collide.
        axisLabel: { color: theme.text.mid, showMinLabel: false },
        splitLine: { lineStyle: { color: theme.border } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: theme.surface2,
        borderColor: theme.border,
        textStyle: { color: theme.text.hi },
        formatter: this.axisTooltipFormatter(),
      },
      legend: { textStyle: { color: theme.text.mid } },
    }
  }

  /** A single "nice" max + tick interval across every supplied value group, so paired grids share
   *  one comparable Y scale (§11.2 FossilComparison; reusable for any future paired chart). */
  protected sharedYAxis(...groups: number[][]): { max: number; interval: number } {
    const peak = Math.max(0, ...groups.flat().filter((n) => Number.isFinite(n)))
    if (peak <= 0) return { max: 1, interval: 0.25 }
    const rawStep = peak / 4
    const mag = 10 ** Math.floor(Math.log10(rawStep))
    const norm = rawStep / mag
    const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
    const interval = niceNorm * mag
    return { max: Math.ceil(peak / interval) * interval, interval }
  }

  // --- helpers ------------------------------------------------------------

  /** ECharts `time` axis expects real timestamps; annual data maps to Jan 1 (UTC) of the year. This
   *  is the single seam between our year-based domain model and the temporal base axis. */
  protected toMs(year: number): number {
    return Date.UTC(year, 0, 1)
  }

  /** [ms, value] pairs on the time axis (nulls preserved so data holes stay visible, business §7.1). */
  protected pairs(series: Series): YearPoint[] {
    return series.points.map((p) => [this.toMs(p.year), p.value])
  }

  /** Value at a year, or 0 when absent (composite scalars, ADR-016). */
  protected valueAt(series: Series, year: number): number {
    return series.points.find((p) => p.year === year)?.value ?? 0
  }

  /** Σ of a series' non-null values over the inclusive year window `[from, to]`. Delegates to the one
   *  shared `stats.sumWindow` so the slide-5/6 magnitude diagrams match the equivalence strip and the
   *  ×N multiplier exactly (§17.4). */
  protected sumWindow(series: Series, from: number, to: number): number {
    return sumWindow(series, from, to)
  }

  /** The series' last real value at or before `year` (0 if none) — the measured annual level, used as
   *  the constant rate for the forgone sink's forward-committed window total (§17.4). */
  protected levelAt(series: Series, year: number): number {
    let level = 0
    for (const p of series.points) {
      if (p.year > year) break
      if (p.value != null) level = p.value
    }
    return level
  }

  /** hex → rgba string for the translucent CI band. */
  protected rgba(hex: string, alpha: number): string {
    const n = Number.parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }

  /** Reposition a CI band onto the upper edge of a stacked base series: each bound becomes
   *  `base(year) + bound`, so the band hugs the top of the stack rather than floating at its own
   *  (near-zero) absolute values. Years the base does not cover are dropped (§4.2 aggregate band). */
  protected bandOnTop(base: Series, band: BandSeries): BandSeries {
    const baseAt = new Map(base.points.map((p) => [p.year, p.value]))
    const lift = (pts: DataPoint[]): DataPoint[] =>
      pts
        .filter((p) => baseAt.get(p.year) != null)
        .map((p) => {
          const b = baseAt.get(p.year) ?? null
          return { ...p, value: p.value == null || b == null ? null : b + p.value }
        })
    return { ...band, points: lift(band.points), lower: lift(band.lower), upper: lift(band.upper) }
  }

  /** Two invisible stacked line series forming the forgone-sink uncertainty band: a transparent
   *  lower baseline + the (upper − lower) delta filled at `bandOpacity`. */
  protected bandSeries(band: BandSeries): SeriesOption[] {
    const { theme } = this.ctx
    const lower: YearPoint[] = band.lower.map((p) => [this.toMs(p.year), p.value])
    const delta: YearPoint[] = band.upper.map((p, i) => {
      const lo = band.lower[i]?.value
      return [this.toMs(p.year), p.value == null || lo == null ? null : p.value - lo]
    })
    const invisible = { type: 'line' as const, stack: 'band', showSymbol: false, silent: true, lineStyle: { opacity: 0 } }
    return [
      { ...invisible, name: '__bandLower', data: lower },
      { ...invisible, name: '__bandUpper', areaStyle: { color: this.rgba(theme.data.forgoneSink, theme.bandOpacity) }, data: delta },
    ]
  }
}
