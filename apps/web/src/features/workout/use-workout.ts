import type { SessionRow } from '@stryde/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { getMeta, setMeta } from '@/db/meta'
import { getActiveSession, getSessionTree, type SessionTree } from '@/db/repositories/sessions'

/** The active workout, null when none (undefined while loading). */
export function useActiveSession(): SessionRow | null | undefined {
  return useLiveQuery(async () => (await getActiveSession()) ?? null, [])
}

export function useSessionTree(id: string | undefined): SessionTree | null | undefined {
  return useLiveQuery(async () => (id ? ((await getSessionTree(id)) ?? null) : null), [id])
}

/** Device setting "Keep screen on during workouts" (default on; UI arrives in Phase 6). */
export function useKeepScreenOn(): boolean {
  return useLiveQuery(
    async () => (await getMeta<boolean>('settings.keepScreenOn')) ?? true,
    [],
    true,
  )
}

export async function setKeepScreenOn(on: boolean) {
  await setMeta('settings.keepScreenOn', on)
}
