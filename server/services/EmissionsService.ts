import type { Series } from '../../shared/types'
import { getIndicator } from '../../shared/config/indicators'
import type { SourceAdapter, FetchOpts } from '../adapters/SourceAdapter'

// EmissionsService (tech-spec §6). Fetches the LULUCF deforestation-stock flow (EN.GHG.CO2.LU.DF…)
// for a domain's ISO3 set and the global fossil-total flow (the ReferenceService denominator). The
// adapter already trims the AR5 nowcast tail and records gaps; this service only fans out. Coverage
// gating + summing are the AggregationService's job (ADR-020).

const STOCK_CODE = getIndicator('deforestationStock').code
const FOSSIL_CODE = getIndicator('fossil').code
/** World Bank aggregate ISO for the whole world (global fossil denominator). */
const WORLD_ISO = 'WLD'

export class EmissionsService {
  constructor(private readonly adapter: SourceAdapter) {}

  /** Per-country deforestation-stock series for a set of countries (Mt CO₂/yr, flow). */
  async domainStockByCountry(isoCodes: string[], opts?: FetchOpts): Promise<Series[]> {
    return this.adapter.fetchIndicatorMulti(isoCodes, STOCK_CODE, opts)
  }

  /** Global fossil-total series (Mt CO₂/yr, flow) — the share-of-footprint denominator. */
  async globalFossil(opts?: FetchOpts): Promise<Series> {
    return this.adapter.fetchIndicator(WORLD_ISO, FOSSIL_CODE, opts)
  }

  /** A single country's fossil-total series (for the equivalence reference country). */
  async countryFossil(iso3: string, opts?: FetchOpts): Promise<Series> {
    return this.adapter.fetchIndicator(iso3, FOSSIL_CODE, opts)
  }
}
