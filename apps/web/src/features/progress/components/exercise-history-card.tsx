import {
  countedSets,
  type ExerciseType,
  type SetRow,
  sessionVolume,
  toDisplayWeight,
  type WeightUnit,
} from '@stryde/shared'
import { format } from 'date-fns'
import { Trophy } from 'lucide-react'
import { PRBadge } from '@/components/app/pr-badge'
import type { ExerciseSession } from '@/lib/training'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/workout'

const head = 'pb-1.5 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase'

/**
 * One past session of an exercise, as a small table: set, weight, reps, RIR (or time for
 * timed exercises), a trophy on the set that earned a PR, and a summary line.
 */
export function ExerciseHistoryCard({
  session,
  type,
  unit,
  prCount,
  prSetIds,
}: {
  session: ExerciseSession
  type: ExerciseType
  unit: WeightUnit
  /** PRs achieved in this session (all types, including session volume). */
  prCount: number
  /** Sets that achieved a PR. */
  prSetIds: ReadonlySet<string>
}) {
  const done = session.sets.filter((s) => s.completedAt !== null)
  const working = countedSets(session.sets)
  const timed = type === 'timed'
  const showRir = !timed && done.some((s) => s.targetKind !== 'fixed')
  const showWeight = !timed || done.some((s) => s.weightKg)
  let number = 0

  const volume = sessionVolume(session.sets)
  const totalSec = working.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)
  const summary = [
    `${working.length} ${working.length === 1 ? 'set' : 'sets'}`,
    timed
      ? totalSec > 0 && `${formatDuration(totalSec)} total`
      : volume > 0 && `${toDisplayWeight(volume, unit, 0).toLocaleString()} ${unit} volume`,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <time dateTime={session.date} className="font-semibold">
            {format(new Date(`${session.date}T00:00:00`), 'EEE d MMM yyyy')}
          </time>
          <span className="tnum text-sm text-muted-foreground">{summary.join(' · ')}</span>
        </div>
        {prCount > 0 && <PRBadge count={prCount} className="shrink-0" />}
      </header>

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
          {done.map((set) => {
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
                  {prSetIds.has(set.id) && (
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
    </div>
  )
}

function weightCell(set: SetRow, type: ExerciseType, unit: WeightUnit): string {
  if (!set.weightKg) return type === 'bodyweight' ? 'BW' : '–'
  const value = toDisplayWeight(set.weightKg, unit)
  return type === 'bodyweight' ? `+${value}` : String(value)
}

function RirCell({ set }: { set: SetRow }) {
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
