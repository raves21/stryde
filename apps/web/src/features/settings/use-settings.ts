import type { UserSettingsRow, WeightUnit } from '@stryde/shared'
import { useRouteContext } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSettings } from '@/db/repositories/settings'

/** The signed-in user's id (screens under the auth guard always have one). */
export function useCurrentUserId(): string {
  const { user } = useRouteContext({ from: '__root__' })
  if (!user) throw new Error('No signed-in user')
  return user.user.id
}

/** The user's settings row from Dexie (undefined until the first pull lands). */
export function useSettings(): UserSettingsRow | undefined {
  const userId = useCurrentUserId()
  return useLiveQuery(() => getSettings(userId), [userId])
}

/** Display unit: local settings, else the value cached from /api/me. */
export function useUnit(): WeightUnit {
  const { user } = useRouteContext({ from: '__root__' })
  const settings = useSettings()
  return settings?.unit ?? user?.settings.unit ?? 'kg'
}
