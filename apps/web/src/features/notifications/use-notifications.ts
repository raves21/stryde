import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOnline } from '@/lib/use-online'
import { notificationsApi } from './api'

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  list: ['notifications', 'list'] as const,
}

/** Unread count for the bell. SSE `notification` events refresh it. */
export function useUnreadCount(): number {
  const online = useOnline()
  const { data } = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => notificationsApi.list(undefined, 1),
    enabled: online,
    select: (page) => page.unreadCount,
  })
  return data ?? 0
}

export function useNotificationList() {
  const online = useOnline()
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: online,
  })
}

/** Mark some (or all) notifications read, then refresh the list and the bell. */
export function useMarkRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ids?: string[]) => notificationsApi.markRead(ids),
    onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
