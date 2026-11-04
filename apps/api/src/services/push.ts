import type { PushPayload } from '@stryde/shared'
import webpush from 'web-push'
import { env } from '../env'

// Web Push delivery (DATA_MODEL_AND_SYNC.md §3 push_subscriptions). Payloads are
// encrypted by `web-push` and go through the browser vendor's push service.

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string }

/** `gone`: the push service says the subscription no longer exists (404/410). */
export type PushResult = 'sent' | 'gone' | 'failed'

export type PushSender = (
  subscription: StoredSubscription,
  payload: PushPayload,
  options: { ttlSeconds: number },
) => Promise<PushResult>

export const pushEnabled = () =>
  Boolean(env.vapidPublicKey && env.vapidPrivateKey && env.vapidSubject)

const webPushSender: PushSender = async (sub, payload, { ttlSeconds }) => {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      {
        TTL: ttlSeconds,
        vapidDetails: {
          subject: env.vapidSubject ?? '',
          publicKey: env.vapidPublicKey ?? '',
          privateKey: env.vapidPrivateKey ?? '',
        },
      },
    )
    return 'sent'
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'gone'
    console.error('web push failed', status ?? error)
    return 'failed'
  }
}

let sender: PushSender = webPushSender

/** Swap the delivery function (tests); returns a restore function. */
export function setPushSender(next: PushSender): () => void {
  const previous = sender
  sender = next
  return () => {
    sender = previous
  }
}

export const sendPush: PushSender = (sub, payload, options) => sender(sub, payload, options)
