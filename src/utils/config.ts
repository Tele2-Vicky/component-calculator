import type { FullTimeLimit, OptimizeScope } from '../components/OptimizerPanel'
import { MAX_MOUNT_LEVEL, type MountLevel } from '../data/lineBonuses'
import { DEFAULT_MOUNT_KEY, isMountKey, MOUNT_KEYS, type MountKey } from '../data/mounts'
import { QUALITIES } from '../data/qualities'
import { SHAPE_KEYS } from '../data/shapes'
import { STAT_KEYS, zeroStats } from '../data/stats'
import type { Piece, StatTotals } from '../data/types'

export const STATS_KEY = 'mount-opt:current-stats:v1'
export const PIECES_KEY = 'mount-opt:pieces:v1'
const LEGACY_MOUNT_LEVEL_KEY = 'mount-opt:mount-level:v1'
export const MOUNT_LEVELS_KEY = 'mount-opt:mount-levels:v1'
export const SELECTED_MOUNT_KEY = 'mount-opt:selected-mount:v1'
export const UNLOCKED_MOUNTS_KEY = 'mount-opt:unlocked-mounts:v1'
export const OPTIMIZE_SCOPE_KEY = 'mount-opt:optimize-scope:v1'
export const FULL_LIMIT_KEY = 'mount-opt:full-time-limit:v1'
export const PROFILES_KEY = 'mount-opt:profiles:v1'
const EXPORT_PREFIX_V1 = 'mount-opt:v1:'
const EXPORT_PREFIX_V2 = 'mount-opt:v2:'
const EXPORT_PREFIX_V3 = 'mount-opt:v3:'
const EXPORT_PREFIX_V4 = 'mount-opt:v4:'
const EXPORT_PREFIX_V5 = 'mount-opt:v5:'
const EXPORT_PREFIX_V6 = 'mount-opt:v6:'
const EXPORT_PREFIX_V7 = 'mount-opt:v7:'
const EXPORT_PREFIX_V8 = 'mount-opt:v8:'
const EXPORT_PREFIX_V9 = 'mount-opt:v9:'
const EXPORT_PREFIX_V10 = 'mount-opt:v10:'
const PRE_RUIN_MOUNT_KEYS: readonly MountKey[] = [
  'electricScooter', 'techHoverboard', 'doomsteed', 'netherflameStalker',
]

export type MountLevelMap = Record<MountKey, MountLevel>
export type UnlockedMap = Record<MountKey, boolean>

export interface ExportedConfig {
  currentStats: StatTotals
  pieces: Piece[]
  selectedMountKey: MountKey
  mountLevels: MountLevelMap
  unlockedMounts: UnlockedMap
  optimizeScope: OptimizeScope
  fullTimeLimit: FullTimeLimit
}

type CompactScope = 'a' | 'e'
type CompactPiece = [shape: Piece['shape'], quality: Piece['quality'], stat: Piece['stat']]
type CompactZeroOne = 0 | 1
type CompactUnlocked = {
  electricScooter: CompactZeroOne
  techHoverboard: CompactZeroOne
  doomsteed: CompactZeroOne
  netherflameStalker: CompactZeroOne
}

interface ExportedConfigV6 {
  version: 6
  s: number[]
  p: CompactPiece[]
  mt: MountKey
  lv: { electricScooter: number; techHoverboard: number; doomsteed: number }
  u: CompactUnlocked
  os: CompactScope
  t: [enabled: 0 | 1, seconds: number]
}

interface ExportedConfigV7 extends Omit<ExportedConfigV6, 'version' | 'lv'> {
  version: 7
  lv: {
    electricScooter: number
    techHoverboard: number
    doomsteed: number
    netherflameStalker: number
  }
}

interface ExportedConfigV8 extends Omit<ExportedConfigV7, 'version'> {
  version: 8
  g: CompactZeroOne
}

interface ExportedConfigV9 extends Omit<ExportedConfigV8, 'version' | 'g' | 'lv' | 'u'> {
  version: 9
  lv: MountLevelMap
  u: Record<MountKey, CompactZeroOne>
}

