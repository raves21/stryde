import type { FeedPage, ReactionEmoji, SessionDetail } from '@stryde/shared'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOnline } from '@/lib/use-online'
import { ApiError, socialApi } from './api'
import { type ReactionState, toggleReaction } from './reactions'

export const socialKeys = {
  feed: ['feed'] as const,
  friends: ['friends'] as const,
  requests: ['friend-requests'] as const,
  search: (q: string) => ['user-search', q] as const,
  session: (id: string) => ['session', id] as const,
  reactors: (id: string) => ['reactors', id] as const,
}

export function useFeed() {
  const online = useOnline()
  return useInfiniteQuery({
    queryKey: socialKeys.feed,
    queryFn: ({ pageParam }) => socialApi.feed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: online,
  })
}

export function useFriends() {
  return useQuery({
    queryKey: socialKeys.friends,
    queryFn: socialApi.friends,
    enabled: useOnline(),
  })
}

export function useFriendRequests() {
  return useQuery({
    queryKey: socialKeys.requests,
    queryFn: socialApi.requests,
    enabled: useOnline(),
  })
}

export function useUserSearch(q: string) {
  const online = useOnline()
  return useQuery({
    queryKey: socialKeys.search(q),
    queryFn: () => socialApi.search(q),
    enabled: online && q.length > 0,
  })
}

export function useSessionDetail(id: string) {
  return useQuery({
    queryKey: socialKeys.session(id),
    queryFn: () => socialApi.session(id),
    enabled: useOnline(),
    select: (r) => r.session,
  })
}

export function useReactors(id: string, enabled: boolean) {
  return useQuery({
    queryKey: socialKeys.reactors(id),
    queryFn: () => socialApi.reactors(id),
    enabled: useOnline() && enabled,
    select: (r) => r.reactors,
  })
}

/**
 * Tap an emoji on a session: the same one removes my reaction, another replaces it.
 * Optimistic on the feed and the session detail; rolls back with a toast on failure.
 */
export function useReact(sessionId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      emoji,
      current,
    }: {
      emoji: ReactionEmoji
      current: ReactionEmoji | null
    }) => (current === emoji ? socialApi.unreact(sessionId) : socialApi.react(sessionId, emoji)),
    onMutate: async ({ emoji }) => {
      await client.cancelQueries({ queryKey: socialKeys.feed })
      await client.cancelQueries({ queryKey: socialKeys.session(sessionId) })
      const feed = client.getQueryData<InfiniteData<FeedPage>>(socialKeys.feed)
      const detail = client.getQueryData<{ session: SessionDetail }>(socialKeys.session(sessionId))
      const patch = <T extends ReactionState>(item: T): T => ({
        ...item,
        ...toggleReaction(item, emoji),
      })
      if (feed) {
        client.setQueryData<InfiniteData<FeedPage>>(socialKeys.feed, {
          ...feed,
          pages: feed.pages.map((p) => ({
            ...p,
            items: p.items.map((i) => (i.sessionId === sessionId ? patch(i) : i)),
          })),
        })
      }
      if (detail) {
        client.setQueryData(socialKeys.session(sessionId), { session: patch(detail.session) })
      }
      return { feed, detail }
    },
    onError: (error, _vars, context) => {
      if (context?.feed) client.setQueryData(socialKeys.feed, context.feed)
      if (context?.detail) client.setQueryData(socialKeys.session(sessionId), context.detail)
      toast.error(error instanceof ApiError ? error.message : 'Could not save your reaction')
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: socialKeys.feed })
      void client.invalidateQueries({ queryKey: socialKeys.session(sessionId) })
      void client.invalidateQueries({ queryKey: socialKeys.reactors(sessionId) })
    },
  })
}

/** Friend actions; each refreshes the lists they change and toasts failures. */
export function useFriendActions() {
  const client = useQueryClient()
  const refresh = () => {
    void client.invalidateQueries({ queryKey: socialKeys.friends })
    void client.invalidateQueries({ queryKey: socialKeys.requests })
    void client.invalidateQueries({ queryKey: ['user-search'] })
    void client.invalidateQueries({ queryKey: socialKeys.feed })
  }
  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : 'Something went wrong')
  return {
    sendRequest: useMutation({
      mutationFn: socialApi.sendRequest,
      onSuccess: (r) => {
        toast(r.status === 'accepted' ? "You're now friends" : 'Request sent')
        refresh()
      },
      onError,
    }),
    answer: useMutation({
      mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' }) =>
        socialApi.answer(id, action),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({ mutationFn: socialApi.removeFriend, onSuccess: refresh, onError }),
    mute: useMutation({
      mutationFn: ({ userId, muted }: { userId: string; muted: boolean }) =>
        socialApi.mute(userId, muted),
      onSuccess: refresh,
      onError,
    }),
  }
}
