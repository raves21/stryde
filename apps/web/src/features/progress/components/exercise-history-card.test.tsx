// @vitest-environment happy-dom
import type { SetRow } from '@stryde/shared'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ExerciseSession } from '@/lib/training'
import { ExerciseHistoryCard } from './exercise-history-card'

const base: SetRow = {
  id: 's',
  userId: 'u',
  createdAt: '2026-10-21T10:00:00.000Z',
  updatedAt: '2026-10-21T10:00:00.000Z',
  deletedAt: null,
  sessionExerciseId: 'se',
  position: 0,
  setType: 'working',
  targetKind: 'fixed',
  targetReps: null,
  targetRepsMax: null,
  targetRir: null,
  weightKg: 80,
  reps: 8,
  rir: null,
  durationSec: null,
  completedAt: '2026-10-21T10:10:00.000Z',
}
const set = (id: string, over: Partial<SetRow> = {}): SetRow => ({ ...base, id, ...over })
const session = (sets: SetRow[]): ExerciseSession => ({
  sessionId: 'x',
  date: '2026-10-21',
  at: '2026-10-21T11:00:00.000Z',
  sets,
})

const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((c) => c.textContent)
const dataRows = () => screen.getAllByRole('row').slice(1)

describe('ExerciseHistoryCard', () => {
  afterEach(cleanup)

  it('lays a weighted session out as a table with date, summary and numbered sets', () => {
    render(
      <ExerciseHistoryCard
        session={session([
          set('w', { setType: 'warmup', weightKg: 40, reps: 10 }),
          set('a', { weightKg: 82.5, reps: 6 }),
          set('b', { weightKg: 82.5, reps: 6 }),
        ])}
        type="weighted"
        unit="kg"
        prCount={0}
        prSetIds={new Set()}
      />,
    )
    expect(screen.getByText('Wed 21 Oct 2026')).toBeTruthy()
    // Working sets only in the summary; volume = 82.5 × 6 × 2 = 990.
    expect(screen.getByText('2 sets · 990 kg volume')).toBeTruthy()
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Set',
      'kg',
      'Reps',
      'Personal record',
    ])
    expect(dataRows().map(cells)).toEqual([
      ['W', '40', '10', ''],
      ['1', '82.5', '6', ''],
      ['2', '82.5', '6', ''],
    ])
    expect(screen.queryByText('Wed 21 Oct 2026 PRs')).toBeNull()
  })

  it('shows RIR and failure per set, and a trophy plus a badge for PRs', () => {
    render(
      <ExerciseHistoryCard
        session={session([
          set('a', { targetKind: 'rir', rir: 1 }),
          set('b', { targetKind: 'failure', rir: 0, reps: 5 }),
          set('c'),
        ])}
        type="weighted"
        unit="kg"
        prCount={2}
        prSetIds={new Set(['b'])}
      />,
    )
    expect(screen.getByText('2 PRs')).toBeTruthy()
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('RIR')
    const rows = dataRows()
    expect(cells(rows[0] as HTMLElement)[3]).toBe('@1')
    expect(cells(rows[1] as HTMLElement)[3]).toBe('F')
    expect(cells(rows[2] as HTMLElement)[3]).toBe('–')
    expect(within(rows[1] as HTMLElement).getAllByText('Personal record').length).toBeGreaterThan(0)
    expect(within(rows[0] as HTMLElement).queryByText('Personal record')).toBeNull()
  })

  it('converts weights to the display unit', () => {
    render(
      <ExerciseHistoryCard
        session={session([set('a', { weightKg: 100, reps: 5 })])}
        type="weighted"
        unit="lb"
        prCount={0}
        prSetIds={new Set()}
      />,
    )
    expect(screen.getByRole('columnheader', { name: 'lb' })).toBeTruthy()
    expect(cells(dataRows()[0] as HTMLElement)[1]).toBe('220.5')
  })

  it('bodyweight: "BW" without added weight, "+10" with it', () => {
    render(
      <ExerciseHistoryCard
        session={session([
          set('a', { weightKg: null, reps: 12 }),
          set('b', { weightKg: 10, reps: 8 }),
        ])}
        type="bodyweight"
        unit="kg"
        prCount={0}
        prSetIds={new Set()}
      />,
    )
    expect(screen.getByRole('columnheader', { name: '+kg' })).toBeTruthy()
    expect(dataRows().map((r) => cells(r)[1])).toEqual(['BW', '+10'])
  })

  it('timed: time column, total in the summary, no weight column without weights', () => {
    render(
      <ExerciseHistoryCard
        session={session([
          set('a', { weightKg: null, reps: null, durationSec: 60 }),
          set('b', { weightKg: null, reps: null, durationSec: 90 }),
        ])}
        type="timed"
        unit="kg"
        prCount={0}
        prSetIds={new Set()}
      />,
    )
    expect(screen.getByText('2 sets · 2:30 total')).toBeTruthy()
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Set',
      'Time',
      'Personal record',
    ])
    expect(dataRows().map((r) => cells(r)[1])).toEqual(['1:00', '1:30'])
  })

  it('leaves out sets that were never completed', () => {
    render(
      <ExerciseHistoryCard
        session={session([set('a'), set('b', { completedAt: null })])}
        type="weighted"
        unit="kg"
        prCount={0}
        prSetIds={new Set()}
      />,
    )
    expect(dataRows()).toHaveLength(1)
  })
})
