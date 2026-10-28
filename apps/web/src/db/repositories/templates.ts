import type { TemplateExerciseRow, TemplateRow, TemplateSetRow } from '@stryde/shared'
import { db as defaultDb, type StrydeDb } from '../db'
import { mutate, type NewRow, type RowPatch, type Writer } from './core'

const TABLES = ['templates', 'templateExercises', 'templateSets'] as const

export function createTemplate(
  input: Pick<TemplateRow, 'name'> & Partial<Pick<TemplateRow, 'notes' | 'sortOrder'>>,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    (w) => w.insert('templates', { notes: null, sortOrder: 0, ...input }),
    db,
  )
}

export function updateTemplate(id: string, patch: RowPatch<'templates'>, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => w.update('templates', id, patch), db)
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
  return mutate([...TABLES], (w) => deleteTemplateExercises(w, [id]), db)
}

export function addTemplateSet(input: NewRow<'templateSets'>, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => w.insert('templateSets', input), db)
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
