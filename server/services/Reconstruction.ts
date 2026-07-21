import type { DomainId } from '../../shared/types'
import amazon from '../../shared/data/luh2/amazon.json'
import congo from '../../shared/data/luh2/congo.json'
import seasia from '../../shared/data/luh2/seasia.json'
import otherTropical from '../../shared/data/luh2/other_tropical.json'

// LUH2 reconstruction loader (ADR-026). The pre-1990 per-domain forest-area curve is an OFFLINE build
// asset (scripts/luh2 → shared/data/luh2/<domain>.json, Hurtt et al. 2020), never fetched at runtime.
// ForestAreaService anchors it to the measured WB area at 1990 and splices it ahead of the measured
// series. This module is the injectable seam so tests can pass a stub curve.

export interface Luh2Point {
  year: number
  areaKm2: number
}

export interface Reconstruction {
  /** LUH2 annual area (km²) for a domain, ascending by year; empty when no asset exists. */
  forDomain(domainId: DomainId): readonly Luh2Point[]
}

const ASSETS: Record<DomainId, readonly Luh2Point[]> = {
  amazon: amazon.points,
  congo: congo.points,
  seasia: seasia.points,
  other_tropical: otherTropical.points,
}

/** The bundled LUH2 reconstruction (production). */
export const luh2Reconstruction: Reconstruction = {
  forDomain: (domainId) => ASSETS[domainId] ?? [],
}
