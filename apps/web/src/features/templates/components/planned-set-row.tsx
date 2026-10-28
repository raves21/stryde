import {
  type ExerciseType,
  fromInputWeight,
  type TemplateSetRow,
  toDisplayWeight,
  type WeightUnit,
} from '@stryde/shared'
import { NumberInput } from '@/components/app/number-input'
import type { RowPatch } from '@/db/repositories/core'
import { RepsTargetInput } from './reps-target-input'
import { SetBadge } from './set-badge'

/** One planned set: badge (tap → options) · target · planned weight. */
export function PlannedSetRow({
  set,
  number,
  exerciseType,
  unit,
  onChange,
  onChangeLater,
  onOpenOptions,
}: {
  set: TemplateSetRow
  /** Working-set number (warm-ups show W). */
  number: number
  exerciseType: ExerciseType
  unit: WeightUnit
  onChange: (patch: RowPatch<'templateSets'>) => void
  /** Debounced variant for per-keystroke edits. */
  onChangeLater: (patch: RowPatch<'templateSets'>) => void
  onOpenOptions: () => void
}) {
  const label = set.setType === 'warmup' ? 'Warm-up set' : `Set ${number}`
  return (
    <div className="grid grid-cols-[48px_1fr_1fr] items-center gap-2">
      <button
        type="button"
        onClick={onOpenOptions}
        aria-label={`${label} options`}
        className="flex min-h-12 items-center justify-center rounded-lg hover:bg-surface-2"
      >
        <SetBadge
          setType={set.setType}
          number={number}
          targetKind={set.targetKind}
          targetRir={set.targetRir}
        />
      </button>

      {exerciseType === 'timed' ? (
        <NumberInput
          aria-label={`${label} duration in seconds`}
          value={set.plannedDurationSec}
          suffix="s"
          placeholder="60"
          onValueChange={(v) => onChangeLater({ plannedDurationSec: v })}
        />
      ) : set.targetKind === 'failure' && set.targetReps === null ? (
        <button
          type="button"
          onClick={onOpenOptions}
          className="flex h-[52px] items-center justify-center rounded-lg bg-surface-2 text-sm text-muted-foreground"
        >
          To failure
        </button>
      ) : (
        <RepsTargetInput
          aria-label={`${label} target reps`}
          reps={set.targetReps}
          repsMax={set.targetRepsMax}
          onCommit={(targetReps, targetRepsMax) => onChange({ targetReps, targetRepsMax })}
        />
      )}

      <NumberInput
        aria-label={`${label} planned weight in ${unit}`}
        decimal
        value={set.plannedWeightKg === null ? null : toDisplayWeight(set.plannedWeightKg, unit, 2)}
        placeholder="–"
        onValueChange={(v) =>
          onChangeLater({ plannedWeightKg: v === null ? null : fromInputWeight(v, unit) })
        }
      />
    </div>
  )
}
