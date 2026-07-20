import type { SourceAdapter } from '../adapters/SourceAdapter'
import { WdiAdapter } from '../adapters/WdiAdapter'
import { createServerAxios } from './http'
import { DOMAINS } from '../../shared/config/domains'
import { EQUIVALENCE_CONFIG } from '../../shared/config/equivalences'
import { CoverageGate } from '../utils/coverage'
import { ForestAreaService } from '../services/ForestAreaService'
import { luh2Reconstruction } from '../services/Reconstruction'
import { EmissionsService } from '../services/EmissionsService'
import { AggregationService } from '../services/AggregationService'
import { ReferenceService } from '../services/ReferenceService'
import { EquivalenceService } from '../services/EquivalenceService'

// Composition root / DI (tech-spec §7). Manual factory wiring (ADR-009) — no IoC container. Routes
// obtain services only through this factory, so dependencies stay explicit and stubbable in tests.
// The stack is stateless (pure functions of DerivationParams) → cached as a process-wide singleton.

export interface Container {
  aggregation: AggregationService
  reference: ReferenceService
  equivalence: EquivalenceService
}

function build(): Container {
  const httpClient = createServerAxios()
  const wdi: SourceAdapter = new WdiAdapter(httpClient)

  const forestArea = new ForestAreaService(wdi, DOMAINS, luh2Reconstruction)
  const emissions = new EmissionsService(wdi)
  const coverage = new CoverageGate()
  const aggregation = new AggregationService(forestArea, emissions, DOMAINS, coverage)
  const reference = new ReferenceService(emissions)
  const equivalence = new EquivalenceService(aggregation, EQUIVALENCE_CONFIG)

  return { aggregation, reference, equivalence }
}

let singleton: Container | undefined

/** The shared, stateless service container (built once per process). */
export function createContainer(): Container {
  singleton ??= build()
  return singleton
}
