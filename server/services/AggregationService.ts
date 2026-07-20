import type {
  Series,
  DataPoint,
  DomainId,
  Horizon,
  DerivationParams,
  DomainResultDTO,
  GlobalResultDTO,
} from '../../shared/types'
import type { DomainConfig } from '../../shared/config/domains'
import { getIndicator } from '../../shared/config/indicators'
import { horizonTargetYear, BASELINE_FLOOR } from '../../shared/config/derivation'
import type { ForestAreaService } from './ForestAreaService'
import type { EmissionsService } from './EmissionsService'
import { countryKey, type CoverageGate, type CoverageVerdict } from '../utils/coverage'
import * as stats from '../../shared/utils/stats'

// AggregationService (tech-spec §6) — the core orchestrator. Combines each domain's forest area +
// deforestation stock with the pure stats module to produce the BASELINE-INDEPENDENT DomainResultDTO /
// GlobalResultDTO. It is a pure function of DerivationParams (ADR-005). The forgone-sink family
// (cumulativeLoss / forgoneSink / fullEmissions / multiplier / crossingYear) is NO LONGER computed
// here — the client derives it at the live baseline via the isomorphic core (ADR-026 §3.2a).
//
// Horizon projection (§6): when `horizon !== 'today'` each series is extended past its last measured
// year up to `horizonTargetYear(horizon)` via `stats.projectSeries` — PER DOMAIN before aggregation.
// Composite scalars (referenceYear) are read at the MEASURED referenceYear, computed from the measured
// bundle before projection, so they are horizon-invariant (ADR-016).
//
// Composite floor (§3.2): the server ships the FULL baseline-independent range (ADR-026) — `area`
// begins at `BASELINE_FLOOR` (the LUH2 reconstruction origin). The WB deforestation stock only exists
// from `deforestationStock.coverageFrom` (2000), so `stock` begins at
// `max(BASELINE_FLOOR, coverageFrom)` = coverageFrom.

const STOCK_FLOOR = getIndicator('deforestationStock').coverageFrom

const clamp = (s: Series, floor: number): Series => ({
  ...s,
  points: s.points.filter((p) => p.year >= floor),
})

/** Per-domain intermediates, shared by the domain and global assemblers. */
interface DomainBundle {
  domainId: DomainId
  area: Series
  stock: Series
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

