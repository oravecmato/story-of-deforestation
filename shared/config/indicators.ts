import type { SeriesType } from '../types'

// Indicator registry (tech-spec §2.2). Maps internal ids to WDI codes + metadata. `seriesType`
// powers the (dormant) correlation guard and the axis-type choice in chart-option classes.
// `coverageFrom` records the earliest real (non-nowcast) year so the composite floor and honesty
// notes derive from data, not a hardcoded assumption. Coverage live-verified against WDI (probe).

export interface IndicatorConfig {
  id: string // internal id, e.g. 'forestArea'
  code: string // WDI code, e.g. 'AG.LND.FRST.K2'
  category: 'forestArea' | 'lulucf' | 'fossil'
  seriesType: SeriesType
  unit: string // km2, Mt CO2, ...
  canBeNegative: boolean // LULUCF net series can be negative
  source: 'FAOSTAT' | 'EDGAR' | 'LULUCF-bookkeeping'
  coverageFrom: number // first year with real (non-nowcast) data — live-verified
}

export const INDICATORS: Record<string, IndicatorConfig> = {
  forestArea: {
    id: 'forestArea',
    code: 'AG.LND.FRST.K2',
    category: 'forestArea',
    seriesType: 'state',
    unit: 'km2',
    canBeNegative: false,
    source: 'FAOSTAT',
    coverageFrom: 1990, // BRA/IDN 1990–2023, no holes, monotone-declining
  },
  deforestationStock: {
    id: 'deforestationStock',
    code: 'EN.GHG.CO2.LU.DF.MT.CE.AR5',
    category: 'lulucf',
    seriesType: 'flow',
    unit: 'Mt CO2',
    canBeNegative: false,
    source: 'EDGAR',
    coverageFrom: 2000, // country-level starts 2000 (WLD carries 1990); positive
  },
  fossil: {
    id: 'fossil',
    code: 'EN.GHG.CO2.MT.CE.AR5',
    category: 'fossil',
    seriesType: 'flow',
    unit: 'Mt CO2',
    canBeNegative: false,
    source: 'EDGAR',
    coverageFrom: 1990, // WLD 1990–2024, full, no holes — the fossil denominator
  },
}

export const getIndicator = (id: string): IndicatorConfig => {
  const cfg = INDICATORS[id]
  if (!cfg) throw new Error(`Unknown indicator id: ${id}`)
  return cfg
}

const BY_CODE: Record<string, IndicatorConfig> = Object.fromEntries(
  Object.values(INDICATORS).map((cfg) => [cfg.code, cfg]),
)

/** Look up an indicator by its WDI code (used by the adapter to populate series meta). */
export const getIndicatorByCode = (code: string): IndicatorConfig => {
  const cfg = BY_CODE[code]
  if (!cfg) throw new Error(`Unknown indicator code: ${code}`)
  return cfg
}
