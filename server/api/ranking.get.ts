import { createContainer } from '../di/container'
import { parseDerivationParams } from '../utils/params'

// GET /api/ranking → RankingDTO (tech-spec §8). Official vs full domain ranking reshuffle.
export default defineEventHandler(async (event) => {
  const params = parseDerivationParams(getQuery(event))
  return createContainer().aggregation.ranking(params)
})