interface ExportedConfigV10 extends Omit<ExportedConfigV9, 'version'> {
  version: 10
  /** Pre-mount Vulnerability; s retains the legacy eight-component-stat order. */
  vu: number
}

export interface SavedProfile {
  id: string
  name: string
  data: string
  updatedAt: number
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

export function encodeConfig(config: ExportedConfig): string {
  const compact: ExportedConfigV10 = {
    version: 10,
    vu: config.currentStats.vulnerability ?? 0,
    s: STAT_KEYS.map((key) => config.currentStats[key]),
    p: config.pieces.map((piece) => [piece.shape, piece.quality, piece.stat]),
    mt: config.selectedMountKey,
    lv: Object.fromEntries(MOUNT_KEYS.map((key) => [key, config.mountLevels[key]])) as MountLevelMap,
    u: Object.fromEntries(MOUNT_KEYS.map((key) => [key, config.unlockedMounts[key] ? 1 : 0])) as Record<MountKey, CompactZeroOne>,
    os: config.optimizeScope === 'allUnlocked' ? 'a' : 'e',
    t: [config.fullTimeLimit.enabled ? 1 : 0, config.fullTimeLimit.seconds],
  }
  const json = JSON.stringify(compact)
  const base64 = bytesToBase64(new TextEncoder().encode(json))
  return `${EXPORT_PREFIX_V10}${base64}`
}

function isMountLevel(value: unknown): value is MountLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_MOUNT_LEVEL
  )
}

export function isMountLevelMap(value: unknown): value is MountLevelMap {
  return hasMountLevels(value, MOUNT_KEYS)
}

function hasMountLevels(value: unknown, keys: readonly MountKey[]): boolean {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>
  return keys.every((key) => isMountLevel(record[key]))
}

function isLegacyMountLevelMap(value: unknown): boolean {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>
  return ['electricScooter', 'techHoverboard', 'doomsteed'].every((key) =>
    isMountLevel(record[key]),
  )
}

function isLegacyUnlockedMap(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>
  return ['electricScooter', 'techHoverboard', 'doomsteed'].every(
    (key) => record[key] === 0 || record[key] === 1,
  )
}

/**
 * A pre-Netherflame `unlockedMounts` object as persisted to localStorage. Unlike
 * the export-string form (`isLegacyUnlockedMap`, which uses 0/1), the localStorage
 * value stores booleans — so migration off it must check for booleans, not 0/1.
 */
function isLegacyBooleanUnlockedMap(value: unknown): value is Record<string, boolean> {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>
  return ['electricScooter', 'techHoverboard', 'doomsteed'].every(
    (key) => typeof record[key] === 'boolean',
  )
}

export function isUnlockedMap(value: unknown): value is UnlockedMap {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>
  return MOUNT_KEYS.every((key) => typeof record[key] === 'boolean')
}

export function isOptimizeScope(value: unknown): value is OptimizeScope {
  return value === 'allUnlocked' || value === 'equippedOnly'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStatTotals(value: unknown): value is StatTotals {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>
  return STAT_KEYS.every((key) => isFiniteNumber(record[key])) &&
    (record.vulnerability === undefined || (isFiniteNumber(record.vulnerability) && record.vulnerability >= 0))
}

function isPiece(value: unknown): value is Piece {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    SHAPE_KEYS.includes(record.shape as (typeof SHAPE_KEYS)[number]) &&
    QUALITIES.some((q) => q.key === record.quality) &&
    STAT_KEYS.includes(record.stat as (typeof STAT_KEYS)[number])
  )
}

function isFullTimeLimit(value: unknown): value is FullTimeLimit {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.enabled === 'boolean' &&
    isFiniteNumber(record.seconds) &&
    record.seconds >= 1
  )
}

function defaultMountLevels(): MountLevelMap {
  return Object.fromEntries(MOUNT_KEYS.map((key) => [key, 0])) as MountLevelMap
}

/**
 * Default unlocked map: only the given mount key unlocked. Used as the
 * fall-back for users with no `unlocked-mounts:v1` key yet (and for older
 * import versions) so the existing single-mount UI stays identical until
 * the user explicitly unlocks more.
 */
