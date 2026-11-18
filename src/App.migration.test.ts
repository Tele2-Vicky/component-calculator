import { beforeEach, describe, expect, it } from 'vitest'
import { legacySeededUnlocked, legacySeededMountLevels } from './utils/config'

const UNLOCKED_MOUNTS_KEY = 'mount-opt:unlocked-mounts:v1'
const MOUNT_LEVELS_KEY = 'mount-opt:mount-levels:v1'

describe('legacy localStorage migration to new mounts', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('migrates a pre-Netherflame unlocked map (booleans), preserving unlocks and locking the new mount', () => {
    // How usePersistedState persisted unlockedMounts before the 4th mount: a
    // 3-key *boolean* map (not the 0/1 form used by export strings).
    window.localStorage.setItem(
      UNLOCKED_MOUNTS_KEY,
      JSON.stringify({ electricScooter: true, techHoverboard: true, doomsteed: false }),
    )

    const result = legacySeededUnlocked()

    // Existing unlocks are preserved (regression: the old 0/1 check silently
    // dropped them and reset to selected-mount-only), new mount defaults locked.
    expect(result).toEqual({
      electricScooter: true,
      techHoverboard: true,
      doomsteed: false,
      netherflameStalker: false,
      ruinWarskitter: false,
    })
    // The expanded map must be written back for usePersistedState's validator.
    expect(JSON.parse(window.localStorage.getItem(UNLOCKED_MOUNTS_KEY)!)).toEqual(result)
  })

  it('preserves pre-Ruin unlocks and defaults Ruin to locked', () => {
    const alreadyMigrated = {
      electricScooter: true,
      techHoverboard: false,
      doomsteed: true,
      netherflameStalker: true,
    }
    window.localStorage.setItem(UNLOCKED_MOUNTS_KEY, JSON.stringify(alreadyMigrated))
    expect(legacySeededUnlocked()).toEqual({ ...alreadyMigrated, ruinWarskitter: false })
  })

  it('migrates a pre-Netherflame mount-levels map, preserving levels and defaulting the new mount to 0', () => {
    window.localStorage.setItem(
      MOUNT_LEVELS_KEY,
      JSON.stringify({ electricScooter: 3, techHoverboard: 0, doomsteed: 8 }),
    )

    const result = legacySeededMountLevels()

    expect(result).toEqual({
      electricScooter: 3,
      techHoverboard: 0,
      doomsteed: 8,
      netherflameStalker: 0,
      ruinWarskitter: 0,
    })
    expect(JSON.parse(window.localStorage.getItem(MOUNT_LEVELS_KEY)!)).toEqual(result)
  })

  it('preserves all four existing mount levels when adding Ruin', () => {
    const existing = { electricScooter: 5, techHoverboard: 7, doomsteed: 1, netherflameStalker: 3 }
    window.localStorage.setItem(MOUNT_LEVELS_KEY, JSON.stringify(existing))
    const result = legacySeededMountLevels()
    expect(result).toEqual({ ...existing, ruinWarskitter: 0 })
    expect(JSON.parse(window.localStorage.getItem(MOUNT_LEVELS_KEY)!)).toEqual(result)
  })

  it('keeps current five-mount saves intact on repeated reads', () => {
    const unlocked = { electricScooter: true, techHoverboard: true, doomsteed: true, netherflameStalker: true, ruinWarskitter: true }
    const levels = { electricScooter: 5, techHoverboard: 7, doomsteed: 1, netherflameStalker: 3, ruinWarskitter: 4 }
    window.localStorage.setItem(UNLOCKED_MOUNTS_KEY, JSON.stringify(unlocked))
    window.localStorage.setItem(MOUNT_LEVELS_KEY, JSON.stringify(levels))
    expect(legacySeededUnlocked()).toEqual(unlocked)
    expect(legacySeededUnlocked()).toEqual(unlocked)
    expect(legacySeededMountLevels()).toEqual(levels)
    expect(legacySeededMountLevels()).toEqual(levels)
  })
})
