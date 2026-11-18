import { useEffect, useState } from 'react'
import { MOUNTS, type MountKey } from '../data/mounts'
import { PanelShell } from './PanelShell'
import type { SearchPhase } from '../optimizer/types'

export interface FullTimeLimit {
  enabled: boolean
  seconds: number
}

export type OptimizeScope = 'allUnlocked' | 'equippedOnly'

interface Props {
  running: boolean
  canRun: boolean
  onRun: () => void
  onCancel: () => void
  fullTimeLimit: FullTimeLimit
  onFullTimeLimitChange: (next: FullTimeLimit) => void
  phase?: SearchPhase
  /**
   * When the player has 2+ unlocked mounts, the panel surfaces a scope
   * toggle. Hidden entirely when only 1 is unlocked (degenerate).
   */
  multipleMountsUnlocked: boolean
  scope: OptimizeScope
  onScopeChange: (next: OptimizeScope) => void
  /**
   * Number of boards a Run will optimize. Used as the fallback denominator for
   * the i/N indicator before the first progress event arrives.
   */
  boardCount: number
  exploredCount?: number
  progressLabel?: string
  /** Per-board completion fraction in [0, 1] from the latest progress event. */
  fractionComplete?: number
  /** 1-based index of the board currently being optimized. */
  boardIndex?: number
  /** Authoritative board count from the optimizer (overrides the prop fallback). */
  progressBoardCount?: number
  /** Mount being optimized right now. */
  currentMountKey?: MountKey
  /** Mounts whose boards are already finished, in solve order. */
  finishedMountKeys?: MountKey[]
}

interface BarProps {
  running: boolean
  phase?: SearchPhase
  /** Per-board time budget in ms (when the time-limit toggle is on). */
  timeBudgetMsPerBoard?: number
  /** Layouts the current board has tiled and scored so far (no known total). */
  exploredCount?: number
  /** Per-board fraction in [0, 1]; only an indicator, the search can stop early. */
  fractionComplete?: number
  boardIndex?: number
  boardCount?: number
  /** Mount being optimized right now. */
  currentMountKey?: MountKey
  /** Mounts whose boards are already finished, in solve order. */
  finishedMountKeys?: MountKey[]
}

/** Largest share of a board's segment the (unreliable) fraction may fill. */
const MAX_PARTIAL_FILL = 0.95

