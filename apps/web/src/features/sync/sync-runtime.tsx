import { useRouter } from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'
import { forgetSession } from '@/features/auth/session'
import { startSyncController } from '@/sync/controller'
import { useSyncState } from '@/sync/status'
import { ActiveSessionConflictDialog } from './components/active-session-conflict-dialog'
import { InitialSyncScreen } from './components/initial-sync-screen'

/** Runs sync while a user is signed in; gates the app on the very first pull. */
export function SyncRuntime({ children }: { children: ReactNode }) {
  const router = useRouter()

  useEffect(
    () =>
      startSyncController({
        // 401: back to /login, keeping unsynced changes for when the same user returns.
        onUnauthorized: () => {
          void forgetSession().then(() => router.invalidate())
        },
      }),
    [router],
  )

  const { ready, lastSyncAt, status } = useSyncState()
  if (!ready) return null
  // Offline or failing first sync: let the user in; the indicator shows the state.
  if (!lastSyncAt && (status === 'idle' || status === 'syncing')) return <InitialSyncScreen />
  return (
    <>
      {children}
      <ActiveSessionConflictDialog />
    </>
  )
}
