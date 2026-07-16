import type {
  Series,
  BandSeries,
  DomainId,
  Horizon,
  DerivationParams,
  DomainResultDTO,
  GlobalResultDTO,
  RankingDTO,
} from '../../shared/types'
import type { DomainConfig } from '../../shared/config/domains'
import { getIndicator } from '../../shared/config/indicators'
import { horizonTargetYear } from '../../shared/config/derivation'
import type { ForestAreaService } from './ForestAreaService'
import type { EmissionsService } from './EmissionsService'
import { countryKey, type CoverageGate, type CoverageVerdict } from '../utils/coverage'
import * as stats from '../utils/stats'

// AggregationService (tech-spec §6) — the core orchestrator. Combines each domain's forest area +
// deforestation stock with the pure stats module to produce DomainResultDTO / GlobalResultDTO /
// RankingDTO. It is a pure function of DerivationParams (ADR-005). There is a single accounting
// ('full', ADR-019): the forgone-sink family (forgoneSink / fullEmissions / multiplier /
// crossingYear) is ALWAYS present.
//
// Horizon projection (§6): when `horizon !== 'today'` each series is extended past its last measured
// year up to `horizonTargetYear(horizon)` via `stats.projectSeries` — PER DOMAIN, before `× R` and
// aggregation, so per-domain R + trend differences reshuffle the ranking (`today` → `atHorizon`).
// Composite scalars (referenceYear, multiplier) are read at the MEASURED referenceYear, computed from
// the measured bundle before projection, so they are horizon-invariant (ADR-016).
//
// Composite floor (§3.2): the WB deforestation stock only exists from `deforestationStock.coverageFrom`
// (2000), while forest area — hence the forgone-sink integral — runs from `baseline` (≥1990). `area`
// and `cumulativeLoss` therefore begin at `baseline`; `stock`, `forgoneSink`, `fullEmissions` begin at
// `max(baseline, coverageFrom)` so stock and sink are always charted together.

const STOCK_FLOOR = getIndicator('deforestationStock').coverageFrom

const clamp = (s: Series, floor: number): Series => ({
  ...s,
  points: s.points.filter((p) => p.year >= floor),
})

const clampBand = (b: BandSeries, floor: number): BandSeries => ({
  ...b,
  points: b.points.filter((p) => p.year >= floor),
  lower: b.lower.filter((p) => p.year >= floor),
  upper: b.upper.filter((p) => p.year >= floor),
})

const valueAt = (s: Series, year: number): number =>
  s.points.find((p) => p.year === year)?.value ?? 0

/** Per-domain intermediates (raw + derived), shared by the domain and global assemblers. */
interface DomainBundle {
  domainId: DomainId
  area: Series
  stock: Series
  cumulativeLoss: Series
  forgoneSink: BandSeries
}

export class AggregationService {
  constructor(
    private readonly forestArea: ForestAreaService,
    private readonly emissions: EmissionsService,
    private readonly domains: Record<DomainId, DomainConfig>,
    private readonly coverage: CoverageGate,
  ) {}

  /** Reference-country fossil-total series (equivalence denominator). Passthrough to EmissionsService
   *  so EquivalenceService keeps its documented 3-arg constructor (per user, Layer 4). */
  referenceCountryEmissions(iso3: string): Promise<Series> {
    return this.emissions.countryFossil(iso3)
  }

  /** Fetch + derive one domain's area/stock/cumulativeLoss/forgoneSink (measured; before any floor
   *  clamp or horizon projection). One CoverageGate decision (stock + area) drives the SAME country
   *  exclusion for both metrics, so stock and forgone sink always describe the same countries (ADR-020). */
  private async buildDomain(domainId: DomainId, params: DerivationParams): Promise<DomainBundle> {
    const cfg = this.domains[domainId]
    const [areaByCountry, stockByCountry] = await Promise.all([
      this.forestArea.domainAreaByCountry(domainId),
      this.emissions.domainStockByCountry(cfg.isoCodes),
    ])
    const verdict = this.coverage.evaluate([
      { indicator: 'forestArea', series: areaByCountry },
      { indicator: 'deforestationStock', series: stockByCountry },
    ])
    const area = this.combine(areaByCountry, verdict, 'forestArea', `area:${domainId}`, domainId)
    const stock = this.combine(stockByCountry, verdict, 'deforestationStock', `stock:${domainId}`, domainId)
    const cumulativeLoss = stats.cumulativeLoss(area, params.baseline)
    const forgoneSink = stats.forgoneSink(cumulativeLoss, cfg.r, params.rScenario)
    return { domainId, area, stock, cumulativeLoss, forgoneSink }
  }

  /** Sum the retained (non-excluded) countries for one metric and clip to that indicator's coverage
   *  window; attaches the shared coverage gaps to meta (ADR-020). */
  private combine(
    perCountry: Series[],
    verdict: CoverageVerdict,
    indicator: string,
    id: string,
    geo: string,
  ): Series {
    const survivors = perCountry.filter((s) => !verdict.excluded.has(countryKey(s)))
    const end = verdict.windowEnd.get(indicator) ?? null
    const summed = stats.sumSeries(survivors, id, geo.toUpperCase())
    const points = end == null ? summed.points : summed.points.filter((p) => p.year <= end)
    const gaps = [
      ...summed.meta.gaps,
      ...verdict.gaps.filter(
        (g) => !summed.meta.gaps.some((h) => h.geo === g.geo && h.reason === g.reason),
      ),
    ]
    return { ...summed, points, meta: { ...summed.meta, latestDataYear: end, gaps } }
  }

