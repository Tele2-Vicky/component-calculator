import type { Piece } from '../data/types'
import type { OptimizerResult } from '../optimizer/types'

/**
 * True when the inventory no longer matches the one the result was computed
 * from: a placed/unused piece was deleted, or a piece was added that the run
 * never saw. The run's inventory snapshot also detects changes to an existing
 * piece's shape, quality or stat, since editing a piece preserves its ID.
 * Inventory order has no bearing on whether a result is still current.
 */
export function isResultStale(
  result: OptimizerResult,
  pieces: Piece[],
  runPieces?: readonly Piece[],
): boolean {
  const known = new Set<string>(result.unusedPieceIds)
  for (const board of result.boards) {
    for (const pl of board.placements) known.add(pl.pieceId)
  }
  const current = new Set(pieces.map((p) => p.id))
  if (current.size !== known.size) return true
  for (const id of known) if (!current.has(id)) return true
  if (runPieces) {
    const original = new Map(runPieces.map((piece) => [piece.id, piece]))
    for (const piece of pieces) {
      const previous = original.get(piece.id)
      if (!previous || previous.shape !== piece.shape || previous.quality !== piece.quality || previous.stat !== piece.stat) {
        return true
      }
    }
  }
  return false
}