function defaultUnlockedFor(key: MountKey): UnlockedMap {
  return Object.fromEntries(MOUNT_KEYS.map((mount) => [mount, mount === key])) as UnlockedMap
}

/**
 * Seed the per-mount levels from the legacy single-mount-level localStorage
 * key (used pre v4). Called once at module init; if the v4 key already exists,
 * usePersistedState will overwrite this with the saved value.
 */
export function legacySeededMountLevels(): MountLevelMap {
  const out = defaultMountLevels()
  if (typeof window === 'undefined') return out
  try {
    const saved = window.localStorage.getItem(MOUNT_LEVELS_KEY)
    if (saved != null) {
      const parsedSaved = JSON.parse(saved)
      if (isMountLevelMap(parsedSaved)) return parsedSaved
      if (isLegacyMountLevelMap(parsedSaved)) {
        const record = parsedSaved as Record<string, unknown>
        const migrated = Object.fromEntries(MOUNT_KEYS.map((key) => [
          key, isMountLevel(record[key]) ? record[key] : 0,
        ])) as MountLevelMap
        window.localStorage.setItem(MOUNT_LEVELS_KEY, JSON.stringify(migrated))
        return migrated
      }
    }
    const raw = window.localStorage.getItem(LEGACY_MOUNT_LEVEL_KEY)
    if (raw == null) return out
    const parsed = JSON.parse(raw)
    if (isMountLevel(parsed)) out.electricScooter = parsed
  } catch {
    // ignore
  }
  return out
}

/**
 * Default unlocked-mounts map: read the previously-selected mount key from
 * localStorage and unlock only that one. Existing single-mount users see no
 * UI change until they explicitly unlock another.
 */
export function legacySeededUnlocked(): UnlockedMap {
  if (typeof window === 'undefined') return defaultUnlockedFor(DEFAULT_MOUNT_KEY)
  try {
    const saved = window.localStorage.getItem(UNLOCKED_MOUNTS_KEY)
    if (saved != null) {
      const parsedSaved = JSON.parse(saved)
      if (isUnlockedMap(parsedSaved)) return parsedSaved
      if (isLegacyBooleanUnlockedMap(parsedSaved)) {
        const record = parsedSaved as Record<string, unknown>
        const migrated = Object.fromEntries(MOUNT_KEYS.map((key) => [
          key, typeof record[key] === 'boolean' ? record[key] : false,
        ])) as UnlockedMap
        window.localStorage.setItem(UNLOCKED_MOUNTS_KEY, JSON.stringify(migrated))
        return migrated
      }
    }
    const raw = window.localStorage.getItem(SELECTED_MOUNT_KEY)
    if (raw == null) return defaultUnlockedFor(DEFAULT_MOUNT_KEY)
    const parsed = JSON.parse(raw)
    if (isMountKey(parsed)) return defaultUnlockedFor(parsed)
  } catch {
    // ignore
  }
  return defaultUnlockedFor(DEFAULT_MOUNT_KEY)
}

