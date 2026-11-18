import { BUFF_TABLE } from '../data/buffTable'
import type { LineBonusTier, MountLevel } from '../data/lineBonuses'
import { SHAPE_KEYS } from '../data/shapes'
import { DEBUFF_PRIORITY, debuffPriorityFor, debuffRank, prefersDebuffs } from '../data/stats'
import type {
  Piece,
  QualityTier,
  ShapeKey,
  StatKey,
  StatTotals,
} from '../data/types'
import { applyLineBonuses, cloneStats, formula, scoreLayout } from './scoring'
import type { ShapeCounts } from './tiling'

interface Bucket {
  shape: ShapeKey
  stat: StatKey
  quality: QualityTier
  buff: number
  pieces: Piece[]
}

// Scores within this relative tolerance are treated as ties. Float sums taken in
// different orders differ by ~1e-16, which would otherwise make the winner
// depend on traversal order.
const TIE_EPS = 1e-9

function isTie(a: number, b: number): boolean {
  return Math.abs(a - b) <= TIE_EPS * Math.max(1, Math.abs(a), Math.abs(b))
}

export interface SelectionOptions {
  /**
   * A known-feasible selection (same dist, lineCount, tiers) to start from:
   * the DFS only has to beat it, which prunes far harder than starting from
   * "no pieces". The result is never worse than the seed.
   */
  seed?: SelectionResult
  /** Stop the DFS after this many nodes and return the best found so far. */
  nodeBudget?: number
  /** Starting-stat order shared across a multi-board run. */
  debuffPriority?: readonly StatKey[]
}

export interface SelectionResult {
  picks: Piece[]
  score: number
  complete?: boolean
}

/**
 * Pick exactly `dist[shape]` pieces of each shape from `inventory` to
 * maximize formula(currentStats + lineBonus(lineCount) + sum-of-buffs).
 *
 * Pieces sharing the same (shape, stat, quality) are interchangeable: only
 * counts per bucket affect the score, so we collapse the inventory into
 * buckets and DFS over per-bucket pick counts.
 *
 * Caller must ensure `dist[shape] <= inventoryShapeCounts(inventory)[shape]`
 * for every shape — otherwise no feasible selection exists and the result
 * falls back to the no-pieces baseline.
 *
 * Dynamic tiers are evaluated after piece buffs, including in the upper
 * bound. Node-limited callers receive the best feasible selection found and
 * complete=false, rather than an assertion of optimality.
 */
