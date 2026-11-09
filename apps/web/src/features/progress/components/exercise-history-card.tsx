import {
  countedSets,
  type ExerciseType,
  sessionVolume,
  toDisplayWeight,
  type WeightUnit,
} from '@stryde/shared'
import { format } from 'date-fns'
import { PRBadge } from '@/components/app/pr-badge'
import { SetTable } from '@/components/sets/set-table'
import type { ExerciseSession } from '@/lib/training'
import { formatDuration } from '@/lib/workout'
import { formatSpan } from '../use-training'

/**
 * One past session of an exercise: date, a summary line and a PR badge, then its sets
 * as a table (`SetTable`).
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
  const volume = sessionVolume(session.sets)
  const totalSec = working.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)
  // A sport is just the time played: no sets to count or show.
  const summary =
    type === 'sport'
      ? [formatSpan(totalSec * 1000)]
      : [
          `${working.length} ${working.length === 1 ? 'set' : 'sets'}`,
          type === 'timed'
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
      {type !== 'sport' && <SetTable sets={done} type={type} unit={unit} prSetIds={prSetIds} />}
    </div>
  )
}