function decodeCompactPayload(
  parsed: Record<string, unknown>,
  expectedVersion: 2 | 3,
): ExportedConfig {
  const validShape =
    parsed.version === expectedVersion &&
    Array.isArray(parsed.s) &&
    parsed.s.length === STAT_KEYS.length &&
    parsed.s.every((value) => isFiniteNumber(value)) &&
    Array.isArray(parsed.p) &&
    parsed.p.every((piece) => {
      if (!Array.isArray(piece) || piece.length !== 3) return false
      const [shape, quality, stat] = piece
      return (
        SHAPE_KEYS.includes(shape as (typeof SHAPE_KEYS)[number]) &&
        QUALITIES.some((q) => q.key === quality) &&
        STAT_KEYS.includes(stat as (typeof STAT_KEYS)[number])
      )
    }) &&
    (parsed.m === 'n' || parsed.m === 'f') &&
    Array.isArray(parsed.t) &&
    parsed.t.length === 2 &&
    (parsed.t[0] === 0 || parsed.t[0] === 1) &&
    isFiniteNumber(parsed.t[1]) &&
    parsed.t[1] >= 1

  if (!validShape) throw new Error('Import string data is invalid.')

  let legacyMountLevel: MountLevel = 0
  if (expectedVersion === 3) {
    if (!isMountLevel(parsed.l)) {
      throw new Error('Import string data is invalid.')
    }
    legacyMountLevel = parsed.l
  }

  const statValues = parsed.s as number[]
  const compactPieces = parsed.p as CompactPiece[]
  const [enabledFlag, seconds] = parsed.t as [0 | 1, number]

  const currentStats = STAT_KEYS.reduce<StatTotals>((acc, key, index) => {
    acc[key] = statValues[index]
    return acc
  }, zeroStats())

  const pieces: Piece[] = compactPieces.map(([shape, quality, stat]) => ({
    id: crypto.randomUUID(),
    shape,
    quality,
    stat,
  }))

  return {
    currentStats,
    pieces,
    selectedMountKey: DEFAULT_MOUNT_KEY,
    mountLevels: { ...defaultMountLevels(), electricScooter: legacyMountLevel },
    unlockedMounts: defaultUnlockedFor(DEFAULT_MOUNT_KEY),
    optimizeScope: 'allUnlocked',
    fullTimeLimit: {
      enabled: enabledFlag === 1,
      seconds,
    },
  }
}

function decodeV4Payload(parsed: Record<string, unknown>): ExportedConfig {
  const validBaseShape =
    parsed.version === 4 &&
    Array.isArray(parsed.s) &&
    parsed.s.length === STAT_KEYS.length &&
    parsed.s.every((value) => isFiniteNumber(value)) &&
    Array.isArray(parsed.p) &&
    parsed.p.every((piece) => {
      if (!Array.isArray(piece) || piece.length !== 3) return false
      const [shape, quality, stat] = piece
      return (
        SHAPE_KEYS.includes(shape as (typeof SHAPE_KEYS)[number]) &&
        QUALITIES.some((q) => q.key === quality) &&
        STAT_KEYS.includes(stat as (typeof STAT_KEYS)[number])
      )
    }) &&
    (parsed.m === 'n' || parsed.m === 'f') &&
    isMountKey(parsed.mt) &&
    isLegacyMountLevelMap(parsed.lv) &&
    Array.isArray(parsed.t) &&
    parsed.t.length === 2 &&
    (parsed.t[0] === 0 || parsed.t[0] === 1) &&
    isFiniteNumber(parsed.t[1]) &&
    parsed.t[1] >= 1

  if (!validBaseShape) throw new Error('Import string data is invalid.')

  const statValues = parsed.s as number[]
  const compactPieces = parsed.p as CompactPiece[]
  const [enabledFlag, seconds] = parsed.t as [0 | 1, number]

  const currentStats = STAT_KEYS.reduce<StatTotals>((acc, key, index) => {
    acc[key] = statValues[index]
    return acc
  }, zeroStats())

  const pieces: Piece[] = compactPieces.map(([shape, quality, stat]) => ({
    id: crypto.randomUUID(),
    shape,
    quality,
    stat,
  }))

  const selectedMountKey = parsed.mt as MountKey

  return {
    currentStats,
    pieces,
    selectedMountKey,
    mountLevels: { ...defaultMountLevels(), ...(parsed.lv as object) } as MountLevelMap,
    unlockedMounts: defaultUnlockedFor(selectedMountKey),
    optimizeScope: 'allUnlocked',
    fullTimeLimit: { enabled: enabledFlag === 1, seconds },
  }
}

