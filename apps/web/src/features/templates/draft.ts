import type { ExerciseRow, TemplateExerciseRow, TemplateRow, TemplateSetRow } from '@stryde/shared'
import type { RowPatch } from '@/db/repositories/core'
import {
  asPlan,
  normalizeSupersets,
  type Planned,
  planGroup,
  planOrder,
  planUngroup,
} from '@/db/repositories/supersets'
import type { TemplateTree } from '@/db/repositories/templates'

// The template editor works on an in-memory draft and writes it once, on Save
// (`saveTemplateTree`). These are the pure edits on that draft; they mirror what the
// repository functions do row by row (copy the last set, renumber, normalize supersets).

type Item = TemplateTree['exercises'][number]

/** A blank template that doesn't exist in the database yet. */
export function newDraft(templateId: string, now: string): TemplateTree {
  const template: TemplateRow = {
    id: templateId,
    userId: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: '',
    notes: null,
    sortOrder: 0,
  }
  return { template, exercises: [] }
}

/** Everything that gets saved, as a string: equal signatures mean nothing to save. */
export function draftSignature(tree: TemplateTree): string {
  return JSON.stringify([
    tree.template.name.trim(),
    tree.template.notes?.trim() || null,
    tree.exercises.map(({ row, sets }) => [
      row.id,
      row.exerciseId,
      row.position,
      row.supersetGroup,
      row.restSeconds,
      sets.map((s) => [
        s.id,
        s.position,
        s.setType,
        s.targetKind,
        s.targetReps,
        s.targetRepsMax,
        s.targetRir,
        s.plannedWeightKg,
        s.plannedDurationSec,
      ]),
    ]),
  ])
}

export function setTemplateText(
  tree: TemplateTree,
  patch: { name?: string; notes?: string | null },
): TemplateTree {
  return { ...tree, template: { ...tree.template, ...patch } }
}

export function addExercise(
  tree: TemplateTree,
  exercise: ExerciseRow,
  ids: { rowId: string; setId: string },
  now: string,
): TemplateTree {
  const { template } = tree
  const common = { userId: template.userId, createdAt: now, updatedAt: now, deletedAt: null }
  const row: TemplateExerciseRow = {
    ...common,
    id: ids.rowId,
    templateId: template.id,
    exerciseId: exercise.id,
    position: tree.exercises.length,
    supersetGroup: null,
    restSeconds: null,
  }
  // A new exercise starts with one plain working set.
  const set: TemplateSetRow = {
    ...common,
    id: ids.setId,
    templateExerciseId: ids.rowId,
    position: 0,
    setType: 'working',
    targetKind: 'fixed',
    targetReps: null,
    targetRepsMax: null,
    targetRir: null,
    plannedWeightKg: null,
    plannedDurationSec: null,
  }
  return { ...tree, exercises: [...tree.exercises, { row, exercise, sets: [set] }] }
}

/** Positions 0..n-1 and normalized superset groups for a plan (the pure `applyPlan`). */
function applyPlan(
  tree: TemplateTree,
  plan: Planned<TemplateExerciseRow>[],
  movedId?: string,
): TemplateTree {
  const byId = new Map(tree.exercises.map((e) => [e.row.id, e]))
  const groups = normalizeSupersets(
    plan.map((p) => ({ id: p.row.id, supersetGroup: p.group })),
    movedId,
  )
  const exercises = plan.flatMap(({ row }, position) => {
    const item = byId.get(row.id)
    return item
      ? [{ ...item, row: { ...item.row, position, supersetGroup: groups[position] ?? null } }]
      : []
  })
  return { ...tree, exercises }
}

const rowsOf = (tree: TemplateTree) => tree.exercises.map((e) => e.row)

export function removeExercise(tree: TemplateTree, rowId: string): TemplateTree {
  const rest = { ...tree, exercises: tree.exercises.filter((e) => e.row.id !== rowId) }
  return applyPlan(rest, asPlan(rowsOf(rest)))
}

export function updateExercise(
  tree: TemplateTree,
  rowId: string,
  patch: RowPatch<'templateExercises'>,
): TemplateTree {
  return mapItem(tree, rowId, (item) => ({ ...item, row: { ...item.row, ...patch } }))
}

export function reorderExercises(
  tree: TemplateTree,
  orderedIds: string[],
  movedId?: string,
): TemplateTree {
  return applyPlan(tree, planOrder(rowsOf(tree), orderedIds), movedId)
}

export function groupExercises(tree: TemplateTree, ids: string[]): TemplateTree {
  return applyPlan(tree, planGroup(rowsOf(tree), ids))
}

export function ungroupExercises(tree: TemplateTree, ids: string[]): TemplateTree {
  return applyPlan(tree, planUngroup(rowsOf(tree), ids))
}

/** Add a set copying the exercise's last one (a warm-up copies as working). */
export function addSet(
  tree: TemplateTree,
  rowId: string,
  setId: string,
  now: string,
): TemplateTree {
  return mapItem(tree, rowId, (item) => {
    const last = item.sets.at(-1)
    const set: TemplateSetRow = {
      id: setId,
      userId: item.row.userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      templateExerciseId: rowId,
      position: (last?.position ?? -1) + 1,
      setType: 'working',
      targetKind: last?.targetKind ?? 'fixed',
      targetReps: last?.targetReps ?? null,
      targetRepsMax: last?.targetRepsMax ?? null,
      targetRir: last?.targetRir ?? null,
      plannedWeightKg: last?.plannedWeightKg ?? null,
      plannedDurationSec: last?.plannedDurationSec ?? null,
    }
    return { ...item, sets: [...item.sets, set] }
  })
}

export function updateSet(
  tree: TemplateTree,
  setId: string,
  patch: RowPatch<'templateSets'>,
): TemplateTree {
  return {
    ...tree,
    exercises: tree.exercises.map((item) =>
      item.sets.some((s) => s.id === setId)
        ? { ...item, sets: item.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
        : item,
    ),
  }
}

export function removeSet(tree: TemplateTree, setId: string): TemplateTree {
  return {
    ...tree,
    exercises: tree.exercises.map((item) => ({
      ...item,
      sets: item.sets.filter((s) => s.id !== setId),
    })),
  }
}

function mapItem(tree: TemplateTree, rowId: string, fn: (item: Item) => Item): TemplateTree {
  return { ...tree, exercises: tree.exercises.map((e) => (e.row.id === rowId ? fn(e) : e)) }
}
