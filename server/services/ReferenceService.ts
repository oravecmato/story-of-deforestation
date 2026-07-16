import type { Series, DerivationParams, ReferenceDTO } from '../../shared/types'
import type { EmissionsService } from './EmissionsService'
import * as stats from '../utils/stats'

// ReferenceService (tech-spec §6, business §4.3). Global fossil-emissions bar + the share-of-footprint
// donut, always shown in global scope. It fetches the global fossil total and combines it with the
// (already-derived, aggregation-owned) deforestation composite at referenceYear. With a single
// accounting ('full', ADR-019) the donut is always 3 slices and the share is a scalar magnitude:
//   defo = stock + forgone     share = defo / (fossil + defo)

export interface ReferenceInput {
  params: DerivationParams
  referenceYear: number
  stockAtRef: number // global deforestation stock at referenceYear (Mt CO₂)
  forgoneSinkAtRef: number // global forgone sink at referenceYear (Mt CO₂) — the donut's 3rd slice
}

const valueAt = (s: Series, year: number): number =>
  s.points.find((p) => p.year === year)?.value ?? 0

export class ReferenceService {
  constructor(private readonly emissions: EmissionsService) {}

  async reference(input: ReferenceInput): Promise<ReferenceDTO> {
    const { params, referenceYear, stockAtRef, forgoneSinkAtRef } = input
    const fossilTotal = await this.emissions.globalFossil()
    const fossil = valueAt(fossilTotal, referenceYear)

    const defo = stockAtRef + forgoneSinkAtRef
    return {
      params,
      referenceYear,
      fossilTotal,
      sharePercent: stats.sharePercent(defo, fossil + defo),
      composition: { fossil, stock: stockAtRef, forgoneSink: forgoneSinkAtRef },
    }
  }
}
