import type { Series, DerivationParams, EquivalenceDTO } from '../../shared/types'
import {
  resolveReferenceCountry,
  type EquivalenceConfig,
} from '../../shared/config/equivalences'
import type { AggregationService } from './AggregationService'

// EquivalenceService (tech-spec §6, business §4.4). Supplies the locale-driven country unit basis for
// the slide-6 equivalence strip: the reference country's annual emissions at referenceYear. The strip
// client-derives its four magnitudes from the global DTO at the live baseline (ADR-025/026), so this
// service no longer computes the baseline-dependent headline / car / country scalars. The reference
// country is LOCALE-DRIVEN (Slovak locale → Slovakia, else UK) and its fossil total is fetched through
// AggregationService.referenceCountryEmissions (passthrough).

const valueAt = (s: Series, year: number): number =>
  s.points.find((p) => p.year === year)?.value ?? 0

export class EquivalenceService {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly cfg: EquivalenceConfig,
  ) {}

  /** The locale country unit basis for the current scope. `locale` selects the reference country; its
   *  annual emissions are read at the composite `referenceYear` (baseline-independent). */
  async equivalence(params: DerivationParams, locale: string): Promise<EquivalenceDTO> {
    const referenceYear = await this.referenceYear(params)
    const country = resolveReferenceCountry(locale, this.cfg)
    const fossil = await this.aggregation.referenceCountryEmissions(country.iso3)
    return {
      params,
      referenceYear,
      referenceCountry: { iso3: country.iso3 },
      referenceCountryAnnualCO2: valueAt(fossil, referenceYear),
    }
  }

  /** The composite reference year (ADR-016) for the current scope — baseline-independent. */
  private async referenceYear(params: DerivationParams): Promise<number> {
    if (params.scope === 'global') {
      return (await this.aggregation.globalResult(params)).referenceYear
    }
    return (await this.aggregation.domainResult(params.domainId!, params)).referenceYear
  }
}
