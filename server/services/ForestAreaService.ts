import type { Series, DataPoint, DomainId } from '../../shared/types'
import type { DomainConfig } from '../../shared/config/domains'
import { getIndicator } from '../../shared/config/indicators'
import { DEFAULT_BASELINE } from '../../shared/config/derivation'
import type { SourceAdapter, FetchOpts } from '../adapters/SourceAdapter'
import type { Reconstruction } from './Reconstruction'

// ForestAreaService (tech-spec §6). Fetches AG.LND.FRST.K2 for a domain's ISO3 set in parallel and
// returns the PER-COUNTRY forest-area series (state). Coverage gating + summing are the
// AggregationService's job (ADR-020) so one coverage decision spans stock + area alike. It also owns
// the LUH2 reconstruction splice (ADR-026): the pre-1990 curve is a domain-level total, so it is
// anchored + spliced onto the AGGREGATED domain area, not per country.

const FOREST_AREA_CODE = getIndicator('forestArea').code

// The reconstructed↔measured join (business §7.2a): points below it are LUH2-reconstructed (dashed),
// points at/above it are measured WB data. The anchor year lives on both series.
const JOIN_YEAR = DEFAULT_BASELINE

export class ForestAreaService {
  constructor(
    private readonly adapter: SourceAdapter,
    private readonly domains: Record<DomainId, DomainConfig>,
    private readonly reconstruction: Reconstruction,
  ) {}

  /** Per-country forest-area series for a domain (km², state). */
  async domainAreaByCountry(domainId: DomainId, opts?: FetchOpts): Promise<Series[]> {
    const cfg = this.domains[domainId]
    return this.adapter.fetchIndicatorMulti(cfg.isoCodes, FOREST_AREA_CODE, opts)
  }

  /** Splice the LUH2 reconstruction ahead of the aggregated measured domain area (ADR-026). The curve
   *  is anchored MULTIPLICATIVELY to the measured value at JOIN_YEAR (k = measured@1990 / LUH2@1990),
   *  preserving LUH2's proportional dynamics; the pre-1990 points carry meta.reconstructedBefore =
   *  JOIN_YEAR (dashed). When no asset exists or the anchor year is missing/zero, the measured series
   *  is returned unchanged. */
  reconstruct(domainId: DomainId, measured: Series): Series {
    const curve = this.reconstruction.forDomain(domainId)
    if (curve.length === 0) return measured

    const luhAtJoin = curve.find((p) => p.year === JOIN_YEAR)?.areaKm2
    const measuredAtJoin = measured.points.find((p) => p.year === JOIN_YEAR)?.value
    if (!luhAtJoin || measuredAtJoin == null) return measured

    const k = measuredAtJoin / luhAtJoin
    const geo = measured.points[0]?.geo ?? domainId.toUpperCase()
    const reconstructed: DataPoint[] = curve
      .filter((p) => p.year < JOIN_YEAR)
      .map((p) => ({ source: 'LUH2', geo, year: p.year, value: p.areaKm2 * k }))

    return {
      ...measured,
      points: [...reconstructed, ...measured.points],
      meta: { ...measured.meta, reconstructedBefore: JOIN_YEAR },
    }
  }
}
