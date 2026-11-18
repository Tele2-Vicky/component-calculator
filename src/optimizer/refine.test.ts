import { describe, expect, it } from 'vitest'
import { BUFF_TABLE } from '../data/buffTable'
import { zeroStats } from '../data/stats'
import type { Piece } from '../data/types'
import { refineAllocation } from './refine'
import type { OptimizerResult } from './types'

function fixture(): { inventory: Piece[]; seed: OptimizerResult } {
  return {
    inventory: [
      { id: 'placed', shape: 'I', quality: 'good', stat: 'skillDamage' },
      { id: 'unused', shape: 'I', quality: 'legend', stat: 'skillDamage' },
    ],
    seed: {
      equippedMountKey: 'electricScooter', unusedPieceIds: ['unused'],
      beforeScore: 1, afterScore: 1.1, elapsedMs: 0, truncated: false,
      boards: [{
        mountKey: 'electricScooter', mountLevel: 0, isEquipped: true, syncRate: 100,
        placements: [{ pieceId: 'placed', rotation: 0, row: 0, col: 0 }],
        buffsFromPieces: { ...zeroStats(), skillDamage: 10 }, buffsFromLines: zeroStats(), linesFilled: 0,
      }],
    },
  }
}

function elementalFixture(
  placed: Piece['stat'],
  unused: Piece['stat'],
  placedGrade: Piece['quality'] = 'legend',
  unusedGrade: Piece['quality'] = placedGrade,
) {
  const { inventory, seed } = fixture()
  inventory[0] = { ...inventory[0], stat: placed, quality: placedGrade }
  inventory[1] = { ...inventory[1], stat: unused, quality: unusedGrade }
  seed.boards[0].buffsFromPieces = { ...zeroStats(), [placed]: BUFF_TABLE[placedGrade][placed] }
  return { inventory, seed }
}

describe('cross-mount refinement', () => {
  it('replaces a weaker placed piece with unused inventory and preserves the original result', async () => {
    const { inventory, seed } = fixture()
    const original = structuredClone(seed)
    const result = await refineAllocation(inventory, zeroStats(), seed, {
      started: performance.now(), deadline: performance.now() + 1_000,
    })
    expect(result.afterScore).toBeCloseTo(1.42, 10)
    expect(result.boards[0].placements).toEqual([{ pieceId: 'unused', rotation: 0, row: 0, col: 0 }])
    expect(result.boards[0].buffsFromPieces.skillDamage).toBe(42)
    expect(result.unusedPieceIds).toEqual(['placed'])
    expect(seed).toEqual(original)
  })

  it('preserves shape geometry when a stronger unused piece has a different shape', async () => {
    const { inventory, seed } = fixture()
    inventory[1] = { ...inventory[1], shape: 'T' }
    const result = await refineAllocation(inventory, zeroStats(), seed, {
      started: performance.now(), deadline: performance.now() + 1_000,
    })
    expect(result.afterScore).toBeCloseTo(1.1, 10)
    expect(result.boards[0].placements[0].pieceId).toBe('placed')
    expect(result.unusedPieceIds).toEqual(['unused'])
  })

  it.each(['toChilled', 'toPoisoned', 'toWeakened'] as const)(
    'uses a matching-grade unused piece for the highest starting element: %s',
    async (highest) => {
      const other = highest === 'toChilled' ? 'toPoisoned' : 'toChilled'
      const { inventory, seed } = elementalFixture(other, highest)
      const result = await refineAllocation(inventory, { ...zeroStats(), [highest]: 500 }, seed, {
        started: performance.now(), deadline: performance.now() + 1_000,
      })
      expect(result.boards[0].placements[0].pieceId).toBe('unused')
      expect(result.unusedPieceIds).toEqual(['placed'])
    },
  )

  it('puts the preferred element on the higher-sync board on an equal-score swap', async () => {
    const { inventory, seed } = elementalFixture('toChilled', 'toPoisoned')
    seed.boards.push({
      ...seed.boards[0], mountKey: 'doomsteed', isEquipped: false, syncRate: 62,
      placements: [{ pieceId: 'unused', rotation: 0, row: 0, col: 0 }],
      buffsFromPieces: { ...zeroStats(), toPoisoned: 42 },
    })
    seed.unusedPieceIds = []
    for (const order of [inventory, [...inventory].reverse()]) {
      const result = await refineAllocation(order, { ...zeroStats(), toPoisoned: 500 }, seed, {
        started: performance.now(), deadline: performance.now() + 1_000,
      })
      expect(result.boards[0].placements[0].pieceId).toBe('unused')
      expect(result.boards[1].placements[0].pieceId).toBe('placed')
      expect(result.unusedPieceIds).toEqual([])
    }
  })

  it('keeps a higher-grade piece when the preferred element is lower grade', async () => {
    const { inventory, seed } = elementalFixture('toChilled', 'toPoisoned', 'legend', 'epic')
    const result = await refineAllocation(inventory, { ...zeroStats(), toPoisoned: 500 }, seed, {
      started: performance.now(), deadline: performance.now() + 1_000,
    })
    expect(result.boards[0].placements[0].pieceId).toBe('placed')
  })

  it('preserves shape geometry for an equal-grade preferred element', async () => {
    const { inventory, seed } = elementalFixture('toChilled', 'toPoisoned')
    inventory[1] = { ...inventory[1], shape: 'T' }
    const result = await refineAllocation(inventory, { ...zeroStats(), toPoisoned: 500 }, seed, {
      started: performance.now(), deadline: performance.now() + 1_000,
    })
    expect(result.boards[0].placements[0].pieceId).toBe('placed')
  })
})
