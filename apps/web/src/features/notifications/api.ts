import type { NotificationsPage } from '@stryde/shared'
import { request } from '@/features/social/api'

// In-app notification list (online-only, like the rest of the social data).
export const notificationsApi = {
  list: (before?: string, limit = 30) =>
    request<NotificationsPage>(
      'GET',
      `/api/notifications?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`,
    ),
  markRead: (ids?: string[]) =>
    request<{ updated: number }>('POST', '/api/notifications/read', { ids }),
}
