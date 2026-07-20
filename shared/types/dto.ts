import type { Series, BandSeries } from './series'
import type { DerivationParams } from './params'

// Endpoint DTOs (BFF → store), tech-spec §3.2. Every DTO ships only the BASELINE-INDEPENDENT bundle
// (ADR-026 §3.2a): the forgone-sink family (cumulativeLoss / forgoneSink / fullEmissions / multiplier /
// crossingYear) is CLIENT-DERIVED at the live baseline via the isomorphic core (see DomainDerived /
// GlobalDerived below) and is no longer carried here. Every DTO carries `referenceYear` for composite
// scalars (ADR-016), computed on MEASURED data only (horizon-invariant).

/** GET /api/domain/[id] — local-scope main chart (baseline-independent bundle). */
export interface DomainResultDTO {
  params: DerivationParams
  referenceYear: number
  area: Series // AG.LND.FRST.K2 (state); FULL range (baseline-independent) — dashed pre-1990 via meta.reconstructedBefore (ADR-026), projected post-latest via meta.projectedFrom
  stock: Series // WB .DF (flow, solid); measured then projected past latest year (projectedFrom)
}

/** GET /api/global — global-scope stacked layers (baseline-independent bundle). */
export interface GlobalResultDTO {
  params: DerivationParams
  referenceYear: number
  perDomainArea: Series[] // FULL-range per-domain area (baseline-independent); feeds per-domain forgone sink (R differs per domain), ADR-026
  perDomainStock: Series[] // stacked layers; measured then projected (per-domain projectedFrom)
  aggregateStock: Series // Σ perDomainStock (denominator for multiplier + fossil comparison, §11.2)
}

// Client/SSR-derived from a *ResultDTO + the client-transform `baseline` via the isomorphic core
// (shared/utils/stats.ts). Recomputed on every baseline-slider frame with NO refetch (ADR-026 §3.2a).
// These fields were previously carried on the DTOs; they are now derived so the slider is real-time.

/** derive(DomainResultDTO, baseline) — the baseline-dependent tail for a single domain. */
export interface DomainDerived {
  cumulativeLoss: Series // cumulative area loss from baseline (state); integrated over the DTO's full projected area
  forgoneSink: BandSeries // R × cumulativeLoss (estimate, dashed+band); clamped to max(baseline, 2000)
  fullEmissions: Series // stock + forgoneSink
  multiplier: number // fullEmissions ÷ WB stock at referenceYear (measured data only)
  crossingYear: number | null // annual stock vs cumulative forgone-sink crossing
}

/** derive(GlobalResultDTO, baseline) — the baseline-dependent tail aggregated across domains. */
export interface GlobalDerived {
  perDomainForgoneSink: BandSeries[] // stacked layers (R differs per domain)
  aggregateForgoneSink: BandSeries // sum + single aggregate band (asymmetric-safe quadrature)
  aggregateFullEmissions: Series
  multiplier: number
  crossingYear: number | null
}

/** GET /api/reference — global fossil bar + share-of-footprint (always fetched in global scope).
 *  Baseline-INDEPENDENT: it ships only the fossil denominator series. The donut's deforestation slices
 *  (stock + forgone sink) and the share % are baseline-dependent → client-derived from the global DTO's
 *  derived tail at the live baseline (ADR-026), NOT computed here. */
export interface ReferenceDTO {
  params: DerivationParams
  referenceYear: number
  fossilTotal: Series // denominator = global fossil emissions
}

/** GET /api/equivalence — the locale-driven country unit basis (ADR-025/026, §17.4). Baseline-
 *  INDEPENDENT: the slide-6 equivalence strip client-derives its four magnitudes from the global DTO at
 *  the live baseline; this endpoint only supplies the reference country's annual emissions so the
 *  `country` unit (× times) can be computed client-side. The `car` basis comes from config. */
export interface EquivalenceDTO {
  params: DerivationParams
  referenceYear: number
  referenceCountry: { iso3: string } // locale-driven (SVK/UK)
  referenceCountryAnnualCO2: number // Mt CO2/yr at referenceYear — the country unit basis
}
