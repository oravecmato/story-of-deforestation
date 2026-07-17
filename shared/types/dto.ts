import type { Series, BandSeries } from './series'
import type { DerivationParams, Horizon } from './params'

// Endpoint DTOs (BFF → store), tech-spec §3.2. With the accounting switch removed there is a single
// accounting ('full'): the forgone-sink family (forgoneSink / fullEmissions / multiplier /
// crossingYear) is ALWAYS present (ADR-019, business §2.6). Every DTO carries `referenceYear` for
// composite scalars (ADR-016), all computed on MEASURED data only (horizon-invariant).

/** GET /api/domain/[id] — local-scope main chart, crossing, multiplier. */
export interface DomainResultDTO {
  params: DerivationParams
  referenceYear: number
  area: Series // AG.LND.FRST.K2 (state)
  cumulativeLoss: Series // cumulative area loss from baseline (state); projected past latest measured year
  stock: Series // WB .DF (flow, solid); measured then projected past latest year (projectedFrom)
  forgoneSink: BandSeries // R × cumulativeLoss (estimate, dashed+band); extends into the projected range
  fullEmissions: Series // stock + forgoneSink
  multiplier: number // fullEmissions ÷ WB stock at referenceYear (measured data only)
  crossingYear: number | null // annual stock impulse × cumulative forgone-sink crossing (may fall in projected range)
}

/** GET /api/global — global-scope main chart, crossing, multiplier. */
export interface GlobalResultDTO {
  params: DerivationParams
  referenceYear: number
  perDomainStock: Series[] // stacked layers; measured then projected (per-domain projectedFrom)
  perDomainForgoneSink: Series[] // stacked layers
  aggregateStock: Series // Σ perDomainStock (denominator for multiplier + fossil comparison, §11.2)
  aggregateForgoneSink: BandSeries // sum + single aggregate band (asymmetric-safe, §5)
  aggregateFullEmissions: Series
  multiplier: number
  crossingYear: number | null
}

/** GET /api/reference — global fossil bar + share-of-footprint (always fetched in global scope). */
export interface ReferenceDTO {
  params: DerivationParams
  referenceYear: number
  fossilTotal: Series // denominator = global fossil emissions
  sharePercent: number // defo / (fossil + defo) at referenceYear
  composition: {
    // donut slices at referenceYear (Mt CO2) — always 3 slices
    fossil: number
    stock: number
    forgoneSink: number
  }
}

/** GET /api/equivalence — equivalence panel. */
export interface EquivalenceDTO {
  params: DerivationParams
  referenceYear: number
  horizon: Horizon // echoes params.horizon
  annualRateCO2: number // Mt CO2/yr at referenceYear (the always-shown headline)
  cumulativeCO2: number | null // committed total = annualRateCO2 × horizonYears(horizon); null when horizon='today'
  carEquivalent: number
  countryEquivalent: { iso3: string; times: number }
}
