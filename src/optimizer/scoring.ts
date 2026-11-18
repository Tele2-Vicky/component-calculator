import { BUFF_TABLE } from '../data/buffTable'
import type { LineBonusTier, MountLevel } from '../data/lineBonuses'
import { SCORE_STAT_KEYS, STAT_KEYS, zeroStats } from '../data/stats'
import type { Piece, ScoreStatKey, StatTotals } from '../data/types'
import { MOUNTS } from '../data/mounts'
import type { BoardResult } from './types'

/**
 * Mutates `stats` in place to add cumulative line-clear bonuses for L filled
 * rows under the given tier list. Tiers above `mountLevel`'s unlock threshold
 * are skipped.
 *
 * Tiers are applied in array order, so a `compute` tier (e.g. Doomsteed's
 * 8-line toBosses-from-toPoisoned) must be ordered after every tier whose
 * static bonus it depends on. Compute tiers see `stats` as fully accumulated
 * by the caller (typically pre-mount + piece buffs) plus any earlier line
 * bonuses applied within this call.
 */
export function applyLineBonuses(
  stats: StatTotals,
  lines: number,
  tiers: LineBonusTier[],
  mountLevel: MountLevel,
): void {
  for (const tier of tiers) {
    if (lines < tier.minLines) continue
    if (tier.unlockedAtLevel > mountLevel) continue
    const inc = tier.bonus ?? tier.compute?.(stats)
    if (!inc) continue
    for (const key of Object.keys(inc) as ScoreStatKey[]) {
      const v = inc[key]
      if (v != null) stats[key] = (stats[key] ?? 0) + v
    }
  }
}

/** The damage formula. Inputs are percentages. */
export function formula(s: StatTotals): number {
  return (
    (1 + s.critDamage / 100) *
    (1 + s.skillDamage / 100) *
    (1 + s.shieldDamage / 100) *
    (1 + s.laceration / 100) *
    (1 + s.toBosses / 100) *
    (1 + (s.vulnerability ?? 0) / 100) *
    (1 + (s.toWeakened + s.toPoisoned + s.toChilled) / 100)
  )
}

/**
 * Marginal damage-formula gain of adding a single piece's full buff on top of
 * `currentStats`: `formula(currentStats + pieceBuff) − formula(currentStats)`.
 * Ignores line bonuses and sync-rate scaling — purely a ranking signal for
 * sorting the inventory against the player's pre-mount stats.
 */
export function marginalGainOf(piece: Piece, currentStats: StatTotals): number {
  const before = formula(currentStats)
  const after = cloneStats(currentStats)
  after[piece.stat] += BUFF_TABLE[piece.quality][piece.stat]
  return formula(after) - before
}

export function cloneStats(s: StatTotals): StatTotals {
  return { vulnerability: 0, ...s }
}

/**
 * Add piece buffs to `stats`. `multiplier` (default 1) scales each piece's
 * buff value before adding — used to model non-equipped mounts' sync rates,
 * where pieces only contribute a fraction of their full buff to the player.
 */
export function addPieceBuffs(
  stats: StatTotals,
  pieces: Piece[],
  multiplier = 1,
): void {
  for (const p of pieces) {
    stats[p.stat] += BUFF_TABLE[p.quality][p.stat] * multiplier
  }
}

/** Compute the final score of a set of placed pieces. */
export function scoreLayout(
  currentStats: StatTotals,
  placedPieces: Piece[],
  lines: number,
  tiers: LineBonusTier[],
  mountLevel: MountLevel,
  pieceBuffMultiplier = 1,
): number {
  const stats = cloneStats(currentStats)
  addPieceBuffs(stats, placedPieces, pieceBuffMultiplier)
  applyLineBonuses(stats, lines, tiers, mountLevel)
  return formula(stats)
}

/**
 * Produce the final stats and the mount contribution split into the piece
 * buffs and the line-clear bonuses.
 *
 * `compute` tiers depend on the running stat totals, so we accumulate piece
 * buffs into a running copy of `currentStats` first, then run the tiers
 * against that — ensuring compute tiers see pre-mount + piece + earlier-tier
 * contributions.
 */
export function finalizeStats(
  currentStats: StatTotals,
  placedPieces: Piece[],
  lines: number,
  tiers: LineBonusTier[],
  mountLevel: MountLevel,
  pieceBuffMultiplier = 1,
): {
  final: StatTotals
  buffsFromPieces: StatTotals
  buffsFromLines: StatTotals
} {
  const afterPieces = cloneStats(currentStats)
  addPieceBuffs(afterPieces, placedPieces, pieceBuffMultiplier)

  const final = cloneStats(afterPieces)
  applyLineBonuses(final, lines, tiers, mountLevel)

  const buffsFromPieces = zeroStats()
  const buffsFromLines = zeroStats()
  for (const k of SCORE_STAT_KEYS) {
    buffsFromPieces[k] = (afterPieces[k] ?? 0) - (currentStats[k] ?? 0)
    buffsFromLines[k] = (final[k] ?? 0) - (afterPieces[k] ?? 0)
  }
  return { final, buffsFromPieces, buffsFromLines }
}

/**
 * Canonical complete-allocation objective. The equipped board's dynamic tiers
 * see pre-mount stats, its own pieces and earlier equipped tiers, just as in
 * scoreLayout. Other boards then add their sync-scaled piece buffs.
 */
export function evaluateBoards(
  currentStats: StatTotals,
  boards: BoardResult[],
): { boards: BoardResult[]; finalStats: StatTotals; score: number } {
  const stats = cloneStats(currentStats)
  const evaluated: BoardResult[] = []
  const ordered = [...boards].sort((a, b) => Number(b.isEquipped) - Number(a.isEquipped))
  for (const board of ordered) {
    for (const key of STAT_KEYS) {
      stats[key] += board.buffsFromPieces[key] * board.syncRate / 100
    }
    const beforeLines = cloneStats(stats)
    if (board.isEquipped) {
      applyLineBonuses(stats, board.linesFilled, MOUNTS[board.mountKey].lineBonusTiers, board.mountLevel)
    }
    const buffsFromLines = zeroStats()
    for (const key of SCORE_STAT_KEYS) {
      buffsFromLines[key] = (stats[key] ?? 0) - (beforeLines[key] ?? 0)
    }
    evaluated.push({ ...board, buffsFromLines })
  }
  return { boards: evaluated, finalStats: stats, score: formula(stats) }
}
