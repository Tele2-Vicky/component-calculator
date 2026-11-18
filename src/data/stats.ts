import type { ScoreStatKey, StatKey, StatTotals } from './types'
import critDamageIcon from '../assets/icons/pets/skills/inspiration.webp'
import skillDamageIcon from '../assets/icons/pets/skills/encouragement.webp'
import shieldDamageIcon from '../assets/icons/pets/skills/shield_damage.webp'
import weakenedIcon from '../assets/icons/pets/skills/weakened.webp'
import poisonedIcon from '../assets/icons/pets/skills/poisoned.webp'
import chilledIcon from '../assets/icons/pets/skills/chilled.webp'
import lacerationIcon from '../assets/icons/stats/laceration.webp'
import bossesIcon from '../assets/icons/damage_boss.webp'
import vulnerabilityIcon from '../assets/icons/stats/vulnerability.webp'

export interface StatMeta {
  key: StatKey
  name: string
  short: string
  icon: string
}

export const STATS: StatMeta[] = [
  {
    key: 'critDamage',
    name: 'Crit Damage',
    short: 'Crit',
    icon: critDamageIcon,
  },
  {
    key: 'skillDamage',
    name: 'Skill Damage',
    short: 'Skill',
    icon: skillDamageIcon,
  },
  {
    key: 'shieldDamage',
    name: 'Shield Damage',
    short: 'Shield',
    icon: shieldDamageIcon,
  },
  {
    key: 'toWeakened',
    name: 'Damage to Weakened',
    short: 'Weakened',
    icon: weakenedIcon,
  },
  {
    key: 'toPoisoned',
    name: 'Damage to Poisoned',
    short: 'Poisoned',
    icon: poisonedIcon,
  },
  {
    key: 'toChilled',
    name: 'Damage to Chilled',
    short: 'Chilled',
    icon: chilledIcon,
  },
  {
    key: 'laceration',
    name: 'Laceration',
    short: 'Lacer.',
    icon: lacerationIcon,
  },
  {
    key: 'toBosses',
    name: 'Damage to Bosses',
    short: 'Boss',
    icon: bossesIcon,
  },
]

export const STAT_KEYS: StatKey[] = STATS.map((s) => s.key)

export const STAT_META: Record<StatKey, StatMeta> = Object.fromEntries(
  STATS.map((s) => [s.key, s]),
) as Record<StatKey, StatMeta>

export type ScoreStatMeta = Omit<StatMeta, 'key'> & { key: ScoreStatKey }
export const SCORE_STATS: ScoreStatMeta[] = [
  ...STATS,
  { key: 'vulnerability', name: 'Vulnerability', short: 'Vulnerability', icon: vulnerabilityIcon },
]
export const SCORE_STAT_KEYS: ScoreStatKey[] = SCORE_STATS.map((stat) => stat.key)
export const SCORE_STAT_META = Object.fromEntries(
  SCORE_STATS.map((stat) => [stat.key, stat]),
) as Record<ScoreStatKey, ScoreStatMeta>

export function zeroStats(): StatTotals {
  return {
    critDamage: 0,
    skillDamage: 0,
    shieldDamage: 0,
    toWeakened: 0,
    toPoisoned: 0,
    toChilled: 0,
    laceration: 0,
    toBosses: 0,
    vulnerability: 0,
  }
}

/**
 * Fallback order when the player's starting elemental stats are equal.
 * Otherwise equal-grade elemental choices favor the highest starting stat.
 */
export const DEBUFF_PRIORITY: StatKey[] = ['toChilled', 'toPoisoned', 'toWeakened']

/** Fixed for a run so earlier boards' buffs cannot change the preference. */
export function debuffPriorityFor(stats: StatTotals): StatKey[] {
  return [...DEBUFF_PRIORITY].sort((a, b) => stats[b] - stats[a])
}

/** Rank of a stat for tie-breaking: lower is preferred; non-debuffs sort last. */
export function debuffRank(stat: StatKey, priority: readonly StatKey[] = DEBUFF_PRIORITY): number {
  const i = priority.indexOf(stat)
  return i === -1 ? priority.length : i
}

/** Compare elemental contributions lexicographically, ignoring float noise. */
export function prefersDebuffs(a: StatTotals, b: StatTotals, priority: readonly StatKey[]): boolean {
  for (const key of priority) {
    if (Math.abs(a[key] - b[key]) > 1e-9 * Math.max(1, Math.abs(a[key]), Math.abs(b[key]))) {
      return a[key] > b[key]
    }
  }
  return false
}
