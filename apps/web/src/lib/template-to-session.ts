import type { SessionExerciseRow, SessionRow, SetRow } from '@stryde/shared'
import type { TemplateTree } from '@/db/repositories/templates'
import { localDateIn } from './dates'
import { matchPrevious, prefill } from './workout'

export type SessionFromTemplate = {
  session: SessionRow
  sessionExercises: SessionExerciseRow[]
  sets: SetRow[]
}

/**
 * Copy a template into new session rows (PRODUCT_SPEC.md §4.2): order, supersets, rest,
 * targets and planned weights, with fresh ids, so later template edits never touch the
 * session. Sets are pre-filled by the §4.3 rules from `previousSets` (last time's
 * completed sets per exercise) and the planned values.
 */
export function templateToSession(
  tree: TemplateTree,
  options: {
    userId: string
    now: Date
    timezone: string
    shareWithFriends: boolean
    newId: () => string
    previousSets?: ReadonlyMap<string, SetRow[]>
  },
): SessionFromTemplate {
  const { userId, now, timezone, newId } = options
  const at = now.toISOString()
  const common = { userId, createdAt: at, updatedAt: at, deletedAt: null }

  const session: SessionRow = {
    ...common,
    id: newId(),
    templateId: tree.template.id,
    name: tree.template.name,
    startedAt: at,
    finishedAt: null,
    timezone,
    localDate: localDateIn(now, timezone),
    notes: null,
    shareWithFriends: options.shareWithFriends,
  }

  const sessionExercises: SessionExerciseRow[] = []
  const sets: SetRow[] = []
  tree.exercises.forEach(({ row, sets: plannedSets }, position) => {
    const se: SessionExerciseRow = {
      ...common,
      id: newId(),
      sessionId: session.id,
      exerciseId: row.exerciseId,
      position,
      supersetGroup: row.supersetGroup,
      restSeconds: row.restSeconds,
    }
    sessionExercises.push(se)
    const previous = matchPrevious(plannedSets, options.previousSets?.get(row.exerciseId) ?? [])
    plannedSets.forEach((planned, setPosition) => {
      sets.push({
        ...common,
        id: newId(),
        sessionExerciseId: se.id,
        position: setPosition,
        setType: planned.setType,
        targetKind: planned.targetKind,
        targetReps: planned.targetReps,
        targetRepsMax: planned.targetRepsMax,
        targetRir: planned.targetRir,
        ...prefill(planned, previous[setPosition], {
          weightKg: planned.plannedWeightKg,
          durationSec: planned.plannedDurationSec,
        }),
        completedAt: null,
      })
    })
  })

  return { session, sessionExercises, sets }
}
