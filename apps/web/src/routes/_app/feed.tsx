import { createFileRoute, Link } from '@tanstack/react-router'
import { RefreshCw, UsersRound } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FeedCard } from '@/features/social/components/feed-card'
import { OfflineState } from '@/features/social/components/offline-state'
import { usePullToRefresh } from '@/features/social/use-pull-to-refresh'
import { useFeed, useFriendRequests } from '@/features/social/use-social'
import { useOnline } from '@/lib/use-online'

export const Route = createFileRoute('/_app/feed')({
  component: FeedPage,
})

/** Feed: me and my friends' shared workouts, newest first (UI_DESIGN.md §5.11). Online-only. */
function FeedPage() {
  const online = useOnline()
  const feed = useFeed()
  const requests = useFriendRequests()
  const { pull, refreshing } = usePullToRefresh(() => feed.refetch(), online)
  const items = feed.data?.pages.flatMap((p) => p.items) ?? []
  const incoming = requests.data?.incoming.length ?? 0

  // Infinite scroll: load the next page when the sentinel comes into view.
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <Screen>
      <TopBar
        title="Feed"
        actions={
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link
              to="/friends"
              aria-label={incoming > 0 ? `Friends, ${incoming} requests` : 'Friends'}
            >
              <UsersRound className="size-5" />
              {incoming > 0 && (
                <span className="tnum absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-primary-foreground">
                  {incoming}
                </span>
              )}
            </Link>
          </Button>
        }
      />
      {(pull > 0 || refreshing) && (
        <div
          className="-mb-3 flex justify-center text-muted-foreground"
          style={{ height: refreshing ? 32 : pull / 2 }}
          aria-hidden
        >
          <RefreshCw className={refreshing ? 'size-5 animate-spin' : 'size-5'} />
        </div>
      )}

      {!online ? (
        <OfflineState />
      ) : feed.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : feed.isError ? (
        <EmptyState
          icon={RefreshCw}
          title="Couldn't load the feed."
          action={<Button onClick={() => void feed.refetch()}>Retry</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Add friends to see their workouts here."
          action={
            <Button asChild>
              <Link to="/friends">Find friends</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
          <div ref={sentinel} className="h-1" />
          {isFetchingNextPage && <Skeleton className="h-44 rounded-2xl" />}
        </div>
      )}
    </Screen>
  )
}
