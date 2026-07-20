// Barrel for the canonical data model (tech-spec §3). Import from '#shared/types' (Nuxt) or
// relatively from tests.
export type { SeriesType, DataPoint, SeriesMeta, Series, BandSeries } from './series'
export type { DomainId, RRange } from './domain'
export type { ThemeTokens } from './theme'
export type { Scope, Horizon, RScenario, DerivationParams } from './params'
export type {
  SceneId,
  LayoutPreset,
  EquivalenceUnit,
  VizKind,
  ControlKey,
  DerivationMode,
  VizConfig,
  VizPresentation,
  SlideDef,
} from './story'
export type {
  DomainResultDTO,
  GlobalResultDTO,
  DomainDerived,
  GlobalDerived,
  ReferenceDTO,
  EquivalenceDTO,
} from './dto'
