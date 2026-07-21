import type {
  Series,
  BandSeries,
  GlobalResultDTO,
  GlobalDerived,
  DomainId,
  RRange,
  RScenario,
} from '../../shared/types'
import { DOMAINS } from '../../shared/config/domains'
import { getIndicator } from '../../shared/config/indicators'
import { isDomainId, sceneWindow } from '../../shared/config/derivation'
import * as stats from '../../shared/utils/stats'

// Isomorphic derive layer (ADR-026 §3.2a). The baseline-dependent tail
// (cumulativeLoss → forgoneSink → fullEmissions → multiplier → crossingYear) is recomputed OFF the
// already-fetched, baseline-INDEPENDENT DTO at the chosen `baseline`, wrapping the SAME pure
// `shared/utils/stats` functions the server used pre-ADR-026 — so it runs during SSR (honouring the
// URL baseline on first paint) and on every slider frame in the browser, with NO server round-trip and
// NO math drift. Kept Pinia/Vue-free so it is unit-testable; the store getter is the only reactive seam.

// The composite floor: WB deforestation stock only exists from 2000, so stock/forgoneSink/fullEmissions
// begin at max(baseline, 2000) while area/cumulativeLoss reach back to the baseline (business §2.4, §7.2a).
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

/** The domain id carried by a per-domain series id (`area:amazon` → `amazon`). */
const domainOf = (series: Series): DomainId => {
  const id = series.id.slice(series.id.indexOf(':') + 1)
  if (!isDomainId(id)) throw new Error(`useDerived: cannot resolve domain from series id "${series.id}"`)
  return id
}

/** Uniformly scale an R band by the client-transform `rMultiplier` (slide 10). A no-op at 1× (the
 *  measured rate), so every other scene derives exactly as before. */
const scaleR = (r: RRange, rMultiplier: number): RRange =>
  rMultiplier === 1
    ? r
    : { low: r.low * rMultiplier, mid: r.mid * rMultiplier, high: r.high * rMultiplier }

/** R × cumulativeLoss for one area series at `baseline`, clamped to the composite stock floor. The
 *  cumulative loss is plateaued at `haltYear` (its domain's stock-projection zero-crossing) so the
 *  sink stops growing once deforestation is projected to stop — area's own trend is overridden by the
 *  coupled stock signal (business §2.4b). */
const forgoneSinkFor = (
  area: Series,
  baseline: number,
  r: RRange,
  scenario: RScenario,
  haltYear: number | null,
): BandSeries => {
  const cumulativeLoss = stats.freezeCumulativeAfter(stats.cumulativeLoss(area, baseline), haltYear)
  const floor = Math.max(baseline, STOCK_FLOOR)
  return clampBand(stats.forgoneSink(cumulativeLoss, r, scenario), floor)
}

/** derive(GlobalResultDTO, baseline, rMultiplier) — baseline-dependent tail (ADR-026
 *  §3.2a). `rMultiplier` scales R uniformly (slide 10); 1× is the measured rate. */
export function deriveGlobal(dto: GlobalResultDTO, baseline: number, rMultiplier = 1): GlobalDerived {
  const scenario = dto.params.rScenario
  const floor = Math.max(baseline, STOCK_FLOOR)

  // Per-domain forgone sink (R differs per domain), then the asymmetric-safe aggregate band. Each
  // domain's sink is plateaued at ITS OWN stock-projection halt year (§2.4b) — matched by domain id.
  const haltByDomain = new Map(
    dto.perDomainStock.map((stock) => [domainOf(stock), stats.projectedHaltYear(stock)]),
  )
  const perDomainForgoneSink = dto.perDomainArea.map((area) => {
    const domain = domainOf(area)
    return forgoneSinkFor(
      area,
      baseline,
      scaleR(DOMAINS[domain].r, rMultiplier),
      scenario,
      haltByDomain.get(domain) ?? null,
    )
  })
  const aggregateForgoneSink = stats.aggregateForgoneSink(perDomainForgoneSink)
  const aggregateStock = clamp(dto.aggregateStock, floor)
  const aggregateFullEmissions = stats.fullEmissions(aggregateStock, aggregateForgoneSink)
  const { from, to } = sceneWindow(dto.referenceYear, dto.params.horizon)

  return {
    perDomainForgoneSink,
    aggregateForgoneSink,
    aggregateFullEmissions,
    multiplier: stats.multiplier(aggregateStock, aggregateFullEmissions, from, to),
    crossingYear: stats.crossingYear(aggregateStock, aggregateForgoneSink),
  }
}