function decodeV5Payload(parsed: Record<string, unknown>): ExportedConfig {
  const u = parsed.u as Record<string, unknown> | undefined
  const validBaseShape =
    parsed.version === 5 &&
    Array.isArray(parsed.s) &&
    parsed.s.length === STAT_KEYS.length &&
    parsed.s.every((value) => isFiniteNumber(value)) &&
    Array.isArray(parsed.p) &&
    parsed.p.every((piece) => {
      if (!Array.isArray(piece) || piece.length !== 3) return false
      const [shape, quality, stat] = piece
      return (
        SHAPE_KEYS.includes(shape as (typeof SHAPE_KEYS)[number]) &&
        QUALITIES.some((q) => q.key === quality) &&
        STAT_KEYS.includes(stat as (typeof STAT_KEYS)[number])
      )
    }) &&
    (parsed.m === 'n' || parsed.m === 'f') &&
    isMountKey(parsed.mt) &&
    isLegacyMountLevelMap(parsed.lv) &&
    isLegacyUnlockedMap(u) &&
    (parsed.os === 'a' || parsed.os === 'e') &&
    Array.isArray(parsed.t) &&
    parsed.t.length === 2 &&
    (parsed.t[0] === 0 || parsed.t[0] === 1) &&
    isFiniteNumber(parsed.t[1]) &&
    parsed.t[1] >= 1

  if (!validBaseShape) throw new Error('Import string data is invalid.')

  const statValues = parsed.s as number[]
  const compactPieces = parsed.p as CompactPiece[]
  const [enabledFlag, seconds] = parsed.t as [0 | 1, number]

  const currentStats = STAT_KEYS.reduce<StatTotals>((acc, key, index) => {
    acc[key] = statValues[index]
    return acc
  }, zeroStats())

  const pieces: Piece[] = compactPieces.map(([shape, quality, stat]) => ({
    id: crypto.randomUUID(),
    shape,
    quality,
    stat,
  }))

  const selectedMountKey = parsed.mt as MountKey
  const unlockedMounts: UnlockedMap = {
    electricScooter: u!.electricScooter === 1,
    techHoverboard: u!.techHoverboard === 1,
    doomsteed: u!.doomsteed === 1,
    netherflameStalker: false,
    ruinWarskitter: false,
  }
  // Force-unlock the equipped mount: a hand-edited import string could be
  // inconsistent, but the equipped mount must always be unlocked.
  unlockedMounts[selectedMountKey] = true

  return {
    currentStats,
    pieces,
    selectedMountKey,
    mountLevels: { ...defaultMountLevels(), ...(parsed.lv as object) } as MountLevelMap,
    unlockedMounts,
    optimizeScope: parsed.os === 'a' ? 'allUnlocked' : 'equippedOnly',
    fullTimeLimit: { enabled: enabledFlag === 1, seconds },
  }
}

function decodeV6Payload(parsed: Record<string, unknown>): ExportedConfig {
  const u = parsed.u as Record<string, unknown> | undefined
  const validShape =
    parsed.version === 6 &&
    Array.isArray(parsed.s) &&
    parsed.s.length === STAT_KEYS.length &&
    parsed.s.every((value) => isFiniteNumber(value)) &&
    Array.isArray(parsed.p) &&
    parsed.p.every((piece) => {
      if (!Array.isArray(piece) || piece.length !== 3) return false
      const [shape, quality, stat] = piece
      return (
        SHAPE_KEYS.includes(shape as (typeof SHAPE_KEYS)[number]) &&
        QUALITIES.some((q) => q.key === quality) &&
        STAT_KEYS.includes(stat as (typeof STAT_KEYS)[number])
      )
    }) &&
    isMountKey(parsed.mt) &&
    isLegacyMountLevelMap(parsed.lv) &&
    isLegacyUnlockedMap(u) &&
    (parsed.os === 'a' || parsed.os === 'e') &&
    Array.isArray(parsed.t) &&
    parsed.t.length === 2 &&
    (parsed.t[0] === 0 || parsed.t[0] === 1) &&
    isFiniteNumber(parsed.t[1]) &&
    parsed.t[1] >= 1

  if (!validShape) throw new Error('Import string data is invalid.')

  const statValues = parsed.s as number[]
  const compactPieces = parsed.p as CompactPiece[]
  const [enabledFlag, seconds] = parsed.t as [0 | 1, number]

  const currentStats = STAT_KEYS.reduce<StatTotals>((acc, key, index) => {
    acc[key] = statValues[index]
    return acc
  }, zeroStats())

  const pieces: Piece[] = compactPieces.map(([shape, quality, stat]) => ({
    id: crypto.randomUUID(),
    shape,
    quality,
    stat,
  }))

  const selectedMountKey = parsed.mt as MountKey
  const unlockedMounts: UnlockedMap = {
    electricScooter: u!.electricScooter === 1,
    techHoverboard: u!.techHoverboard === 1,
    doomsteed: u!.doomsteed === 1,
    netherflameStalker: false,
    ruinWarskitter: false,
  }
  unlockedMounts[selectedMountKey] = true

  return {
    currentStats,
    pieces,
    selectedMountKey,
    mountLevels: { ...defaultMountLevels(), ...(parsed.lv as object) } as MountLevelMap,
    unlockedMounts,
    optimizeScope: parsed.os === 'a' ? 'allUnlocked' : 'equippedOnly',
    fullTimeLimit: { enabled: enabledFlag === 1, seconds },
  }
}

