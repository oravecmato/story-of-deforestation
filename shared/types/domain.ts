// Domain-level value types shared by config, services and DTOs (tech-spec §2.1 / §3).

/** The four locked V1 rainforest domains (business §3.1). */
export type DomainId = 'amazon' | 'congo' | 'seasia' | 'other_tropical'

/**
 * Sequestration-rate range. Stored as **absolute** endpoints (NOT `mid ± σ`) so asymmetric CI
 * bands (Amazon floor-at-0, "other tropical" envelope) survive both the ×1.24 allometric scaling
 * and aggregation (business §6, tech-spec §2.1 / §16.26).
 */
export interface RRange {
  mid: number
  low: number
  high: number
}
