import type { Series, DomainId } from '../../shared/types'
import type { DomainConfig } from '../../shared/config/domains'
import { getIndicator } from '../../shared/config/indicators'
import type { SourceAdapter, FetchOpts } from '../adapters/SourceAdapter'

// ForestAreaService (tech-spec §6). Fetches AG.LND.FRST.K2 for a domain's ISO3 set in parallel and
// returns the PER-COUNTRY forest-area series (state). Coverage gating + summing are the
// AggregationService's job (ADR-020) so one coverage decision spans stock + area alike.

const FOREST_AREA_CODE = getIndicator('forestArea').code

export class ForestAreaService {
  constructor(
    private readonly adapter: SourceAdapter,
    private readonly domains: Record<DomainId, DomainConfig>,
  ) {}

  /** Per-country forest-area series for a domain (km², state). */
  async domainAreaByCountry(domainId: DomainId, opts?: FetchOpts): Promise<Series[]> {
    const cfg = this.domains[domainId]
    return this.adapter.fetchIndicatorMulti(cfg.isoCodes, FOREST_AREA_CODE, opts)
  }
}
