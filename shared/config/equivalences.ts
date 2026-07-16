// Equivalence config (tech-spec §2.3, business §4.4). The equivalence panel is driven by the SAME
// horizon as the rest of the app (ADR-019) — it has no horizon vocabulary of its own; the committed
// total = annualRate × horizonYears(horizon). The reference country is LOCALE-DRIVEN: it is resolved
// from the active i18n locale so the equivalence panel re-anchors reactively when the UI language
// changes (Slovak → Slovakia, all other locales → UK), with no new data fetch.

export interface ReferenceCountry {
  iso3: string
  labelKey: string // i18n key — never a literal label
  source: string
}

export interface EquivalenceConfig {
  semantics: 'forward-committed' // horizon value = annualRate × horizonYears(horizon)
  carAnnualTonsCO2: number // 4.6 (EPA typical passenger vehicle)
  referenceCountryByLocale: Record<string, ReferenceCountry> // e.g. { sk: SVK }
  defaultReferenceCountry: ReferenceCountry // fallback for any other locale (GBR)
  sourceRefs: string[]
}

// The reference country's annual emissions come from the fossil indicator
// (EN.GHG.CO2.MT.CE.AR5), the same denominator used for the share-of-footprint donut.
const FOSSIL_SOURCE = 'EDGAR — EN.GHG.CO2.MT.CE.AR5 (CO2 excl-LULUCF)'

const SLOVAKIA: ReferenceCountry = {
  iso3: 'SVK',
  labelKey: 'country.svk',
  source: FOSSIL_SOURCE,
}

const UNITED_KINGDOM: ReferenceCountry = {
  iso3: 'GBR',
  labelKey: 'country.gbr',
  source: FOSSIL_SOURCE,
}

export const EQUIVALENCE_CONFIG: EquivalenceConfig = {
  semantics: 'forward-committed',
  // US EPA "typical passenger vehicle": ~11,500 mi/yr at ~22 mpg × 8,887 g CO2/gal ≈ 4.6 t CO2/yr
  // (EPA-420-F-18-008). Single, internationally recognizable anchor for the "≈ N million cars" framing.
  carAnnualTonsCO2: 4.6,
  referenceCountryByLocale: { sk: SLOVAKIA },
  defaultReferenceCountry: UNITED_KINGDOM,
  sourceRefs: [
    'US EPA, Greenhouse Gas Emissions from a Typical Passenger Vehicle (EPA-420-F-18-008)',
    FOSSIL_SOURCE,
  ],
}

/** Resolve the reference country reactively from the active UI locale (business §4.4). */
export const resolveReferenceCountry = (
  locale: string,
  cfg: EquivalenceConfig = EQUIVALENCE_CONFIG,
): ReferenceCountry => cfg.referenceCountryByLocale[locale] ?? cfg.defaultReferenceCountry
