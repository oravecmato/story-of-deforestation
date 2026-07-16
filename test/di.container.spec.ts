import { describe, it, expect } from 'vitest'
import { createContainer } from '../server/di/container'
import { AggregationService } from '../server/services/AggregationService'
import { ReferenceService } from '../server/services/ReferenceService'
import { EquivalenceService } from '../server/services/EquivalenceService'

describe('createContainer', () => {
  it('wires the three request services', () => {
    const c = createContainer()
    expect(c.aggregation).toBeInstanceOf(AggregationService)
    expect(c.reference).toBeInstanceOf(ReferenceService)
    expect(c.equivalence).toBeInstanceOf(EquivalenceService)
  })

  it('returns the same singleton on repeat calls (stateless stack)', () => {
    expect(createContainer()).toBe(createContainer())
  })
})
