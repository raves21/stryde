import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ensureSubscription } from '../push'

/**
 * Background chores for push while signed in: keep the subscription registered with the
 * server, and route in place when the service worker says a notification was tapped.
 */
export function PushRuntime() {
  const router = useRouter()

  useEffect(() => {
    void ensureSubscription()
    window.addEventListener('online', ensureSubscription)
    return () => window.removeEventListener('online', ensureSubscription)
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null
      if (data?.type === 'NAVIGATE' && typeof data.url === 'string' && data.url.startsWith('/')) {
        void router.navigate({ to: data.url as '/' })
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [router])

  return null
}
