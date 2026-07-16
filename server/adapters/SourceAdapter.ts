import type { Series } from '../../shared/types'

// The extension seam (tech-spec §4, ADR-008). One module per source; uniform `Series` output.
// Services depend on this interface, never on a concrete adapter — a future GfwAdapter is a new
// file + a wiring line, with no route/contract/frontend change.

export interface FetchOpts {
  dateRange?: [number, number]
  mostRecentNonEmpty?: boolean // WDI mrnev — for series that end 1–2 years early
  perPage?: number
}

export interface SourceAdapter {
  fetchIndicator(iso3: string, indicatorCode: string, opts?: FetchOpts): Promise<Series>
  fetchIndicatorMulti(
    iso3List: string[],
    indicatorCode: string,
    opts?: FetchOpts,
  ): Promise<Series[]>
}
