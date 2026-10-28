import { useLiveQuery } from 'dexie-react-hooks'
import {
  getTemplateTree,
  listTemplateSummaries,
  type TemplateSummary,
} from '@/db/repositories/templates'

export function useTemplateSummaries(): TemplateSummary[] | undefined {
  return useLiveQuery(() => listTemplateSummaries(), [])
}

export function useTemplateTree(id: string) {
  // null = loaded but missing/deleted; undefined = still loading.
  return useLiveQuery(async () => (await getTemplateTree(id)) ?? null, [id])
}

/** "Bench, Incline DB, Dips +3". */
export function exercisePreview(names: string[], shown = 3): string {
  if (names.length === 0) return 'No exercises yet'
  const head = names.slice(0, shown).join(', ')
  return names.length > shown ? `${head} +${names.length - shown}` : head
}
