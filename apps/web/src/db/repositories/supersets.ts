import type { Writer } from './core'

// Superset bookkeeping shared by template and session exercises (same columns).

type Grouped = { id: string; position: number; supersetGroup: string | null }
export type Planned<T extends Grouped> = { row: T; group: string | null }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

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

export function nextFreeLetter(rows: Grouped[]): string {
  const used = new Set(rows.map((r) => r.supersetGroup))
  const letter = [...LETTERS].find((l) => !used.has(l))
  if (!letter) throw new Error('No superset letters left')
  return letter
}

/** Group `ids` under a new letter, moved next to each other at the first one's place. */
export function planGroup<T extends Grouped>(rows: T[], ids: string[]): Planned<T>[] {
  if (ids.length < 2) throw new Error('A superset needs at least two exercises')
  const letter = nextFreeLetter(rows)
  const selected = new Set(ids)
  const first = rows.findIndex((r) => selected.has(r.id))
  const members = rows.filter((r) => selected.has(r.id))
  const rest = rows.filter((r) => !selected.has(r.id))
  return [...rest.slice(0, first), ...members, ...rest.slice(first)].map((row) => ({
    row,
    group: selected.has(row.id) ? letter : row.supersetGroup,
  }))
}

/** Take `ids` out of their supersets; each moves just after its former group. */
export function planUngroup<T extends Grouped>(rows: T[], ids: string[]): Planned<T>[] {
  const out = new Set(ids)
  let plan: Planned<T>[] = rows.map((row) => ({ row, group: row.supersetGroup }))
  for (const id of ids) {
    const item = plan.find((p) => p.row.id === id)
    if (!item?.group) continue
    const group = item.group
    plan = plan.filter((p) => p !== item)
    const lastMember = plan.findLastIndex((p) => p.group === group && !out.has(p.row.id))
    plan.splice(lastMember + 1, 0, { row: item.row, group: null })
  }
  return plan
}

/** Write positions 0..n-1 and normalized groups where they changed. */
export async function applyPlan<T extends Grouped>(
  w: Writer,
  table: 'templateExercises' | 'sessionExercises',
  plan: Planned<T>[],
  movedId?: string,
) {
  const groups = normalizeSupersets(
    plan.map((p) => ({ id: p.row.id, supersetGroup: p.group })),
    movedId,
  )
  for (const [position, { row }] of plan.entries()) {
    const supersetGroup = groups[position] ?? null
    if (row.position !== position || row.supersetGroup !== supersetGroup) {
      await w.update(table, row.id, { position, supersetGroup })
    }
  }
}

/** Plan for a plain reorder (keeping groups). */
export function planOrder<T extends Grouped>(rows: T[], orderedIds: string[]): Planned<T>[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return orderedIds.flatMap((id) => {
    const row = byId.get(id)
    return row ? [{ row, group: row.supersetGroup }] : []
  })
}

export function asPlan<T extends Grouped>(rows: T[]): Planned<T>[] {
  return rows.map((row) => ({ row, group: row.supersetGroup }))
}