function ProgressBar({
  running,
  phase,
  timeBudgetMsPerBoard,
  exploredCount,
  fractionComplete,
  boardIndex,
  boardCount,
  currentMountKey,
  finishedMountKeys,
}: BarProps) {
  const [elapsedThisBoard, setElapsed] = useState(0)

  useEffect(() => {
    if (!running) return
    const startedAt = performance.now()
    const timer = window.setInterval(() => {
      setElapsed(performance.now() - startedAt)
    }, 100)
    return () => {
      window.clearInterval(timer)
    }
  }, [running])

  if (!running) return null

  const timed = timeBudgetMsPerBoard != null && timeBudgetMsPerBoard > 0 && phase !== 'refining'
  const timePct = timed
    ? Math.min(100, (elapsedThisBoard / timeBudgetMsPerBoard) * 100)
    : 0
  const sharedPhase = phase === 'refining'
  const total = sharedPhase ? 1 : Math.max(1, boardCount ?? 1)
  const current = sharedPhase ? 1 : Math.min(total, Math.max(1, boardIndex ?? 1))
  const partial = Math.min(
    MAX_PARTIAL_FILL,
    Math.max(0, fractionComplete ?? 0),
  )
  const currentMount = currentMountKey ? MOUNTS[currentMountKey] : null
  const finished = finishedMountKeys ?? []

  // One segment per board: finished boards are full, the current board shows
  // its (indicative) fraction on a pulsing fill, later boards are empty. The
  // overall bar therefore only ever moves forward.
  const segments = Array.from({ length: total }, (_, i) => {
    const n = i + 1
    const key =
      n < current ? finished[i] : n === current ? currentMountKey : undefined
    const fill = n < current ? 1 : n === current ? partial : 0
    return { n, key, fill, isCurrent: n === current }
  })

  return (
    <div className="mt-3">
      {sharedPhase && (
        <div className="text-xs text-gray-300 mb-1.5" role="status">
          Improving allocations across mounts…
        </div>
      )}
      {total > 1 && (
        <div className="flex items-center gap-2 text-xs text-gray-300 mb-1.5">
          <span className="tabular-nums">
            Board {current} of {total}
          </span>
          {currentMount && (
            <span className="flex items-center gap-1.5 text-white">
              {currentMount.iconUrl && (
                <img
                  src={currentMount.iconUrl}
                  alt=""
                  className="h-4 w-4 object-contain"
                />
              )}
              {currentMount.name}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-1">
        {segments.map((seg) => (
          <div key={seg.n} className="flex-1 min-w-0">
            <div
              className="h-2.5 rounded-full bg-bg-line overflow-hidden"
              title={seg.key ? MOUNTS[seg.key].name : `Board ${seg.n}`}
            >
              <div
                className={`h-full bg-accent ${seg.isCurrent ? 'animate-pulse' : ''}`}
                style={{
                  width: sharedPhase ? '35%' : `${seg.fill * 100}%`,
                  transition: 'width 200ms linear',
                }}
              />
            </div>
            {total > 1 && (
              <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                {seg.key ? MOUNTS[seg.key].name : '·'}
              </div>
            )}
          </div>
        ))}
      </div>
      {timed && (
        <div className="h-1.5 rounded-full bg-bg-line overflow-hidden mt-1">
          <div
            className="h-full bg-accent/50"
            style={{
              width: `${timePct}%`,
              transition: 'width 100ms linear',
            }}
          />
        </div>
      )}
      <div className="flex justify-between text-[11px] text-gray-500 mt-1">
        <span>
          {(elapsedThisBoard / 1000).toFixed(1)}s {sharedPhase ? 'elapsed' : 'on this board'}
          {timed && ` of ${(timeBudgetMsPerBoard! / 1000).toFixed(0)}s limit`}
        </span>
        {exploredCount != null && exploredCount > 0 && (
          <span>{exploredCount.toLocaleString()} candidates checked</span>
        )}
      </div>
    </div>
  )
}

export function OptimizerPanel({
  running,
  canRun,
  onRun,
  onCancel,
  fullTimeLimit,
  onFullTimeLimitChange,
  phase,
  multipleMountsUnlocked,
  scope,
  onScopeChange,
  boardCount,
  exploredCount,
  progressLabel,
  fractionComplete,
  boardIndex,
  progressBoardCount,
  currentMountKey,
  finishedMountKeys,
}: Props) {
  const timeBudgetMsPerBoard = fullTimeLimit.enabled
    ? fullTimeLimit.seconds * 1000
    : undefined
  const effectiveBoardCount = progressBoardCount ?? boardCount

  return (
    <PanelShell title="Optimizer">
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex flex-col gap-3 min-w-0">
          {multipleMountsUnlocked && (
            <div>
              <div className="inline-flex rounded-full border border-bg-line bg-bg-elev p-0.5">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => onScopeChange('allUnlocked')}
                  aria-pressed={scope === 'allUnlocked'}
                  className={`text-xs px-3 py-1 rounded-full transition disabled:opacity-50 ${
                    scope === 'allUnlocked'
                      ? 'bg-accent text-bg font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  All unlocked mounts
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => onScopeChange('equippedOnly')}
                  aria-pressed={scope === 'equippedOnly'}
                  className={`text-xs px-3 py-1 rounded-full transition disabled:opacity-50 ${
                    scope === 'equippedOnly'
                      ? 'bg-accent text-bg font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Equipped only
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="text-xs text-gray-400 mb-1.5">Time limit</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fullTimeLimit.enabled}
                  disabled={running}
                  onChange={(e) =>
                    onFullTimeLimitChange({
                      ...fullTimeLimit,
                      enabled: e.target.checked,
                    })
                  }
                  className="accent-accent"
                />
                <span>Limit search</span>
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={fullTimeLimit.seconds}
                disabled={!fullTimeLimit.enabled || running}
                onChange={(e) => {
                  const v = Math.max(1, Math.floor(Number(e.target.value) || 0))
                  onFullTimeLimitChange({ ...fullTimeLimit, seconds: v })
                }}
                className="app-input w-20 px-2 py-1 text-xs focus:outline-none focus:border-accent disabled:opacity-50"
              />
              <span className="text-gray-500">
                seconds{boardCount > 1 && ' per board'}
              </span>
              {!fullTimeLimit.enabled && (
                <span className="text-gray-500 italic">
                  · unlimited (cancel to stop)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {running ? (
            <button
              type="button"
              onClick={onCancel}
              className="app-button border-red-500/60 bg-red-700/70 text-white hover:bg-red-600"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={onRun}
              disabled={!canRun}
              className="app-button px-4 py-2 disabled:cursor-not-allowed"
            >
              Run optimizer
            </button>
          )}
        </div>
      </div>

      {running && <ProgressBar
        key={phase === 'refining' ? 'refining' : `board-${boardIndex ?? 1}`}
        running={running}
        phase={phase}
        timeBudgetMsPerBoard={timeBudgetMsPerBoard}
        exploredCount={exploredCount}
        fractionComplete={fractionComplete}
        boardIndex={boardIndex}
        boardCount={effectiveBoardCount}
        currentMountKey={currentMountKey}
        finishedMountKeys={finishedMountKeys}
      />}

      {progressLabel && (
        <div className="mt-2 text-xs text-gray-400">{progressLabel}</div>
      )}
    </PanelShell>
  )
}