  /** Series projector for the chosen horizon: identity for `today`, else linear-trend extrapolation
   *  up to `horizonTargetYear(horizon)` (ADR-019). */
  private projectFn(horizon: Horizon): (s: Series) => Series {
    if (horizon === 'today') return (s) => s
    const target = horizonTargetYear(horizon)
    return (s) => stats.projectSeries(s, target)
  }

  /** GET /api/domain/[id] — local-scope main chart, crossing, multiplier. */
  async domainResult(domainId: DomainId, params: DerivationParams): Promise<DomainResultDTO> {
    const cfg = this.domains[domainId]
    const bundle = await this.buildDomain(domainId, params)
    const refYear = stats.referenceYear(bundle.area, bundle.stock) // measured (horizon-invariant)
    const floor = Math.max(params.baseline, STOCK_FLOOR)
    const project = this.projectFn(params.horizon)

    const area = project(clamp(bundle.area, params.baseline))
    const cumulativeLoss = project(clamp(bundle.cumulativeLoss, params.baseline))
    const stock = project(clamp(bundle.stock, floor))
    // forgone sink is R × the (projected) cleared-area series, then clamped to the stock floor.
    const forgoneSink = clampBand(stats.forgoneSink(cumulativeLoss, cfg.r, params.rScenario), floor)
    const fullEmissions = stats.fullEmissions(stock, forgoneSink)

    return {
      params,
      referenceYear: refYear,
      area,
      cumulativeLoss,
      stock,
      forgoneSink,
      fullEmissions,
      multiplier: stats.multiplier(stock, fullEmissions, refYear),
      crossingYear: stats.crossingYear(stock, forgoneSink),
    }
  }

  /** GET /api/global — global-scope stacked layers, aggregate band, crossing, multiplier. */
  async globalResult(params: DerivationParams): Promise<GlobalResultDTO> {
    const ids = Object.keys(this.domains) as DomainId[]
    const bundles = await Promise.all(ids.map((id) => this.buildDomain(id, params)))
    const refYear = stats.referenceYear(...bundles.flatMap((b) => [b.area, b.stock]))
    const floor = Math.max(params.baseline, STOCK_FLOOR)
    const project = this.projectFn(params.horizon)

    // Stock: aggregate the MEASURED per-domain series first (Option-A window/exclusion), then project
    // the aggregate; per-domain layers are projected individually for the stacked display.
    const perDomainStockMeasured = bundles.map((b) => clamp(b.stock, floor))
    const aggregateStock = project(stats.sumSeries(perDomainStockMeasured, 'stock:global', 'GLOBAL'))
    const perDomainStock = perDomainStockMeasured.map(project)

    // Forgone sink: projected PER DOMAIN (R differs → ranking reshuffle), then combined into the
    // aggregate band over the full (projected) year range.
    const perDomainForgoneSink = bundles.map((b) => {
      const cfg = this.domains[b.domainId]
      const cumulativeLoss = project(clamp(b.cumulativeLoss, params.baseline))
      return clampBand(stats.forgoneSink(cumulativeLoss, cfg.r, params.rScenario), floor)
    })
    const aggregateForgoneSink = stats.aggregateForgoneSink(perDomainForgoneSink)
    const aggregateFullEmissions = stats.fullEmissions(aggregateStock, aggregateForgoneSink)

    return {
      params,
      referenceYear: refYear,
      perDomainStock,
      perDomainForgoneSink,
      aggregateStock,
      aggregateForgoneSink,
      aggregateFullEmissions,
      multiplier: stats.multiplier(aggregateStock, aggregateFullEmissions, refYear),
      crossingYear: stats.crossingYear(aggregateStock, aggregateForgoneSink),
    }
  }

  /** GET /api/ranking — two-column bump (business §4.3): `today` = full emissions per domain on
   *  MEASURED data at referenceYear; `atHorizon` = per-domain full emissions read at the horizon's
   *  target year (projected). Ranks reshuffle because per-domain R + trend differ. */
  async ranking(params: DerivationParams): Promise<RankingDTO> {
    const ids = Object.keys(this.domains) as DomainId[]
    const bundles = await Promise.all(ids.map((id) => this.buildDomain(id, params)))
    const refYear = stats.referenceYear(...bundles.flatMap((b) => [b.area, b.stock]))
    const floor = Math.max(params.baseline, STOCK_FLOOR)

    const todayVals = bundles.map((b) => {
      const stock = clamp(b.stock, floor)
      const forgone = clampBand(b.forgoneSink, floor)
      const full = stats.fullEmissions(stock, forgone)
      return { domainId: b.domainId as string, value: valueAt(full, refYear) }
    })

    let atHorizonVals = todayVals
    if (params.horizon !== 'today') {
      const target = horizonTargetYear(params.horizon)
      atHorizonVals = bundles.map((b) => {
        const cfg = this.domains[b.domainId]
        const stock = stats.projectSeries(clamp(b.stock, floor), target)
        const cumulativeLoss = stats.projectSeries(clamp(b.cumulativeLoss, params.baseline), target)
        const forgone = clampBand(stats.forgoneSink(cumulativeLoss, cfg.r, params.rScenario), floor)
        const full = stats.fullEmissions(stock, forgone)
        return { domainId: b.domainId as string, value: valueAt(full, target) }
      })
    }

    return {
      params,
      referenceYear: refYear,
      today: stats.domainRanking(todayVals),
      atHorizon: stats.domainRanking(atHorizonVals),
    }
  }
}
