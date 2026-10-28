import type { Db } from '../db/client'

/**
 * Side effects after a push commits (DATA_MODEL_AND_SYNC.md §6), for the sessions and
 * exercises the push touched. Empty for now: PR recompute arrives in Phase 5, feed
 * events and notifications in Phases 8–9, SSE hints in Phase 9.
 */
export async function onSessionsChanged(
  _db: Db,
  _userId: string,
  _sessionIds: string[],
  _exerciseIds: string[],
): Promise<void> {}
