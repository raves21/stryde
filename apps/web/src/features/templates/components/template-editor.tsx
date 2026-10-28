import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ExerciseRow, TemplateSetRow } from '@stryde/shared'
import { useNavigate } from '@tanstack/react-router'
import { Check, Copy, Ellipsis, Link2, Link2Off, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { NewRow, RowPatch } from '@/db/repositories/core'
import {
  addTemplateExercise,
  addTemplateSet,
  deleteTemplate,
  duplicateTemplate,
  groupSuperset,
  removeTemplateExercise,
  removeTemplateSet,
  reorderTemplateExercises,
  type TemplateTree,
  ungroupSuperset,
  updateTemplate,
  updateTemplateExercise,
  updateTemplateSet,
} from '@/db/repositories/templates'
import { ExercisePicker } from '@/features/exercises/components/exercise-picker'
import { useUnit } from '@/features/settings/use-settings'
import { useSaveState } from '../use-save-state'
import { SetOptionsSheet } from './set-options-sheet'
import { TemplateExerciseCard } from './template-exercise-card'

/** "A1", "A2"… for exercises in a superset, by order within the group. */
function supersetLabels(tree: TemplateTree): Map<string, string> {
  const seen = new Map<string, number>()
  const labels = new Map<string, string>()
  for (const { row } of tree.exercises) {
    if (!row.supersetGroup) continue
    const n = (seen.get(row.supersetGroup) ?? 0) + 1
    seen.set(row.supersetGroup, n)
    labels.set(row.id, `${row.supersetGroup}${n}`)
  }
  return labels
}

/** A new set copies the last one; the first set of an exercise is a plain working set. */
function nextSet(templateExerciseId: string, sets: TemplateSetRow[]): NewRow<'templateSets'> {
  const last = sets.at(-1)
  return {
    templateExerciseId,
    position: (last?.position ?? -1) + 1,
    setType: last?.setType === 'warmup' ? 'working' : (last?.setType ?? 'working'),
    targetKind: last?.targetKind ?? 'fixed',
    targetReps: last?.targetReps ?? null,
    targetRepsMax: last?.targetRepsMax ?? null,
    targetRir: last?.targetRir ?? null,
    plannedWeightKg: last?.plannedWeightKg ?? null,
    plannedDurationSec: last?.plannedDurationSec ?? null,
  }
}

/** Template editor with autosave (UI_DESIGN.md §5.8, PRODUCT_SPEC.md §4.2). */
export function TemplateEditor({ tree }: { tree: TemplateTree }) {
  const { template } = tree
  const navigate = useNavigate()
  const unit = useUnit()
  const { state, save, saveLater } = useSaveState()
  const [name, setName] = useState(template.name)
  const [notes, setNotes] = useState(template.notes ?? '')
  const [picking, setPicking] = useState(false)
  const [optionsFor, setOptionsFor] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Pick up changes synced from another device while not editing these fields.
  useEffect(
    () => setName((n) => (document.activeElement?.id === 'template-name' ? n : template.name)),
    [template.name],
  )
  useEffect(
    () =>
      setNotes((n) =>
        document.activeElement?.id === 'template-notes' ? n : (template.notes ?? ''),
      ),
    [template.notes],
  )

  const labels = useMemo(() => supersetLabels(tree), [tree])
  const ids = tree.exercises.map((e) => e.row.id)
  const optionsSet = tree.exercises.flatMap((e) => e.sets).find((s) => s.id === optionsFor) ?? null
  const optionsTimed =
    tree.exercises.find((e) => e.row.id === optionsSet?.templateExerciseId)?.exercise?.type ===
    'timed'
  const selectedRows = tree.exercises.filter((e) => selected.has(e.row.id)).map((e) => e.row)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function reorder(order: string[], movedId: string) {
    void save(() => reorderTemplateExercises(template.id, order, movedId))
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    reorder(arrayMove(ids, from, to), String(active.id))
  }

  async function addExercise(exercise: ExerciseRow) {
    await save(async () => {
      const te = await addTemplateExercise({
        templateId: template.id,
        exerciseId: exercise.id,
        position: tree.exercises.length,
      })
      await addTemplateSet(nextSet(te.id, []))
    })
  }

  function exitSelection() {
    setSelecting(false)
    setSelected(new Set())
  }

  return (
    <Screen className="pb-28">
      <TopBar
        title="Template"
        back
        actions={
          <>
            <span className="tnum flex items-center gap-1 text-sm text-faint" aria-live="polite">
              {state === 'pending' && 'Saving…'}
              {state === 'saved' && (
                <>
                  <Check className="size-4" aria-hidden /> Saved
                </>
              )}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Template options">
                  <Ellipsis className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={async () => {
                    const copy = await duplicateTemplate(template.id)
                    await navigate({ to: '/templates/$id', params: { id: copy.id } })
                  }}
                >
                  <Copy /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="-mt-2 flex flex-col gap-3">
        <Input
          id="template-name"
          aria-label="Template name"
          value={name}
          maxLength={100}
          placeholder="Template name"
          onChange={(e) => {
            setName(e.target.value)
            const value = e.target.value.trim()
            if (value) saveLater('name', () => updateTemplate(template.id, { name: value }))
          }}
          className="h-14 border-none bg-transparent px-0 font-display text-[28px] font-semibold dark:bg-transparent"
        />
        <Textarea
          id="template-notes"
          aria-label="Notes"
          value={notes}
          maxLength={2000}
          placeholder="Notes (optional)"
          rows={2}
          onChange={(e) => {
            setNotes(e.target.value)
            const value = e.target.value.trim()
            saveLater('notes', () => updateTemplate(template.id, { notes: value || null }))
          }}
          className="min-h-0 resize-none bg-surface-2"
        />
      </div>

      {tree.exercises.length > 1 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (selecting ? exitSelection() : setSelecting(true))}
          >
            {selecting ? 'Done' : 'Select for superset'}
          </Button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {tree.exercises.map((item, index) => (
              <TemplateExerciseCard
                key={item.row.id}
                item={item}
                supersetLabel={labels.get(item.row.id) ?? null}
                unit={unit}
                selecting={selecting}
                selected={selected.has(item.row.id)}
                onSelectedChange={(on) =>
                  setSelected((s) => {
                    const next = new Set(s)
                    if (on) next.add(item.row.id)
                    else next.delete(item.row.id)
                    return next
                  })
                }
                isFirst={index === 0}
                isLast={index === tree.exercises.length - 1}
                onMove={(d) => reorder(arrayMove(ids, index, index + d), item.row.id)}
                onRemove={() => void save(() => removeTemplateExercise(item.row.id))}
                onRestChange={(restSeconds) =>
                  void save(() => updateTemplateExercise(item.row.id, { restSeconds }))
                }
                onAddSet={() => void save(() => addTemplateSet(nextSet(item.row.id, item.sets)))}
                onSetChange={(setId, patch) => void save(() => updateTemplateSet(setId, patch))}
                onSetChangeLater={(setId, patch: RowPatch<'templateSets'>) =>
                  saveLater(`set:${setId}:${Object.keys(patch).join(',')}`, () =>
                    updateTemplateSet(setId, patch),
                  )
                }
                onOpenSetOptions={(set) => setOptionsFor(set.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button variant="secondary" size="lg" onClick={() => setPicking(true)}>
        <Plus /> Add exercise
      </Button>

      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface">
          <div className="mx-auto flex max-w-[640px] gap-2 px-4 py-3">
            <Button
              className="flex-1"
              disabled={selectedRows.length < 2}
              onClick={async () => {
                await save(() => groupSuperset(template.id, [...selected]))
                exitSelection()
              }}
            >
              <Link2 /> Group as superset
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={!selectedRows.some((r) => r.supersetGroup)}
              onClick={async () => {
                await save(() => ungroupSuperset(template.id, [...selected]))
                exitSelection()
              }}
            >
              <Link2Off /> Ungroup
            </Button>
          </div>
        </div>
      )}

      <ExercisePicker open={picking} onOpenChange={setPicking} onPick={addExercise} />
      <SetOptionsSheet
        set={optionsSet}
        timed={optionsTimed}
        onOpenChange={(open) => !open && setOptionsFor(null)}
        onChange={(patch) => optionsSet && void save(() => updateTemplateSet(optionsSet.id, patch))}
        onDelete={() => {
          if (optionsSet) void save(() => removeTemplateSet(optionsSet.id))
          setOptionsFor(null)
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${template.name}?`}
        description="Workouts you already did from this template keep their history."
        confirmLabel="Delete template"
        onConfirm={async () => {
          await deleteTemplate(template.id)
          await navigate({ to: '/templates', replace: true })
        }}
      />
    </Screen>
  )
}
