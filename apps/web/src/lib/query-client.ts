import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/features/social/api'

/**
 * Social data only (feed, friends, reactions): online-only, in-memory cache, no
 * persister (UI_DESIGN.md §7). Own data never goes through here, it lives in Dexie.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A 4xx (not found, unauthorized) won't change by asking again.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
})
