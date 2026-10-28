import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TemplateSetRow, WeightUnit } from '@stryde/shared'
import { ArrowDown, ArrowUp, Ellipsis, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { RowPatch } from '@/db/repositories/core'
import type { TemplateTree } from '@/db/repositories/templates'
import {
  EQUIPMENT_LABELS,
  formatDuration,
  MUSCLE_GROUP_LABELS,
  REST_OPTIONS,
} from '@/features/exercises/labels'
import { cn } from '@/lib/utils'
import { PlannedSetRow } from './planned-set-row'

type Item = TemplateTree['exercises'][number]

/** One exercise of a template with its planned sets (UI_DESIGN.md §5.8). */
export function TemplateExerciseCard({
  item,
  supersetLabel,
  unit,
  selecting,
  selected,
  onSelectedChange,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onRestChange,
  onAddSet,
  onSetChange,
  onSetChangeLater,
  onOpenSetOptions,
}: {
  item: Item
  /** "A1", "A2"… when in a superset. */
  supersetLabel: string | null
  unit: WeightUnit
  selecting: boolean
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onRestChange: (restSeconds: number | null) => void
  onAddSet: () => void
  onSetChange: (setId: string, patch: RowPatch<'templateSets'>) => void
  onSetChangeLater: (setId: string, patch: RowPatch<'templateSets'>) => void
  onOpenSetOptions: (set: TemplateSetRow) => void
}) {
  const { row, exercise, sets } = item
  const sortable = useSortable({ id: row.id, disabled: selecting })
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  }
  const name = exercise?.name ?? 'Unknown exercise'
  const type = exercise?.type ?? 'weighted'
  let working = 0

  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4',
        supersetLabel && 'border-l-[3px] border-l-brand',
        sortable.isDragging && 'z-10 opacity-80',
        selected && 'bg-brand-dim',
      )}
    >
      <header className="flex items-start gap-2">
        {selecting ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(c) => onSelectedChange(c === true)}
            aria-label={`Select ${name}`}
            className="mt-3 size-6"
          />
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-2 cursor-grab touch-none text-faint active:cursor-grabbing"
            aria-label={`Reorder ${name}`}
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical className="size-5" />
          </Button>
        )}
        <div className="flex min-w-0 flex-1 flex-col pt-1.5">
          <div className="flex items-center gap-2">
            {supersetLabel && (
              <span className="rounded-full bg-brand-dim px-2 font-display text-sm font-bold text-brand">
                {supersetLabel}
              </span>
            )}
            <h3 className="truncate font-semibold">{name}</h3>
          </div>
          {exercise && (
            <p className="text-sm text-muted-foreground">
              {EQUIPMENT_LABELS[exercise.equipment]} · {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="-mr-2" aria-label={`${name} options`}>
              <Ellipsis className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isFirst} onSelect={() => onMove(-1)}>
              <ArrowUp /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onSelect={() => onMove(1)}>
              <ArrowDown /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <Trash2 /> Remove exercise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rest</span>
        <Select
          value={row.restSeconds === null ? 'default' : String(row.restSeconds)}
          onValueChange={(v) => onRestChange(v === 'default' ? null : Number(v))}
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
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[48px_1fr_1fr] gap-2 text-center text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
            <span>Set</span>
            <span>{type === 'timed' ? 'Time' : 'Target'}</span>
            <span>{type === 'bodyweight' ? `+${unit}` : unit}</span>
          </div>
          {sets.map((set) => {
            if (set.setType === 'working') working += 1
            return (
              <PlannedSetRow
                key={set.id}
                set={set}
                number={working}
                exerciseType={type}
                unit={unit}
                onChange={(patch) => onSetChange(set.id, patch)}
                onChangeLater={(patch) => onSetChangeLater(set.id, patch)}
                onOpenOptions={() => onOpenSetOptions(set)}
              />
            )
          })}
        </div>
      )}

      <Button variant="ghost" className="self-start text-muted-foreground" onClick={onAddSet}>
        <Plus /> Add set
      </Button>
    </article>
  )
}
