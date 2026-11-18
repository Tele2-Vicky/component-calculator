import { describe, expect, it } from 'vitest'
import { BUFF_TABLE } from '../data/buffTable'
import { MOUNTS } from '../data/mounts'
import { zeroStats } from '../data/stats'
import type { Piece, QualityTier, ShapeKey, StatKey } from '../data/types'
import { applyLineBonuses, formula, scoreLayout } from './scoring'
import { selectPieces } from './selection'
import { emptyShapeCounts, type ShapeCounts } from './tiling'

const ES_TIERS = MOUNTS.electricScooter.lineBonusTiers

let nextId = 0
function mk(shape: ShapeKey, quality: QualityTier, stat: StatKey): Piece {
  return { id: `p${++nextId}`, shape, quality, stat }
}

function counts(parts: Partial<ShapeCounts>): ShapeCounts {
  return { ...emptyShapeCounts(), ...parts }
}

describe('selectPieces', () => {
  it('selects poison when crossing a dynamic Doomsteed bonus threshold beats skill damage', () => {
    const poison = mk('I', 'legend', 'toPoisoned')
    const skill = mk('I', 'legend', 'skillDamage')
    const stats = { ...zeroStats(), toPoisoned: 90 }
    const tiers = MOUNTS.doomsteed.lineBonusTiers
    const result = selectPieces([skill, poison], counts({ I: 1 }), 8, stats, tiers, 8, 1, {
      seed: { picks: [skill], score: -1 },
    })
    expect(result.picks).toEqual([poison])
    expect(result.score).toBeCloseTo(scoreLayout(stats, [poison], 8, tiers, 8), 10)
    expect(result.complete).toBe(true)
  })

  it('reports an unfinished selection when its node budget is exhausted', () => {
    const piece = mk('O', 'legend', 'critDamage')
    const result = selectPieces([piece], counts({ O: 1 }), 0, zeroStats(), [], 0, 1, {
      seed: { picks: [piece], score: 0 }, nodeBudget: 0,
    })
    expect(result.picks).toEqual([piece])
    expect(result.score).toBeCloseTo(1.33)
    expect(result.complete).toBe(false)
  })
  it('returns the line-bonus-only baseline for an empty distribution', () => {
    const result = selectPieces(
      [mk('O', 'legend', 'critDamage')],
      counts({}),
      4,
      zeroStats(),
      ES_TIERS,
      0,
    )
    expect(result.picks).toEqual([])
    const expected = zeroStats()
    applyLineBonuses(expected, 4, ES_TIERS, 0)
    expect(result.score).toBeCloseTo(formula(expected), 10)
  })

  it('picks the only feasible selection when dist matches inventory', () => {
    const pieces = [
      mk('O', 'legend', 'critDamage'),
      mk('I', 'legend', 'skillDamage'),
    ]
    const result = selectPieces(
      pieces,
      counts({ O: 1, I: 1 }),
      0,
      zeroStats(),
      ES_TIERS,
      0,
    )
    expect(result.picks.length).toBe(2)
    expect(result.score).toBeCloseTo(
      scoreLayout(zeroStats(), pieces, 0, ES_TIERS, 0),
      10,
    )
  })

  it('picks the highest-buff piece when slots < inventory', () => {
    const best = mk('O', 'legend', 'critDamage')
    const worst = mk('O', 'good', 'toBosses')
    const result = selectPieces(
      [best, worst],
      counts({ O: 1 }),
      0,
      zeroStats(),
      ES_TIERS,
      0,
    )
    expect(result.picks).toEqual([best])
    expect(result.score).toBeCloseTo(
      scoreLayout(zeroStats(), [best], 0, ES_TIERS, 0),
      10,
    )
  })

  it('prefers diversifying stats over stacking the same stat', () => {
    const a = mk('O', 'legend', 'critDamage')
    const b = mk('O', 'legend', 'skillDamage')
    const c = mk('O', 'good', 'critDamage')
    const result = selectPieces(
      [a, b, c],
      counts({ O: 2 }),
      0,
      zeroStats(),
      ES_TIERS,
      0,
    )
    const ids = new Set(result.picks.map((p) => p.id))
    expect(ids).toEqual(new Set([a.id, b.id]))
    expect(result.score).toBeCloseTo(
      scoreLayout(zeroStats(), [a, b], 0, ES_TIERS, 0),
      10,
    )
  })

  it('respects per-shape quotas', () => {
    const o1 = mk('O', 'legend', 'critDamage')
    const o2 = mk('O', 'legend', 'skillDamage')
    const i1 = mk('I', 'good', 'toBosses')
    const result = selectPieces(
      [o1, o2, i1],
      counts({ O: 1, I: 1 }),
      0,
      zeroStats(),
      ES_TIERS,
      0,
    )
    expect(result.picks.length).toBe(2)
    const shapeCounts = result.picks.reduce<Record<string, number>>((acc, p) => {
      acc[p.shape] = (acc[p.shape] ?? 0) + 1
      return acc
    }, {})
    expect(shapeCounts.O).toBe(1)
    expect(shapeCounts.I).toBe(1)
    expect(result.picks).toContain(i1)
  })

  it('applies line bonuses when scoring', () => {
    const p = mk('O', 'legend', 'critDamage')
    const noLines = selectPieces([p], counts({ O: 1 }), 0, zeroStats(), ES_TIERS, 0)
    const withLines = selectPieces([p], counts({ O: 1 }), 4, zeroStats(), ES_TIERS, 0)
    expect(withLines.score).toBeGreaterThan(noLines.score)
    expect(withLines.score).toBeCloseTo(
      scoreLayout(zeroStats(), [p], 4, ES_TIERS, 0),
      10,
    )
  })

  it('respects already-present currentStats', () => {
    const high = zeroStats()
    high.critDamage = 200
    const critPiece = mk('O', 'legend', 'critDamage')
    const skillPiece = mk('O', 'legend', 'skillDamage')
    const result = selectPieces(
      [critPiece, skillPiece],
      counts({ O: 1 }),
      0,
      high,
      ES_TIERS,
      0,
    )
    expect(result.picks).toEqual([skillPiece])
  })

  it('considers stacking the same stat when only same-stat options exist', () => {
    const a = mk('O', 'legend', 'critDamage')
    const b = mk('O', 'good', 'critDamage')
    const c = mk('I', 'legend', 'critDamage')
    const result = selectPieces(
      [a, b, c],
      counts({ O: 2, I: 1 }),
      0,
      zeroStats(),
      ES_TIERS,
      0,
    )
    expect(result.picks.length).toBe(3)
    const totalCrit =
      BUFF_TABLE.legend.critDamage * 2 + BUFF_TABLE.good.critDamage
    expect(result.score).toBeCloseTo(1 + totalCrit / 100, 10)
  })

  it('finds the optimum on a small mixed inventory', () => {
    const inventory = [
      mk('O', 'legend', 'critDamage'),
      mk('O', 'epic', 'skillDamage'),
      mk('I', 'legend', 'skillDamage'),
      mk('I', 'good', 'toBosses'),
      mk('T', 'epicPlus', 'shieldDamage'),
      mk('L', 'excellent', 'laceration'),
    ]
    const result = selectPieces(
      inventory,
      counts({ O: 1, I: 1, T: 1, L: 1 }),
      2,
      zeroStats(),
      ES_TIERS,
      0,
    )
    expect(result.picks.length).toBe(4)
    expect(result.score).toBeCloseTo(
      scoreLayout(zeroStats(), result.picks, 2, ES_TIERS, 0),
      10,
    )
    const ids = new Set(result.picks.map((p) => p.id))
    expect(ids).toEqual(
      new Set([
        inventory[0].id,
        inventory[2].id,
        inventory[4].id,
        inventory[5].id,
      ]),
    )
  })

  describe('elemental preference', () => {
    const pick = (inv: Piece[]) =>
      selectPieces(inv, counts({ O: 1 }), 0, zeroStats(), ES_TIERS, 0).picks.map(
        (p) => p.stat,
      )

    it('uses chilled, poisoned, weakened as the fallback when starting stats tie', () => {
      const w = mk('O', 'legend', 'toWeakened')
      const p = mk('O', 'legend', 'toPoisoned')
      const c = mk('O', 'legend', 'toChilled')
      expect(pick([w, p, c])).toEqual(['toChilled'])
      expect(pick([w, p])).toEqual(['toPoisoned'])
    })

    it('is independent of inventory order', () => {
      const inv = [
        mk('O', 'legend', 'toWeakened'),
        mk('O', 'legend', 'toPoisoned'),
        mk('O', 'legend', 'toChilled'),
      ]
      for (const order of [inv, [...inv].reverse(), [inv[1], inv[2], inv[0]]]) {
        expect(pick(order)).toEqual(['toChilled'])
      }
    })

    it('does not override a genuinely higher-scoring piece', () => {
      const w = mk('O', 'legend', 'toWeakened')
      const c = mk('O', 'good', 'toChilled')
      expect(pick([c, w])).toEqual(['toWeakened'])
    })

    it.each(['toChilled', 'toPoisoned', 'toWeakened'] as const)(
      'prefers matching-grade pieces for the highest starting element: %s',
      (highest) => {
        const stats = { ...zeroStats(), [highest]: 500 }
        const inventory = [
          mk('O', 'epic', 'toChilled'),
          mk('O', 'epic', 'toPoisoned'),
          mk('O', 'epic', 'toWeakened'),
        ]
        for (const order of [inventory, [...inventory].reverse()]) {
          const result = selectPieces(order, counts({ O: 1 }), 0, stats, [], 0)
          expect(result.picks.map((p) => p.stat)).toEqual([highest])
        }
      },
    )

    it('falls back to the next-highest available element', () => {
      const stats = { ...zeroStats(), toWeakened: 500, toPoisoned: 200, toChilled: 100 }
      const chilled = mk('O', 'epic', 'toChilled')
      const poison = mk('O', 'epic', 'toPoisoned')
      expect(selectPieces([chilled, poison], counts({ O: 1 }), 0, stats, [], 0).picks).toEqual([poison])
    })

    it('keeps a higher-grade element over a lower-grade preferred element', () => {
      const stats = { ...zeroStats(), toPoisoned: 500 }
      const chilled = mk('O', 'legend', 'toChilled')
      const poison = mk('O', 'epic', 'toPoisoned')
      expect(selectPieces([poison, chilled], counts({ O: 1 }), 0, stats, [], 0).picks).toEqual([chilled])
    })

    it('corrects an equal-score seed toward the highest starting element', () => {
      const stats = { ...zeroStats(), toWeakened: 500 }
      const chilled = mk('O', 'legend', 'toChilled')
      const weakened = mk('O', 'legend', 'toWeakened')
      const result = selectPieces([chilled, weakened], counts({ O: 1 }), 0, stats, [], 0, 1, {
        seed: { picks: [chilled], score: scoreLayout(stats, [chilled], 0, [], 0) },
      })
      expect(result.picks).toEqual([weakened])
    })

    it('preserves a higher-scoring Doomsteed poison threshold over the preferred element', () => {
      const stats = { ...zeroStats(), toChilled: 1_000, toPoisoned: 90 }
      const chilled = mk('I', 'legend', 'toChilled')
      const poison = mk('I', 'legend', 'toPoisoned')
      const result = selectPieces([chilled, poison], counts({ I: 1 }), 8, stats, MOUNTS.doomsteed.lineBonusTiers, 8)
      expect(result.picks).toEqual([poison])
    })
  })
})