function decodeModernPayload(
  parsed: Record<string, unknown>,
  expectedVersion: 7 | 9 | 10 = 7,
): ExportedConfig {
  const keys = expectedVersion === 7 ? PRE_RUIN_MOUNT_KEYS : MOUNT_KEYS
  const u = parsed.u as Record<string, unknown> | undefined
  const validShape =
    parsed.version === expectedVersion &&
    (expectedVersion !== 10 || (isFiniteNumber(parsed.vu) && parsed.vu >= 0)) &&
    Array.isArray(parsed.s) &&
    parsed.s.length === STAT_KEYS.length &&
    parsed.s.every((value) => isFiniteNumber(value)) &&
    Array.isArray(parsed.p) &&
    parsed.p.every((piece) => {
      if (!Array.isArray(piece) || piece.length !== 3) return false
      const [shape, quality, stat] = piece
      return (
        SHAPE_KEYS.includes(shape as (typeof SHAPE_KEYS)[number]) &&
        QUALITIES.some((q) => q.key === quality) &&
        STAT_KEYS.includes(stat as (typeof STAT_KEYS)[number])
      )
    }) &&
    isMountKey(parsed.mt) &&
    keys.includes(parsed.mt) &&
    hasMountLevels(parsed.lv, keys) &&
    u != null &&
    keys.every((key) => u[key] === 0 || u[key] === 1) &&
    (parsed.os === 'a' || parsed.os === 'e') &&
    Array.isArray(parsed.t) &&
    parsed.t.length === 2 &&
    (parsed.t[0] === 0 || parsed.t[0] === 1) &&
    isFiniteNumber(parsed.t[1]) &&
    parsed.t[1] >= 1

  if (!validShape) throw new Error('Import string data is invalid.')

  const statValues = parsed.s as number[]
  const currentStats = STAT_KEYS.reduce<StatTotals>((acc, key, index) => {
    acc[key] = statValues[index]
    return acc
  }, zeroStats())
  if (expectedVersion === 10) currentStats.vulnerability = parsed.vu as number
  const pieces = (parsed.p as CompactPiece[]).map(([shape, quality, stat]) => ({
    id: crypto.randomUUID(),
    shape,
    quality,
    stat,
  }))
  const selectedMountKey = parsed.mt as MountKey
  const unlockedMounts = defaultUnlockedFor(selectedMountKey)
  const mountLevels = defaultMountLevels()
  for (const key of keys) {
    unlockedMounts[key] = u![key] === 1
    mountLevels[key] = (parsed.lv as Record<string, MountLevel>)[key]
  }
  unlockedMounts[selectedMountKey] = true
  const [enabledFlag, seconds] = parsed.t as [0 | 1, number]
  return {
    currentStats,
    pieces,
    selectedMountKey,
    mountLevels,
    unlockedMounts,
    optimizeScope: parsed.os === 'a' ? 'allUnlocked' : 'equippedOnly',
    fullTimeLimit: { enabled: enabledFlag === 1, seconds },
  }
}

export function decodeConfig(raw: string): ExportedConfig {
  return decodeConfigPayload(raw)
}

