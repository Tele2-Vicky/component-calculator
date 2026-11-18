import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OptimizerPanel } from './OptimizerPanel'

afterEach(cleanup)

const props = () => ({
  running: false, canRun: true, onRun: vi.fn(), onCancel: vi.fn(),
  fullTimeLimit: { enabled: true, seconds: 120 }, onFullTimeLimitChange: vi.fn(),
  multipleMountsUnlocked: true, scope: 'allUnlocked' as const, onScopeChange: vi.fn(), boardCount: 2,
})

describe('optimizer controls', () => {
  it('offers the fast search with per-board limits and no search-mode checkbox', () => {
    const input = props()
    render(<OptimizerPanel {...input} />)
    expect(screen.queryByRole('checkbox', { name: 'Greedy' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Limit search' })).toBeChecked()
    expect(screen.getByText('seconds per board')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run optimizer' }))
    expect(input.onRun).toHaveBeenCalledOnce()
  })

  it('keeps cancellation available while refining the allocation', () => {
    const input = props()
    render(<OptimizerPanel {...input} running phase="refining" />)
    expect(screen.getByRole('checkbox', { name: 'Limit search' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Improving allocations across mounts')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(input.onCancel).toHaveBeenCalledOnce()
  })
})