export function selectPieces(
  inventory: Piece[],
  dist: ShapeCounts,
  lineCount: number,
  currentStats: StatTotals,
  tiers: LineBonusTier[],
  mountLevel: MountLevel,
  pieceBuffMultiplier = 1,
  opts: SelectionOptions = {},
): SelectionResult {
  const debuffPriority = opts.debuffPriority ?? debuffPriorityFor(currentStats)
  const baseStats = cloneStats(currentStats)
  function finalStats(stats: StatTotals): StatTotals {
    const out = cloneStats(stats)
    applyLineBonuses(out, lineCount, tiers, mountLevel)
    return out
  }
  const baseScore = formula(finalStats(baseStats))
  const dynamic = tiers.some((t) => t.compute && t.minLines <= lineCount && t.unlockedAtLevel <= mountLevel)

  const groups = new Map<string, Bucket>()
  for (const p of inventory) {
    const key = `${p.shape}|${p.stat}|${p.quality}`
    let g = groups.get(key)
    if (!g) {
      g = {
        shape: p.shape,
        stat: p.stat,
        quality: p.quality,
        buff: BUFF_TABLE[p.quality][p.stat] * pieceBuffMultiplier,
        pieces: [],
      }
      groups.set(key, g)
    }
    g.pieces.push(p)
  }
  const buckets = Array.from(groups.values())
  // Make the result independent of inventory order: pieces within a bucket are
  // interchangeable, so take them in a fixed (id) order.
  for (const b of buckets) {
    b.pieces.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
  }

  // Order DFS by descending standalone marginal under the line-bonused stats.
  // Doesn't affect correctness — only how fast we find a strong best-so-far,
  // which in turn tightens the upper-bound prune.
  function marginalAtBase(b: Bucket): number {
    const s = cloneStats(baseStats)
    s[b.stat] += b.buff
    return formula(finalStats(s)) - baseScore
  }
  const marginals = new Map(buckets.map((b) => [b, marginalAtBase(b)]))
  buckets.sort((a, b) => {
    const ma = marginals.get(a)!
    const mb = marginals.get(b)!
    if (!isTie(ma, mb)) return mb - ma
    // Ties: strongest starting element first, then a fixed total order so
    // the DFS visits buckets identically for any inventory order.
    return (
      debuffRank(a.stat, debuffPriority) - debuffRank(b.stat, debuffPriority) ||
      (a.stat < b.stat ? -1 : a.stat > b.stat ? 1 : 0) ||
      (a.quality < b.quality ? -1 : a.quality > b.quality ? 1 : 0) ||
      SHAPE_KEYS.indexOf(a.shape) - SHAPE_KEYS.indexOf(b.shape)
    )
  })

  const slotsLeft: ShapeCounts = { ...dist }
  const accumStats = cloneStats(baseStats)
  const pickCounts: number[] = new Array(buckets.length).fill(0)
  let bestScore = baseScore
  let bestPickCounts: number[] = pickCounts.slice()
  let bestDebuffs = finalStats(baseStats)

  /** Preference only substitutes elemental pieces of the same shape and grade. */
  function sameElementalGrades(a: number[], b: number[]): boolean {
    const balances = new Map<string, number>()
    for (let i = 0; i < buckets.length; i++) {
      const delta = a[i] - b[i]
      if (delta === 0) continue
      const bucket = buckets[i]
      if (!DEBUFF_PRIORITY.includes(bucket.stat)) return false
      const key = `${bucket.shape}|${bucket.quality}`
      balances.set(key, (balances.get(key) ?? 0) + delta)
    }
    return [...balances.values()].every((delta) => delta === 0)
  }
  const nodeBudget = opts.nodeBudget ?? Infinity
  let nodes = 0
  let complete = true
  if (opts.seed) {
    const bucketIdx = new Map(
      buckets.map((b, i) => [`${b.shape}|${b.stat}|${b.quality}`, i]),
    )
    const seeded: number[] = new Array(buckets.length).fill(0)
    for (const p of opts.seed.picks) {
      seeded[bucketIdx.get(`${p.shape}|${p.stat}|${p.quality}`)!]++
    }
    bestPickCounts = seeded
    bestScore = scoreLayout(currentStats, opts.seed.picks, lineCount, tiers, mountLevel, pieceBuffMultiplier)
    const seedStats = cloneStats(baseStats)
    for (const p of opts.seed.picks) {
      seedStats[p.stat] += BUFF_TABLE[p.quality][p.stat] * pieceBuffMultiplier
    }
    bestDebuffs = finalStats(seedStats)
  }

  function totalSlotsLeft(): number {
    let n = 0
    for (const s of SHAPE_KEYS) n += slotsLeft[s]
    return n
  }

  /**
   * Multiplicative upper bound on any completion's score from buckets[idx:].
   *
   * For each piece i, formula(accumStats + buff_i) / formula(accumStats) is
   * its "standalone ratio". When pieces are added in any order, each piece's
   * actual ratio in the cumulative product is ≤ its standalone ratio (the
   * stat it buffs only grows, so its marginal multiplier shrinks). So the
   * product of the per-shape top-slot standalone ratios is ≥ any feasible
   * selection's score / formula(accumStats).
   */
  function upperBound(idx: number): number {
    if (dynamic) {
      // Relax competition for slots: every remaining bucket may use every
      // still-open slot of its shape. All stats and dynamic tiers are
      // monotone, so this can only overestimate any feasible completion.
      const optimistic = cloneStats(accumStats)
      for (let i = idx; i < buckets.length; i++) {
        const b = buckets[i]
        optimistic[b.stat] += b.buff * Math.min(b.pieces.length, slotsLeft[b.shape])
      }
      return formula(finalStats(optimistic)) * (1 + 1e-12)
    }
    const scoredStats = finalStats(accumStats)
    const currScore = formula(scoredStats)
    const ratiosByShape: Record<ShapeKey, number[]> = {
      O: [],
      I: [],
      T: [],
      L: [],
      J: [],
    }
    for (let i = idx; i < buckets.length; i++) {
      const b = buckets[i]
      const cap = Math.min(b.pieces.length, slotsLeft[b.shape])
      if (cap === 0) continue
      const s = cloneStats(scoredStats)
      s[b.stat] += b.buff
      const r = formula(s) / currScore
      const list = ratiosByShape[b.shape]
      for (let j = 0; j < cap; j++) list.push(r)
    }
    let bound = currScore
    for (const shape of SHAPE_KEYS) {
      const ratios = ratiosByShape[shape]
      if (ratios.length === 0) continue
      ratios.sort((a, b) => b - a)
      const k = Math.min(slotsLeft[shape], ratios.length)
      for (let j = 0; j < k; j++) bound *= ratios[j]
    }
    return bound * (1 + 1e-12)
  }

  function dfs(idx: number): void {
    if (++nodes > nodeBudget) {
      complete = false
      return
    }
    if (totalSlotsLeft() === 0) {
      const final = finalStats(accumStats)
      const score = formula(final)
      if (!isTie(score, bestScore) && score > bestScore) {
        bestScore = score
        bestPickCounts = pickCounts.slice()
        bestDebuffs = final
      } else if (isTie(score, bestScore)) {
        if (sameElementalGrades(pickCounts, bestPickCounts) && prefersDebuffs(final, bestDebuffs, debuffPriority)) {
          bestPickCounts = pickCounts.slice()
          bestDebuffs = final
          bestScore = Math.max(bestScore, score)
        }
      }
      return
    }
    if (idx >= buckets.length) return
    const ub = upperBound(idx)
    if (ub < bestScore && !isTie(ub, bestScore)) return

    const bucket = buckets[idx]
    const maxPick = Math.min(bucket.pieces.length, slotsLeft[bucket.shape])

    for (let c = maxPick; c >= 0; c--) {
      pickCounts[idx] = c
      slotsLeft[bucket.shape] -= c
      accumStats[bucket.stat] += c * bucket.buff

      dfs(idx + 1)

      accumStats[bucket.stat] -= c * bucket.buff
      slotsLeft[bucket.shape] += c
      pickCounts[idx] = 0
    }
  }

  dfs(0)

  const picks: Piece[] = []
  for (let i = 0; i < buckets.length; i++) {
    const c = bestPickCounts[i]
    for (let j = 0; j < c; j++) picks.push(buckets[i].pieces[j])
  }
  return { picks, score: bestScore, complete }
}
