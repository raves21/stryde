import {
  EQUIPMENT,
  type Equipment,
  EXERCISE_TYPES,
  type ExerciseRow,
  type ExerciseType,
  MUSCLE_GROUPS,
  type MuscleGroup,
} from '@stryde/shared'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { createExercise, updateExercise } from '@/db/repositories/exercises'
import { useUnsavedWork } from '@/lib/unsaved-work'
import {
  EQUIPMENT_LABELS,
  EXERCISE_TYPE_LABELS,
  formatDuration,
  MUSCLE_GROUP_LABELS,
  REST_OPTIONS,
} from '../labels'

type Draft = {
  name: string
  type: ExerciseType
  muscleGroup: MuscleGroup
  equipment: Equipment
  defaultRestSeconds: number | null
}

const EMPTY: Draft = {
  name: '',
  type: 'weighted',
  muscleGroup: 'chest',
  equipment: 'barbell',
  defaultRestSeconds: null,
}

const GRID_COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
} as const

/**
 * Create a custom exercise, or edit one (`exercise` given). `types` limits the choices: the
 * gym picker leaves out Sport, the sport picker offers only Sport (and then hides the
 * choice). A sport has no muscle group, equipment or rest, so those fields are hidden.
 */
export function ExerciseFormSheet({
  open,
  onOpenChange,
  exercise,
  onSaved,
  types = EXERCISE_TYPES,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise?: ExerciseRow
  onSaved?: (exercise: ExerciseRow) => void
  types?: readonly ExerciseType[]
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  // An open form holds typed values: no automatic app update meanwhile.
  useUnsavedWork(open)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(
      exercise
        ? {
            name: exercise.name,
            type: exercise.type,
            muscleGroup: exercise.muscleGroup,
            equipment: exercise.equipment,
            defaultRestSeconds: exercise.defaultRestSeconds,
          }
        : { ...EMPTY, type: types[0] ?? EMPTY.type },
    )
  }, [open, exercise, types])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return
    setPending(true)
    try {
      // A sport is just a name: no muscle group, equipment or rest.
      const values: Draft =
        draft.type === 'sport'
          ? { ...draft, muscleGroup: 'cardio', equipment: 'other', defaultRestSeconds: null }
          : draft
      const saved = exercise
        ? await updateExercise(exercise.id, values)
        : await createExercise(values)
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the exercise')
    } finally {
      setPending(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${exercise ? 'Edit' : 'New'} ${draft.type === 'sport' ? 'sport' : 'exercise'}`}
    >
      <form id="exercise-form" onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="exercise-name">Name</Label>
          <Input
            id="exercise-name"
            value={draft.name}
            maxLength={100}
            onChange={(e) => set('name', e.target.value)}
            placeholder={draft.type === 'sport' ? 'e.g. Table tennis' : 'e.g. Landmine Press'}
            required
          />
        </div>
        {types.length > 1 && (
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <ToggleGroup
              type="single"
              value={draft.type}
              onValueChange={(v) => v && set('type', v as ExerciseType)}
              className={`grid w-full ${GRID_COLS[Math.min(types.length, 4) as 1 | 2 | 3 | 4]}`}
              spacing={2}
              aria-label="Exercise type"
            >
              {types.map((t) => (
                <ToggleGroupItem
                  key={t}
                  value={t}
                  className="h-12 bg-surface-2 data-[state=on]:bg-brand-dim data-[state=on]:text-brand"
                >
                  {EXERCISE_TYPE_LABELS[t]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        {draft.type !== 'sport' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="exercise-muscle">Muscle group</Label>
                <Select
                  value={draft.muscleGroup}
                  onValueChange={(v) => set('muscleGroup', v as MuscleGroup)}
                >
                  <SelectTrigger id="exercise-muscle" className="w-full data-[size=default]:h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MUSCLE_GROUP_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="exercise-equipment">Equipment</Label>
                <Select
                  value={draft.equipment}
                  onValueChange={(v) => set('equipment', v as Equipment)}
                >
                  <SelectTrigger
                    id="exercise-equipment"
                    className="w-full data-[size=default]:h-12"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT.map((m) => (
                      <SelectItem key={m} value={m}>
                        {EQUIPMENT_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exercise-rest">Default rest</Label>
              <Select
                value={
                  draft.defaultRestSeconds === null ? 'default' : String(draft.defaultRestSeconds)
                }
                onValueChange={(v) => set('defaultRestSeconds', v === 'default' ? null : Number(v))}
              >
                <SelectTrigger id="exercise-rest" className="w-full data-[size=default]:h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Use my default</SelectItem>
                  {REST_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {formatDuration(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <Button type="submit" size="lg" disabled={pending || !draft.name.trim()}>
          {exercise ? 'Save' : draft.type === 'sport' ? 'Create sport' : 'Create exercise'}
        </Button>
      </form>
    </BottomSheet>
  )
}
