import type { ExerciseRow, TemplateExerciseRow, TemplateRow, TemplateSetRow } from '@stryde/shared'
import { db as defaultDb, type StrydeDb } from '../db'
import { mutate, type NewRow, type RowPatch, type Writer } from './core'

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
      await applyOrder(w, await getTemplateExercises(row.templateId, w.db))
    },
    db,
  )
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

/**
 * Superset groups after a reorder, by position. The moved exercise joins a group when
 * dropped between two of its members, and leaves its own group when dropped away from
 * it. Then a group split into several runs keeps only its first run, and a group of one
 * is cleared. Returns the group for every item, in the given order.
 */
export function normalizeSupersets(
  items: { id: string; supersetGroup: string | null }[],
  movedId?: string,
): (string | null)[] {
  const groups = items.map((i) => i.supersetGroup)
  const m = movedId === undefined ? -1 : items.findIndex((i) => i.id === movedId)
  if (m >= 0) {
    const before = groups[m - 1] ?? null
    const after = groups[m + 1] ?? null
    if (before && before === after) groups[m] = before
    else if (groups[m] && groups[m] !== before && groups[m] !== after) groups[m] = null
  }
  const closed = new Set<string>()
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i]
    if (!g) continue
    if (closed.has(g)) groups[i] = null
    else if (groups[i + 1] !== g) closed.add(g)
  }
  const counts = new Map<string, number>()
  for (const g of groups) if (g) counts.set(g, (counts.get(g) ?? 0) + 1)
  return groups.map((g) => (g && counts.get(g) === 1 ? null : g))
}

/** Write positions 0..n-1 in this order and normalized superset groups, where changed. */
async function applyOrder(w: Writer, rows: TemplateExerciseRow[], movedId?: string) {
  const groups = normalizeSupersets(rows, movedId)
  for (const [position, row] of rows.entries()) {
    const supersetGroup = groups[position] ?? null
    if (row.position !== position || row.supersetGroup !== supersetGroup) {
      await w.update('templateExercises', row.id, { position, supersetGroup })
    }
  }
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
      const byId = new Map((await getTemplateExercises(templateId, w.db)).map((r) => [r.id, r]))
      await applyOrder(
        w,
        orderedIds.flatMap((id) => byId.get(id) ?? []),
        movedId,
      )
    },
    db,
  )
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Group exercises as a superset: they get the next free letter and are moved next to
 * each other at the position of the first one.
 */
export function groupSuperset(templateId: string, ids: string[], db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      if (ids.length < 2) throw new Error('A superset needs at least two exercises')
      const all = await getTemplateExercises(templateId, w.db)
      const used = new Set(all.map((te) => te.supersetGroup))
      const letter = [...LETTERS].find((l) => !used.has(l))
      if (!letter) throw new Error('No superset letters left')
      const selected = new Set(ids)
      const first = all.findIndex((te) => selected.has(te.id))
      const members = all.filter((te) => selected.has(te.id))
      const rest = all.filter((te) => !selected.has(te.id))
      const order = [...rest.slice(0, first), ...members, ...rest.slice(first)]
      for (const [position, te] of order.entries()) {
        const group = selected.has(te.id) ? letter : te.supersetGroup
        if (te.position !== position || te.supersetGroup !== group) {
          await w.update('templateExercises', te.id, { position, supersetGroup: group })
        }
      }
      await clearLoneGroups(w, templateId)
    },
    db,
  )
}

export function ungroupSuperset(templateId: string, ids: string[], db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      for (const id of ids) await w.update('templateExercises', id, { supersetGroup: null })
      await clearLoneGroups(w, templateId)
    },
    db,
  )
}

/** A superset of one isn't a superset. */
async function clearLoneGroups(w: Writer, templateId: string) {
  const all = await getTemplateExercises(templateId, w.db)
  const counts = new Map<string, number>()
  for (const te of all) {
    if (te.supersetGroup) counts.set(te.supersetGroup, (counts.get(te.supersetGroup) ?? 0) + 1)
  }
  for (const te of all) {
    if (te.supersetGroup && counts.get(te.supersetGroup) === 1) {
      await w.update('templateExercises', te.id, { supersetGroup: null })
    }
  }
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
