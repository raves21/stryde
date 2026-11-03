import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useOnline } from '@/lib/use-online'
import { ApiError } from '../api'
import { useSessionDetail } from '../use-social'
import { FriendSessionDetail } from './friend-session-detail'
import { OfflineState } from './offline-state'

/**
 * `/workout/$sessionId` for a session that isn't on this device: a friend's shared
 * workout, fetched from the server. Not found and not allowed look the same (404).
 */
export function FriendSessionPage({ sessionId }: { sessionId: string }) {
  const online = useOnline()
  const query = useSessionDetail(sessionId)
  if (query.data) return <FriendSessionDetail session={query.data} />

  return (
    <Screen>
      <TopBar title="Workout" back />
      {!online ? (
        <OfflineState what="This workout" />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState icon={SearchX} title="This workout doesn't exist or isn't shared with you." />
        ) : (
          <EmptyState
            icon={SearchX}
            title="Couldn't load this workout."
            action={<Button onClick={() => void query.refetch()}>Retry</Button>}
          />
        )
      ) : (
        <Skeleton className="h-64 rounded-2xl" aria-busy="true" />
      )}
    </Screen>
  )
}
