import type { DomainId, RRange } from '../types'

// Domain config (tech-spec §2.1, business §3.1/§6). Single source for defensible R numbers and
// ISO3 membership. Values are provisional and flagged `revisable`. `r` (total sink) is DERIVED from
// `rAboveground × allometricFactor` (not hardcoded) so there is a single source of truth; a config
// integrity test asserts the derived values match the published config-ready table (business §6).

export interface DomainConfig {
  id: DomainId
  labelKey: string // i18n key, never a literal label
  isoCodes: string[] // ISO3 membership
  rAboveground: RRange // published aboveground CO2 sink (t CO2/ha/yr) = source t C × 3.667
  allometricFactor: number // LOCKED = 1.24 (1 + IPCC root:shoot ~0.24; business §6)
  r: RRange // = rAboveground × allometricFactor (total ecosystem sink)
  robustness: 'high' | 'medium' | 'lower' | 'rough'
  caveatKeys: string[] // i18n keys for domain-specific caveats
  sourceRefs: string[] // literature citations
}

/** Locked allometric factor: total sink = aboveground × (1 + root:shoot ≈ 0.24). */
export const ALLOMETRIC_FACTOR = 1.24

const scaleR = (r: RRange, factor: number): RRange => ({
  mid: r.mid * factor,
  low: r.low * factor,
  high: r.high * factor,
})

const domain = (
  cfg: Omit<DomainConfig, 'r' | 'allometricFactor'> & { allometricFactor?: number },
): DomainConfig => {
  const allometricFactor = cfg.allometricFactor ?? ALLOMETRIC_FACTOR
  return { ...cfg, allometricFactor, r: scaleR(cfg.rAboveground, allometricFactor) }
}

// "Other tropical" = remaining tropical-forest ISO3 not in the three named domains (business §3.1).
// Derived from World Bank forest-area data (AG.LND.FRST.K2, 2023) filtered to the tropical belt and
// to a ≥5% forest-cover floor (drops hyper-arid Sahel scrub: NER 0.8%, MRT 0.3%, TCD 3.2%). Sorted
// by forest area at derivation time; revisable.
const OTHER_TROPICAL_ISO = [
  // Central America + Caribbean
  'MEX', 'GTM', 'BLZ', 'HND', 'NIC', 'CRI', 'PAN', 'CUB', 'DOM', 'HTI', 'JAM', 'TTO',
  // South America (non-Amazon tropical)
  'PRY',
  // Tropical Africa (West / Sahelian-forest / East / Southern)
  'NGA', 'GHA', 'CIV', 'LBR', 'SLE', 'GIN', 'GNB', 'SEN', 'TGO', 'BEN', 'BFA', 'MLI', 'GMB',
  'SDN', 'SSD', 'ETH', 'SOM', 'KEN', 'UGA', 'TZA', 'RWA', 'BDI', 'AGO', 'ZMB', 'MWI', 'MOZ',
  'ZWE', 'MDG', 'STP',
  // South / Southeast Asia (non-domain)
  'IND', 'LKA', 'BGD', 'NPL', 'BTN', 'TLS',
  // Pacific + Oceania tropical
  'FJI', 'SLB', 'VUT', 'WSM',
]

export const DOMAINS: Record<DomainId, DomainConfig> = {
  amazon: domain({
    id: 'amazon',
    labelKey: 'domain.amazon',
    // GUF (French Guiana) is a French territory; WB coverage is thin, degrades to a recorded gap.
    isoCodes: ['BRA', 'PER', 'COL', 'VEN', 'ECU', 'BOL', 'GUY', 'SUR', 'GUF'],
    rAboveground: { mid: 1.1, low: 0.0, high: 1.8 },
    robustness: 'lower',
    caveatKeys: ['caveat.amazon.decliningSink', 'caveat.amazon.asymmetricFloor'],
    sourceRefs: ['Hubau et al. 2020, Nature (Amazon 2010–2015 window)'],
  }),
  congo: domain({
    id: 'congo',
    labelKey: 'domain.congo',
    isoCodes: ['COD', 'COG', 'GAB', 'CMR', 'CAF', 'GNQ'],
    rAboveground: { mid: 2.42, low: 1.94, high: 2.9 },
    robustness: 'high',
    caveatKeys: ['caveat.congo.stableSink'],
    sourceRefs: ['Hubau et al. 2020, Nature (244 African plots)'],
  }),
  seasia: domain({
    id: 'seasia',
    labelKey: 'domain.seasia',
    isoCodes: ['IDN', 'MYS', 'PNG', 'MMR', 'KHM', 'LAO', 'THA', 'VNM', 'PHL', 'BRN'],
    rAboveground: { mid: 1.58, low: 0.51, high: 2.64 },
    robustness: 'medium',
    caveatKeys: ['caveat.seasia.borneoProxy'],
    sourceRefs: ['Qie et al. 2017, Nature Communications (Borneo proxy)'],
  }),
  other_tropical: domain({
    id: 'other_tropical',
    labelKey: 'domain.other',
    isoCodes: OTHER_TROPICAL_ISO,
    // Pan-tropical mean; CI is the envelope seasia-low → congo-high (business §6).
    rAboveground: { mid: 1.83, low: 0.51, high: 2.9 },
    robustness: 'rough',
    caveatKeys: ['caveat.otherTropical.panTropicalAverage', 'caveat.otherTropical.envelopeCI'],
    sourceRefs: ['Pan-tropical plot-network mean, 1990–2007 (~0.5 t C/ha/yr)'],
  }),
}

export const getDomain = (id: DomainId): DomainConfig => DOMAINS[id]

export const ALL_DOMAINS: DomainConfig[] = Object.values(DOMAINS)
