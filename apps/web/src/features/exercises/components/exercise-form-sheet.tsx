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

/** Create a custom exercise, or edit one (`exercise` given). */
export function ExerciseFormSheet({
  open,
  onOpenChange,
  exercise,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise?: ExerciseRow
  onSaved?: (exercise: ExerciseRow) => void
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
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
        : EMPTY,
    )
  }, [open, exercise])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return
    setPending(true)
    try {
      const saved = exercise
        ? await updateExercise(exercise.id, draft)
        : await createExercise(draft)
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
      title={exercise ? 'Edit exercise' : 'New exercise'}
    >
      <form id="exercise-form" onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="exercise-name">Name</Label>
          <Input
            id="exercise-name"
            value={draft.name}
            maxLength={100}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Landmine Press"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Type</Label>
          <ToggleGroup
            type="single"
            value={draft.type}
            onValueChange={(v) => v && set('type', v as ExerciseType)}
            className="grid w-full grid-cols-3"
            spacing={2}
            aria-label="Exercise type"
          >
            {EXERCISE_TYPES.map((t) => (
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
            <Select value={draft.equipment} onValueChange={(v) => set('equipment', v as Equipment)}>
              <SelectTrigger id="exercise-equipment" className="w-full data-[size=default]:h-12">
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
            value={draft.defaultRestSeconds === null ? 'default' : String(draft.defaultRestSeconds)}
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
        <Button type="submit" size="lg" disabled={pending || !draft.name.trim()}>
          {exercise ? 'Save' : 'Create exercise'}
        </Button>
      </form>
    </BottomSheet>
  )
}
