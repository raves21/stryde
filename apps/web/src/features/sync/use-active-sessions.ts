import type { SessionRow } from '@stryde/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { listActiveSessions } from '@/db/repositories/sessions'

export function useActiveSessions(): SessionRow[] {
  return useLiveQuery(() => listActiveSessions(), [], [])
}
