export type StatKey =
  | 'critDamage'
  | 'skillDamage'
  | 'shieldDamage'
  | 'toWeakened'
  | 'toPoisoned'
  | 'toChilled'
  | 'laceration'
  | 'toBosses'

export type ShapeKey = 'O' | 'I' | 'T' | 'L' | 'J'

export type QualityTier =
  | 'good'
  | 'better'
  | 'excellent'
  | 'excellentPlus'
  | 'epic'
  | 'epicPlus'
  | 'legend'

export interface Piece {
  id: string
  shape: ShapeKey
  quality: QualityTier
  stat: StatKey
}

/** Vulnerability is a player/mount stat, not a component type. */
export type ScoreStatKey = StatKey | 'vulnerability'
/** Optional for compatibility with existing saved eight-stat inventories. */
export type StatTotals = Record<StatKey, number> & { vulnerability?: number }
