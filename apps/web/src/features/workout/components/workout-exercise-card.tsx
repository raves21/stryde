import type { SetRow as SetRowData, WeightUnit } from '@stryde/shared'
import { ArrowDown, ArrowUp, Ellipsis, Link2, Link2Off, Plus, Replace, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { SetOptionsSheet } from '@/components/sets/set-options-sheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SessionTree } from '@/db/repositories/sessions'
import { ExercisePicker } from '@/features/exercises/components/exercise-picker'
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, REST_OPTIONS } from '@/features/exercises/labels'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/workout'
import type { WorkoutActions } from '../use-workout-actions'
import { SetRow, setGridClass } from './set-row'

type Item = SessionTree['exercises'][number]

/** One exercise of a workout with its set rows (UI_DESIGN.md §5.4). */
export function WorkoutExerciseCard({
  item,
  supersetLabel,
  unit,
  isFirst,
  isLast,
  actions,
}: {
  item: Item
  supersetLabel: string | null
  unit: WeightUnit
  isFirst: boolean
  isLast: boolean
  actions: WorkoutActions
}) {
  const { row, exercise, sets, previous } = item
  const [optionsFor, setOptionsFor] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const type = exercise?.type ?? 'weighted'
  const name = exercise?.name ?? 'Unknown exercise'
  const showRir = sets.some((s) => s.targetKind !== 'fixed')
  const optionsSet = sets.find((s) => s.id === optionsFor) ?? null
  const hasCompleted = sets.some((s) => s.completedAt !== null)
  let working = 0

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4',
        supersetLabel && 'border-l-[3px] border-l-brand',
      )}
    >
      <header className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            {supersetLabel && (
              <span className="rounded-full bg-brand-dim px-2 font-display text-sm font-bold text-brand">
                {supersetLabel}
              </span>
            )}
            <h2 className="truncate font-semibold">{name}</h2>
          </div>
          {exercise && (
            <p className="text-sm text-muted-foreground">
              {EQUIPMENT_LABELS[exercise.equipment]} · {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-2 -mt-1"
              aria-label={`${name} options`}
            >
              <Ellipsis className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isFirst} onSelect={() => actions.move(item, -1)}>
              <ArrowUp /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onSelect={() => actions.move(item, 1)}>
              <ArrowDown /> Move down
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setReplacing(true)}>
              <Replace /> Replace exercise
            </DropdownMenuItem>
            {row.supersetGroup ? (
              <DropdownMenuItem onSelect={() => actions.removeFromSuperset(item)}>
                <Link2Off /> Remove from superset
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled={isLast} onSelect={() => actions.supersetWithNext(item)}>
                <Link2 /> Superset with next
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                hasCompleted ? setConfirmRemove(true) : actions.removeExercise(item)
              }
            >
              <Trash2 /> Remove exercise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="-mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rest</span>
        <Select
          value={row.restSeconds === null ? 'default' : String(row.restSeconds)}
          onValueChange={(v) => actions.setRest(item, v === 'default' ? null : Number(v))}
        >
          <SelectTrigger
            size="sm"
            className="tnum w-auto gap-1 border-none bg-surface-2 data-[size=sm]:h-9"
            aria-label={`Rest after ${name}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">
              Default
              {exercise?.defaultRestSeconds
                ? ` (${formatDuration(exercise.defaultRestSeconds)})`
                : ''}
            </SelectItem>
            {REST_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {formatDuration(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div
            className={cn(
              'grid gap-1 text-center text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase',
              setGridClass(type, showRir),
            )}
          >
            <span>Set</span>
            <span className="text-left">Previous</span>
            <span>{type === 'bodyweight' ? `+${unit}` : unit}</span>
            <span>{type === 'timed' ? 'Time' : 'Reps'}</span>
            {type !== 'timed' && showRir && <span>RIR</span>}
            <span aria-hidden>✓</span>
          </div>
          {sets.map((set, index) => {
            if (set.setType === 'working') working += 1
            const prev = previous[index]
            return (
              <SetRow
                key={set.id}
                set={set}
                number={working}
                previous={prev}
                type={type}
                unit={unit}
                showRir={showRir}
                onChange={(patch) => actions.changeSet(item, set, patch)}
                onToggleComplete={() => actions.toggleComplete(item, set)}
                onOpenOptions={() => setOptionsFor(set.id)}
                onCopyPrevious={() => prev && actions.copyPrevious(item, set, prev)}
                onDelete={() => actions.deleteSet(set)}
              />
            )
          })}
        </div>
      )}

      <Button
        variant="ghost"
        className="self-start text-muted-foreground"
        onClick={() => actions.addSet(item)}
      >
        <Plus /> Add set
      </Button>

      <SetOptionsSheet
        set={optionsSet}
        timed={type === 'timed'}
        onOpenChange={(open) => !open && setOptionsFor(null)}
        onChange={(patch) =>
          optionsSet && actions.changeTargets(optionsSet, patch as Partial<SetRowData>)
        }
        onKindChange={(kind) => optionsSet && actions.changeKind(optionsSet, kind)}
        onDelete={() => {
          if (optionsSet) actions.deleteSet(optionsSet)
          setOptionsFor(null)
        }}
      />
      <ExercisePicker
        open={replacing}
        onOpenChange={setReplacing}
        onPick={(e) => actions.replace(item, e.id)}
      />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${name}?`}
        description="Its logged sets are removed from this workout."
        confirmLabel="Remove"
        onConfirm={() => actions.removeExercise(item)}
      />
    </article>
  )
}
