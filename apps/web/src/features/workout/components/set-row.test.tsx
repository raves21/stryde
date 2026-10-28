// @vitest-environment happy-dom
import type { SetRow as SetRowData } from '@stryde/shared'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SetRow } from './set-row'

const base: SetRowData = {
  id: '01a16d28-9e70-750e-917d-ccf0c6e2dfd5',
  userId: '01a16d28-9e71-700c-8c73-3421a4a90d4e',
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-28T10:00:00.000Z',
  deletedAt: null,
  sessionExerciseId: '01a16d28-9e71-700c-8c74-4a445ff58997',
  position: 0,
  setType: 'working',
  targetKind: 'fixed',
  targetReps: 8,
  targetRepsMax: null,
  targetRir: null,
  weightKg: 80,
  reps: 8,
  rir: null,
  durationSec: null,
  completedAt: null,
}

function renderRow(set: Partial<SetRowData>, type: 'weighted' | 'timed' = 'weighted') {
  const onToggleComplete = vi.fn()
  const onChange = vi.fn()
  render(
    <SetRow
      set={{ ...base, ...set }}
      number={1}
      previous={undefined}
      type={type}
      unit="kg"
      showRir
      onChange={onChange}
      onToggleComplete={onToggleComplete}
      onOpenOptions={() => {}}
      onCopyPrevious={() => {}}
      onDelete={() => {}}
    />,
  )
  return {
    onToggleComplete,
    onChange,
    check: screen.getByRole('button', { name: /complete set 1|set 1 completed/i }),
  }
}

describe('SetRow', () => {
  afterEach(cleanup)

  it.each([
    ['fixed set with pre-filled reps', { targetKind: 'fixed', reps: 8 }, true],
    ['RIR set without reps', { targetKind: 'rir', targetRir: 2, reps: null, rir: 2 }, false],
    ['RIR set with reps', { targetKind: 'rir', targetRir: 2, reps: 9, rir: 2 }, true],
    [
      'RIR set with reps but no RIR',
      { targetKind: 'rir', targetRir: 2, reps: 9, rir: null },
      false,
    ],
    ['failure set without reps', { targetKind: 'failure', reps: null, rir: 0 }, false],
    ['failure set with reps', { targetKind: 'failure', reps: 7, rir: 0 }, true],
  ] as const)('%s → ✓ enabled: %s', (_, set, enabled) => {
    const { check } = renderRow(set)
    expect((check as HTMLButtonElement).disabled).toBe(!enabled)
  })

  it('a completed set can always be un-ticked', async () => {
    const { check, onToggleComplete } = renderRow({ completedAt: '2026-10-28T10:05:00.000Z' })
    expect(check.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(check)
    expect(onToggleComplete).toHaveBeenCalledOnce()
  })

  it('a timed set needs a duration', () => {
    const disabled = (b: HTMLElement) => (b as HTMLButtonElement).disabled
    expect(disabled(renderRow({ reps: null, durationSec: null }, 'timed').check)).toBe(true)
    cleanup()
    expect(disabled(renderRow({ reps: null, durationSec: 60 }, 'timed').check)).toBe(false)
  })

  it('typing reps on a failure set reports them', async () => {
    const { onChange } = renderRow({ targetKind: 'failure', reps: null, rir: 0 })
    await userEvent.type(screen.getByLabelText('Set 1 reps'), '7')
    expect(onChange).toHaveBeenLastCalledWith({ reps: 7 })
  })
})
