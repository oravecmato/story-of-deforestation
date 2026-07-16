import type { DomainId } from './domain'

// The two independent control axes (business §3) plus the R scenario and baseline. Together they
// form the cache-key surface (ADR-005) and the URL-synced composer state (ADR-017).

export type Scope = 'global' | 'local'
/** The signature control (ADR-019): time horizon = projected window upper bound, anchored at
 *  HORIZON_ANCHOR_YEAR. `today` = measured data only; others project per-domain to the target year. */
export type Horizon = 'today' | '20y' | '30y' | '50y' | '75y' | '100y'
/** conservative / mid / high = lower CI / central / upper CI of R (business §4.1, default mid). */
export type RScenario = 'conservative' | 'mid' | 'high'

/** The full derivation-parameter signature. Endpoints are pure, deterministic functions of it. */
export interface DerivationParams {
  scope: Scope
  domainId?: DomainId // required when scope = 'local'
  horizon: Horizon
  rScenario: RScenario
  baseline: number // >= 1990 (FAOSTAT floor, business §7.2)
}
