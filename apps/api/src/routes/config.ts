import type { AppConfig } from '@stryde/shared'
import { Hono } from 'hono'
import { env } from '../env'
import { pushEnabled } from '../services/push'

/** Public client configuration: the VAPID public key (null when push isn't set up). */
export const configRoute = new Hono().get('/', (c) =>
  c.json<AppConfig>({ vapidPublicKey: pushEnabled() ? (env.vapidPublicKey ?? null) : null }),
)
