import type { ServerEvent } from '@stryde/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { socialKeys } from '@/features/social/use-social'
import { useOnline } from '@/lib/use-online'
import { getSyncOrigin, requestSync } from '@/sync/controller'
import { notificationKeys } from '../use-notifications'

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}
const isVisible = () => document.visibilityState === 'visible'

/**
 * Live updates over SSE (`GET /api/events`) while the app is visible and online: another
 * device pushed → pull; a friend's feed changed → reload it; a notification arrived →
 * refresh the bell. The events are hints only; EventSource reconnects by itself.
 */
export function EventsRuntime() {
  const online = useOnline()
  const visible = useSyncExternalStore(subscribeVisibility, isVisible)
  const client = useQueryClient()

  useEffect(() => {
    if (!online || !visible || typeof EventSource === 'undefined') return
    let source: EventSource | undefined
    let cancelled = false

    void getSyncOrigin().then((origin) => {
      if (cancelled) return
      source = new EventSource('/api/events')
      const on = (type: ServerEvent['type'] | 'ready', handler: (data: unknown) => void) =>
        source?.addEventListener(type, (e) => {
          try {
            handler(JSON.parse((e as MessageEvent<string>).data))
          } catch {
            // A malformed event is ignored; the next poll catches up.
          }
        })
      // Pushes from this very device are ignored: it already has them.
      on('sync', (data) => {
        if ((data as { origin: string | null }).origin !== origin) requestSync()
      })
      on('feed', () => void client.invalidateQueries({ queryKey: socialKeys.feed }))
      on('notification', () => void client.invalidateQueries({ queryKey: notificationKeys.all }))
      // (Re)connected: anything missed meanwhile shows up now.
      on('ready', () => void client.invalidateQueries({ queryKey: notificationKeys.all }))
    })

    return () => {
      cancelled = true
      source?.close()
    }
  }, [online, visible, client])

  return null
}
