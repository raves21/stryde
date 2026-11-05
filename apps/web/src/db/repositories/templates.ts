import type { ExerciseRow, TemplateExerciseRow, TemplateRow, TemplateSetRow } from '@stryde/shared'
import { db as defaultDb, type StrydeDb } from '../db'
import { mutate, type NewRow, type RowPatch, type Writer } from './core'
import { applyPlan, asPlan, planGroup, planOrder, planUngroup } from './supersets'

const TABLES = ['templates', 'templateExercises', 'templateSets'] as const

export function createTemplate(
  input: Pick<TemplateRow, 'name'> & Partial<Pick<TemplateRow, 'notes' | 'sortOrder'>>,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    async (w) =>
      w.insert('templates', { notes: null, sortOrder: await nextSortOrder(w), ...input }),
    db,
  )
}

/** New templates go to the end of the list. */
async function nextSortOrder(w: Writer): Promise<number> {
  const live = await w.db.templates.filter((t) => !t.deletedAt).toArray()
  return live.reduce((max, t) => Math.max(max, t.sortOrder + 1), 0)
}

export function updateTemplate(id: string, patch: RowPatch<'templates'>, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => w.update('templates', id, patch), db)
}

/**
 * Write an edited template in one transaction, from the editor's draft: the template row
 * (inserted when `isNew`), then exercises and sets inserted, updated or soft-deleted to
 * match the draft. Only rows that actually differ are touched, so saving an unchanged
 * template writes nothing and unrelated devices' edits to other rows are left alone.
 */
export function saveTemplateTree(
  tree: TemplateTree,
  options: { isNew: boolean },
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    async (w) => {
      const { template } = tree
      const fields = { name: template.name.trim(), notes: template.notes?.trim() || null }
      if (options.isNew) {
        await w.insert('templates', {
          id: template.id,
          ...fields,
          sortOrder: await nextSortOrder(w),
        })
      } else {
        const stored = await w.get('templates', template.id)
        if (!stored) throw new Error('This template was deleted')
        if (stored.name !== fields.name || stored.notes !== fields.notes) {
          await w.update('templates', template.id, fields)
        }
      }

      const storedRows = options.isNew ? [] : await getTemplateExercises(template.id, w.db)
      const keep = new Set(tree.exercises.map((e) => e.row.id))
      await deleteTemplateExercises(
        w,
        storedRows.filter((r) => !keep.has(r.id)).map((r) => r.id),
      )
      const storedById = new Map(storedRows.map((r) => [r.id, r]))

      for (const { row, sets } of tree.exercises) {
        const exerciseFields = {
          position: row.position,
          supersetGroup: row.supersetGroup,
          restSeconds: row.restSeconds,
        }
        const stored = storedById.get(row.id)
        if (!stored) {
          await w.insert('templateExercises', {
            id: row.id,
            templateId: template.id,
            exerciseId: row.exerciseId,
            ...exerciseFields,
          })
        } else if (
          stored.position !== row.position ||
          stored.supersetGroup !== row.supersetGroup ||
          stored.restSeconds !== row.restSeconds
        ) {
          await w.update('templateExercises', row.id, exerciseFields)
        }

        const storedSets = stored ? await getTemplateSets(row.id, w.db) : []
        const keepSets = new Set(sets.map((s) => s.id))
        await w.softDelete(
          'templateSets',
          storedSets.filter((s) => !keepSets.has(s.id)).map((s) => s.id),
        )
        const storedSetById = new Map(storedSets.map((s) => [s.id, s]))
        for (const set of sets) {
          const setFields = {
            position: set.position,
            setType: set.setType,
            targetKind: set.targetKind,
            targetReps: set.targetReps,
            targetRepsMax: set.targetRepsMax,
            targetRir: set.targetRir,
            plannedWeightKg: set.plannedWeightKg,
            plannedDurationSec: set.plannedDurationSec,
          }
          const prev = storedSetById.get(set.id)
          if (!prev) {
            await w.insert('templateSets', { id: set.id, templateExerciseId: row.id, ...setFields })
          } else if (
            (Object.keys(setFields) as (keyof typeof setFields)[]).some(
              (k) => prev[k] !== setFields[k],
            )
          ) {
            await w.update('templateSets', set.id, setFields)
          }
        }
      }
    },
    db,
  )
}

/** Soft-deletes the template with its exercises and sets. */
export function deleteTemplate(id: string, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const children = await w.db.templateExercises.where('templateId').equals(id).primaryKeys()
      await deleteTemplateExercises(w, children)
      await w.softDelete('templates', [id])
    },
    db,
  )
}

export function addTemplateExercise(
  input: Pick<TemplateExerciseRow, 'templateId' | 'exerciseId' | 'position'> &
    Partial<Pick<TemplateExerciseRow, 'supersetGroup' | 'restSeconds'>>,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    (w) => w.insert('templateExercises', { supersetGroup: null, restSeconds: null, ...input }),
    db,
  )
}

export function updateTemplateExercise(
  id: string,
  patch: RowPatch<'templateExercises'>,
  db: StrydeDb = defaultDb,
) {
  return mutate([...TABLES], (w) => w.update('templateExercises', id, patch), db)
}

export function removeTemplateExercise(id: string, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const row = await w.get('templateExercises', id)
      if (!row) return
      await deleteTemplateExercises(w, [id])
      await applyPlan(
        w,
        'templateExercises',
        asPlan(await getTemplateExercises(row.templateId, w.db)),
      )
    },
    db,
  )
}

export function addTemplateSet(input: NewRow<'templateSets'>, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => w.insert('templateSets', input), db)
}

/**
 * Add a set copying the exercise's last set as stored (a warm-up copies as working);
 * the first set is a plain working set. Read inside the transaction so it never copies
 * a stale on-screen value.
 */
