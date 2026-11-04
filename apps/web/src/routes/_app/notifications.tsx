import type { NotificationItem, NotificationType } from '@stryde/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  Bell,
  Dumbbell,
  type LucideIcon,
  SmilePlus,
  Timer,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarkRead, useNotificationList } from '@/features/notifications/use-notifications'
import { OfflineState } from '@/features/social/components/offline-state'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/notifications')({
  component: NotificationsPage,
})

const ICONS: Record<NotificationType, LucideIcon> = {
  friend_workout_finished: Dumbbell,
  reaction_received: SmilePlus,
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  rest_timer_done: Timer,
}

/** Notifications list (UI_DESIGN.md §5.13). Online-only. */
function NotificationsPage() {
  const online = useOnline()
  const list = useNotificationList()
  const markRead = useMarkRead()
  const navigate = useNavigate()
  const items = list.data?.pages.flatMap((p) => p.items) ?? []
  const unread = list.data?.pages[0]?.unreadCount ?? 0

  async function open(item: NotificationItem) {
    if (!item.readAt) markRead.mutate([item.id])
    // The server only stores in-app paths (/workout/…, /friends).
    await navigate({ to: item.url as '/' })
  }

  return (
    <Screen>
      <TopBar
        title="Notifications"
        back
        actions={
          unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => markRead.mutate(undefined)}>
              Mark all read
            </Button>
          ) : undefined
        }
      />
      {!online ? (
        <OfflineState what="Your notifications" />
      ) : list.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : list.isError ? (
        <EmptyState
          icon={Bell}
          title="Couldn't load notifications."
          action={<Button onClick={() => void list.refetch()}>Retry</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing yet. Friend activity and reactions show up here." />
      ) : (
        <>
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
            {items.map((item) => {
              const Icon = ICONS[item.type]
              return (
                <li key={item.id} className="not-last:border-b not-last:border-border">
                  <button
                    type="button"
                    onClick={() => void open(item)}
                    className={cn(
                      'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2',
                      !item.readAt && 'bg-surface-2/60',
                    )}
                  >
                    <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{item.title}</span>
                      <span className="truncate text-sm text-muted-foreground">{item.body}</span>
                    </span>
                    <time
                      dateTime={item.createdAt}
                      className="shrink-0 text-xs text-muted-foreground"
                    >
                      {formatDistanceToNowStrict(item.createdAt, { addSuffix: true })}
                    </time>
                    {!item.readAt && (
                      <>
                        <span className="size-2.5 shrink-0 rounded-full bg-brand" aria-hidden />
                        <span className="sr-only">Unread</span>
                      </>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {list.hasNextPage && (
            <Button
              variant="secondary"
              onClick={() => void list.fetchNextPage()}
              disabled={list.isFetchingNextPage}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </Screen>
  )
}
