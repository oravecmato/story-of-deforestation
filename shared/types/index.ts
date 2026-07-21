// Barrel for the canonical data model (tech-spec §3). Import from '#shared/types' (Nuxt) or
// relatively from tests.
export type { SeriesType, DataPoint, SeriesMeta, Series, BandSeries } from './series'
export type { DomainId, RRange } from './domain'
export type { ThemeTokens } from './theme'
export type { Horizon, RScenario, DerivationParams } from './params'
export type {
  SceneId,
  GridTemplateId,
  EquivalenceUnit,
  VizKind,
  ControlKey,
  DerivationMode,
  WidgetType,
  TextWidget,
  ControlsWidget,
  VizWidget,
  MultiplierWidget,
  EquivalenceWidget,
  WidgetDef,
  VizPresentation,
  SlideDef,
} from './story'
export type {
  GlobalResultDTO,
  GlobalDerived,
  ReferenceDTO,
  EquivalenceDTO,
} from './dto'
