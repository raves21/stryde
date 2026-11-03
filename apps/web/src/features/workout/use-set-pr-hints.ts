import type { ExerciseRow, SetRow } from '@stryde/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { getExerciseHistory } from '@/db/repositories/sessions'
import { setPRHints } from './set-pr-hints'

const NO_HINTS = new Map<string, string>()

/**
 * PR chip labels per set id for one exercise card of an in-progress workout. History
 * comes from Dexie, so it works offline; `enabled` is false for finished sessions, where
 * "PR" would have to be judged against that session's own past, not all other sessions.
 */
export function useSetPRHints(
  exercise: ExerciseRow | null | undefined,
  exerciseId: string,
  sessionId: string,
  sets: SetRow[],
  enabled: boolean,
): Map<string, string> {
  const history = useLiveQuery(
    () => (enabled ? getExerciseHistory(exerciseId, sessionId) : undefined),
    [enabled, exerciseId, sessionId],
  )
  const type = exercise?.type
  return useMemo(
    () => (history && type ? setPRHints(type, history, sets) : NO_HINTS),
    [history, type, sets],
  )
}
