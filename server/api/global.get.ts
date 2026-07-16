import { createContainer } from '../di/container'
import { parseDerivationParams } from '../utils/params'

// GET /api/global → GlobalResultDTO (tech-spec §8).
export default defineEventHandler(async (event) => {
  const params = parseDerivationParams(getQuery(event))
  return createContainer().aggregation.globalResult(params)
})
