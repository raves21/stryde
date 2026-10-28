import { DEFAULT_REST_SECONDS, type UserSettingsRow } from '@stryde/shared'
import { db as defaultDb, type StrydeDb } from '../db'
import { mutate, type RowPatch } from './core'

const DEFAULTS: Omit<UserSettingsRow, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
  unit: 'kg',
  defaultRestSeconds: DEFAULT_REST_SECONDS,
  defaultShareWithFriends: true,
  notificationsMuted: false,
  notifyFriendWorkouts: true,
  notifyReactions: true,
  notifyFriendRequests: true,
  notifyRestTimer: true,
}

/**
 * Patch the user's settings row. If it hasn't been pulled yet (first sync still
 * running), start from the server defaults; LWW keeps the newer local write.
 */
export function updateSettings(patch: RowPatch<'userSettings'>, db: StrydeDb = defaultDb) {
  return mutate(
    ['userSettings'],
    async (w) => {
      if (await w.get('userSettings', w.userId)) return w.update('userSettings', w.userId, patch)
      return w.insert('userSettings', { ...DEFAULTS, ...patch, id: w.userId })
    },
    db,
  )
}

export async function getSettings(userId: string, db: StrydeDb = defaultDb) {
  return db.userSettings.get(userId)
}
