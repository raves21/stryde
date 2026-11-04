import type { AppConfig } from '@stryde/shared'
import { isStandalone, platform } from '@/features/pwa/install'

// Web Push on this device (plan/phase-09 §3). The server stores one subscription per
// browser; permission must be asked from a tap, and iOS only delivers to installed apps.

export type PushSupport = 'supported' | 'unsupported' | 'ios-needs-install'

export function pushSupport(): PushSupport {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    // iOS Safari only exposes the Push API once the PWA is on the Home Screen.
    return platform() === 'ios' && !isStandalone() ? 'ios-needs-install' : 'unsupported'
  }
  return platform() === 'ios' && !isStandalone() ? 'ios-needs-install' : 'supported'
}

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  'Notification' in window ? Notification.permission : 'unsupported'

/** The registration, or null when there is no service worker (dev builds, first load). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const ready = navigator.serviceWorker.ready
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
  return Promise.race([ready, timeout])
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  return (await (await registration())?.pushManager.getSubscription()) ?? null
}

export async function fetchVapidKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/config', { credentials: 'same-origin' })
    if (!res.ok) return null
    return ((await res.json()) as AppConfig).vapidPublicKey
  } catch {
    return null
  }
}

/** The VAPID public key (base64url) as the bytes `subscribe` wants. */
export function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function send(method: 'POST' | 'DELETE', subscription: PushSubscription): Promise<boolean> {
  try {
    const res = await fetch('/api/push/subscribe', {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        method === 'POST'
          ? { ...subscription.toJSON(), userAgent: navigator.userAgent }
          : { endpoint: subscription.endpoint },
      ),
    })
    return res.ok
  } catch {
    return false
  }
}

export type EnableResult =
  | 'enabled'
  | 'denied'
  | 'unsupported'
  | 'not-configured'
  | 'offline'
  | 'failed'

/**
 * Ask for permission and subscribe this device. Call it straight from a click: the
 * permission prompt must be a user gesture (iOS), so it is the first await here.
 */
export async function enablePush(): Promise<EnableResult> {
  if (pushSupport() !== 'supported') return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  if (!navigator.onLine) return 'offline'
  const key = await fetchVapidKey()
  if (!key) return 'not-configured'
  const reg = await registration()
  if (!reg) return 'unsupported'
  try {
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBytes(key),
      }))
    return (await send('POST', subscription)) ? 'enabled' : 'failed'
  } catch {
    return 'failed'
  }
}

/** Unsubscribe this device (server row first, then the browser). */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await send('DELETE', subscription)
  await subscription.unsubscribe().catch(() => false)
}

/**
 * On app start: if permission was granted, make sure a subscription exists and the
 * server has it for the signed-in user (also moves it over after an account switch).
 */
export async function ensureSubscription(): Promise<void> {
  if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return
  if (!navigator.onLine) return
  const key = await fetchVapidKey()
  const reg = await registration()
  if (!key || !reg) return
  try {
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBytes(key),
      }))
    await send('POST', subscription)
  } catch {
    // Retry on the next start.
  }
}

/** Sign-out: stop pushes to this browser for the account that is leaving. */
export async function releaseSubscription(): Promise<void> {
  if (pushSupport() !== 'supported' || !navigator.onLine) return
  await disablePush().catch(() => undefined)
}
