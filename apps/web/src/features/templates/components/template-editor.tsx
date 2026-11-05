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
import type { ExerciseRow } from '@stryde/shared'
import { useBlocker, useNavigate } from '@tanstack/react-router'
import { Copy, Ellipsis, Link2, Link2Off, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { SetOptionsSheet } from '@/components/sets/set-options-sheet'
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
import { newId } from '@/db/ids'
import {
  deleteTemplate,
  duplicateTemplate,
  saveTemplateTree,
  type TemplateTree,
} from '@/db/repositories/templates'
import { ExercisePicker } from '@/features/exercises/components/exercise-picker'
import { useUnit } from '@/features/settings/use-settings'
import {
  addExercise,
  addSet,
  draftSignature,
  groupExercises,
  newDraft,
  removeExercise,
  removeSet,
  reorderExercises,
  setTemplateText,
  ungroupExercises,
  updateExercise,
  updateSet,
} from '../draft'
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

/**
 * Template editor (UI_DESIGN.md §5.8, PRODUCT_SPEC.md §4.2). Edits go to an in-memory draft
 * and are written once with the Save button; leaving with unsaved changes asks first.
 * Without `tree` it creates a new template: nothing exists until the first Save.
 */
export function TemplateEditor({ tree }: { tree?: TemplateTree }) {
  const isNew = !tree
  const navigate = useNavigate()
  const unit = useUnit()
  const [blank] = useState(() => newDraft(newId(), new Date().toISOString()))
  const baseline = tree ?? blank
  const baselineSig = draftSignature(baseline)
  const [draft, setDraft] = useState<TemplateTree>(baseline)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [optionsFor, setOptionsFor] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const { template } = draft
  const dirty = draftSignature(draft) !== baselineSig

  // A new template opens with its name field active.
  useEffect(() => {
    if (isNew) nameRef.current?.focus()
  }, [isNew])

  // The saved version changed (our own save, or a sync from another device): adopt it
  // unless there are unsaved edits, which stay.
  const lastBaseline = useRef(baselineSig)
  useEffect(() => {
    if (baselineSig === lastBaseline.current) return
    const previous = lastBaseline.current
    lastBaseline.current = baselineSig
    setDraft((d) => (draftSignature(d) === previous ? baseline : d))
  }, [baselineSig, baseline])

  // Leaving (Back, a tab, the browser's back button, closing the tab) with unsaved edits.
  const leaving = useRef(false)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current && !leaving.current,
    enableBeforeUnload: () => dirtyRef.current && !leaving.current,
    withResolver: true,
  })

  const labels = useMemo(() => supersetLabels(draft), [draft])
  const ids = draft.exercises.map((e) => e.row.id)
  const optionsSet = draft.exercises.flatMap((e) => e.sets).find((s) => s.id === optionsFor) ?? null
  const optionsTimed =
    draft.exercises.find((e) => e.row.id === optionsSet?.templateExerciseId)?.exercise?.type ===
    'timed'
  const selectedRows = draft.exercises.filter((e) => selected.has(e.row.id)).map((e) => e.row)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const edit = (fn: (d: TemplateTree) => TemplateTree) => setDraft(fn)

  function reorder(order: string[], movedId: string) {
    edit((d) => reorderExercises(d, order, movedId))
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    reorder(arrayMove(ids, from, to), String(active.id))
  }

  function pickExercise(exercise: ExerciseRow) {
    const rowIds = { rowId: newId(), setId: newId() }
    const now = new Date().toISOString()
    edit((d) => addExercise(d, exercise, rowIds, now))
  }

  function exitSelection() {
    setSelecting(false)
    setSelected(new Set())
  }

  async function onSave() {
    if (!template.name.trim()) {
      toast.error('Give the template a name first')
      nameRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      await saveTemplateTree(draft, { isNew })
      toast('Template saved', { duration: 1800 })
      if (isNew) {
        // Now it exists: continue on its own page without the "unsaved" guard.
        leaving.current = true
        await navigate({ to: '/templates/$id', params: { id: template.id }, replace: true })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the template')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen className="pb-28">
      <TopBar
        title={isNew ? 'New template' : 'Template'}
        back
        actions={
          <>
            <Button size="sm" onClick={onSave} disabled={saving || !dirty}>
              Save
            </Button>
            {!isNew && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Template options">
                    <Ellipsis className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={dirty}
                    onSelect={async () => {
                      const copy = await duplicateTemplate(template.id)
                      await navigate({ to: '/templates/$id', params: { id: copy.id } })
                    }}
                  >
                    <Copy /> {dirty ? 'Duplicate (save first)' : 'Duplicate'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <div className="-mt-2 flex flex-col gap-3">
        <Input
          ref={nameRef}
          id="template-name"
          aria-label="Template name"
          value={template.name}
          maxLength={100}
          placeholder="Template name"
          onChange={(e) => edit((d) => setTemplateText(d, { name: e.target.value }))}
          // px-2.5 with -mx-2.5: room for the focus ring, text still lines up with the page.
          className="-mx-2.5 h-14 w-[calc(100%+1.25rem)] border-none bg-transparent px-2.5 font-display text-[28px] font-semibold dark:bg-transparent"
        />
        <Textarea
          id="template-notes"
          aria-label="Notes"
          value={template.notes ?? ''}
          maxLength={2000}
          placeholder="Notes (optional)"
          rows={2}
          onChange={(e) => edit((d) => setTemplateText(d, { notes: e.target.value }))}
          className="min-h-0 resize-none bg-surface-2"
        />
      </div>

      {draft.exercises.length > 1 && (
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
            {draft.exercises.map((item, index) => (
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
                isLast={index === draft.exercises.length - 1}
                onMove={(d) => reorder(arrayMove(ids, index, index + d), item.row.id)}
                onRemove={() => edit((d) => removeExercise(d, item.row.id))}
                onRestChange={(restSeconds) =>
                  edit((d) => updateExercise(d, item.row.id, { restSeconds }))
                }
                onAddSet={() => {
                  const setId = newId()
                  const now = new Date().toISOString()
                  edit((d) => addSet(d, item.row.id, setId, now))
                }}
                onSetChange={(setId, patch) => edit((d) => updateSet(d, setId, patch))}
                onSetChangeLater={(setId, patch) => edit((d) => updateSet(d, setId, patch))}
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
              onClick={() => {
                edit((d) => groupExercises(d, [...selected]))
                exitSelection()
              }}
            >
              <Link2 /> Group as superset
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={!selectedRows.some((r) => r.supersetGroup)}
              onClick={() => {
                edit((d) => ungroupExercises(d, [...selected]))
                exitSelection()
              }}
            >
              <Link2Off /> Ungroup
            </Button>
          </div>
        </div>
      )}

      <ExercisePicker open={picking} onOpenChange={setPicking} onPick={pickExercise} />
      <SetOptionsSheet
        set={optionsSet}
        timed={optionsTimed}
        onOpenChange={(open) => !open && setOptionsFor(null)}
        onChange={(patch) => optionsSet && edit((d) => updateSet(d, optionsSet.id, patch))}
        onKindChange={(targetKind) =>
          optionsSet &&
          edit((d) =>
            updateSet(d, optionsSet.id, {
              targetKind,
              // RIR sets need a target RIR; the others have none.
              targetRir: targetKind === 'rir' ? (optionsSet.targetRir ?? 2) : null,
            }),
          )
        }
        onDelete={() => {
          if (optionsSet) edit((d) => removeSet(d, optionsSet.id))
          setOptionsFor(null)
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${template.name || 'this template'}?`}
        description="Workouts you already did from this template keep their history."
        confirmLabel="Delete template"
        onConfirm={async () => {
          await deleteTemplate(template.id)
          leaving.current = true
          await navigate({ to: '/templates', replace: true })
        }}
      />
      <ConfirmDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => !open && blocker.status === 'blocked' && blocker.reset()}
        title="Discard your changes?"
        description="This template has changes you haven't saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => blocker.status === 'blocked' && blocker.proceed()}
      />
    </Screen>
  )
}
