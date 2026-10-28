import { type SetRow, setCompletionError, type TargetKind } from '@stryde/shared'
import { toast } from 'sonner'
import type { SessionTree } from '@/db/repositories/sessions'
import {
  addSetToExercise,
  removeFromSuperset,
  removeSessionExercise,
  reorderSessionExercises,
  replaceSessionExercise,
  supersetWithNext,
  updateSessionExercise,
} from '@/db/repositories/sessions'
import { removeSet, restoreSet, updateSet } from '@/db/repositories/sets'
import { useSettings } from '@/features/settings/use-settings'
import { restAfter, targetKindPatch } from '@/lib/workout'
import type { SetPatch } from './components/set-row'
import { clearRestTimer, startRestTimer } from './rest-timer'

type Item = SessionTree['exercises'][number]

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save')
  }
}

/**
 * Every workout edit goes straight to the repositories (no in-memory state), so a killed
 * app resumes exactly. `mode: 'edit'` is a finished session: no rest timer, and
 * completing a set dates it at the session's finish time.
 */
export function useWorkoutActions(tree: SessionTree, mode: 'active' | 'edit') {
  const settings = useSettings()
  const ids = tree.exercises.map((e) => e.row.id)

  function changeSet(item: Item, set: SetRow, patch: SetPatch) {
    const type = item.exercise?.type ?? 'weighted'
    const next = { ...set, ...patch }
    // Clearing a required value un-completes the set rather than failing validation.
    if (next.completedAt !== null && setCompletionError(next, type) !== null) {
      patch = { ...patch, completedAt: null }
      if (mode === 'active') void clearRestTimer(set.id)
    }
    void run(() => updateSet(set.id, patch))
  }

  function toggleComplete(item: Item, set: SetRow) {
    if (set.completedAt !== null) {
      void run(() => updateSet(set.id, { completedAt: null }))
      if (mode === 'active') void clearRestTimer(set.id)
      return
    }
    const completedAt =
      mode === 'edit'
        ? (tree.session.finishedAt ?? new Date().toISOString())
        : new Date().toISOString()
    void run(async () => {
      await updateSet(set.id, { completedAt })
      if (mode !== 'active') return
      navigator.vibrate?.(10)
      const rest = restAfter({
        set,
        sessionExercise: item.row,
        sessionExercises: tree.exercises.map((e) => e.row),
        exercise: item.exercise,
        defaultRestSeconds: settings?.defaultRestSeconds ?? 120,
      })
      if (rest)
        await startRestTimer({ durationSec: rest, sessionId: tree.session.id, setId: set.id })
    })
  }

  function changeKind(set: SetRow, kind: TargetKind) {
    const patch = targetKindPatch(set, kind)
    // A kind change can make a completed set invalid (e.g. now needs RIR): un-complete.
    void run(() => updateSet(set.id, set.completedAt ? { ...patch, completedAt: null } : patch))
  }

  function deleteSet(set: SetRow) {
    void run(async () => {
      await removeSet(set.id)
      if (mode === 'active') await clearRestTimer(set.id)
      toast('Set deleted', {
        action: { label: 'Undo', onClick: () => void run(() => restoreSet(set.id)) },
      })
    })
  }

  return {
    changeSet,
    toggleComplete,
    changeKind,
    deleteSet,
    changeTargets: (set: SetRow, patch: Partial<SetRow>) =>
      void run(() => updateSet(set.id, patch)),
    copyPrevious(item: Item, set: SetRow, previous: SetRow) {
      changeSet(item, set, {
        weightKg: previous.weightKg,
        durationSec: previous.durationSec,
        ...(set.targetKind === 'failure'
          ? { reps: previous.reps }
          : { reps: previous.reps, rir: set.targetKind === 'rir' ? previous.rir : null }),
      })
    },
    addSet: (item: Item) => void run(() => addSetToExercise(item.row.id)),
    move: (item: Item, d: -1 | 1) => {
      const i = ids.indexOf(item.row.id)
      const order = [...ids]
      const [moved] = order.splice(i, 1)
      if (moved) order.splice(i + d, 0, moved)
      void run(() => reorderSessionExercises(tree.session.id, order, item.row.id))
    },
    replace: (item: Item, exerciseId: string) =>
      void run(() => replaceSessionExercise(item.row.id, exerciseId)),
    supersetWithNext: (item: Item) => void run(() => supersetWithNext(item.row.id)),
    removeFromSuperset: (item: Item) => void run(() => removeFromSuperset(item.row.id)),
    setRest: (item: Item, restSeconds: number | null) =>
      void run(() => updateSessionExercise(item.row.id, { restSeconds })),
    removeExercise: (item: Item) => void run(() => removeSessionExercise(item.row.id)),
  }
}

export type WorkoutActions = ReturnType<typeof useWorkoutActions>
