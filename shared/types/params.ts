// The horizon control axis (business §3) plus the R scenario. Together they form the cache-key surface
// (ADR-005) and the URL-synced composer state (ADR-017). The app has a single GLOBAL view (all tropical
// domains stacked), so there is no scope/domain axis. NOTE: `baseline` is NOT here — per ADR-026 it is a
// CLIENT-TRANSFORM view-state (URL-synced but never refetches; the server ships the full-range area
// series and the client re-derives baseline-dependent figures locally).

/** The signature control (ADR-019): time horizon = projected window upper bound, anchored at
 *  HORIZON_ANCHOR_YEAR. `today` = measured data only; others project per-domain to the target year. */
export type Horizon = 'today' | '20y' | '30y' | '50y' | '75y' | '100y'
/** conservative / mid / high = lower CI / central / upper CI of R (business §4.1, default mid). */
export type RScenario = 'conservative' | 'mid' | 'high'

/** The full derivation-parameter signature. Endpoints are pure, deterministic functions of it. */
export interface DerivationParams {
  horizon: Horizon
  rScenario: RScenario
}