export function addNextTemplateSet(templateExerciseId: string, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const last = (await getTemplateSets(templateExerciseId, w.db)).at(-1)
      return w.insert('templateSets', {
        templateExerciseId,
        position: (last?.position ?? -1) + 1,
        setType: 'working',
        targetKind: last?.targetKind ?? 'fixed',
        targetReps: last?.targetReps ?? null,
        targetRepsMax: last?.targetRepsMax ?? null,
        targetRir: last?.targetRir ?? null,
        plannedWeightKg: last?.plannedWeightKg ?? null,
        plannedDurationSec: last?.plannedDurationSec ?? null,
      })
    },
    db,
  )
}

export function updateTemplateSet(
  id: string,
  patch: RowPatch<'templateSets'>,
  db: StrydeDb = defaultDb,
) {
  return mutate([...TABLES], (w) => w.update('templateSets', id, patch), db)
}

export function removeTemplateSet(id: string, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => w.softDelete('templateSets', [id]), db)
}

async function deleteTemplateExercises(w: Writer, ids: string[]) {
  const sets = await w.db.templateSets.where('templateExerciseId').anyOf(ids).primaryKeys()
  await w.softDelete('templateSets', sets)
  await w.softDelete('templateExercises', ids)
}

export function listTemplates(db: StrydeDb = defaultDb): Promise<TemplateRow[]> {
  return db.templates.filter((t) => !t.deletedAt).sortBy('sortOrder')
}

export async function getTemplateExercises(
  templateId: string,
  db: StrydeDb = defaultDb,
): Promise<TemplateExerciseRow[]> {
  const rows = await db.templateExercises
    .where('[templateId+position]')
    .between([templateId, -Infinity], [templateId, Infinity])
    .toArray()
  return rows.filter((r) => !r.deletedAt)
}

export async function getTemplateSets(
  templateExerciseId: string,
  db: StrydeDb = defaultDb,
): Promise<TemplateSetRow[]> {
  const rows = await db.templateSets
    .where('[templateExerciseId+position]')
    .between([templateExerciseId, -Infinity], [templateExerciseId, Infinity])
    .toArray()
  return rows.filter((r) => !r.deletedAt)
}

/** Deep copy (exercises and sets) with new ids, placed at the end of the list. */
export function duplicateTemplate(id: string, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const source = await w.get('templates', id)
      if (!source) throw new Error(`templates ${id} not found`)
      const copy = await w.insert('templates', {
        name: `${source.name} (copy)`.slice(0, 100),
        notes: source.notes,
        sortOrder: await nextSortOrder(w),
      })
      for (const te of await getTemplateExercises(id, w.db)) {
        const { id: teId, userId: _u, createdAt: _c, updatedAt: _up, deletedAt: _d, ...fields } = te
        const teCopy = await w.insert('templateExercises', { ...fields, templateId: copy.id })
        for (const ts of await getTemplateSets(teId, w.db)) {
          const {
            id: _id,
            userId: _u2,
            createdAt: _c2,
            updatedAt: _up2,
            deletedAt: _d2,
            ...setFields
          } = ts
          await w.insert('templateSets', { ...setFields, templateExerciseId: teCopy.id })
        }
      }
      return copy
    },
    db,
  )
}

/** Reorder a template's exercises to match `orderedIds`; `movedId` is the one the user moved. */
export function reorderTemplateExercises(
  templateId: string,
  orderedIds: string[],
  movedId?: string,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    async (w) => {
      const rows = await getTemplateExercises(templateId, w.db)
      await applyPlan(w, 'templateExercises', planOrder(rows, orderedIds), movedId)
    },
    db,
  )
}

/** Group exercises as a superset (next free letter), moved next to each other. */
export function groupSuperset(templateId: string, ids: string[], db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const rows = await getTemplateExercises(templateId, w.db)
      await applyPlan(w, 'templateExercises', planGroup(rows, ids))
    },
    db,
  )
}

export function ungroupSuperset(templateId: string, ids: string[], db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const rows = await getTemplateExercises(templateId, w.db)
      await applyPlan(w, 'templateExercises', planUngroup(rows, ids))
    },
    db,
  )
}

export async function getTemplate(id: string, db: StrydeDb = defaultDb) {
  const row = await db.templates.get(id)
  return row && !row.deletedAt ? row : undefined
}

export type TemplateTree = {
  template: TemplateRow
  exercises: {
    row: TemplateExerciseRow
    exercise: ExerciseRow | undefined
    sets: TemplateSetRow[]
  }[]
}

/** A template with its exercises (in order) and their sets, for the editor and for starting it. */
export async function getTemplateTree(
  id: string,
  db: StrydeDb = defaultDb,
): Promise<TemplateTree | undefined> {
  const template = await getTemplate(id, db)
  if (!template) return undefined
  const rows = await getTemplateExercises(id, db)
  const exercises = await Promise.all(
    rows.map(async (row) => ({
      row,
      exercise: await db.exercises.get(row.exerciseId),
      sets: await getTemplateSets(row.id, db),
    })),
  )
  return { template, exercises }
}

export type TemplateSummary = TemplateRow & { exerciseNames: string[] }

/** Templates in list order, each with its exercise names (for "Bench, Incline DB, Dips +3"). */
export async function listTemplateSummaries(db: StrydeDb = defaultDb): Promise<TemplateSummary[]> {
  const templates = await listTemplates(db)
  return Promise.all(
    templates.map(async (t) => {
      const rows = await getTemplateExercises(t.id, db)
      const exercises = await db.exercises.bulkGet(rows.map((r) => r.exerciseId))
      return { ...t, exerciseNames: exercises.flatMap((e) => (e ? [e.name] : [])) }
    }),
  )
}
