import type { DerivationParams, ReferenceDTO } from '../../shared/types'
import { horizonTargetYear } from '../../shared/config/derivation'
import * as stats from '../../shared/utils/stats'
import type { EmissionsService } from './EmissionsService'

// ReferenceService (tech-spec §6, business §4.3). Ships the global fossil-emissions denominator series,
// always shown in global scope. Baseline-INDEPENDENT under ADR-026: the donut's deforestation slices
// (stock + forgone sink) and the share % are baseline-dependent and are derived CLIENT-SIDE from the
// global DTO's derived tail at the live baseline, so they are no longer computed here.
//
// Fossil is PROJECTED to the horizon target year (ADR-019, like the deforestation series in
// AggregationService) so the donut/fossil-bar forward window `[referenceYear, referenceYear +
// horizonYears(horizon)]` sums fossil over the SAME projected range as stock and forgone — otherwise
// the fossil integral would be truncated at the last measured year and the share skewed at long
// horizons. `today` projects to the anchor (current) year too, keeping the fossil series' extent
// uniform with the deforestation series. The endpoint cache key includes horizon, so changing horizon
// refetches the correctly-projected series.

export interface ReferenceInput {
  params: DerivationParams
  referenceYear: number
}

export class ReferenceService {
  constructor(private readonly emissions: EmissionsService) {}

  async reference(input: ReferenceInput): Promise<ReferenceDTO> {
    const { params, referenceYear } = input
    const fossil = await this.emissions.globalFossil()
    const fossilTotal = stats.projectSeries(fossil, horizonTargetYear(params.horizon))
    return { params, referenceYear, fossilTotal }
  }
}
