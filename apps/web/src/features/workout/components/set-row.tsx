import {
  type ExerciseType,
  fromInputWeight,
  type SetRow as SetRowData,
  setCompletionError,
  toDisplayWeight,
  type WeightUnit,
} from '@stryde/shared'
import { Check } from 'lucide-react'
import { type PointerEvent, useRef, useState } from 'react'
import { NumberInput } from '@/components/app/number-input'
import { DurationInput } from '@/components/sets/duration-input'
import { SetBadge } from '@/components/sets/set-badge'
import { cn } from '@/lib/utils'
import { formatPrevious } from '@/lib/workout'

export type SetPatch = Partial<
  Pick<SetRowData, 'weightKg' | 'reps' | 'rir' | 'durationSec' | 'completedAt'>
>

/** Column template shared by the header and rows of one card. */
export function setGridClass(type: ExerciseType, showRir: boolean) {
  if (type === 'timed') return 'grid-cols-[36px_minmax(0,1fr)_60px_72px_48px]'
  return showRir
    ? 'grid-cols-[36px_minmax(0,1fr)_60px_52px_40px_48px]'
    : 'grid-cols-[36px_minmax(0,1fr)_64px_60px_48px]'
}

const SWIPE_DELETE_PX = 80

/**
 * One logged set (UI_DESIGN.md §5.4): badge (tap → options) · previous (tap → copy) ·
 * weight · reps · RIR · ✓. Swipe left to delete.
 */
export function SetRow({
  set,
  number,
  previous,
  type,
  unit,
  showRir,
  onChange,
  onToggleComplete,
  onOpenOptions,
  onCopyPrevious,
  onDelete,
}: {
  set: SetRowData
  /** Working-set number (warm-ups show W). */
  number: number
  previous: SetRowData | undefined
  type: ExerciseType
  unit: WeightUnit
  showRir: boolean
  onChange: (patch: SetPatch) => void
  onToggleComplete: () => void
  onOpenOptions: () => void
  onCopyPrevious: () => void
  onDelete: () => void
}) {
  const label = set.setType === 'warmup' ? 'Warm-up set' : `Set ${number}`
  const completed = set.completedAt !== null
  const canComplete = completed || setCompletionError({ ...set, completedAt: 'now' }, type) === null
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null)

  // Swipe starts only outside inputs and buttons, so typing and tapping stay unaffected.
  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('input,button')) return
    start.current = { x: e.clientX, y: e.clientY, active: false }
  }
  function onPointerMove(e: PointerEvent) {
    const s = start.current
    if (!s) return
    const x = e.clientX - s.x
    if (!s.active && Math.abs(e.clientY - s.y) > 10) {
      start.current = null
      return
    }
    if (!s.active && x < -10) s.active = true
    if (s.active) setDx(Math.min(0, x))
  }
  function onPointerEnd() {
    if (start.current?.active && dx < -SWIPE_DELETE_PX) onDelete()
    start.current = null
    setDx(0)
  }

  return (
    <div className="relative overflow-hidden rounded-[10px]">
      {/* Only while swiping: the completed tint is translucent and would show it. */}
      {dx < 0 && (
        <div
          className="absolute inset-0 flex items-center justify-end bg-failure/20 pr-4 text-sm font-medium text-failure"
          aria-hidden
        >
          Delete
        </div>
      )}
      <fieldset
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        className={cn(
          'relative m-0 grid min-w-0 touch-pan-y items-center gap-1 border-0 bg-surface p-0 py-0.5 transition-colors',
          setGridClass(type, showRir),
          completed && 'bg-brand-dim',
          !dx && 'transition-transform',
        )}
      >
        <button
          type="button"
          onClick={onOpenOptions}
          aria-label={`${label} options`}
          className="flex min-h-12 items-center justify-center rounded-lg"
        >
          <SetBadge
            setType={set.setType}
            number={number}
            targetKind={set.targetKind}
            targetRir={set.targetRir}
          />
        </button>

        <button
          type="button"
          onClick={onCopyPrevious}
          disabled={!previous}
          aria-label={
            previous ? `Copy previous: ${formatPrevious(previous, type, unit)}` : 'No previous set'
          }
          className="tnum min-h-12 truncate text-left text-sm text-faint"
        >
          {previous ? formatPrevious(previous, type, unit) : '–'}
        </button>

        <NumberInput
          aria-label={`${label} ${type === 'bodyweight' ? 'added weight' : 'weight'} in ${unit}`}
          decimal
          value={set.weightKg === null ? null : toDisplayWeight(set.weightKg, unit, 2)}
          placeholder={
            previous?.weightKg != null ? String(toDisplayWeight(previous.weightKg, unit)) : '–'
          }
          onValueChange={(v) =>
            onChange({ weightKg: v === null ? null : fromInputWeight(v, unit) })
          }
          className="px-1"
        />

        {type === 'timed' ? (
          <DurationInput
            aria-label={`${label} time`}
            value={set.durationSec}
            placeholder={previous?.durationSec != null ? undefined : '0:00'}
            onCommit={(durationSec) => onChange({ durationSec })}
          />
        ) : (
          <NumberInput
            aria-label={`${label} reps`}
            value={set.reps}
            placeholder={
              previous?.reps != null ? String(previous.reps) : (set.targetReps?.toString() ?? '–')
            }
            onValueChange={(reps) => onChange({ reps })}
            className="px-1"
          />
        )}

        {type !== 'timed' &&
          showRir &&
          (set.targetKind === 'rir' ? (
            <NumberInput
              aria-label={`${label} RIR`}
              value={set.rir}
              onValueChange={(rir) => onChange({ rir: rir === null ? null : Math.min(rir, 10) })}
              className="px-0"
            />
          ) : (
            <span className="text-center font-display text-base font-bold text-faint">
              {set.targetKind === 'failure' ? <span className="text-failure">F</span> : '–'}
            </span>
          ))}

        <button
          type="button"
          onClick={onToggleComplete}
          disabled={!canComplete}
          aria-pressed={completed}
          aria-label={completed ? `${label} completed` : `Complete ${label.toLowerCase()}`}
          className={cn(
            'flex size-12 items-center justify-center rounded-[10px] border transition-colors',
            completed
              ? 'border-brand bg-brand text-primary-foreground'
              : 'border-border bg-surface-2 text-muted-foreground disabled:bg-transparent disabled:text-faint',
          )}
        >
          <Check className="size-6" strokeWidth={completed ? 3 : 2} />
        </button>
      </fieldset>
    </div>
  )
}
