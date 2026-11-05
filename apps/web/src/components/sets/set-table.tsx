import { type ExerciseType, type SetRow, toDisplayWeight, type WeightUnit } from '@stryde/shared'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/workout'

/** The fields a logged set is shown with; callers pass completed sets only. */
export type TableSet = Pick<
  SetRow,
  'id' | 'setType' | 'targetKind' | 'weightKg' | 'reps' | 'rir' | 'durationSec'
>

const head = 'pb-1.5 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase'

/**
 * Logged sets as a small table: set badge (`W` or the working-set number), weight, reps (or
 * time), RIR / failure when any set has them, and a trophy on the sets that earned a PR.
 * Shared by the exercise history cards and the session details.
 */
export function SetTable({
  sets,
  type,
  unit,
  prSetIds,
}: {
  sets: TableSet[]
  type: ExerciseType
  unit: WeightUnit
  /** Sets that achieved a PR (empty when unknown, e.g. a friend's workout). */
  prSetIds?: ReadonlySet<string>
}) {
  const timed = type === 'timed'
  const showRir = !timed && sets.some((s) => s.targetKind !== 'fixed')
  const showWeight = !timed || sets.some((s) => s.weightKg)
  let number = 0

  return (
    <table className="tnum w-full table-fixed text-sm">
      <thead>
        <tr>
          <th scope="col" className={cn(head, 'w-12 text-left')}>
            Set
          </th>
          {showWeight && (
            <th scope="col" className={cn(head, 'text-center')}>
              {type === 'bodyweight' ? `+${unit}` : unit}
            </th>
          )}
          <th scope="col" className={cn(head, 'text-center')}>
            {timed ? 'Time' : 'Reps'}
          </th>
          {showRir && (
            <th scope="col" className={cn(head, 'text-center')}>
              RIR
            </th>
          )}
          <th scope="col" className="w-8">
            <span className="sr-only">Personal record</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {sets.map((set) => {
          const warmup = set.setType === 'warmup'
          if (!warmup) number += 1
          return (
            <tr
              key={set.id}
              className={cn('border-t border-border/60', warmup && 'text-muted-foreground')}
            >
              <td className="py-1.5">
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-md bg-surface-3 font-display text-sm font-bold',
                    warmup && 'text-warmup',
                  )}
                  title={warmup ? 'Warm-up' : undefined}
                >
                  {warmup ? 'W' : number}
                </span>
              </td>
              {showWeight && (
                <td className="py-1.5 text-center text-base font-medium">
                  {weightCell(set, type, unit)}
                </td>
              )}
              <td className="py-1.5 text-center text-base font-medium">
                {timed
                  ? set.durationSec === null
                    ? '–'
                    : formatDuration(set.durationSec)
                  : (set.reps ?? '–')}
              </td>
              {showRir && (
                <td className="py-1.5 text-center">
                  <RirCell set={set} />
                </td>
              )}
              <td className="py-1.5 pl-2 text-right">
                {prSetIds?.has(set.id) && (
                  <>
                    <Trophy className="ml-auto size-4 text-pr" aria-hidden />
                    <span className="sr-only">Personal record</span>
                  </>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function weightCell(set: TableSet, type: ExerciseType, unit: WeightUnit): string {
  if (!set.weightKg) return type === 'bodyweight' ? 'BW' : '–'
  const value = toDisplayWeight(set.weightKg, unit)
  return type === 'bodyweight' ? `+${value}` : String(value)
}

function RirCell({ set }: { set: TableSet }) {
  if (set.targetKind === 'failure') {
    return (
      <span className="rounded bg-failure/15 px-1.5 py-0.5 font-display text-xs font-bold text-failure">
        F
      </span>
    )
  }
  if (set.targetKind === 'rir' && set.rir !== null) {
    return <span className="font-display text-sm font-bold text-rir">@{set.rir}</span>
  }
  return <span className="text-faint">–</span>
}
