import { createContainer } from '../../di/container'
import { parseDomainRouteParams } from '../../utils/params'

// GET /api/domain/[id] → DomainResultDTO (tech-spec §8). Thin: parse+validate → service → DTO.
export default defineEventHandler(async (event) => {
  const params = parseDomainRouteParams(getRouterParam(event, 'id'), getQuery(event))
  return createContainer().aggregation.domainResult(params.domainId, params)
})