  /** Fetch + combine one domain's area/stock (measured; before any floor clamp or horizon
   *  projection). One CoverageGate decision (stock + area) drives the SAME country exclusion for both
   *  metrics, so stock and area always describe the same countries (ADR-020). */
  private async buildDomain(domainId: DomainId): Promise<DomainBundle> {
    const cfg = this.domains[domainId]
    const [areaByCountry, stockByCountry] = await Promise.all([
      this.forestArea.domainAreaByCountry(domainId),
      this.emissions.domainStockByCountry(cfg.isoCodes),
    ])
    const verdict = this.coverage.evaluate([
      { indicator: 'forestArea', series: areaByCountry },
      { indicator: 'deforestationStock', series: stockByCountry },
    ])
    const measuredArea = this.combine(areaByCountry, verdict, 'forestArea', `area:${domainId}`, domainId)
    // Splice the LUH2 reconstruction (1800–1990, anchored to measured@1990) ahead of the aggregated
    // measured area so the shipped `area` reaches back to BASELINE_FLOOR (ADR-026 §3.2a).
    const area = this.forestArea.reconstruct(domainId, measuredArea)
    const stock = this.combine(stockByCountry, verdict, 'deforestationStock', `stock:${domainId}`, domainId)
    return { domainId, area, stock }
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

  /** Series projector for the chosen horizon: linear-trend extrapolation up to
   *  `horizonTargetYear(horizon)` (ADR-019). For `today` the target is the anchor (current) year, so
   *  measured series are nowcast uniformly up to the present — this closes the inter-series gap where
   *  the World Bank forest-area data is fresher than the deforestation-stock data, since both now reach
   *  the anchor year (a series already at/past the target is returned unchanged, projectedFrom null).
   *  Composite scalars stay measured (computed before projection) so they remain horizon-invariant. */
  private projectFn(horizon: Horizon): (s: Series) => Series {
    const target = horizonTargetYear(horizon)
    return (s) => stats.projectSeries(s, target)
  }

  /** Decompose a PROJECTED aggregate stock into per-domain stacked layers whose sum equals the
   *  aggregate at every year. Measured years keep each domain's real value; projected years split the
   *  projected aggregate by each domain's share FROZEN at the join year (the last-measured composition).
   *  This keeps the stacked total additive with the authoritative aggregate — otherwise projecting each
   *  domain individually diverges, because `projectSeries`'s `Math.max(0, …)` clamp floors declining
   *  domains at 0 while a growing one (Amazon) runs away, breaking additivity. `today` horizon (aggregate
   *  not projected) returns the measured series unchanged. */
  private decomposeAggregateProjection(measured: Series[], aggregate: Series): Series[] {
    const join = aggregate.meta.projectedFrom
    if (join == null) return measured

    // Frozen share = each domain's last measured value at/before the join year, normalized to sum 1.
    const valueAtJoin = (s: Series): number =>
      s.points.filter((p) => p.year <= join && p.value != null).at(-1)?.value ?? 0
    const shares = measured.map(valueAtJoin)
    const shareTotal = shares.reduce((a, b) => a + b, 0)
    const projectedTail = aggregate.points.filter((p) => p.year > join)

    return measured.map((s, i) => {
      const share = shareTotal > 0 ? (shares[i] as number) / shareTotal : 0
      const geo = s.points.at(-1)?.geo ?? s.meta.indicatorId
      const tail: DataPoint[] = projectedTail.map((p) => ({
        source: 'projected',
        geo,
        year: p.year,
        value: p.value == null ? null : p.value * share,
      }))
      return {
        ...s,
        points: [...s.points, ...tail],
        meta: { ...s.meta, gaps: [...s.meta.gaps], projectedFrom: join },
      }
    })
  }

  /** GET /api/domain/[id] — local-scope baseline-independent bundle (area + stock). */
  async domainResult(domainId: DomainId, params: DerivationParams): Promise<DomainResultDTO> {
    const bundle = await this.buildDomain(domainId)
    const refYear = stats.referenceYear(bundle.area, bundle.stock) // measured (horizon-invariant)
    const floor = Math.max(BASELINE_FLOOR, STOCK_FLOOR)
    const project = this.projectFn(params.horizon)

    return {
      params,
      referenceYear: refYear,
      area: project(clamp(bundle.area, BASELINE_FLOOR)),
      stock: project(clamp(bundle.stock, floor)),
    }
  }

  /** GET /api/global — global-scope baseline-independent stacked layers (area + stock). */
  async globalResult(params: DerivationParams): Promise<GlobalResultDTO> {
    const ids = Object.keys(this.domains) as DomainId[]
    const bundles = await Promise.all(ids.map((id) => this.buildDomain(id)))
    const refYear = stats.referenceYear(...bundles.flatMap((b) => [b.area, b.stock]))
    const floor = Math.max(BASELINE_FLOOR, STOCK_FLOOR)
    const project = this.projectFn(params.horizon)

    // Full-range per-domain area (baseline-independent): the client derives per-domain cumulative loss
    // + forgone sink off these at the chosen baseline (R differs per domain), ADR-026 §3.2a.
    const perDomainArea = bundles.map((b) => project(clamp(b.area, BASELINE_FLOOR)))

    // Stock: aggregate the MEASURED per-domain series first (Option-A window/exclusion), then project
    // the aggregate — this is the AUTHORITATIVE global stock (declining trend, used by the crossing
    // chart). The stacked per-domain layers are then decomposed OUT of that projected aggregate by each
    // domain's frozen last-measured share, so `Σ perDomainStock == aggregateStock` at every year — the
    // stacked total (slide 7) matches the aggregate crossing series (slide 8) and no single domain's
    // linear extrapolation explodes past its 0-clamped peers.
    const perDomainStockMeasured = bundles.map((b) => clamp(b.stock, floor))
    const aggregateStock = project(stats.sumSeries(perDomainStockMeasured, 'stock:global', 'GLOBAL'))
    const perDomainStock = this.decomposeAggregateProjection(perDomainStockMeasured, aggregateStock)

    return {
      params,
      referenceYear: refYear,
      perDomainArea,
      perDomainStock,
      aggregateStock,
    }
  }
}
