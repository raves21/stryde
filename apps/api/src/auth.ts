import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import {
  isValidUsername,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '@stryde/shared'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { username } from 'better-auth/plugins'
import { db } from './db/client'
import * as schema from './db/schema'
import { env } from './env'
import { createDefaultUserSettings } from './services/user-settings'

const DAY = 60 * 60 * 24

const google =
  env.googleClientId && env.googleClientSecret
    ? {
        google: {
          clientId: env.googleClientId,
          clientSecret: env.googleClientSecret,
          redirectURI: `${env.publicUrl}/api/auth/callback/google`,
        },
      }
    : undefined

export const auth = betterAuth({
  baseURL: env.publicUrl,
  basePath: '/api/auth',
  secret: env.betterAuthSecret,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    // No SMTP in v1 (PRODUCT_SPEC.md §3).
    requireEmailVerification: false,
  },
  socialProviders: google,
  plugins: [
    username({
      minUsernameLength: USERNAME_MIN_LENGTH,
      maxUsernameLength: USERNAME_MAX_LENGTH,
      usernameValidator: isValidUsername,
      validationOrder: { username: 'post-normalization' },
      displayUsername: false,
    }),
  ],
  session: {
    expiresIn: 60 * DAY,
    // Rolling: extend the session when used more than a day after the last refresh.
    updateAge: DAY,
  },
  rateLimit: {
    enabled: env.isProduction || process.env.AUTH_RATE_LIMIT === '1',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/*': { window: 60, max: 10 },
      '/sign-up/*': { window: 60, max: 5 },
    },
  },
  advanced: {
    database: { generateId: 'uuid' },
    useSecureCookies: env.isProduction,
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: env.isProduction },
  },
  hooks: {
    // Email sign-ups must pick a username up front; only Google users onboard without one.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return
      const body: unknown = ctx.body
      const value =
        typeof body === 'object' && body !== null && 'username' in body ? body.username : undefined
      if (typeof value !== 'string' || value.trim() === '') {
        throw new APIError('BAD_REQUEST', { message: 'Username is required' })
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await createDefaultUserSettings(db, user.id)
        },
      },
    },
  },
})

export type AuthSession = typeof auth.$Infer.Session