function decodeConfigPayload(raw: string): ExportedConfig {
  if (raw.startsWith(EXPORT_PREFIX_V10)) {
    const payload = raw.slice(EXPORT_PREFIX_V10.length).trim()
    const parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(payload))) as Record<string, unknown>
    return decodeModernPayload(parsed, 10)
  }
  if (raw.startsWith(EXPORT_PREFIX_V9)) {
    const payload = raw.slice(EXPORT_PREFIX_V9.length).trim()
    const parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(payload))) as Record<string, unknown>
    return decodeModernPayload(parsed, 9)
  }
  if (raw.startsWith(EXPORT_PREFIX_V8)) {
    const payload = raw.slice(EXPORT_PREFIX_V8.length).trim()
    const parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(payload))) as Record<string, unknown>
    if (parsed.version !== 8 || (parsed.g !== 0 && parsed.g !== 1)) {
      throw new Error('Import string data is invalid.')
    }
    // Previous search-mode preferences do not affect the current optimizer.
    return decodeModernPayload({ ...parsed, version: 7 })
  }
  if (raw.startsWith(EXPORT_PREFIX_V7)) {
    const payload = raw.slice(EXPORT_PREFIX_V7.length).trim()
    const json = new TextDecoder().decode(base64ToBytes(payload))
    return decodeModernPayload(JSON.parse(json) as Record<string, unknown>)
  }
  if (raw.startsWith(EXPORT_PREFIX_V6)) {
    const payload = raw.slice(EXPORT_PREFIX_V6.length).trim()
    const json = new TextDecoder().decode(base64ToBytes(payload))
    const parsed = JSON.parse(json) as Record<string, unknown>
    return decodeV6Payload(parsed)
  }

  if (raw.startsWith(EXPORT_PREFIX_V5)) {
    const payload = raw.slice(EXPORT_PREFIX_V5.length).trim()
    const json = new TextDecoder().decode(base64ToBytes(payload))
    const parsed = JSON.parse(json) as Record<string, unknown>
    return decodeV5Payload(parsed)
  }

  if (raw.startsWith(EXPORT_PREFIX_V4)) {
    const payload = raw.slice(EXPORT_PREFIX_V4.length).trim()
    const json = new TextDecoder().decode(base64ToBytes(payload))
    const parsed = JSON.parse(json) as Record<string, unknown>
    return decodeV4Payload(parsed)
  }

  if (raw.startsWith(EXPORT_PREFIX_V3)) {
    const payload = raw.slice(EXPORT_PREFIX_V3.length).trim()
    const json = new TextDecoder().decode(base64ToBytes(payload))
    const parsed = JSON.parse(json) as Record<string, unknown>
    return decodeCompactPayload(parsed, 3)
  }

  if (raw.startsWith(EXPORT_PREFIX_V2)) {
    const payload = raw.slice(EXPORT_PREFIX_V2.length).trim()
    const json = new TextDecoder().decode(base64ToBytes(payload))
    const parsed = JSON.parse(json) as Record<string, unknown>
    return decodeCompactPayload(parsed, 2)
  }

  if (raw.startsWith(EXPORT_PREFIX_V1)) {
    const payload = raw.slice(EXPORT_PREFIX_V1.length).trim()
    const json = new TextDecoder().decode(base64ToBytes(payload))
    const parsed = JSON.parse(json) as Record<string, unknown>

    if (
      parsed.version !== 1 ||
      !isStatTotals(parsed.currentStats) ||
      !Array.isArray(parsed.pieces) ||
      !parsed.pieces.every((piece) => isPiece(piece)) ||
      (parsed.mode !== 'normal' && parsed.mode !== 'full') ||
      !isFullTimeLimit(parsed.fullTimeLimit)
    ) {
      throw new Error('Import string data is invalid.')
    }

    return {
      currentStats: { ...zeroStats(), ...parsed.currentStats },
      pieces: parsed.pieces,
      selectedMountKey: DEFAULT_MOUNT_KEY,
      mountLevels: defaultMountLevels(),
      unlockedMounts: defaultUnlockedFor(DEFAULT_MOUNT_KEY),
      optimizeScope: 'allUnlocked',
      fullTimeLimit: parsed.fullTimeLimit,
    }
  }

  throw new Error('Unrecognized import string format.')
}

