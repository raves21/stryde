import { type CalcSet, type DetectedPR, detectPRs, type ExerciseType } from '@stryde/shared'

const HINT_LABELS: Record<DetectedPR['prType'], string> = {
  e1rm: 'e1RM PR',
  weight: 'Weight PR',
  reps_at_weight: 'Rep PR',
  max_reps: 'Reps PR',
  duration: 'Time PR',
  // Session volume belongs to no single set, so it never reaches a row.
  volume: 'Volume PR',
}

/**
 * Set id → chip label for the sets of one exercise that are PRs against `history`
 * (UI_DESIGN.md §5.4). `detectPRs` credits the best set, so when a later set beats an
 * earlier one the chip moves to it. A set with several PRs shows the first (e1RM first).
 */
export function setPRHints(
  exerciseType: ExerciseType,
  history: CalcSet[][],
  sets: CalcSet[],
): Map<string, string> {
  const hints = new Map<string, string>()
  for (const pr of detectPRs(exerciseType, history, sets)) {
    if (pr.setId !== null && !hints.has(pr.setId)) hints.set(pr.setId, HINT_LABELS[pr.prType])
  }
  return hints
}
