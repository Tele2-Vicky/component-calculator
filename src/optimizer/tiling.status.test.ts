import { describe, expect, it } from 'vitest'
import { emptyShapeCounts, searchTiling } from './tiling'

describe('tiling search completion', () => {
  it('distinguishes an exhausted node budget from an impossible distribution', () => {
    const dist = { ...emptyShapeCounts(), I: 14 }
    expect(searchTiling(dist, 7, 8, { nodeBudget: 0 })).toMatchObject({
      result: null, complete: false, stopReason: 'nodeLimit',
    })
    const retry = searchTiling(dist, 7, 8, { nodeBudget: Infinity })
    expect(retry.complete).toBe(true)
    expect(retry.result?.lines).toBe(8)
    expect(searchTiling({ ...emptyShapeCounts(), O: 14 }, 7, 8)).toMatchObject({
      result: null, complete: true,
    })
  })

  it('reports an expired deadline without claiming infeasibility', () => {
    expect(searchTiling({ ...emptyShapeCounts(), I: 1 }, 7, 0, {
      deadline: performance.now() - 1,
    })).toMatchObject({ result: null, complete: false, stopReason: 'timeLimit' })
  })

  it('accepts a reached line target as complete', () => {
    expect(searchTiling({ ...emptyShapeCounts(), I: 1 }, 7, 0, { nodeBudget: 2 })).toMatchObject({
      complete: true, result: { lines: 0 },
    })
  })

  it('reports cancellation without claiming infeasibility', () => {
    expect(searchTiling({ ...emptyShapeCounts(), I: 1 }, 7, 0, {
      isCancelled: () => true,
    })).toMatchObject({ result: null, complete: false, stopReason: 'cancelled' })
  })
})
