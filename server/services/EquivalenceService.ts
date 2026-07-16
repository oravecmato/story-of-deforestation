import type { Series, DerivationParams, EquivalenceDTO } from '../../shared/types'
import {
  resolveReferenceCountry,
  type EquivalenceConfig,
} from '../../shared/config/equivalences'
import type { AggregationService } from './AggregationService'
import * as stats from '../utils/stats'

// EquivalenceService (tech-spec §6, business §4.4). Turns the headline deforestation annual flow into
// forward-committed car + reference-country equivalents. The reference country is LOCALE-DRIVEN
// (Slovak locale → Slovakia, else UK — resolved per request from the Pinia locale) and its fossil
// total is fetched through AggregationService.referenceCountryEmissions (passthrough, per user).

const valueAt = (s: Series, year: number): number =>
  s.points.find((p) => p.year === year)?.value ?? 0

export class EquivalenceService {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly cfg: EquivalenceConfig,
  ) {}

  /** Equivalence panel for the current scope. Driven by `params.horizon` (ADR-019); `locale` selects
   *  the reference country. */
  async equivalence(params: DerivationParams, locale: string): Promise<EquivalenceDTO> {
    const { annualRateCO2, referenceYear } = await this.headline(params)

    const country = resolveReferenceCountry(locale, this.cfg)
    const fossil = await this.aggregation.referenceCountryEmissions(country.iso3)
    const referenceCountryAnnualCO2 = valueAt(fossil, referenceYear)

    return stats.equivalence({
      params,
      referenceYear,
      horizon: params.horizon,
      annualRateCO2,
      referenceCountry: { iso3: country.iso3 },
      referenceCountryAnnualCO2,
      cfg: this.cfg,
    })
  }

  /** Headline annual deforestation flow (Mt CO₂/yr) at referenceYear = full emissions (stock + forgone)
   *  read on MEASURED data (single accounting, ADR-019). */
  private async headline(
    params: DerivationParams,
  ): Promise<{ annualRateCO2: number; referenceYear: number }> {
    if (params.scope === 'global') {
      const g = await this.aggregation.globalResult(params)
      return {
        annualRateCO2: valueAt(g.aggregateFullEmissions, g.referenceYear),
        referenceYear: g.referenceYear,
      }
    }
    const d = await this.aggregation.domainResult(params.domainId!, params)
    return { annualRateCO2: valueAt(d.fullEmissions, d.referenceYear), referenceYear: d.referenceYear }
  }
}
