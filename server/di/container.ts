import type { FetchOpts, SourceAdapter } from '../adapters/SourceAdapter'
import { WdiAdapter, type WdiFetchCache } from '../adapters/WdiAdapter'
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

// WB fetches change ~yearly → cache each atomic per-country indicator fetch for 6h (matches the CDN
// window), keyed by indicator + ISO3 + the fetch mode (mrnev / date-range / full). `swr` serves a
// stale value while it revalidates. `defineCachedFunction` is a Nitro server auto-import absent in the
// unit-test env, so the wrapper is built LAZILY on the first fetch — `build()`/`createContainer()`
// (exercised by di.container.spec) never touch it, and WdiAdapter's own tests inject no cache at all.
const WB_CACHE_MAX_AGE_S = 60 * 60 * 6
const fetchMode = (opts?: FetchOpts): string =>
  opts?.mostRecentNonEmpty ? 'mrnev' : opts?.dateRange ? `${opts.dateRange[0]}-${opts.dateRange[1]}` : 'all'

const wdiCache: WdiFetchCache = (fetch) => {
  let cached: typeof fetch | undefined
  return (iso3, code, opts) => {
    cached ??= defineCachedFunction(fetch, {
      name: 'wb',
      maxAge: WB_CACHE_MAX_AGE_S,
      swr: true,
      getKey: (i: string, c: string, o?: FetchOpts) => `${c}:${i}:${fetchMode(o)}`,
    })
    return cached(iso3, code, opts)
  }
}

function build(): Container {
  const httpClient = createServerAxios()
  const wdi: SourceAdapter = new WdiAdapter(httpClient, wdiCache)

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
